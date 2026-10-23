import React from 'react';
import { ArrowLeft } from 'lucide-react';

/** The "Back" every page opens with: a pill with a round arrow that slides left on hover. */
const BackButton = ({ onClick, label = 'Back', style, disabled }) => (
  <button type="button" className="tp-back" onClick={onClick} disabled={disabled} style={style}>
    <span className="tp-back-icon"><ArrowLeft size={15} strokeWidth={2.3} /></span>
    {label}
  </button>
);

export default BackButton;
