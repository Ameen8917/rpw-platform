import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { Btn, Card, Field, inputCls, inputStyle } from "../../components/ui";
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
    <div className="flex min-h-screen items-center justify-center px-5" style={{ background: T.canvas, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black text-white" style={{ background: T.primary }}>R</div>
          <h1 className="text-xl font-bold" style={{ color: T.ink }}>Ratnapprabbha World</h1>
          <p className="text-sm" style={{ color: T.sub }}>Internal Operations Platform</p>
        </div>
        <Card>
          <form className="space-y-3" onSubmit={submit}>
            <Field label="Employee code">
              <input className={inputCls} style={inputStyle} value={empCode} onChange={(e) => setEmpCode(e.target.value)}
                placeholder="RPW-EMP-0001" autoComplete="username" autoFocus />
            </Field>
            <Field label="Password">
              <input type="password" className={inputCls} style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" />
            </Field>
            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12px]" style={{ background: T.badBg, color: T.bad }}>
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}
              </div>
            )}
            <Btn full type="submit" disabled={busy || !empCode.trim() || !password}>{busy ? "Signing in…" : "Sign in"}</Btn>
            <p className="pt-1 text-center text-[11px]" style={{ color: T.sub }}>One login across every RPW module.</p>
          </form>
        </Card>

        {devUsers.length > 0 && (
          <Card className="mt-3">
            <Field label="Development only — sign in as">
              <select className={inputCls} style={inputStyle} value="" disabled={busy}
                onChange={(e) => e.target.value && attempt(() => sessionApi.loginAs(e.target.value))}>
                <option value="">Choose a person…</option>
                {devUsers.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.title}</option>)}
              </select>
            </Field>
          </Card>
        )}
      </div>
    </div>
  );
}
