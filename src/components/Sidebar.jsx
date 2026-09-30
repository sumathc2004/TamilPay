import React from 'react';
import { BarChart3, Home, Settings as SettingsIcon, ShieldCheck, SlidersHorizontal, Users, Wallet } from 'lucide-react';

// The same rail this app has always carried — only the styling is TamilPay's.
const NAV_ITEMS = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'walletSettlement', label: 'Wallet & Settlement', Icon: Wallet },
  { key: 'customers', label: 'Customers', Icon: Users, adminOnly: true },
  { key: 'reports', label: 'Reports', Icon: BarChart3 },
  { key: 'admin', label: 'Admin', Icon: SettingsIcon, adminOnly: true },
  { key: 'pgsettings', label: 'PG Settings', Icon: SlidersHorizontal, adminOnly: true },
];

// Drilling into a sub-page still highlights the nav item it was reached from.
const ACTIVE_GROUP = { customerDetail: 'customers' };

const Sidebar = ({ user, currentPage, onNavigate }) => {
  const isAdmin = (user?.roleName || '').toLowerCase() === 'admin';
  const activeKey = ACTIVE_GROUP[currentPage] ?? currentPage;

  // Icons-only outside Home: full width is the dashboard's, every other page
  // gives the rail's space back to the content. Labels stay as tooltips.
  const collapsed = currentPage !== 'home';

  const fullName = (user?.FULL_NAME || '').trim();
  const initial = (fullName[0] || 'T').toUpperCase();

  return (
    <aside className={`app-sidebar${collapsed ? ' app-sidebar--collapsed' : ''}`}>
      <div className="app-sidebar-user">
        <span className="app-sidebar-avatar">{initial}</span>
        <span className="app-sidebar-user-text">
          <span className="app-sidebar-user-name">{fullName || 'TamilPay'}</span>
          <span className="app-sidebar-user-role">{isAdmin ? 'Administrator' : 'Merchant'}</span>
        </span>
      </div>

      <nav className="app-sidebar-nav">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            title={collapsed ? label : undefined}
            className={`app-sidebar-item${activeKey === key ? ' app-sidebar-item--active' : ''}`}
            onClick={() => onNavigate?.(key)}
          >
            <Icon size={18} strokeWidth={2.1} />
            <span className="app-sidebar-item-label">{label}</span>
          </button>
        ))}
      </nav>

      <div className="app-sidebar-badge" title={collapsed ? 'Secure Payments — Trusted Platform' : undefined}>
        <ShieldCheck size={20} color="#4ADE80" strokeWidth={2.2} />
        <span className="app-sidebar-badge-text">Secure Payments<br />Trusted Platform</span>
      </div>
    </aside>
  );
};

export default Sidebar;
