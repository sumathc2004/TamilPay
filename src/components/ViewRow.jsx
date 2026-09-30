import React from 'react';
import { labelStyle } from '../styles/formStyles';

const valueTextStyle = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 14.5,
  color: '#0D4FB0',
  fontWeight: 600,
  margin: 0,
};

/**
 * Read-only "LABEL / value" pair used throughout the Customer Details view.
 * Pass `value` for plain text, or `children` for custom content (e.g. a photo preview).
 */
const ViewRow = ({ label, value, children, style, labelMarginBottom = 3 }) => (
  <div style={{ marginBottom: 14, ...style }}>
    <p style={{ ...labelStyle, marginBottom: labelMarginBottom }}>{label}</p>
    {children ?? <p style={valueTextStyle}>{value || '—'}</p>}
  </div>
);

export default ViewRow;
