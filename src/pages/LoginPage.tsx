import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!loading && user) return <Navigate to="/app" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      const destination = (location.state as { from?: string } | null)?.from ?? "/app";
      navigate(destination, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar.");
    } finally { setSubmitting(false); }
  }

  return (
    <main className="login-page">
      <section className="login-visual" aria-label="Perfect Prospect">
        <div className="visual-grid" />
        <div className="login-brand"><img src="/perfect-mark.png" alt="Perfect Evolution" /><span>Perfect Evolution</span></div>
        <div className="visual-copy">
          <span className="signal"><i /> Inteligência comercial</span>
          <h1>Transforme pesquisa em <em>oportunidade.</em></h1>
          <p>Uma central segura para descobrir, qualificar e acompanhar seus próximos clientes.</p>
        </div>
        <div className="principle"><ShieldCheck size={22} /><span><strong>Controle em cada etapa</strong>Automação com aprovação humana.</span></div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand"><img src="/perfect-mark.png" alt="" /><span>Perfect Prospect</span></div>
          <span className="eyebrow">Acesso interno</span>
          <h2>Bem-vindo de volta</h2>
          <p>Entre com suas credenciais da Perfect Evolution.</p>
          <form onSubmit={submit}>
            <label>E-mail<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@perfectevolution.com.br" required /></label>
            <label>Senha<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" required /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={submitting}>{submitting ? "Entrando…" : "Entrar"}<ArrowRight size={19} /></button>
          </form>
          <div className="security-note"><LockKeyhole size={17} /><span>Suas credenciais são verificadas com segurança no servidor.</span></div>
        </div>
        <small className="legal">Uso exclusivo da equipe Perfect Evolution.</small>
      </section>
    </main>
  );
}
