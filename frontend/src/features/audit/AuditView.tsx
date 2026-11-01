import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw, Search,
} from "lucide-react";
import { Pagination } from "../../components/Pagination";
import { DEFAULT_PAGE_SIZE } from "../../domain/pagination";
import { Avatar, Btn, Card, Empty, PageHead } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { fmtDate } from "../../lib/format";
import { T } from "../../theme";
import type { AuditEntry } from "../../types";

interface AuditPage {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/* Every entry comes from the server (asset, requisition, payment and Admin actions), a page at a
   time, searched there over the whole trail. */
export function AuditView({ ctx }) {
  const { U } = ctx;
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [saved, setSaved] = useState<AuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  /* Search after a pause in typing, from the first page */
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    const call = ++latest.current;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(query ? { q: query } : {}) });
      const res = await api.get<AuditPage>(`/audit?${params}`);
      if (call === latest.current) setSaved(res);
    } catch (err) {
      if (call === latest.current) setError(errorMessage(err));
    } finally {
      if (call === latest.current) setLoading(false);
    }
  }, [page, pageSize, query]);
  useEffect(() => { load(); }, [load]);

  const goTo = (p: number) => { setPage(p); window.scrollTo({ top: 0 }); };

  const entry = (e: AuditEntry) => (
    <div key={e.id} className="flex items-start gap-3 py-3">
      <Avatar name={U(e.actorId)?.name || "?"} size={32} />
      <div className="min-w-0 flex-1">
        <div className="text-sm"><b>{U(e.actorId)?.name}</b> <span style={{ color: T.sub }}>· {U(e.actorId)?.title}</span></div>
        <div className="text-[13px] font-semibold" style={{ color: T.primary }}>{e.action}</div>
        <div className="text-[13px]" style={{ color: T.sub }}><span className="font-mono">{e.ref}</span> — {e.detail}</div>
      </div>
      <div className="shrink-0 text-right text-[11px]" style={{ color: T.sub }}>{fmtDate(e.at)}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHead title="Audit trail" sub={saved ? `${saved.total} ${saved.total === 1 ? "entry" : "entries"}${query ? " match" : ""}` : "Every money & asset-value action, platform-wide"} />
      <Card pad={false}>
        <div className="p-3">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: "1px solid " + T.line }}>
            <Search size={16} style={{ color: T.sub }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, ref, action…" className="w-full text-sm outline-none" />
          </div>
        </div>
      </Card>

      {error && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm" style={{ color: T.bad }}>Entries could not be loaded: {error}</span>
            <Btn size="sm" kind="secondary" icon={RefreshCw} onClick={load}>Try again</Btn>
          </div>
        </Card>
      )}
      <Card>
        {!saved && loading && <Empty msg="Loading entries…" />}
        {saved && (
          <div className="divide-y" style={{ borderColor: T.line, opacity: loading ? 0.5 : 1, transition: "opacity 150ms" }} aria-busy={loading}>
            {saved.entries.map(entry)}
            {saved.entries.length === 0 && <Empty msg={query ? "No entries match." : "No entries."} />}
          </div>
        )}
      </Card>
      {saved && <Pagination total={saved.total} page={saved.page} pageSize={saved.pageSize} onPage={goTo}
        onPageSize={(n) => { setPageSize(n); setPage(1); }} noun="entries" />}
    </div>
  );
}
