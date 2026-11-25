import { describe, expect, it } from "vitest";
import { buildTemplate } from "./template";
import { parseWorkbook } from "./parse";
import { buildImportPlan, parseIntCell, splitList, type ExistingProduct, type ImportContext } from "./validate";
import { fetchImage, isPrivateAddress, sniffImageType } from "./images";
import { makeXlsx, product, variant } from "./test-helpers";

const COLLECTIONS: ImportContext["collections"] = [
  { id: "c-masks", slug: "masks", kind: "CATEGORY" },
  { id: "c-serums", slug: "serums", kind: "CATEGORY" },
  { id: "c-acne", slug: "acne", kind: "CONCERN" },
];
const emptyCtx = (over: Partial<ImportContext> = {}): ImportContext => ({
  collections: COLLECTIONS,
  products: new Map(),
  skuOwners: new Map(),
  barcodeOwners: new Map(),
  ...over,
});

async function plan(products: Parameters<typeof makeXlsx>[0], variants: Parameters<typeof makeXlsx>[1], ctx = emptyCtx()) {
  return buildImportPlan(await parseWorkbook(await makeXlsx(products, variants)), ctx);
}

const existing = (over: Partial<ExistingProduct> = {}): ExistingProduct => ({
  id: "p1",
  slug: "masque",
  name: "MASQUE",
  kind: "SINGLE",
  tagline: "Маск",
  recommendedFor: null,
  benefits: ["Тайвшруулах"],
  description: "Тайлбар",
  skinScience: "Шинжлэх ухаан",
  howToUse: [],
  ingredients: null,
  environmental: { Савлагаа: "Шил" },
  clinicalNotes: ["94%"],
  seoTitle: "SEO",
  seoDescription: null,
  badge: "ICONIC",
  isPublished: true,
  sortOrder: 5,
  images: [{ id: "i1", url: "/uploads/products/a.jpg", alt: "a" }],
  variants: [
    { id: "v1", sku: "MQ-50", barcode: "4600000000050", size: "50 мл", price: 100000, costPrice: 50000, lowStockAt: 3, isActive: true },
    { id: "v2", sku: "MQ-100", barcode: null, size: "100 мл", price: 180000, costPrice: 90000, lowStockAt: 3, isActive: true },
  ],
  collectionIds: ["c-masks", "c-acne"],
  relations: [{ relatedId: "p9", type: "SIMILAR" }],
  bundleItems: [],
  ...over,
});

describe("туслах функцууд", () => {
  it("parseIntCell", () => {
    expect(parseIntCell("185,000₮")).toBe(185000);
    expect(parseIntCell("185 000")).toBe(185000);
    expect(parseIntCell("12.0")).toBe(12);
    expect(parseIntCell("")).toBeNull();
    expect(parseIntCell("12.5")).toBeNaN();
    expect(parseIntCell("үнэгүй")).toBeNaN();
  });
  it("splitList — «;» ба мөр шилжилт", () => {
    expect(splitList("a; b ;;c\nd")).toEqual(["a", "b", "c", "d"]);
  });
});

describe("parseWorkbook", () => {
  it("толгойн текстээр баганыг таньж, хоосон мөрийг алгасна", async () => {
    const parsed = await parseWorkbook(await makeXlsx([product("a"), {}, product("b")], [variant("a", "A-1")]));
    expect(parsed.errors).toEqual([]);
    expect(parsed.products.map((p) => [p.row, p.values.slug])).toEqual([
      [2, "a"],
      [4, "b"],
    ]);
    expect(parsed.variants[0]!.values.price).toBe("100000");
  });

  it("sheet алга бол алдаа", async () => {
    const parsed = await parseWorkbook(await makeXlsx([product("a")], [], { omitSheet: "Хувилбар" }));
    expect(parsed.errors.join()).toContain("«Хувилбар» sheet олдсонгүй");
  });

  it("гэмтсэн файл", async () => {
    const parsed = await parseWorkbook(new TextEncoder().encode("not a zip"));
    expect(parsed.errors[0]).toContain("уншиж чадсангүй");
  });

  it("загвар: тайлбар мөрийг алгасаж, жишээ мөрүүдийг алдаа болгоно", async () => {
    const tpl = await buildTemplate([{ slug: "masks", name: "Маск", kind: "CATEGORY" }]);
    const parsed = await parseWorkbook(tpl);
    expect(parsed.errors).toEqual([]);
    expect(parsed.products).toHaveLength(2);
    expect(parsed.products[0]!.row).toBe(3); // 1 толгой, 2 тайлбар
    const p = buildImportPlan(parsed, emptyCtx());
    expect(p.canImport).toBe(false);
    expect(p.products[0]!.errors.join()).toContain("жишээ мөр");
  });
});

