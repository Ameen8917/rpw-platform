import { useState } from "react";
import {
  Search, X,
} from "lucide-react";
import { Avatar, inputStyle } from "./ui";
import { T } from "../theme";
import type { User } from "../types";

/* Employee picker: type-ahead over the synced directory, scoped to a dealership.
   A dropdown is unusable at 1,200 records. */
interface EmployeePickerProps {
  users: User[];
  dealershipId?: string;
  value: string;
  onChange: (id: string) => void;
  allowNone?: boolean;
  noneLabel?: string;
  facilityName?: (facilityId: string) => string | undefined;
}
export function EmployeePicker({ users, dealershipId, value, onChange, allowNone = true, noneLabel = "— not issued to an individual —", facilityName }: EmployeePickerProps) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const pool = users.filter((u) => !u.inactive && (!dealershipId || u.dealershipIds.includes(dealershipId)));
  const chosen = users.find((u) => u.id === value);
  const matches = q.trim()
    ? pool.filter((u) => (u.name + " " + u.empCode + " " + u.title).toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : pool.slice(0, 8);
  return (
    <div className="relative">
      {chosen && !open ? (
        <button onClick={() => { setOpen(true); setQ(""); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left" style={inputStyle}>
          <Avatar name={chosen.name} size={26} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{chosen.name}</span>
            <span className="block truncate text-[11px]" style={{ color: T.sub }}>{chosen.empCode} · {chosen.title}</span>
          </span>
          <X size={14} style={{ color: T.sub }} onClick={(e) => { e.stopPropagation(); onChange(""); }} />
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={inputStyle}>
            <Search size={15} style={{ color: T.sub }} />
            <input autoFocus={open} value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              placeholder="Search name or employee code" className="w-full text-sm outline-none" />
          </div>
          {open && (
            <div className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-lg shadow-lg" style={{ background: "#fff", border: "1px solid " + T.line, WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
              {allowNone && (
                <button onClick={() => { onChange(""); setOpen(false); }} className="w-full px-3 py-2 text-left text-[13px] hover:bg-slate-50" style={{ color: T.sub }}>
                  {noneLabel}
                </button>
              )}
              {matches.map((u) => (
                <button key={u.id} onClick={() => { onChange(u.id); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
                  <Avatar name={u.name} size={26} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{u.name}</span>
                    <span className="block truncate text-[11px]" style={{ color: T.sub }}>{u.empCode} · {u.title}{u.noLogin ? " · no login" : ""}</span>
                    {u.facilityId && facilityName && <span className="block truncate text-[10px]" style={{ color: T.sub }}>{facilityName(u.facilityId)}</span>}
                  </span>
                </button>
              ))}
              {matches.length === 0 && <div className="px-3 py-3 text-center text-[13px]" style={{ color: T.sub }}>No employee matches.</div>}
              <div className="px-3 py-1.5 text-[10px]" style={{ color: T.sub, borderTop: "1px solid " + T.line }}>
                Directory synced from HRMS · showing {matches.length} of {pool.length}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
