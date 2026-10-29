import {
  AlertTriangle, CheckCircle2, XCircle, Clock, Landmark,
} from "lucide-react";
import { REQ_STATUS, escalation, needsDirectorPurchase } from "../../domain/requisitions";
import { fmtDate, inrShort } from "../../lib/format";
import { T } from "../../theme";

export function EscalationChip({ r }) {
  const e = escalation(r);
  if (!e) return null;
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: T.bad, background: T.badBg }}>
    <AlertTriangle size={10} />Escalated · {e.days}d
  </span>;
}

export function ReqBadge({ s }) {
  const v = REQ_STATUS[s];
  return <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: v.c, background: v.bg }}>{v.label}</span>;
}

export function ApprovalPips({ r, ctx }) {
  const { D } = ctx;
  const isCorp = D(r.dealershipId).isCorporate;
  const pip = (label, d) => (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={d === "approved" ? { color: T.ok, background: T.okBg } : d === "rejected" ? { color: T.bad, background: T.badBg } : { color: T.sub, background: T.slateBg }}>
      {d === "approved" ? <CheckCircle2 size={10} /> : d === "rejected" ? <XCircle size={10} /> : <Clock size={10} />}{label}
    </span>
  );
  return (
    <span className="flex flex-wrap gap-1">
      {pip(isCorp ? "Director" : "Business Head", r.bh.decision)}
      {pip("Functional", r.fn.decision)}
      {needsDirectorPurchase(r) && pip("Director", r.directorPurchase?.decision)}
      <EscalationChip r={r} />
      {r.advance?.required && (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: T.accent, background: "#FBF3E3" }}>
          <Landmark size={10} />Advance {inrShort(r.advance.amount)}
        </span>
      )}
    </span>
  );
}

export function ApprovalBox({ label, person, slot, U }) {
  const d = slot.decision;
  const tone = d === "approved" ? { c: T.ok, bg: T.okBg } : d === "rejected" ? { c: T.bad, bg: T.badBg } : { c: T.sub, bg: T.slateBg };
  return (
    <div className="rounded-lg p-3" style={{ background: tone.bg }}>
      <div className="flex items-center gap-2 text-xs font-bold" style={{ color: tone.c }}>
        {d === "approved" ? <CheckCircle2 size={14} /> : d === "rejected" ? <XCircle size={14} /> : <Clock size={14} />}
        {label} — {d ? d : "pending"}
      </div>
      <div className="mt-1 text-[12px]" style={{ color: T.ink }}>
        {slot.onBehalfOf ? `${U(slot.by)?.name} (for ${U(slot.onBehalfOf)?.name})` : person ? person.name : "Not assigned"}
      </div>
      {slot.at && <div className="text-[11px]" style={{ color: T.sub }}>{fmtDate(slot.at)}</div>}
      {slot.onBehalfOf && <div className="mt-1 text-[11px] font-semibold" style={{ color: T.warn }}>
        Escalated — no response for {slot.lateDays} days
      </div>}
      {slot.note && <div className="mt-1 text-[12px]" style={{ color: T.sub }}>“{slot.note}”</div>}
    </div>
  );
}
