import { useState } from "react";
import { Camera, FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { Btn, Card, Empty, Field, Modal, SectionTitle, inputCls, inputStyle } from "../../components/ui";
import { fmtDate, inrFull } from "../../lib/format";
import { T } from "../../theme";
import type { Asset, Attachment, AttachmentKind } from "../../types";
import { ATTACHMENT_ACCEPT, ATTACHMENT_KIND_LABEL, attachmentName, fileSize, prepareAttachment } from "./attachments";

/* Invoices, photos and documents kept with the asset, plus the invoice details read when it was
   added. Links are signed for 10 minutes; AssetDetailPage reloads the asset before they expire.
   Handlers resolve true on success, so dialogs close only then. */
export function AttachmentsCard({ a, U, canEdit, onAdd, onRemove }: {
  a: Asset;
  U: (id: string) => { name: string } | undefined;
  canEdit: boolean;
  onAdd: (file: Blob, d: { kind: AttachmentKind; name: string; caption: string }) => Promise<boolean>;
  onRemove: (attachmentId: string) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Attachment | null>(null);
  const [busy, setBusy] = useState(false);
  const list = a.attachments ?? [];
  const inv = a.invoiceDoc;
  const invoiceLine = inv && [inv.vendor, inv.invoiceNo && `No. ${inv.invoiceNo}`, inv.invoiceDate && fmtDate(inv.invoiceDate), inv.total != null && inrFull(inv.total)]
    .filter(Boolean).join(" · ");

  async function run(work: () => Promise<boolean>, close: () => void) {
    setBusy(true);
    try {
      if (await work()) close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle icon={Paperclip}>Attachments ({list.length})</SectionTitle>
        {canEdit && <Btn size="sm" kind="secondary" icon={Plus} onClick={() => setAdding(true)}>Add photo / document</Btn>}
      </div>
      <p className="mt-1 text-[13px]" style={{ color: T.sub }}>Invoice, photos of the asset and its papers. Visible to everyone who can see the asset.</p>

      {invoiceLine && (
        <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: T.canvas }}>
          <span className="font-semibold">Invoice details: </span>{invoiceLine}
        </div>
      )}

      {list.length === 0 ? <Empty msg="No invoice, photos or documents attached yet." /> : (
        <div className="mt-3 space-y-2">
          {list.map((x) => (
            <div key={x.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: T.canvas }}>
              <Thumb x={x} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {x.url
                    ? <a href={x.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-semibold hover:underline" style={{ color: T.primary }}>{x.fileName}</a>
                    : <span className="truncate text-sm font-semibold">{x.fileName}</span>}
                  <span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: T.sub, background: T.slateBg }}>{ATTACHMENT_KIND_LABEL[x.kind]}</span>
                </div>
                {x.caption && <div className="text-[12px]" style={{ color: T.ink }}>{x.caption}</div>}
                <div className="text-[11px]" style={{ color: T.sub }}>
                  {U(x.addedBy)?.name ?? x.addedBy} · {fmtDate(x.addedAt)} · {fileSize(x.sizeBytes)}{!x.url ? " · link unavailable, reload the page" : ""}
                </div>
              </div>
              {canEdit && (
                <button onClick={() => setRemoving(x)} aria-label={`Remove ${x.fileName}`} className="shrink-0 rounded-md p-1.5 hover:bg-black/[0.05]" style={{ color: T.sub }}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && <AttachmentModal busy={busy} onClose={() => setAdding(false)}
        onSubmit={(file, d) => run(() => onAdd(file, d), () => setAdding(false))} />}
      {removing && (
        <Modal title="Remove attachment" onClose={() => setRemoving(null)}
          footer={<><Btn kind="ghost" full onClick={() => setRemoving(null)}>Cancel</Btn>
            <Btn kind="danger" full disabled={busy} onClick={() => run(() => onRemove(removing.id), () => setRemoving(null))}>Remove</Btn></>}>
          <p className="text-[13px]">
            <b>{removing.fileName}</b> will no longer show on this asset. The file and who removed it stay on record in the audit trail.
          </p>
        </Modal>
      )}
    </Card>
  );
}

function Thumb({ x }: { x: Attachment }) {
  const box = "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded";
  if (x.url && x.contentType.startsWith("image/")) {
    return (
      <a href={x.url} target="_blank" rel="noopener noreferrer" className={box} style={{ background: "#fff", border: "1px solid " + T.line }}>
        <img src={x.url} alt={x.caption || x.fileName} className="h-full w-full object-cover" />
      </a>
    );
  }
  return <div className={box} style={{ background: "#fff", border: "1px solid " + T.line, color: T.sub }}><FileText size={20} /></div>;
}

function AttachmentModal({ busy, onClose, onSubmit }: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (file: Blob, d: { kind: AttachmentKind; name: string; caption: string }) => void;
}) {
  const [kind, setKind] = useState<AttachmentKind>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f); setErr(null);
    if (f.type === "application/pdf" && kind === "photo") setKind("document");
  }

  async function save() {
    setPreparing(true); setErr(null);
    try {
      const ready = await prepareAttachment(file, kind);
      onSubmit(ready, { kind, name: attachmentName(file, ready), caption });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPreparing(false);
    }
  }

  const picker = "flex cursor-pointer items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold";
  return (
    <Modal title="Add photo or document" onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn>
        <Btn full disabled={!file || busy || preparing} onClick={save}>{busy || preparing ? "Uploading…" : "Attach"}</Btn></>}>
      <div className="space-y-3">
        <Field label="What is it?">
          <select className={inputCls} style={inputStyle} value={kind} onChange={(e) => setKind(e.target.value as AttachmentKind)}>
            <option value="photo">Photo of the asset</option>
            <option value="invoice">Invoice</option>
            <option value="document">Other document (warranty card, manual, certificate…)</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <label className={picker} style={{ border: "1px dashed " + T.line, color: T.primary, background: "#fff" }}>
            <Camera size={16} />Take photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
          </label>
          <label className={picker} style={{ border: "1px dashed " + T.line, color: T.primary, background: "#fff" }}>
            <FileText size={16} />Choose file
            <input type="file" accept={ATTACHMENT_ACCEPT} className="hidden" onChange={pick} />
          </label>
        </div>
        {file && (
          <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.canvas }}>
            <span className="font-semibold">{file.name}</span> · {fileSize(file.size)}
            {file.type.startsWith("image/") && <span style={{ color: T.sub }}> · large photos are reduced before upload</span>}
          </div>
        )}
        <Field label="Caption (optional)">
          <input className={inputCls} style={inputStyle} value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Serial plate, front view" />
        </Field>
        <p className="text-[11px]" style={{ color: T.sub }}>JPEG, PNG, WebP or PDF, up to 4 MB.</p>
        {err && <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.badBg, color: T.bad }}>{err}</div>}
      </div>
    </Modal>
  );
}