describe("buildImportPlan — шалгалт", () => {
  it("зөв мөр → create, ProductInput бэлэн", async () => {
    const p = await plan(
      [product("masque", { categories: "masks", concerns: "acne", benefits: "А; Б", isPublished: "тийм", badge: "ИКОНИК" })],
      [variant("masque", "mq-50", { costPrice: 40000, initialStock: 5 })],
    );
    expect(p.canImport).toBe(true);
    expect(p.summary).toEqual({ create: 1, update: 0, unchanged: 0, error: 0 });
    const prod = p.products[0]!;
    expect(prod.input).toMatchObject({
      slug: "masque",
      badge: "ICONIC",
      isPublished: true,
      benefits: ["А", "Б"],
      collectionIds: ["c-masks", "c-acne"],
      variants: [{ sku: "MQ-50", price: 100000, costPrice: 40000, lowStockAt: 3, isActive: true }],
    });
    expect(prod.variants[0]).toMatchObject({ action: "create", initialStock: 5 });
  });

  it("хоосон нэр", async () => {
    const p = await plan([product("a", { name: "" })], [variant("a", "A-1")]);
    expect(p.products[0]!.errors).toContain("Бүтээгдэхүүн 2-р мөр: Нэр (латин) — Заавал бөглөнө.");
    expect(p.canImport).toBe(false);
  });

  it("буруу үнэ", async () => {
    const p = await plan([product("a")], [variant("a", "A-1", { price: "хямд" })]);
    expect(p.products[0]!.errors).toContain("Хувилбар 2-р мөр: Үнэ тоо биш байна");
  });

  it("сөрөг үнэ — админы формын schema-ын алдаа", async () => {
    const p = await plan([product("a")], [variant("a", "A-1", { price: -5 })]);
    expect(p.products[0]!.errors.join()).toContain("Хувилбар 2-р мөр: Үнэ — Сөрөг байж болохгүй.");
  });

  it("давхар SKU (Excel дотор)", async () => {
    const p = await plan([product("a"), product("b")], [variant("a", "X-1"), variant("b", "x-1")]);
    expect(p.products[1]!.errors).toContain("Хувилбар 3-р мөр: SKU «X-1» давхардсан (2-р мөртэй)");
  });

  it("баркод: зайг хасна; давхар, буруу, өөр хувилбарт ашиглагдсан", async () => {
    const ok = await plan([product("a")], [{ ...variant("a", "X-1"), barcode: "460 0000 1234 56" }]);
    expect(ok.products[0]!.errors).toEqual([]);
    expect(ok.products[0]!.input!.variants[0]!.barcode).toBe("4600000123456");
    const dup = await plan([product("a"), product("b")], [{ ...variant("a", "X-1"), barcode: "123456" }, { ...variant("b", "X-2"), barcode: "123456" }]);
    expect(dup.products[1]!.errors.join()).toContain("баркод «123456» давхардсан");
    const bad = await plan([product("a")], [{ ...variant("a", "X-1"), barcode: "12" }]);
    expect(bad.products[0]!.errors.join()).toContain("Баркод");
    const owned = await plan([product("a")], [{ ...variant("a", "X-1"), barcode: "123456" }], emptyCtx({ barcodeOwners: new Map([["123456", "OTHER-SKU"]]) }));
    expect(owned.products[0]!.errors.join()).toContain("өөр хувилбарт (OTHER-SKU)");
  });

  it("SKU өөр бүтээгдэхүүнд DB-д ашиглагдсан", async () => {
    const p = await plan([product("a")], [variant("a", "X-1")], emptyCtx({ skuOwners: new Map([["X-1", "other"]]) }));
    expect(p.products[0]!.errors.join()).toContain("өөр бүтээгдэхүүнд («other»)");
  });

  it("байхгүй ангилал, буруу төрлийн slug", async () => {
    const p = await plan([product("a", { categories: "serums; nope", concerns: "masks" })], [variant("a", "A-1")]);
    expect(p.products[0]!.errors).toEqual(
      expect.arrayContaining(["Бүтээгдэхүүн 2-р мөр: ангилал «nope» олдсонгүй", "Бүтээгдэхүүн 2-р мөр: арьсны асуудал «masks» олдсонгүй"]),
    );
  });

  it("давхар slug, хувилбаргүй бүтээгдэхүүн, тодорхойгүй slug-тай хувилбар", async () => {
    const p = await plan([product("a"), product("a"), product("b")], [variant("a", "A-1"), variant("zzz", "Z-1")]);
    expect(p.products[1]!.errors.join()).toContain("давхардсан (2-р мөртэй)");
    expect(p.products[2]!.errors.join()).toContain("хувилбар алга");
    expect(p.errors.join()).toContain("«zzz» slug-тай бүтээгдэхүүн");
  });

  it("badge, нийтлэх, зургийн URL буруу", async () => {
    const p = await plan([product("a", { badge: "SALE", isPublished: "магадгүй", images: "ftp://x/y.jpg" })], [variant("a", "A-1")]);
    const e = p.products[0]!.errors.join("\n");
    expect(e).toContain("badge «SALE» буруу");
    expect(e).toContain("«тийм» эсвэл «үгүй»");
    expect(e).toContain("зургийн хаяг буруу");
  });
});

