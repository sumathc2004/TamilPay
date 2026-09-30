import React from 'react';
import { ArrowRight } from 'lucide-react';

/** One tile within a DashboardSection — colored icon badge on a white card, label below.
 * Tiles without an onClick render visible but inert (no backend behind them yet). */
const DashboardTile = ({ label, Icon, color, bg, onClick }) => {
  const clickable = Boolean(onClick);
  return (
    <button
      type="button"
      className={`dash-tile${clickable ? '' : ' dash-tile--inert'}`}
      onClick={onClick}
      disabled={!clickable}
    >
      <span className="dash-tile-icon" style={{ background: bg, color }}>
        <Icon size={27} strokeWidth={2.1} />
      </span>
      <span className="dash-tile-label">{label}</span>
    </button>
  );
};

/** Colored quadrant panel (Pay In / BBPS / Pay Out / More) — heading + optional "View
 * All" link, a subtitle, then a row of DashboardTiles. */
const DashboardSection = ({ title, subtitle, panelBg, linkColor, onViewAll, tiles }) => (
  <section className="dash-section" style={{ background: panelBg }}>
    <div className="dash-section-head">
      <div>
        <h2 className="dash-section-title">{title}</h2>
        <p className="dash-section-subtitle">{subtitle}</p>
      </div>
      {onViewAll && (
        <button type="button" className="dash-view-all" onClick={onViewAll} style={{ color: linkColor }}>
          View All <ArrowRight size={14} />
        </button>
      )}
    </div>
    <div className="dash-tile-row">
      {tiles.map((tile) => (
        <DashboardTile key={tile.label} {...tile} />
      ))}
    </div>
  </section>
);

export default DashboardSection;
