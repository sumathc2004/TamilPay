import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ChevronRight, Clock, Megaphone, Sparkles, X } from 'lucide-react';
import { formatAnnouncementTime } from '../utils/announcements';
import '../styles/announcements.css';

/** The popup: every active announcement, newest first, shown once per day (see App). */
export const AnnouncementModal = ({ items, onClose }) => {
  const [closing, setClosing] = useState(false);

  // Plays the exit animation, then hands control back (a plain unmount would just vanish).
  const close = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [close]);

  return createPortal(
    <div className={`an-overlay${closing ? ' is-closing' : ''}`} onMouseDown={close}>
      {/* Drifting light specks behind the card. */}
      <div className="an-specks" aria-hidden="true">
        {Array.from({ length: 14 }, (_, k) => <i key={k} style={{ '--k': k }} />)}
      </div>

      <div className="an-modal" role="dialog" aria-modal="true" aria-label="Announcements" onMouseDown={(e) => e.stopPropagation()}>
        <div className="an-hero">
          <span className="an-hero-glow" aria-hidden="true" />
          <Sparkles className="an-spark an-spark-1" size={18} aria-hidden="true" />
          <Sparkles className="an-spark an-spark-2" size={13} aria-hidden="true" />
          <Sparkles className="an-spark an-spark-3" size={15} aria-hidden="true" />

          <button type="button" className="an-close" onClick={close} aria-label="Close"><X size={18} /></button>

          <span className="an-mega" aria-hidden="true">
            <i className="an-wave an-wave-1" /><i className="an-wave an-wave-2" /><i className="an-wave an-wave-3" />
            <span className="an-mega-core"><Megaphone size={34} strokeWidth={2} /></span>
          </span>

          <h2 className="an-hero-title">Announcements</h2>
          <p className="an-hero-sub">
            <span className="an-live"><i />NEW</span>
            {items.length === 1 ? '1 update' : `${items.length} updates`} from TamilPay
          </p>

          <svg className="an-hero-wave" viewBox="0 0 520 30" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 14 C 90 34, 170 0, 260 14 S 440 30, 520 10 L520 30 L0 30 Z" />
          </svg>
        </div>

        <div className="an-list">
          {items.map((a, i) => (
            <article key={a.id ?? i} className="an-item" style={{ '--i': i }}>
              <span className="an-num">{i + 1}</span>
              <div className="an-item-body">
                <h3 className="an-item-title">{a.title}</h3>
                <p className="an-item-msg">{a.message}</p>
                {a.createdTime && (
                  <time className="an-item-time"><Clock size={12} /> {formatAnnouncementTime(a.createdTime)}</time>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="an-foot">
          <button type="button" className="an-gotit" onClick={close}>
            <span>Got it</span><ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const MAX_ROWS = 3;

/**
 * Home-page entry point: fills the header row between the welcome text and the date with the
 * active announcements (a small icon button on phones). The animated border and glow are what
 * say "something is up"; clicking anywhere opens the full popup.
 */
export const AnnouncementBanner = ({ items, onOpen }) => {
  if (items.length === 0) return null;
  const shown = items.slice(0, MAX_ROWS);
  const more = items.length - shown.length;

  return (
    <button
      type="button" className="an-pill-btn" onClick={onOpen}
      aria-label={`${items.length} announcement${items.length === 1 ? '' : 's'}: ${items.map((a) => a.title).join(', ')}. Open`}
    >
      <span className="an-bell" aria-hidden="true">
        <i className="an-ring an-ring-1" /><i className="an-ring an-ring-2" />
        <Sparkles className="an-pill-spark an-pill-spark-1" size={11} />
        <Sparkles className="an-pill-spark an-pill-spark-2" size={9} />
        <Megaphone size={20} strokeWidth={2.2} />
        <span className="an-ping" />
      </span>

      <span className="an-rows">
        {shown.map((a, i) => (
          <span key={a.id ?? i} className="an-line" style={{ '--i': i }}>
            <i className="an-dot" aria-hidden="true" />
            <strong className="an-pill-title">{a.title}</strong>
            <span className="an-pill-msg">{a.message}</span>
            {a.createdTime && <time className="an-pill-time">{formatAnnouncementTime(a.createdTime)}</time>}
          </span>
        ))}
        {more > 0 && <span className="an-more">+{more} more</span>}
      </span>

      <span className="an-cta" aria-hidden="true">
        {items.length > 1 ? `View all (${items.length})` : 'Read'} <ChevronRight size={16} />
      </span>
      <span className="an-count" aria-hidden="true">{items.length}</span>
    </button>
  );
};
