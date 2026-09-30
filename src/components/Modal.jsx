import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Centered overlay dialog — click the backdrop (or call onClose) to dismiss.
 * `style` sizes/pads the white card itself; `overlayStyle` tweaks the backdrop
 * (e.g. side padding so a tall card still fits on small screens).
 *
 * Rendered through a portal straight to document.body — every page wraps its
 * content in a `position: relative; zIndex: 2` div (for the background gradient
 * layering), which creates its own stacking context and would otherwise trap
 * this z-index inside it, capping it below the navbar's sticky z-index: 100
 * regardless of the number set here. Portaling out to body escapes that.
 *
 * That same portal also escapes any `.theme-*` class on an ancestor — a modal
 * opened from a themed page (PG's green, IMPS's blue, ...) would otherwise fall
 * back to the default brand orange/teal since the CSS variables it relies on no
 * longer cascade down. Pass `themeClassName` (e.g. "theme-green") from the
 * calling page to carry that theme onto the modal card itself.
 */
// Higher than the navbar's sticky z-index (100) so it never gets clipped underneath it.
const Modal = ({ onClose, zIndex = 200, style, overlayStyle, themeClassName, children }) => createPortal(
  <div
    onClick={onClose}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(1,87,111,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflowY: 'auto',
      padding: '24px 16px',
      zIndex,
      ...overlayStyle,
    }}
  >
    <div
      className={themeClassName}
      onClick={(e) => e.stopPropagation()}
      style={{
        background: '#ffffff',
        borderRadius: 20,
        boxShadow: '0 20px 60px rgba(1,87,111,0.25)',
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
        margin: 'auto',
        ...style,
      }}
    >
      {children}
    </div>
  </div>,
  document.body,
);

export default Modal;
