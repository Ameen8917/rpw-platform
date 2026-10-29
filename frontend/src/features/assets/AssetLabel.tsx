import { useState } from "react";
import {
  FileText,
} from "lucide-react";
import { Barcode } from "../../components/Barcode";
import { Btn, Field, Modal } from "../../components/ui";
import { LABEL_SIZES, fyOf } from "../../domain/assets";
import { T } from "../../theme";

export function AssetLabel({ a, ctx, size = "standard" }) {
  const { D, F } = ctx;
  const S = LABEL_SIZES[size];
  const encoded = S.full ? a.code : a.tagId;
  return (
    <div style={{ border: "1px solid #000", background: "#fff", padding: size === "micro" ? 4 : 7, width: S.width }}>
      {S.detail ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 800, fontSize: size === "small" ? 8 : 11, letterSpacing: 0.4 }}>
              {size === "small" ? "RPW" : "RATNAPPRABBHA WORLD"}
            </span>
            <span style={{ fontSize: 7 }}>{fyOf(a.purchaseDate)}</span>
          </div>
          <div style={{ fontSize: size === "small" ? 8 : 10, marginTop: 2, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{a.name}</div>
          {size === "standard" && (
            <div style={{ fontSize: 8, color: "#333" }}>
              {D(a.dealershipId)?.name}{a.facilityId ? ` · ${F(a.facilityId)?.name}` : ""}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontWeight: 800, fontSize: 7, letterSpacing: 0.4 }}>RPW</div>
      )}
      <div style={{ marginTop: 3 }}>
        <Barcode value={encoded} height={S.barH} module={S.module} showText={false} />
      </div>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: size === "micro" ? 6 : 7, textAlign: "center", marginTop: 1 }}>
        {S.full ? a.code : `${a.tagId} · ${a.code}`}
      </div>
      {size === "standard" && <div style={{ fontSize: 7, color: "#333", marginTop: 2 }}>Property of RPW — do not remove</div>}
    </div>
  );
}

export function LabelModal({ ctx, assets, onClose }) {
  const [size, setSize] = useState("standard");
  const S = LABEL_SIZES[size];
  return (
    <Modal title={assets.length > 1 ? `Print ${assets.length} labels` : "Print asset label"} onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Close</Btn>
        <Btn full icon={FileText} onClick={() => window.print()}>Print</Btn></>}>
      <div className="space-y-3">
        <Field label="Tag size">
          <div className="flex gap-1 rounded-lg p-1" style={{ background: T.canvas }}>
            {Object.entries(LABEL_SIZES).map(([k, v]) => (
              <button key={k} onClick={() => setSize(k)} className="flex-1 rounded-md py-1.5 text-xs font-semibold"
                style={size === k ? { background: "#fff", color: T.primary, border: "1px solid " + T.line } : { color: T.sub }}>{v.label}</button>
            ))}
          </div>
        </Field>
        <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
          {S.note}
          <div className="mt-1">
            {S.full
              ? "Barcode carries the full asset code."
              : "Barcode carries the short tag ID; the full code is printed as text. Scanning the ID pulls up the same asset."}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {assets.map((a) => <AssetLabel key={a.id} a={a} ctx={ctx} size={size} />)}
        </div>
        <p className="text-[11px]" style={{ color: T.sub }}>
          Test one printed tag with your scanner before running a batch — print quality and label stock affect readability more than size does.
        </p>
      </div>
    </Modal>
  );
}
