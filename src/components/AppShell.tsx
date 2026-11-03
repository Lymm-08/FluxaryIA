import {
  Bell, BellRing, CreditCard, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, PiggyBank,
  Settings, Sparkles, Tags, Target, TrendingUp, Wallet, X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FinanceNotification } from "../types/finance";

const menuItems = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Categorias", icon: Tags },
  { label: "Contas", icon: Wallet },
  { label: "Cartões", icon: CreditCard },
  { label: "Planejamento", icon: TrendingUp },
  { label: "Metas", icon: Target },
  { label: "Caixinhas", icon: PiggyBank },
  { label: "Chat Fluxary", icon: Sparkles },
];

// Navegação principal, cabeçalho e comportamento do menu em telas pequenas.
export function AppShell({ page, mobileMenuOpen, sidebarCollapsed, userEmail, notifications, onMarkSettled, onNavigate, onToggleSidebar, onMenuClose, onSignOut, children }: {
  page: string;
  mobileMenuOpen: boolean;
  sidebarCollapsed: boolean;
  userEmail: string | null;
  onNavigate: (page: string) => void;
  onToggleSidebar: () => void;
  onMenuClose: () => void;
  notifications: FinanceNotification[];
  onMarkSettled: (transactionId: string) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notificationsOpen) return;
    function handleOutside(event: PointerEvent) {
      if (event.target instanceof Node && !notificationsRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setNotificationsOpen(false);
    }
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [notificationsOpen]);

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
          <div className="sidebar-account-actions">
            <button className={`nav-item sidebar-settings-button ${page === "Configurações" ? "nav-item-active" : ""}`} onClick={() => onNavigate("Configurações")} title={sidebarCollapsed ? "Configurações" : undefined}>
              <Settings size={15} strokeWidth={1.8} /><span>Configurações</span>
            </button>
            {userEmail && <button className="nav-item signout-button" onClick={onSignOut} title={sidebarCollapsed ? "Sair da conta" : undefined}><LogOut size={15} /><span>Sair da conta</span></button>}
          </div>
          <div className="profile"><div className="avatar">{userEmail?.slice(0, 1).toUpperCase() ?? "F"}</div><div className="profile-text"><strong>{userEmail ?? "Minha conta"}</strong><span>Conta Fluxary.ia</span></div></div>
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
            <div className="notification-menu" ref={notificationsRef}>
              <button
                className={`icon-button notification-button ${notificationsOpen ? "notification-button-open" : ""}`}
                aria-label={`Notificações${notifications.length ? `, ${notifications.length} avisos` : ""}`}
                aria-expanded={notificationsOpen}
                aria-controls="finance-notification-panel"
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={16} />
                {notifications.length > 0 && <i aria-hidden="true" />}
              </button>
              {notificationsOpen && (
                <section className="notification-panel" id="finance-notification-panel" role="dialog" aria-label="Notificações">
                  <div className="notification-panel-heading">
                    <div><span className="eyebrow">FLUXARY.IA</span><h2>Notificações</h2></div>
                    <button className="icon-button" aria-label="Fechar notificações" onClick={() => setNotificationsOpen(false)}><X size={15} /></button>
                  </div>
                  {notifications.length ? (
                    <div className="notification-list">
                      {notifications.map((notification) => (
                        <article className={`finance-notification ${notification.tone}`} key={notification.id}>
                          <span className="finance-notification-icon"><BellRing size={14} /></span>
                          <div className="finance-notification-content">
                            <strong>{notification.title}</strong>
                            <p>{notification.message}</p>
                            {notification.transactionId && (
                              <button
                                className="notification-action"
                                onClick={() => {
                                  if (notification.transactionId) onMarkSettled(notification.transactionId);
                                }}
                              >
                                {notification.actionLabel ?? "Marcar como realizada"}
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="notification-empty"><Bell size={18} /><strong>Você está em dia!</strong><span>Nenhum aviso financeiro por enquanto.</span></div>
                  )}
                  {notifications.length > 0 && (
                    <div className="notification-summary">{notifications.length} {notifications.length === 1 ? "aviso" : "avisos"} · valores previstos não alteram o saldo atual até serem confirmados.</div>
                  )}
                </section>
              )}
            </div>
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
