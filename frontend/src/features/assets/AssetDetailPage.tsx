import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { Btn, Card, Empty } from "../../components/ui";
import { ApiError, errorMessage } from "../../lib/api";
import { T } from "../../theme";
import type { Asset } from "../../types";
import { AssetDetail } from "./AssetDetail";
import { assetApi } from "./api";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; asset: Asset };

/* Asset detail backed by the API: loads the full record (custody history, activity, signature
   links) and sends each action to the server. The screen updates from the server's answer. */
export function AssetDetailPage({ ctx, assetId, reqs, auditLog, notify, onChanged }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });

  const fetchAsset = useCallback(async () => {
    setLoad({ status: "loading" });
    try {
      setLoad({ status: "ready", asset: await assetApi.get(assetId) });
    } catch (err) {
      setLoad({ status: "error", message: err instanceof ApiError && err.status === 404 ? "Asset not found." : errorMessage(err) });
    }
  }, [assetId]);

  useEffect(() => { fetchAsset(); }, [fetchAsset]);

  /* Runs one action. Resolves true when it succeeded, so the dialog can close; on failure the
     dialog stays open with what was entered. A conflict means the asset changed meanwhile. */
  async function act(work: () => Promise<Asset>, done: string): Promise<boolean> {
    try {
      const updated = await work();
      setLoad({ status: "ready", asset: updated });
      onChanged(updated);
      notify(done);
      return true;
    } catch (err) {
      notify(errorMessage(err), "error");
      if (err instanceof ApiError && err.status === 409) {
        assetApi.get(assetId).then((a) => { setLoad({ status: "ready", asset: a }); onChanged(a); }).catch(() => {});
      }
      return false;
    }
  }

  if (load.status !== "ready") {
    return (
      <div className="space-y-4">
        <button onClick={() => ctx.go("assets")} className="-ml-1 flex items-center gap-0.5 rounded px-1 text-[13px] font-medium hover:underline" style={{ color: T.sub }}><ChevronLeft size={15} />Assets</button>
        <Card>
          {load.status === "loading" ? <Empty msg="Loading asset…" /> : (
            <div className="py-6 text-center">
              <div className="text-sm" style={{ color: T.bad }}>{load.message}</div>
              <div className="mt-3"><Btn size="sm" kind="secondary" icon={RefreshCw} onClick={fetchAsset}>Try again</Btn></div>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const a = load.asset;
  return (
    <AssetDetail ctx={ctx} a={a} reqs={reqs} auditLog={auditLog}
      onIssue={(d) => act(() => assetApi.issue(a.id, d), d.method === "signature" ? "Handover recorded" : "Sent for acceptance")}
      onAccept={() => act(() => assetApi.accept(a.id), "Receipt confirmed")}
      onReturn={(d) => act(() => assetApi.recordReturn(a.id, d), d.missing.length ? "Return recorded with missing items" : "Return recorded")}
      onAddAccessory={(acc) => act(() => assetApi.addAccessory(a.id, acc), "Accessory added")}
      onDispose={(reason, scrap) => act(() => assetApi.dispose(a.id, reason, scrap), "Asset written off")} />
  );
}
