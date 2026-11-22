import Link from "next/link";
import type { ReactNode } from "react";
import { parseMarkdown, type Inline } from "@/lib/safe-markdown";

/** Админы оруулсан markdown-ыг аюулгүй render хийнэ (HTML-гүй, React text node). */
export function SafeMarkdown({ source, className = "" }: { source: string; className?: string }) {
  return (
    <div className={`space-y-4 text-[15px] leading-relaxed ${className}`}>
      {parseMarkdown(source).map((b, i) => {
        if (b.type === "heading") {
          const H = `h${b.level}` as "h2" | "h3" | "h4";
          return (
            <H key={i} className={b.level === 2 ? "pt-4 text-[20px] font-medium" : "pt-2 text-[17px] font-medium"}>
              {inline(b.children)}
            </H>
          );
        }
        if (b.type === "list") {
          const L = b.ordered ? "ol" : "ul";
          return (
            <L key={i} className={`space-y-1.5 pl-5 ${b.ordered ? "list-decimal" : "list-disc"}`}>
              {b.items.map((item, j) => (
                <li key={j}>{inline(item)}</li>
              ))}
            </L>
          );
        }
        return <p key={i}>{inline(b.children)}</p>;
      })}
    </div>
  );
}

function inline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    if (n.type === "text") return n.text;
    if (n.type === "strong") return <strong key={i} className="font-medium">{inline(n.children)}</strong>;
    if (n.type === "em") return <em key={i}>{inline(n.children)}</em>;
    const external = /^https?:/.test(n.href);
    return external ? (
      <a key={i} href={n.href} target="_blank" rel="noopener noreferrer nofollow" className="link-underline">
        {inline(n.children)}
      </a>
    ) : n.href.startsWith("/") ? (
      <Link key={i} href={n.href} className="link-underline">
        {inline(n.children)}
      </Link>
    ) : (
      <a key={i} href={n.href} className="link-underline">
        {inline(n.children)}
      </a>
    );
  });
}
