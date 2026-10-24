import React from "react";

export function HireVisionLogo({ className = "h-25 w-25" }: { className?: string }) {
  
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img 
      src="/logo.png" 
      alt="HireVision AI Logo" 
      className={`${className} object-contain shrink-0`} 
    />
  );
}
