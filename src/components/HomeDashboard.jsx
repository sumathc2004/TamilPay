import React, { useEffect, useState } from 'react';
import { Landmark, Scale, Users, Wallet } from 'lucide-react';
import { apiUrl } from '../utils/api';

const money = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const REFRESH_MS = 30_000;

/** The four dashboard numbers (pipe balance, wallet balance, wallets, difference) as a compact
 * strip at the top of Home. Admin only — the caller decides; this component just draws it. */
const HomeDashboard = ({ walletVersion }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch(apiUrl('/api/dashboard'), { cache: 'no-store' })
        .then((res) => {
          if (!res.ok) throw new Error(`Request failed (${res.status})`);
          return res.json();
        })
        .then((d) => { if (alive) { setData(d); setError(null); } })
        .catch((err) => { if (alive) setError(err.message); });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [walletVersion]);

  if (error && !data) {
    return <p className="hd-error">Couldn&apos;t load the dashboard: {error}</p>;
  }

  const diff = Number(data?.difference ?? 0);
  const cards = [
    { key: 'pipe', label: 'Total Pipe Balance', Icon: Landmark, tone: 'blue', value: data && money(data.totalPipeBalance) },
    { key: 'wallet', label: 'Total Wallet Balance', Icon: Wallet, tone: 'orange', value: data && money(data.totalWalletBalance) },
    { key: 'count', label: 'Wallets', Icon: Users, tone: 'amber', value: data && Number(data.walletCount).toLocaleString('en-IN') },
    { key: 'diff', label: 'Difference', Icon: Scale, tone: diff >= 0 ? 'green' : 'red', value: data && money(diff) },
  ];

  return (
    <div className="hd-strip" aria-label="Dashboard">
      {cards.map(({ key, label, Icon, tone, value }) => (
        <div key={key} className={`hd-card hd-${tone}`}>
          <span className="hd-icon"><Icon size={18} strokeWidth={2} /></span>
          <span className="hd-text">
            <span className="hd-label">{label}</span>
            <span className={`hd-value${value ? '' : ' is-loading'}`}>{value || ' '}</span>
          </span>
        </div>
      ))}
    </div>
  );
};

export default HomeDashboard;
