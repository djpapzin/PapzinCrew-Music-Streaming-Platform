import React from 'react';

export const ImageIcon: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={1.5} />
      <circle cx="9" cy="9" r="2" strokeWidth={1.5} />
      <path d="m21 15-3.086-3.086a2 2 0 00-2.828 0L6 21" strokeWidth={1.5} />
    </svg>
  );
};