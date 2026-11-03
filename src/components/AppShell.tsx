import {
  Bell, CircleHelp, CreditCard, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen,
  Settings, Sparkles, Tags, Target, TrendingUp, Wallet, X,
} from "lucide-react";
import type { ReactNode } from "react";

const menuItems = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Categorias", icon: Tags },
  { label: "Contas", icon: Wallet },
  { label: "Cartões", icon: CreditCard },
  { label: "Planejamento", icon: TrendingUp },
  { label: "Metas", icon: Target },
  { label: "Chat Fluxary", icon: Sparkles },
];

// Navegação principal, cabeçalho e comportamento do menu em telas pequenas.
export function AppShell({ page, mobileMenuOpen, sidebarCollapsed, userEmail, onNavigate, onToggleSidebar, onMenuClose, onNotify, onSignOut, children }: {
  page: string;
  mobileMenuOpen: boolean;
  sidebarCollapsed: boolean;
  userEmail: string | null;
  onNavigate: (page: string) => void;
  onToggleSidebar: () => void;
  onMenuClose: () => void;
  onNotify: () => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`app-shell ${sidebarCollapsed ? "app-shell-collapsed" : ""}`}>
      {mobileMenuOpen && <button aria-label="Fechar menu" className="mobile-backdrop" onClick={onMenuClose} />}
      <aside className={`sidebar ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <button className="brand" onClick={() => onNavigate("Visão geral")} aria-label="Fluxary.ia, ir para visão geral">
          <span>Fluxary<span className="brand-dot">.ia</span></span>
        </button>
        <div className="workspace-label">ESPAÇO PESSOAL</div>
        <nav className="side-nav" aria-label="Navegação principal">
          {menuItems.map(({ label, icon: Icon }) => (
            <button className={`nav-item ${page === label ? "nav-item-active" : ""}`} key={label} onClick={() => onNavigate(label)} title={sidebarCollapsed ? label : undefined}>
              <Icon size={15} strokeWidth={1.8} /><span>{label}</span>{label === "Chat Fluxary" && <span className="nav-new">NOVO</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-utility-nav">
            <button className={`nav-item ${page === "Configurações" ? "nav-item-active" : ""}`} onClick={() => onNavigate("Configurações")} title={sidebarCollapsed ? "Configurações" : undefined}>
              <Settings size={15} strokeWidth={1.8} /><span>Configurações</span>
            </button>
            <button className="nav-item" title={sidebarCollapsed ? "Central de ajuda" : undefined}>
              <CircleHelp size={15} strokeWidth={1.8} /><span>Central de ajuda</span>
            </button>
          </div>
          <div className="profile"><div className="avatar">{userEmail?.slice(0, 1).toUpperCase() ?? "F"}</div><div className="profile-text"><strong>{userEmail ?? "Minha conta"}</strong><span>Conta Fluxary.ia</span></div></div>
          {userEmail && <button className="nav-item signout-button" onClick={onSignOut}><LogOut size={15} /><span>Sair da conta</span></button>}
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button
            className="icon-button sidebar-toggle"
            onClick={onToggleSidebar}
            aria-label={sidebarCollapsed ? "Mostrar menu lateral" : "Recolher menu lateral"}
            title={sidebarCollapsed ? "Mostrar menu" : "Recolher menu"}
          >
            {mobileMenuOpen ? <X className="mobile-menu-icon" size={18} /> : <Menu className="mobile-menu-icon" size={18} />}
            <span className="desktop-sidebar-icon">{sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</span>
          </button>
          <div className="breadcrumb">Seu espaço <span>/</span> <strong>{page}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button notification-button" aria-label="Notificações" onClick={onNotify}><Bell size={16} /><i /></button>
          </div>
        </header>
        <div className="page-wrap">{children}</div>
      </main>
    </div>
  );
}

export function ErrorNotice({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;
  return <div className="notice" role="status"><span>{message}</span><button aria-label="Fechar aviso" onClick={onClose}><X size={14} /></button></div>;
}