describe("buildImportPlan — байгаа бүтээгдэхүүн", () => {
  const ctx = () =>
    emptyCtx({
      products: new Map([["masque", existing()]]),
      skuOwners: new Map([
        ["MQ-50", "masque"],
        ["MQ-100", "masque"],
      ]),
    });

  it("ижил утга → unchanged (давтан импорт юу ч бичихгүй)", async () => {
    const p = await plan(
      [product("masque", { name: "MASQUE", description: "Тайлбар" })],
      [variant("masque", "MQ-50", { price: 100000, costPrice: 50000 })],
      ctx(),
    );
    expect(p.products[0]!.action).toBe("unchanged");
    expect(p.products[0]!.input).toBeUndefined();
    expect(p.canImport).toBe(false);
  });

  it("үнэ солигдвол update; Excel-д байхгүй талбар, хувилбар, холбоос хэвээр", async () => {
    const p = await plan([product("masque", { name: "MASQUE", tagline: "" })], [variant("masque", "MQ-50", { price: 120000, initialStock: 9 })], ctx());
    const prod = p.products[0]!;
    expect(prod.action).toBe("update");
    expect(prod.input).toMatchObject({
      id: "p1",
      tagline: "Маск",
      skinScience: "Шинжлэх ухаан",
      seoTitle: "SEO",
      sortOrder: 5,
      badge: "ICONIC",
      isPublished: true,
      environmental: [{ key: "Савлагаа", value: "Шил" }],
      relations: [{ relatedId: "p9", type: "SIMILAR" }],
      images: [{ id: "i1" }],
      collectionIds: ["c-masks", "c-acne"],
    });
    expect(prod.input!.variants).toEqual([
      // Баркод Excel-д хоосон — хуучин нь хэвээр
      { id: "v1", sku: "MQ-50", barcode: "4600000000050", size: "50 мл", price: 120000, costPrice: 50000, lowStockAt: 3, isActive: true },
      { id: "v2", sku: "MQ-100", barcode: null, size: "100 мл", price: 180000, costPrice: 90000, lowStockAt: 3, isActive: true },
    ]);
    // байгаа хувилбарын үлдэгдэлд хүрэхгүй
    expect(prod.variants[0]!.initialStock).toBe(0);
    expect(prod.warnings.join()).toContain("эхний үлдэгдлийг алгасна");
  });

  it("ангилал бөглөвөл зөвхөн CATEGORY-г солино, CONCERN хэвээр", async () => {
    const p = await plan([product("masque", { categories: "serums" })], [variant("masque", "MQ-50", { costPrice: 50000 })], ctx());
    expect(p.products[0]!.input!.collectionIds.sort()).toEqual(["c-acne", "c-serums"]);
  });

  it("шинэ SKU нэмэгдэнэ, зураг байгаа тул URL-ийг алгасна", async () => {
    const p = await plan([product("masque", { images: "https://cdn.example.com/x.jpg" })], [variant("masque", "MQ-30", { initialStock: 4 })], ctx());
    const prod = p.products[0]!;
    expect(prod.input!.variants.map((v) => v.sku)).toEqual(["MQ-50", "MQ-100", "MQ-30"]);
    expect(prod.variants[0]).toMatchObject({ action: "create", initialStock: 4 });
    expect(prod.imageUrls).toEqual([]);
    expect(prod.warnings.join()).toContain("зураг аль хэдийн байгаа");
  });
});

describe("images", () => {
  it("isPrivateAddress", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("sniffImageType", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg"))).toBeNull();
  });

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

  it("fetchImage: дотоод хаяг, redirect-ээр дотоод руу орохыг хориглоно", async () => {
    await expect(fetchImage("http://127.0.0.1/a.png")).rejects.toThrow("дотоод сүлжээ");
    await expect(fetchImage("http://localhost/a.png")).rejects.toThrow("дотоод сүлжээ");
    const redirect = (async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } })) as unknown as typeof fetch;
    await expect(fetchImage("https://8.8.8.8/a.png", redirect)).rejects.toThrow("дотоод сүлжээ");
  });

  it("fetchImage: төрөл, хэмжээ, HTTP алдаа", async () => {
    const ok = (async () => new Response(png, { status: 200 })) as unknown as typeof fetch;
    const f = await fetchImage("https://8.8.8.8/a.png", ok);
    expect(f.type).toBe("image/png");
    const html = (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch;
    await expect(fetchImage("https://8.8.8.8/a.png", html)).rejects.toThrow("JPG, PNG, WEBP");
    const big = (async () => new Response(new Uint8Array(6 * 1024 * 1024), { status: 200 })) as unknown as typeof fetch;
    await expect(fetchImage("https://8.8.8.8/a.png", big)).rejects.toThrow("5MB");
    const notFound = (async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    await expect(fetchImage("https://8.8.8.8/a.png", notFound)).rejects.toThrow("404");
  });
});
