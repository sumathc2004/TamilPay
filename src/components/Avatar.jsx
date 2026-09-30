import React from 'react';
import { getInitials } from '../utils/customer';

/** Small gradient circle showing a customer's initials — used in the table and detail header. */
const Avatar = ({ name, size = 40 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #F26A1B, #FF5A36)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff',
      fontWeight: 700,
      fontSize: size * 0.36,
      fontFamily: 'Inter, sans-serif',
      flexShrink: 0,
    }}
  >
    {getInitials(name)}
  </div>
);

export default Avatar;
