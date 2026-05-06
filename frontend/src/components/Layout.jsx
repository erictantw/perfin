import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import {
  LayoutDashboard, TrendingUp, Building2, PiggyBank, Gift,
  CreditCard, History, Target, LogOut, Menu, X
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/investments', label: 'Investments', icon: TrendingUp },
  { to: '/cpf', label: 'CPF', icon: Building2 },
  { to: '/srs', label: 'SRS', icon: PiggyBank },
  { to: '/dividends', label: 'Dividends', icon: Gift },
  { to: '/loans', label: 'Loans', icon: CreditCard },
  { to: '/history', label: 'History', icon: History },
  { to: '/plan', label: 'Plan', icon: Target },
];

function NavItem({ to, label, icon: Icon, end, mobile }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        mobile
          ? `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors ${isActive ? 'text-emerald-400' : 'text-stone-500'}`
          : `nav-link ${isActive ? 'active' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={mobile ? 20 : 16} strokeWidth={isActive ? 2.5 : 1.8} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#1a1714' }}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-[#292524] px-4 py-6 fixed top-0 left-0 bottom-0" style={{ background: '#1a1714' }}>
        {/* Logo */}
        <div className="mb-8 px-3">
          <p style={{ fontFamily:"'Lora',Georgia,serif", fontWeight:400, fontSize:'1.25rem', color:'#e8ddd0', letterSpacing:'-0.01em' }}>
            Wealthfolio
          </p>
          {profile?.display_name && (
            <p className="text-xs text-stone-600 mt-0.5">{profile.display_name}</p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Logout */}
        <button onClick={handleLogout} className="nav-link mt-4 text-stone-600 hover:text-red-400 w-full">
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </aside>

      {/* Mobile: overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 border-r border-[#292524] px-4 py-6 flex flex-col" style={{ background: '#1a1714' }}>
            <div className="flex items-center justify-between mb-8 px-3">
              <p style={{ fontFamily:"'Lora',Georgia,serif", fontWeight:400, fontSize:'1.1rem', color:'#e8ddd0' }}>Wealthfolio</p>
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

      {/* Main content */}
      <main className="flex-1 lg:ml-56 flex flex-col min-h-screen">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[#292524]" style={{ background: '#1a1714' }}>
          <p style={{ fontFamily:"'Lora',Georgia,serif", fontWeight:400, fontSize:'1rem', color:'#e8ddd0' }}>Wealthfolio</p>
          <button onClick={() => setMobileOpen(true)} className="text-stone-400 hover:text-stone-200">
            <Menu size={20} />
          </button>
        </div>

        {/* Page content */}
        <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 lg:pb-6">
          <div className="page-enter">
            <Outlet />
          </div>
        </div>

        {/* Mobile bottom tab bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-[#292524] flex items-center justify-around px-2 py-2 z-30" style={{ background: '#1a1714' }}>
          {NAV_ITEMS.slice(0, 5).map(item => (
            <NavItem key={item.to} {...item} mobile />
          ))}
        </nav>
      </main>
    </div>
  );
}
