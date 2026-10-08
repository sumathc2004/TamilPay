import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

const MENU_WIDTH = 180;

/**
 * A "three dots" button that opens a small menu of actions for one table row. The menu is drawn
 * through a portal at the button's position, so the table's scrolling area cannot clip it.
 * `actions` is [{ label, Icon, danger, onSelect }].
 */
const RowMenu = ({ actions, label = 'More actions' }) => {
  const buttonRef = useRef(null);
  const [pos, setPos] = useState(null);

  const open = () => {
    const rect = buttonRef.current.getBoundingClientRect();
    const height = actions.length * 40 + 8;
    const below = rect.bottom + 6 + height <= window.innerHeight;
    setPos({
      left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
      top: below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - height),
    });
  };

  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={buttonRef} type="button" title={label} aria-label={label} aria-haspopup="menu" aria-expanded={Boolean(pos)}
        className="icon-btn-anim" onClick={() => (pos ? setPos(null) : open())}
        style={{ background: '#F3F7FD', border: '1px solid rgba(var(--theme-heading-rgb),0.1)', borderRadius: 8, cursor: 'pointer', padding: 6, lineHeight: 0 }}
      >
        <MoreVertical size={16} color="var(--theme-heading)" />
      </button>
      {pos && createPortal(
        <>
          <div onClick={() => setPos(null)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
          <div
            role="menu"
            style={{
              position: 'fixed', left: pos.left, top: pos.top, width: MENU_WIDTH, zIndex: 151, background: '#ffffff',
              border: '1px solid rgba(var(--theme-heading-rgb),0.12)', borderRadius: 12, padding: 4,
              boxShadow: '0 10px 30px rgba(13,79,176,0.18)',
            }}
          >
            {actions.map(({ label: text, Icon, danger, onSelect }) => (
              <button
                key={text} type="button" role="menuitem"
                onClick={() => { setPos(null); onSelect(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', border: 'none',
                  background: 'transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: danger ? '#DC2626' : 'var(--theme-heading)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = danger ? '#FDE8E8' : '#F3F7FD'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {Icon && <Icon size={15} />} {text}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  );
};

export default RowMenu;
