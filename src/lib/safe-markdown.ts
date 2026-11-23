/**
 * Энгийн, аюулгүй markdown parser — HTML-ийг ХЭЗЭЭ Ч render хийхгүй (React text node болно).
 * Дэмжих: # / ## / ### гарчиг, догол мөр, "- " / "1. " жагсаалт, **тод**, *налуу*, [текст](href).
 * HTML tag-ийг хасна; href зөвхөн https/http/mailto/tel эсвэл "/"-ээр эхэлсэн зам.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; level: 2 | 3 | 4; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] };

export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (/^\/(?!\/)/.test(href) || href.startsWith("#")) return href;
  try {
    const u = new URL(href);
    return ["https:", "http:", "mailto:", "tel:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

const stripHtml = (s: string) => s.replace(/<\/?[a-z][^>]*>/gi, "").replace(/<!--[\s\S]*?-->/g, "");

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  let buf = "";
  const flush = () => {
    if (buf) out.push({ type: "text", text: buf });
    buf = "";
  };
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^\*\*(.+?)\*\*/))) {
      flush();
      out.push({ type: "strong", children: parseInline(m[1]!) });
      i += m[0].length;
    } else if ((m = rest.match(/^\*(?!\s)(.+?)\*/))) {
      flush();
      out.push({ type: "em", children: parseInline(m[1]!) });
      i += m[0].length;
    } else if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
      flush();
      const href = safeHref(m[2]!);
      if (href) out.push({ type: "link", href, children: parseInline(m[1]!) });
      else out.push(...parseInline(m[1]!));
      i += m[0].length;
    } else {
      buf += src[i];
      i++;
    }
  }
  flush();
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const lines = stripHtml(src.replace(/\r\n?/g, "\n")).split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: Inline[][] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ type: "paragraph", children: parseInline(para.join(" ")) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: "list", ...list });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ type: "heading", level: (h[1]!.length + 1) as 2 | 3 | 4, children: parseInline(h[2]!) });
      continue;
    }
    const li = line.match(/^(?:([-*•])|(\d+)[.)])\s+(.*)$/);
    if (li) {
      flushPara();
      const ordered = !!li[2];
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(parseInline(li[3]!));
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}
