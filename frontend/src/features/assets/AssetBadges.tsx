import { ASSET_STATUS } from "../../domain/assets";
import { T } from "../../theme";

export function AssetBadge({ s }) {
  const v = ASSET_STATUS[s];
  return <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: v.c, background: v.bg }}>{v.label}</span>;
}

export function SourceTag({ s }) {
  return s === "procured"
    ? <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: T.primary, background: T.primarySoft }}>Procured</span>
    : <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: T.sub, background: T.slateBg }}>Opening stock</span>;
}
