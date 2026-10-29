import { code128Runs } from "../lib/barcode";

export function Barcode({ value, height = 46, module = 1.6, showText = true }) {
  const runs = code128Runs(value);
  const total = runs.reduce((s, r) => s + r.w, 0);
  const quiet = 10;
  const width = (total + quiet * 2) * module;
  let x = quiet * module;
  return (
    <svg viewBox={`0 0 ${width} ${height + (showText ? 14 : 0)}`} width="100%" style={{ maxWidth: width * 1.4 }} role="img" aria-label={`Barcode ${value}`}>
      <rect x="0" y="0" width={width} height={height + (showText ? 14 : 0)} fill="#fff" />
      {runs.map((r, i) => {
        const w = r.w * module, rx = x; x += w;
        return r.bar ? <rect key={i} x={rx} y="0" width={w} height={height} fill="#000" /> : null;
      })}
      {showText && (
        <text x={width / 2} y={height + 11} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize="9" fill="#000">{value}</text>
      )}
    </svg>
  );
}
