import { useState } from "react";
import {
  Search, FileText,
} from "lucide-react";
import { Card, SectionTitle } from "../../components/ui";
import { LIMITS } from "../../domain/config";
import { readInvoiceAssets } from "./invoiceReader";
import { inrFull, inrShort } from "../../lib/format";
import { T } from "../../theme";

/* Capture-first entry: photograph the invoice, then fill the gaps */
export function InvoiceScanner({ onFill, compact }: { onFill: (item: any, meta: any) => void; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [doc, setDoc] = useState(null);
  const [items, setItems] = useState(null);
  const [meta, setMeta] = useState(null);

  async function handle(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr(null); setItems(null); setBusy(true);
    const url = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f); });
    setDoc({ url, name: f.name, type: f.type });
    try {
      const out = await readInvoiceAssets(f);
      const list = (out.items || []).filter((x) => x && x.name);
      setMeta({ vendor: out.vendor, invoiceNo: out.invoiceNo, invoiceDate: out.invoiceDate, total: out.total });
      setItems(list);
      if (list.length === 1) {
        onFill(list[0], { ...out, fileName: f.name, fileUrl: url, fileType: f.type });
      }
    } catch {
      setErr("Could not read that image. Try a straighter, better-lit photo — or just fill the form in by hand.");
    }
    setBusy(false);
  }

  return (
    <Card className={compact ? "" : "mb-4"}>
      <SectionTitle icon={FileText}>Start from the invoice</SectionTitle>
      <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
        Photograph or upload the invoice and the fields below fill themselves. Anything not printed on it, you enter by hand.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold"
          style={{ border: "1px dashed " + T.line, color: T.primary, background: "#fff" }}>
          <Search size={16} />Take photo
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
        </label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold"
          style={{ border: "1px dashed " + T.line, color: T.primary, background: "#fff" }}>
          <FileText size={16} />Upload file
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handle} />
        </label>
      </div>

      {busy && <div className="mt-3 text-[13px]" style={{ color: T.sub }}>Reading the invoice…</div>}
      {err && <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: T.warnBg, color: T.warn }}>{err}</div>}

      {doc && !busy && (
        <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: T.canvas }}>
          {doc.type?.startsWith("image")
            ? <img src={doc.url} alt="Invoice" style={{ height: 40, width: 40, objectFit: "cover", borderRadius: 4 }} />
            : <FileText size={18} style={{ color: T.sub }} />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold">{doc.name}</div>
            {meta && <div className="truncate text-[11px]" style={{ color: T.sub }}>
              {meta.vendor || "Vendor not read"}{meta.invoiceNo ? ` · ${meta.invoiceNo}` : ""}{meta.total != null ? ` · ${inrFull(meta.total)}` : ""}
            </div>}
          </div>
        </div>
      )}

      {items && items.length > 1 && (
        <div className="mt-3">
          <div className="text-xs font-bold" style={{ color: T.sub }}>{items.length} items on this invoice — pick the one to record</div>
          <div className="mt-2 space-y-1.5">
            {items.map((it, i) => (
              <button key={i} onClick={() => onFill(it, { ...meta, fileName: doc.name, fileUrl: doc.url, fileType: doc.type })}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left" style={{ background: T.canvas }}>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{it.name}</span>
                  <span className="block truncate text-[11px]" style={{ color: T.sub }}>
                    {[it.make, it.model].filter(Boolean).join(" ") || "—"}{it.serial ? ` · ${it.serial}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-semibold">{it.unitCost != null ? inrShort(it.unitCost) : "—"}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px]" style={{ color: T.sub }}>Record them one at a time — each becomes its own asset with its own code.</p>
        </div>
      )}

      {items && items.length === 0 && (
        <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: T.warnBg, color: T.warn }}>
          No product lines found on that document. Fill the form in by hand.
        </div>
      )}
    </Card>
  );
}

export function InvoiceUpload({ r, onExtract }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [data, setData] = useState(null);

  async function handle(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setErr(null); setData(null); setBusy(true);
    const url = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f); });
    setPreview({ url, name: f.name, type: f.type });
    try {
      const out = await readInvoiceAssets(f);
      setData(out);
      onExtract({ ...out, fileName: f.name, fileUrl: url, fileType: f.type });
    } catch {
      setErr("Could not read the invoice automatically. Enter the figures below by hand — the file is still attached.");
      onExtract({ fileName: f.name, fileUrl: url, fileType: f.type, failed: true });
    }
    setBusy(false);
  }

  const variance = data?.total ? ((data.total - r.estCost) / r.estCost) * 100 : null;
  return (
    <div className="rounded-lg p-3" style={{ background: T.canvas }}>
      <div className="text-sm font-semibold">Purchase invoice</div>
      <p className="mt-0.5 text-[12px]" style={{ color: T.sub }}>
        Attach the vendor invoice. The amount is read from it and checked against the approved estimate of {inrFull(r.estCost)}.
      </p>
      <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold"
        style={{ border: "1px dashed " + T.line, background: "#fff", color: T.primary }}>
        <FileText size={16} />{file ? "Replace invoice" : "Upload invoice (PDF or photo)"}
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handle} />
      </label>

      {busy && <div className="mt-2 text-[12px]" style={{ color: T.sub }}>Reading the invoice…</div>}
      {err && <div className="mt-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: T.warnBg, color: T.warn }}>{err}</div>}

      {preview && !busy && (
        <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "#fff", border: "1px solid " + T.line }}>
          {preview.type?.startsWith("image") ? (
            <img src={preview.url} alt="Invoice" style={{ height: 44, width: 44, objectFit: "cover", borderRadius: 4 }} />
          ) : <FileText size={20} style={{ color: T.sub }} />}
          <span className="min-w-0 flex-1 truncate text-[12px]">{preview.name}</span>
        </div>
      )}

      {data && (
        <div className="mt-2 space-y-2">
          <div className="rounded-lg p-3" style={{ background: "#fff", border: "1px solid " + T.line }}>
            <div className="text-xs font-bold" style={{ color: T.sub }}>Read from the invoice</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
              <dt style={{ color: T.sub }}>Vendor</dt><dd className="text-right font-semibold">{data.vendor || "—"}</dd>
              <dt style={{ color: T.sub }}>Invoice no.</dt><dd className="text-right font-mono">{data.invoiceNo || "—"}</dd>
              <dt style={{ color: T.sub }}>Date</dt><dd className="text-right">{data.invoiceDate || "—"}</dd>
              {data.subtotal != null && <><dt style={{ color: T.sub }}>Subtotal</dt><dd className="text-right">{inrFull(data.subtotal)}</dd></>}
              {data.tax != null && <><dt style={{ color: T.sub }}>GST</dt><dd className="text-right">{inrFull(data.tax)}</dd></>}
              <dt className="font-semibold">Total</dt><dd className="text-right font-bold">{data.total != null ? inrFull(data.total) : "—"}</dd>
            </dl>
            {data.items?.length > 0 && (
              <div className="mt-2 rounded-lg px-2 py-1.5 text-[11px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
                {data.items.length} product line{data.items.length > 1 ? "s" : ""} read — the asset entries below have been filled in.
              </div>
            )}
            <p className="mt-2 text-[11px]" style={{ color: T.sub }}>Check these against the paper before saving — correct anything that is wrong.</p>
          </div>

          {variance != null && (
            <div className="rounded-lg px-3 py-2 text-[12px]"
              style={Math.abs(variance) <= LIMITS.variancePct ? { background: T.okBg, color: T.ok } : { background: T.badBg, color: T.bad }}>
              {Math.abs(variance) <= LIMITS.variancePct
                ? `Reconciles with the approved estimate — ${variance >= 0 ? "+" : ""}${variance.toFixed(1)}% against ${inrFull(r.estCost)}.`
                : `Invoice is ${variance > 0 ? "over" : "under"} the approved estimate by ${Math.abs(variance).toFixed(1)}% (${inrFull(Math.abs(data.total - r.estCost))}). ${variance > LIMITS.variancePct ? "Payment will need Director re-approval." : ""}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
