'use client';

import React from 'react';

interface PipesHubIconProps {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function PipesHubIcon({
  size = 80,
  style,
  className,
}: PipesHubIconProps) {
  // Renders the PIP logo mark (chevron / arrow geometry, no wordmark)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 62 45"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-flex', flexShrink: 0, ...style }}
      className={className}
    >
      <path d="M13.1124 34.9688L43.2609 4.79464L47.8552 9.38497L17.7066 39.5591L13.1124 34.9688Z" fill="#002470" />
      <path d="M13.1124 34.9688L43.2609 4.79464L47.8552 9.38497L17.7066 39.5591L13.1124 34.9688Z" fill="url(#pip-mark-gradient)" />
      <path d="M42.4999 38.7702L32.7744 29.0447L37.3107 24.5083L44.7845 31.9493L53.074 23.6598L45.6982 16.2842L50.2346 11.7151L59.8946 21.3753C60.4822 21.9628 60.841 22.8113 60.841 23.6598C60.841 24.5083 60.4822 25.3243 59.8946 25.9443L47.0687 38.7702C46.4487 39.3902 45.6654 39.7166 44.7845 39.7166C43.9357 39.684 43.12 39.3576 42.4999 38.7702Z" fill="#002470" />
      <path d="M0.954594 22.7787C-0.318198 21.5059 -0.318198 19.4825 0.954594 18.2097L13.8131 5.3512C15.0532 4.11104 17.1093 4.11104 18.3494 5.3512L28.0749 15.0766L23.5059 19.6456L16.0649 12.2047L7.77545 20.4942L15.1511 27.8699L10.6148 32.4388L0.954594 22.7787Z" fill="#002470" />
      <defs>
        <linearGradient id="pip-mark-gradient" x1="45.6113" y1="7.14301" x2="11.6374" y2="32.1607" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6798FF" />
          <stop offset="1" stopColor="#09FFE7" />
        </linearGradient>
      </defs>
    </svg>
  );
}
