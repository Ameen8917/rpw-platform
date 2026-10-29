import { useState } from "react";
import {
  Search,
} from "lucide-react";
import { Avatar, Card, Empty, PageHead } from "../../components/ui";
import { fmtDate } from "../../lib/format";
import { T } from "../../theme";

export function AuditView({ ctx, auditLog }) {
  const { U } = ctx;
  const [q, setQ] = useState("");
  const rows = auditLog.filter((e) => !q || (e.action + e.ref + e.detail + (U(e.actorId)?.name || "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <PageHead title="Audit trail" sub="Every money & asset-value action, platform-wide" />
      <Card pad={false}>
        <div className="p-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: "1px solid " + T.line }}>
            <Search size={16} style={{ color: T.sub }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, ref, action…" className="w-full text-sm outline-none" />
          </div>
        </div>
      </Card>
      <Card>
        <div className="divide-y" style={{ borderColor: T.line }}>
          {rows.map((e) => (
            <div key={e.id} className="flex items-start gap-3 py-3">
              <Avatar name={U(e.actorId)?.name || "?"} size={32} />
              <div className="min-w-0 flex-1">
                <div className="text-sm"><b>{U(e.actorId)?.name}</b> <span style={{ color: T.sub }}>· {U(e.actorId)?.title}</span></div>
                <div className="text-[13px] font-semibold" style={{ color: T.primary }}>{e.action}</div>
                <div className="text-[13px]" style={{ color: T.sub }}><span className="font-mono">{e.ref}</span> — {e.detail}</div>
              </div>
              <div className="shrink-0 text-right text-[11px]" style={{ color: T.sub }}>{fmtDate(e.at)}</div>
            </div>
          ))}
          {rows.length === 0 && <Empty msg="No entries." />}
        </div>
      </Card>
    </div>
  );
}
