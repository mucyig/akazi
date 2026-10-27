import React from 'react';

// Phone/tablet background for the auth pages: one smooth S-curve from the top-right
// corner to the bottom-left corner. Green above-left, off-white below-right.
// Hidden on desktop (lg+), where the pages use their side panel instead.
export default function AuthBackdrop() {
  return (
    <svg
      className="absolute inset-0 w-full h-full lg:hidden pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M0,0 L100,0 C72,22 94,46 54,58 S24,82 0,100 Z" fill="#17483A" />
    </svg>
  );
}