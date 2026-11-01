import { useState, useRef } from "react";
import { T } from "../theme";

/* Finger/mouse signature capture — exports a PNG data URL */
export function SignaturePad({ onChange }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  function pos(e) {
    const c = ref.current, r = c.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (c.width / r.width), y: (t.clientY - r.top) * (c.height / r.height) };
  }
  function start(e) { e.preventDefault(); drawing.current = true; const c = ref.current.getContext("2d"); const p = pos(e); c.beginPath(); c.moveTo(p.x, p.y); }
  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const c = ref.current.getContext("2d"); const p = pos(e);
    c.lineTo(p.x, p.y); c.strokeStyle = "#1A1A1C"; c.lineWidth = 2; c.lineCap = "round"; c.stroke();
    if (empty) setEmpty(false);
  }
  function end() { if (!drawing.current) return; drawing.current = false; onChange(ref.current.toDataURL("image/png")); }
  function clear() {
    const c = ref.current; c.getContext("2d").clearRect(0, 0, c.width, c.height);
    setEmpty(true); onChange(null);
  }
  /* Inside a <label> (Field), a click on the canvas would be passed to the Clear button and wipe the signature */
  return (
    <div>
      <div className="relative rounded-lg" style={{ border: "1px dashed " + T.line, background: "#fff" }}>
        <canvas ref={ref} width={520} height={160} style={{ width: "100%", height: 130, touchAction: "none", display: "block" }}
          onClick={(e) => e.preventDefault()}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        {empty && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm" style={{ color: T.sub }}>
          Sign here with a finger or mouse
        </div>}
      </div>
      <button type="button" onClick={clear} className="mt-1 text-[11px] font-semibold" style={{ color: T.primary }}>Clear signature</button>
    </div>
  );
}
