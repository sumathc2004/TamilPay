import React from 'react';
import heroExactImg from '../assets/images/tamilpay-hero.jpg';

/**
 * Hero — the branded panel down the right of the login screen.
 *
 * It covers its panel rather than fitting inside it: `contain` left letterbox
 * gaps whenever the image's proportions didn't match the panel's, and those
 * gaps are what made it read as a photo dropped onto the page instead of part
 * of it. The edge is left clean — a soft mask here just looked like the image
 * was dissolving.
 */
const Hero = () => {
  return (
    <div className="hero-image-wrap">
      <img
        src={heroExactImg}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
          userSelect: 'none',
          display: 'block',
        }}
        draggable={false}
      />
    </div>
  );
};

export default Hero;
