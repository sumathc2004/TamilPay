import React from 'react';
import tamilPayLogo from '../assets/images/tamilpay-logo.png';

const BrandLogo = ({ height = 'clamp(42px, 12vw, 84px)' }) => {
  return (
    <div className="flex items-center select-none brand-logo-wrap">
      <img
        src={tamilPayLogo}
        alt="TamilPay Logo"
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
          width: 'auto',
          objectFit: 'contain',
          display: 'block',
        }}
        draggable={false}
      />
    </div>
  );
};

export default BrandLogo;
