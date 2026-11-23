import { describe, expect, it } from "vitest";
import { isSocialUrl, phoneSchema, settingSchemas } from "./site-settings";

const validFooter = () => ({
  columns: [
    { title: "Дэлгүүр", collections: { kind: "CATEGORY" as const }, links: [{ label: "Бүх ангилал", href: "/collections" }] },
    { title: "Компани", links: [{ label: "Бидний тухай", href: "/about" }] },
  ],
  contact: {
    title: "Холбоо барих",
    address: "Улаанбаатар, Сүхбаатар дүүрэг",
    phone: "+976 7011 2233",
    email: "info@example.mn",
    hours: ["Даваа–Баасан 10:00–20:00", "Бямба–Ням 11:00–18:00"],
  },
  socials: [
    { network: "instagram" as const, href: "https://instagram.com/biologique.mn", label: "Instagram" },
    { network: "facebook" as const, href: "https://www.facebook.com/biologique.mn", label: "Facebook" },
  ],
  newsletter: { title: "Мэдээлэл авах", text: "Шинэ мэдээг имэйлээр аваарай.", placeholder: "Имэйл хаяг", button: "Бүртгүүлэх" },
  copyright: "Biologique Recherche Mongolia. Бүх эрх хуулиар хамгаалагдсан.",
});

const errorPaths = (input: unknown) => {
  const r = settingSchemas.footer.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("footer / contact setting", () => {
  it("accepts a complete, valid footer", () => {
    expect(settingSchemas.footer.safeParse(validFooter()).success).toBe(true);
  });

  it("passes contact details through (they are validated in Тохиргоо → Салоны мэдээлэл)", () => {
    const f = validFooter();
    f.contact.phone = "";
    f.contact.email = "";
    expect(settingSchemas.footer.safeParse(f).success).toBe(true);
  });

  it("rejects a social URL on the wrong host or without https", () => {
    const f = validFooter();
    f.socials[0]!.href = "https://evil.example/instagram.com";
    f.socials[1]!.href = "http://facebook.com/biologique.mn";
    expect(errorPaths(f)).toEqual(expect.arrayContaining(["socials.0.href", "socials.1.href"]));
  });

  it("allows an empty social URL (hidden in the footer)", () => {
    const f = validFooter();
    f.socials[1]!.href = "";
    expect(settingSchemas.footer.safeParse(f).success).toBe(true);
  });

  it("keeps columns and newsletter it does not edit", () => {
    const r = settingSchemas.footer.safeParse(validFooter());
    expect(r.success && r.data.columns[0]!.collections).toEqual({ kind: "CATEGORY" });
    expect(r.success && r.data.newsletter.button).toBe("Бүртгүүлэх");
  });
});

describe("phoneSchema", () => {
  it.each(["+976 7011 2233", "7011-2233", "99112233", "+976-9911-2233"])("accepts %s", (v) => {
    expect(phoneSchema.safeParse(v).success).toBe(true);
  });

  it.each(["", "12345", "утас", "+976 7011 22a3", "99-11"])("rejects %s", (v) => {
    expect(phoneSchema.safeParse(v).success).toBe(false);
  });
});

describe("isSocialUrl", () => {
  it("matches the network host, allowing www./m.", () => {
    expect(isSocialUrl("instagram", "https://www.instagram.com/x")).toBe(true);
    expect(isSocialUrl("facebook", "https://m.facebook.com/x")).toBe(true);
    expect(isSocialUrl("instagram", "https://facebook.com/x")).toBe(false);
    expect(isSocialUrl("facebook", "https://facebook.com.evil.mn/x")).toBe(false);
    expect(isSocialUrl("instagram", "instagram.com/x")).toBe(false);
  });
});
