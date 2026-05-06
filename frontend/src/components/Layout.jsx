import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import {
  LayoutDashboard, TrendingUp, Building2, PiggyBank, Gift,
  CreditCard, History, Target, LogOut, Menu, X, ChevronLeft,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',           label: 'Overview',    icon: LayoutDashboard, end: true },
  { to: '/investments',label: 'Investments', icon: TrendingUp },
  { to: '/cpf',        label: 'CPF',         icon: Building2 },
  { to: '/srs',        label: 'SRS',         icon: PiggyBank },
  { to: '/dividends',  label: 'Dividends',   icon: Gift },
  { to: '/loans',      label: 'Loans',       icon: CreditCard },
  { to: '/history',    label: 'History',     icon: History },
  { to: '/plan',       label: 'Plan',        icon: Target },
];

function NavItem({ to, label, icon: Icon, end, mobile, collapsed }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        mobile
          ? `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors ${isActive ? 'text-emerald-400' : 'text-stone-500'}`
          : `nav-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={mobile ? 20 : 16} strokeWidth={isActive ? 2.5 : 1.8} className="shrink-0" />
          {!collapsed && <span className={mobile ? '' : 'truncate'}>{label}</span>}
        </>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen]   = useState(false);
  const [collapsed, setCollapsed]     = useState(
    () => localStorage.getItem('wf_sidebar_collapsed') === 'true'
  );

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('wf_sidebar_collapsed', String(next));
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const sidebarW = collapsed ? '64px' : '224px';

  return (
    <div className="min-h-screen flex" style={{ background: '#1a1714' }}>

      {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0 border-r border-[#292524] fixed top-0 left-0 bottom-0 overflow-hidden"
        style={{
          width: sidebarW,
          background: '#1a1714',
          transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Logo + collapse toggle */}
        <div className="flex items-center justify-between px-4 py-6 mb-2 shrink-0 min-w-0">
          <div className="overflow-hidden min-w-0" style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : undefined, transition: 'opacity 200ms, width 200ms' }}>
            <p style={{ fontFamily: "'Lora',Georgia,serif", fontWeight: 400, fontSize: '1.15rem', color: '#e8ddd0', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              Wealthfolio
            </p>
            {profile?.display_name && (
              <p className="text-xs text-stone-600 mt-0.5 truncate">{profile.display_name}</p>
            )}
          </div>
          <button
            onClick={toggleCollapse}
            className="text-stone-600 hover:text-stone-300 transition-colors rounded-lg p-1.5 hover:bg-white/5 shrink-0 ml-auto"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              size={16}
              style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          </button>
        </div>

        {/* Nav links */}
        <nav className={`flex-1 space-y-0.5 overflow-hidden ${collapsed ? 'px-2' : 'px-4'}`}
          style={{ transition: 'padding 250ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
          {NAV_ITEMS.map(item => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}
        </nav>

        {/* Logout */}
        <div className={`shrink-0 pb-5 ${collapsed ? 'px-2' : 'px-4'}`}
          style={{ transition: 'padding 250ms cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <button
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
            className={`nav-link mt-4 text-stone-600 hover:text-red-400 w-full ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Mobile overlay sidebar ─────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside
            className="absolute left-0 top-0 bottom-0 w-56 border-r border-[#292524] px-4 py-6 flex flex-col"
            style={{ background: '#1a1714' }}
          >
            <div className="flex items-center justify-between mb-8 px-1">
              <p style={{ fontFamily: "'Lora',Georgia,serif", fontWeight: 400, fontSize: '1.1rem', color: '#e8ddd0' }}>
                Wealthfolio
              </p>
              <button onClick={() => setMobileOpen(false)} className="text-stone-500 hover:text-stone-200">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5">
              {NAV_ITEMS.map(item => (
                <div key={item.to} onClick={() => setMobileOpen(false)}>
                  <NavItem {...item} />
                </div>
              ))}
            </nav>
            <button onClick={handleLogout} className="nav-link mt-4 text-stone-600 hover:text-red-400 w-full">
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </aside>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────── */}
      <main
        className="flex-1 flex flex-col min-h-screen"
        style={{
          marginLeft: `max(0px, ${sidebarW})`,
          transition: 'margin-left 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[#292524]"
          style={{ background: '#1a1714' }}>
          <p style={{ fontFamily: "'Lora',Georgia,serif", fontWeight: 400, fontSize: '1rem', color: '#e8ddd0' }}>
            Wealthfolio
          </p>
          <button onClick={() => setMobileOpen(true)} className="text-stone-400 hover:text-stone-200">
            <Menu size={20} />
          </button>
        </div>

        {/* Page content */}
        <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 lg:pb-6">
          <Outlet />
        </div>

        {/* Mobile bottom tab bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-[#292524] flex items-center justify-around px-2 py-2 z-30"
          style={{ background: '#1a1714' }}>
          {NAV_ITEMS.slice(0, 5).map(item => (
            <NavItem key={item.to} {...item} mobile />
          ))}
        </nav>
      </main>
    </div>
  );
}
