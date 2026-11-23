import type { ReactNode } from "react";

export function SectionTitle({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={`text-section mb-5 text-center md:mb-[30px] ${className}`}>
      {children}
    </h2>
  );
}
