import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, safeHref } from "./safe-markdown";
import { aboutPageSchema, contactPageSchema, isMapEmbedUrl, ABOUT_PAGE_DEFAULT, PRIVACY_PAGE_DEFAULT, privacyPageSchema } from "./validation/content-pages";

describe("safe-markdown", () => {
  it("гарчиг, догол мөр, жагсаалт", () => {
    expect(parseMarkdown("# A\n\nНэг\nмөр\n\n- x\n- y\n\n1. z")).toEqual([
      { type: "heading", level: 2, children: [{ type: "text", text: "A" }] },
      { type: "paragraph", children: [{ type: "text", text: "Нэг мөр" }] },
      { type: "list", ordered: false, items: [[{ type: "text", text: "x" }], [{ type: "text", text: "y" }]] },
      { type: "list", ordered: true, items: [[{ type: "text", text: "z" }]] },
    ]);
  });

  it("HTML tag-ийг хасна (script, iframe, img onerror)", () => {
    const blocks = parseMarkdown('<script>alert(1)</script>Сайн <img src=x onerror="alert(1)"> байна <iframe src="//evil"></iframe>');
    expect(JSON.stringify(blocks)).not.toMatch(/<|onerror|iframe|script>/);
    expect(blocks[0]).toEqual({ type: "paragraph", children: [{ type: "text", text: "alert(1)Сайн  байна" }] });
  });

  it("аюултай линкийг текст болгоно", () => {
    expect(parseInline("[x](javascript:alert(1))").some((n) => n.type === "link")).toBe(false);
    expect(parseInline("[x](javascript:void)")).toEqual([{ type: "text", text: "x" }]);
    expect(parseInline("[x](data:text/html,hi)")).toEqual([{ type: "text", text: "x" }]);
    expect(parseInline("[x](//evil.com)")).toEqual([{ type: "text", text: "x" }]);
    expect(parseInline("[x](/contact)")).toEqual([{ type: "link", href: "/contact", children: [{ type: "text", text: "x" }] }]);
    expect(safeHref("mailto:a@b.mn")).toBe("mailto:a@b.mn");
  });

  it("**тод**, *налуу*", () => {
    expect(parseInline("a **b** *c*")).toEqual([
      { type: "text", text: "a " },
      { type: "strong", children: [{ type: "text", text: "b" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "c" }] },
    ]);
  });
});

describe("content-pages schema", () => {
  it("placeholder-ууд schema-д тэнцэнэ", () => {
    expect(aboutPageSchema.safeParse(ABOUT_PAGE_DEFAULT).success).toBe(true);
    expect(privacyPageSchema.safeParse(PRIVACY_PAGE_DEFAULT).success).toBe(true);
  });

  it("Google Maps embed: iframe кодоос src-ийг авна, бусад хаягийг хориглоно", () => {
    const r = contactPageSchema.safeParse({
      mapEmbedUrl: '<iframe src="https://www.google.com/maps/embed?pb=!1m18&amp;x=1" width="600"></iframe>',
    });
    expect(r.success && r.data.mapEmbedUrl).toBe("https://www.google.com/maps/embed?pb=!1m18&x=1");
    expect(contactPageSchema.safeParse({ mapEmbedUrl: "" }).success).toBe(true);
    expect(isMapEmbedUrl("https://evil.com/maps/embed")).toBe(false);
    expect(isMapEmbedUrl("http://www.google.com/maps/embed?pb=1")).toBe(false);
    expect(isMapEmbedUrl("https://www.google.com/maps/place/x")).toBe(false);
  });
});
