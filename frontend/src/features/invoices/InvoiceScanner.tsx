import { useState } from "react";
import {
  Search, FileText, Sparkles,
} from "lucide-react";
import { Btn, Card, SectionTitle } from "../../components/ui";
import { LIMITS } from "../../domain/config";
import { errorMessage } from "../../lib/api";
import { readInvoiceAssets, useInvoiceReading, type ExtractedInvoice, type InvoiceReadingStatus } from "./invoiceReader";
import { inrFull, inrShort } from "../../lib/format";
import { T } from "../../theme";

const readFailed = (err: unknown) => `${errorMessage(err)} The file is still attached.`;

/* Attaching the file and reading it are separate steps: reading costs money, so it runs only
   when someone asks for it, and only where the server has it set up (decision D6). */
function useAttachedInvoice() {
  const status = useInvoiceReading();
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function attach(e, onAttached: (meta) => void) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const url = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f); });
    const meta = { url, name: f.name, type: f.type };
    setFile(f); setDoc(meta); setErr(null);
    onAttached({ fileName: f.name, fileUrl: url, fileType: f.type, file: f });
  }

  async function read(): Promise<ExtractedInvoice | null> {
    if (!file || !status?.aiReading) return null;
    setBusy(true); setErr(null);
    try {
      return await readInvoiceAssets(file, status as InvoiceReadingStatus);
    } catch (e) {
      setErr(readFailed(e));
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { status, file, doc, busy, err, attach, read };
}

function ReadButton({ status, busy, onRead }) {
  if (!status) return null;
  if (!status.aiReading) {
    return <div className="mt-2 text-[11px]" style={{ color: T.sub }}>Automatic reading is not set up. Enter the details from the invoice by hand.</div>;
  }
  return (
    <div className="mt-2">
      <Btn kind="secondary" size="sm" icon={Sparkles} disabled={busy} onClick={onRead}>{busy ? "Reading the invoice…" : "Read with AI"}</Btn>
      <span className="ml-2 text-[11px]" style={{ color: T.sub }}>Optional. Check every field before saving.</span>
    </div>
  );
}

function DocChip({ doc, meta = null, background = T.canvas }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background, border: background === "#fff" ? "1px solid " + T.line : undefined }}>
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
  );
}

/* Capture-first entry for one asset: attach the invoice, optionally read it, fill the gaps */
export function InvoiceScanner({ onFill, onAttach, compact }: { onFill: (item: any, meta: any) => void; onAttach?: (meta: any) => void; compact?: boolean }) {
  const inv = useAttachedInvoice();
  const [items, setItems] = useState(null);
  const [meta, setMeta] = useState(null);

  async function handle(e) {
    setItems(null); setMeta(null);
    await inv.attach(e, (m) => onAttach?.(m));
  }
  async function read() {
    const out = await inv.read();
    if (!out) return;
    const list = out.items.filter((x) => x && x.name);
    const m = { vendor: out.vendor, invoiceNo: out.invoiceNo, invoiceDate: out.invoiceDate, total: out.total };
    setMeta(m); setItems(list);
    const file = { fileName: inv.doc.name, fileUrl: inv.doc.url, fileType: inv.doc.type };
    if (list.length === 1) onFill(list[0], { ...out, ...file });
  }

  return (
    <Card className={compact ? "" : "mb-4"}>
      <SectionTitle icon={FileText}>Start from the invoice</SectionTitle>
      <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
        Photograph or upload the invoice: it is saved with the asset.
        {inv.status?.aiReading ? " You can let AI read it to fill the fields below." : ""} Anything not printed on it, you enter by hand.
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

      {inv.doc && <DocChip doc={inv.doc} meta={meta} />}
      {inv.doc && !items && <ReadButton status={inv.status} busy={inv.busy} onRead={read} />}
      {inv.err && <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: T.warnBg, color: T.warn }}>{inv.err}</div>}

      {items && items.length > 1 && (
        <div className="mt-3">
          <div className="text-xs font-semibold" style={{ color: T.sub }}>{items.length} items on this invoice — pick the one to record</div>
          <div className="mt-2 space-y-1.5">
            {items.map((it, i) => (
              <button key={i} onClick={() => onFill(it, { ...meta, fileName: inv.doc.name, fileUrl: inv.doc.url, fileType: inv.doc.type })}
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

      {items && items.length === 1 && (
        <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
          Fields marked “from invoice” were read from it. Check them against the paper before saving.
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

/* The purchase invoice when recording a requisition's procurement */
export function InvoiceUpload({ r, onExtract }) {
  const inv = useAttachedInvoice();
  const [data, setData] = useState<ExtractedInvoice | null>(null);

  async function handle(e) {
    setData(null);
    await inv.attach(e, (m) => onExtract(m));
  }
  async function read() {
    const out = await inv.read();
    if (!out) return;
    setData(out);
    onExtract({ ...out, fileName: inv.doc.name, fileUrl: inv.doc.url, fileType: inv.doc.type });
  }

  const variance = data?.total ? ((data.total - r.estCost) / r.estCost) * 100 : null;
  return (
    <div className="rounded-lg p-3" style={{ background: T.canvas }}>
      <div className="text-sm font-semibold">Purchase invoice</div>
      <p className="mt-0.5 text-[12px]" style={{ color: T.sub }}>
        Attach the vendor invoice and check its amount against the approved estimate of {inrFull(r.estCost)}.
      </p>
      <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold"
        style={{ border: "1px dashed " + T.line, background: "#fff", color: T.primary }}>
        <FileText size={16} />{inv.file ? "Replace invoice" : "Upload invoice (PDF or photo)"}
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handle} />
      </label>

      {inv.doc && <DocChip doc={inv.doc} background="#fff" />}
      {inv.doc && !data && <ReadButton status={inv.status} busy={inv.busy} onRead={read} />}
      {inv.err && <div className="mt-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: T.warnBg, color: T.warn }}>{inv.err}</div>}

      {data && (
        <div className="mt-2 space-y-2">
          <div className="rounded-lg p-3" style={{ background: "#fff", border: "1px solid " + T.line }}>
            <div className="text-xs font-semibold" style={{ color: T.sub }}>Read from the invoice</div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
              <dt style={{ color: T.sub }}>Vendor</dt><dd className="text-right font-semibold">{data.vendor || "—"}</dd>
              <dt style={{ color: T.sub }}>Invoice no.</dt><dd className="text-right font-mono">{data.invoiceNo || "—"}</dd>
              <dt style={{ color: T.sub }}>Date</dt><dd className="text-right">{data.invoiceDate || "—"}</dd>
              {data.subtotal != null && <><dt style={{ color: T.sub }}>Subtotal</dt><dd className="text-right">{inrFull(data.subtotal)}</dd></>}
              {data.tax != null && <><dt style={{ color: T.sub }}>GST</dt><dd className="text-right">{inrFull(data.tax)}</dd></>}
              <dt className="font-semibold">Total</dt><dd className="text-right font-semibold">{data.total != null ? inrFull(data.total) : "—"}</dd>
            </dl>
            {data.items?.length > 0 && (
              <div className="mt-2 rounded-lg px-2 py-1.5 text-[11px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
                {data.items.length} product line{data.items.length > 1 ? "s" : ""} read — the asset entries below have been filled in, one per unit.
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
