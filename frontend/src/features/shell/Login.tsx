import { Btn, Card, Field, inputCls, inputStyle } from "../../components/ui";
import { T } from "../../theme";

export function Login({ onLogin }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5" style={{ background: T.canvas, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black text-white" style={{ background: T.primary }}>R</div>
          <h1 className="text-xl font-bold" style={{ color: T.ink }}>Ratnapprabbha World</h1>
          <p className="text-sm" style={{ color: T.sub }}>Internal Operations Platform</p>
        </div>
        <Card>
          <div className="space-y-3">
            <Field label="Employee ID or Mobile"><input className={inputCls} style={inputStyle} defaultValue="arjun@rpw" /></Field>
            <Field label="Password"><input type="password" className={inputCls} style={inputStyle} defaultValue="········" /></Field>
            <Btn full onClick={onLogin}>Sign in</Btn>
            <p className="pt-1 text-center text-[11px]" style={{ color: T.sub }}>One login across every RPW module.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
