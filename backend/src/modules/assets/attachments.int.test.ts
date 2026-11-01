import request from "supertest";
import type { Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { createApp } from "../../app.js";
import { createTestApp, signIn } from "../../test/test-app.js";
import { openTestDatabase, testDbEnv } from "../../test/test-db.js";
import { createMemoryStorage, createUnconfiguredStorage } from "../files/storage.js";

const env = testDbEnv();

/* Seeded people. These tests work in JCB CSN (D_JCB_CSN), which no other test file uses. */
const IT_HEAD = "RPW-EMP-0012";    // U_SUNIL: adds and removes attachments
const GM_FINANCE = "RPW-EMP-0007"; // U_SUJAY: may dispose (grant)
const BH_JCS = "RPW-EMP-0040";     // U_PRA: Business Head of JCB CSN, sees but cannot attach
const BH_NSK = "RPW-EMP-0052";     // U_SAM: Business Head elsewhere

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");

describe.skipIf(!env)("asset attachments API (test database)", () => {
  let sequelize: Sequelize;
  let app: ReturnType<typeof createApp>;
  const storage = createMemoryStorage();
  const as: Record<string, string> = {};
  const get = (who: string, path: string) => request(app).get(path).set("Cookie", as[who]);
  const post = (who: string, path: string, body: object = {}) => request(app).post(path).set("Cookie", as[who]).send(body);
  const attach = (who: string, id: string, query: Record<string, string>, bytes: Buffer, type = "application/octet-stream", to = app) =>
    request(to).post(`/api/assets/${id}/attachments`).query(query).set("Cookie", as[who]).set("Content-Type", type).send(bytes);

  const addAsset = async (name: string) => {
    const res = await post(IT_HEAD, "/api/assets", {
      category: "Diagnostic Equipment", name, cost: 90000, dealershipId: "D_JCB_CSN", facilityId: "F07",
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };

  beforeAll(async () => {
    sequelize = openTestDatabase(env!);
    app = createTestApp(sequelize, {}, storage);
    for (const code of [IT_HEAD, GM_FINANCE, BH_JCS, BH_NSK]) as[code] = await signIn(app, code);
  });
  afterAll(() => sequelize?.close());

  describe("adding, viewing and removing", () => {
    let id: string;
    beforeAll(async () => { id = await addAsset("Attachment Scanner"); });

    it("starts with no attachments", async () => {
      expect((await get(IT_HEAD, `/api/assets/${id}`)).body.attachments).toEqual([]);
    });

    it("stores a photo, records it and answers with the asset", async () => {
      const before = storage.objects.size;
      const res = await attach(IT_HEAD, id, { kind: "photo", name: "front.jpg", caption: "Front panel" }, JPEG, "image/jpeg");
      expect(res.status).toBe(201);
      expect(res.body.attachments).toHaveLength(1);
      expect(res.body.attachments[0]).toMatchObject({
        kind: "photo", fileName: "front.jpg", contentType: "image/jpeg", sizeBytes: JPEG.length,
        caption: "Front panel", addedBy: "U_SUNIL",
      });
      expect(res.body.attachments[0].url).toMatch(/^memory:\/\/signed\/attachments\/.+\.jpg$/);
      expect(res.body.activity[0]).toMatchObject({ actorId: "U_SUNIL", action: "Attached photo", detail: "front.jpg · Front panel" });
      expect(storage.objects.size).toBe(before + 1);
    });

    it("takes the type from the bytes, not the label the client sends", async () => {
      const res = await attach(IT_HEAD, id, { kind: "invoice", name: "invoice.pdf" }, PDF, "image/png");
      expect(res.status).toBe(201);
      expect(res.body.attachments.map((x: { kind: string }) => x.kind)).toEqual(["photo", "invoice"]);
      expect(res.body.attachments[1]).toMatchObject({ contentType: "application/pdf", caption: "" });
    });

    it("refuses bad files and requests without uploading anything", async () => {
      const before = storage.objects.size;
      const notAFile = await attach(IT_HEAD, id, { kind: "document", name: "page.html" }, Buffer.from("<html></html>"));
      expect(notAFile.status).toBe(400);
      expect(notAFile.body.error.details[0]).toMatchObject({ path: "file" });
      expect((await attach(IT_HEAD, id, { kind: "photo", name: "scan.pdf" }, PDF)).status).toBe(400);
      const badKind = await attach(IT_HEAD, id, { kind: "selfie", name: "a.jpg" }, JPEG);
      expect(badKind.status).toBe(400);
      expect(badKind.body.error.details[0]).toMatchObject({ location: "query", path: "kind" });
      expect((await attach(IT_HEAD, id, { kind: "photo" }, JPEG)).status).toBe(400);
      expect(storage.objects.size).toBe(before);
    });

    it("cleans the file name it keeps as a label", async () => {
      const res = await attach(IT_HEAD, id, { kind: "document", name: "../../etc/manual.pdf" }, PDF);
      expect(res.status).toBe(201);
      expect(res.body.attachments[2].fileName).toBe(".._.._etc_manual.pdf");
    });

    it("lets people who can see the asset view attachments, but not add them", async () => {
      const seen = await get(BH_JCS, `/api/assets/${id}`);
      expect(seen.status).toBe(200);
      expect(seen.body.attachments).toHaveLength(3);
      expect(seen.body.attachments[0].url).toMatch(/^memory:/);
      expect((await attach(BH_JCS, id, { kind: "photo", name: "b.jpg" }, JPEG)).status).toBe(403);
      expect((await get(BH_NSK, `/api/assets/${id}`)).status).toBe(404);
    });

    it("answers 404 for an asset that does not exist", async () => {
      expect((await attach(IT_HEAD, "00000000-0000-4000-8000-000000000000", { kind: "photo", name: "a.jpg" }, JPEG)).status).toBe(404);
    });

    it("hides a removed attachment but keeps the file and the record", async () => {
      const shown = (await get(IT_HEAD, `/api/assets/${id}`)).body.attachments;
      const target = shown[2];
      const path = `/api/assets/${id}/attachments/${target.id}/remove`;
      const before = storage.objects.size;

      expect((await post(BH_JCS, path)).status).toBe(403);
      const res = await post(IT_HEAD, path);
      expect(res.status).toBe(200);
      expect(res.body.attachments.map((x: { id: string }) => x.id)).toEqual([shown[0].id, shown[1].id]);
      expect(res.body.activity[0]).toMatchObject({ actorId: "U_SUNIL", action: "Removed attachment", detail: "document · .._.._etc_manual.pdf" });
      expect(storage.objects.size).toBe(before);

      expect((await post(IT_HEAD, path)).status).toBe(404);
      const [[row]] = await sequelize.query(
        `SELECT removed_by, removed_at IS NOT NULL AS removed FROM "${env!.DATABASE_SCHEMA}".asset_attachments WHERE id = $1`,
        { bind: [target.id] },
      ) as [{ removed_by: string; removed: boolean }[], unknown];
      expect(row).toEqual({ removed_by: "U_SUNIL", removed: true });
    });

    it("does not remove another asset's attachment", async () => {
      const other = await addAsset("Attachment Other");
      const attachmentId = (await get(IT_HEAD, `/api/assets/${id}`)).body.attachments[0].id;
      expect((await post(IT_HEAD, `/api/assets/${other}/attachments/${attachmentId}/remove`)).status).toBe(404);
    });
  });

  it("still accepts papers on a disposed asset", async () => {
    const id = await addAsset("Attachment Scrap");
    expect((await post(GM_FINANCE, `/api/assets/${id}/dispose`, { reason: "Beyond repair" })).status).toBe(200);
    const res = await attach(IT_HEAD, id, { kind: "document", name: "scrap-certificate.pdf" }, PDF);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("disposed");
    expect(res.body.attachments).toHaveLength(1);
  });

  it("answers 503 and saves nothing when Storage is not configured", async () => {
    const id = await addAsset("Attachment No Storage");
    const noStorage = createTestApp(sequelize, {}, createUnconfiguredStorage());
    const res = await attach(IT_HEAD, id, { kind: "photo", name: "a.jpg" }, JPEG, "image/jpeg", noStorage);
    expect(res.status).toBe(503);
    expect((await get(IT_HEAD, `/api/assets/${id}`)).body.attachments).toEqual([]);
  });
});
