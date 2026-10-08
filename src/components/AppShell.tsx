import { useState } from "react";
import { BarChart3, BellRing, Bot, BriefcaseBusiness, CheckCircle2, ChevronLeft, ClipboardCheck, LayoutDashboard, Menu, Search, Settings, Users, X } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const items = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/buscar", label: "Buscar leads", icon: Search },
  { to: "/app/leads", label: "Leads", icon: Users },
  { to: "/app/aprovacoes", label: "Aprovações", icon: ClipboardCheck, badge: "—" },
  { to: "/app/crm", label: "CRM", icon: BriefcaseBusiness },
  { to: "/app/follow-ups", label: "Follow-ups", icon: BellRing },
  { to: "/app/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const roleLabel = user?.role === "ADMIN" ? "Administrador" : user?.role === "COMMERCIAL" ? "Comercial" : "Visualização";
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={22} /></button>
      {open && <button className="nav-backdrop" onClick={() => setOpen(false)} aria-label="Fechar menu" />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <img src="/perfect-mark.png" alt="" className="brand-mark" />
          <div><strong>Perfect</strong><span>Prospect</span></div>
          <button className="close-menu" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
        </div>
        <nav aria-label="Navegação principal">
          {items.map(({ to, label, icon: Icon, badge, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
              <Icon size={19} strokeWidth={1.8} /><span>{label}</span>{badge && <small>{badge}</small>}
            </NavLink>
          ))}
        </nav>
        <div className="human-rule"><Bot size={18} /><p><strong>A IA recomenda.</strong><br />O humano decide.</p></div>
        <div className="user-card">
          <span className="avatar">{user?.name.slice(0, 1)}</span>
          <div><strong>{user?.name}</strong><span>{roleLabel}</span></div>
          <button onClick={handleLogout} aria-label="Sair"><ChevronLeft size={19} /></button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div><span className="eyebrow">Central comercial</span><strong>Perfect Evolution</strong></div>
          <div className="secure-pill"><CheckCircle2 size={16} /><span>Sessão protegida</span></div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
