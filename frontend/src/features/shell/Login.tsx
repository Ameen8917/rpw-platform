import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { Btn, Field, inputCls, inputStyle } from "../../components/ui";
import { errorMessage } from "../../lib/api";
import { T } from "../../theme";
import { sessionApi, type DevUser, type SessionInfo } from "./session";

export function Login({ onSignedIn, expired }: { onSignedIn: (s: SessionInfo) => void; expired?: boolean }) {
  const [empCode, setEmpCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(expired ? "Your session has ended. Please sign in again." : null);
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);

  useEffect(() => { sessionApi.devUsers().then(setDevUsers); }, []);

  async function attempt(work: () => Promise<SessionInfo>) {
    setBusy(true); setError(null);
    try {
      onSignedIn(await work());
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (empCode.trim() && password) attempt(() => sessionApi.login(empCode.trim(), password));
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" style={{ background: T.canvas }}>
      {/* The banner carries its own logo and headline, so it is shown whole (contain), never
          cropped or covered. Its edges are near-black, so the panel colour absorbs the letterbox;
          a blurred copy behind adds the showroom's warmth to the bands. */}
      <aside className="relative overflow-hidden md:min-h-screen" style={{ background: "#0C0C0E" }}>
        <img src="/banner.jpg" alt="" aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden h-full w-full scale-110 object-cover opacity-30 blur-2xl md:block" />
        <img src="/banner.jpg" alt="Ratnaprabha Motors showroom"
          className="relative block aspect-[3/2] w-full object-cover md:absolute md:inset-0 md:aspect-auto md:h-full md:object-contain" />
      </aside>

      <div className="flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-[28px] font-medium leading-tight" style={{ color: T.ink }}>Sign in</h1>
        <p className="mb-6 mt-1 text-[13px]" style={{ color: T.sub }}>Use your employee code. One login across every RPW module.</p>
        <div>
          <form className="space-y-4" onSubmit={submit}>
            <Field label="Employee code">
              <input className={inputCls} style={inputStyle} value={empCode} onChange={(e) => setEmpCode(e.target.value)}
                placeholder="RPW-EMP-0001" autoComplete="username" autoFocus />
            </Field>
            <Field label="Password">
              <input type="password" className={inputCls} style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" />
            </Field>
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-md px-3 py-2 text-[12px]" style={{ background: T.badBg, color: T.bad }}>
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}
              </div>
            )}
            <Btn full type="submit" disabled={busy || !empCode.trim() || !password}>{busy ? "Signing in…" : "Sign in"}</Btn>
          </form>
        </div>

        {devUsers.length > 0 && (
          <div className="mt-8 rounded-md p-4" style={{ border: "1px dashed " + T.line, background: "rgba(255,255,255,.5)" }}>
            <Field label="Development only — sign in as">
              <select className={inputCls} style={inputStyle} value="" disabled={busy}
                onChange={(e) => e.target.value && attempt(() => sessionApi.loginAs(e.target.value))}>
                <option value="">Choose a person…</option>
                {devUsers.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.title}</option>)}
              </select>
            </Field>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
