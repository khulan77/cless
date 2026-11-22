import type { ReactNode } from "react";

export function SectionTitle({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={`text-section mb-8 text-center md:mb-10 ${className}`}>
      {children}
    </h2>
  );
}
