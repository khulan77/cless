/**
 * Excel импортын баганын тодорхойлолт — загвар (template.ts) ба parser (parse.ts) хоёул эндээс.
 * Баганыг толгойн текстээр нь таньдаг тул дараалал солигдсон ч ажиллана.
 */

export const PRODUCT_SHEET = "Бүтээгдэхүүн";
export const VARIANT_SHEET = "Хувилбар";
export const REFERENCE_SHEET = "Лавлах";

/** Загварын 2-р мөр (баганын тайлбар) энэ тэмдгээр эхэлдэг — parser алгасна */
export const NOTE_MARK = "ℹ";
/** Жишээ мөрийн slug — санамсаргүй импортлохоос сэргийлж алдаа өгнө */
export const EXAMPLE_SLUG_PREFIX = "example-";

export const MAX_ROWS = 2000;
export const MAX_IMAGES_PER_PRODUCT = 10;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type ColumnDef<K extends string> = {
  key: K;
  header: string;
  /** header-ийг таних нэмэлт нэрс (жижиг үсгээр) */
  aliases?: string[];
  required?: boolean;
  note: string;
  width: number;
  examples: [string | number, string | number];
};

export type ProductColumn =
  | "slug"
  | "name"
  | "tagline"
  | "recommendedFor"
  | "benefits"
  | "description"
  | "howToUse"
  | "ingredients"
  | "badge"
  | "categories"
  | "concerns"
  | "isPublished"
  | "images";

export type VariantColumn = "productSlug" | "sku" | "barcode" | "size" | "price" | "costPrice" | "initialStock" | "lowStockAt";

export const PRODUCT_COLUMNS: ColumnDef<ProductColumn>[] = [
  {
    key: "slug",
    header: "slug",
    required: true,
    note: "URL-ийн нэр: латин жижиг үсэг, тоо, зураас. Жишээ: masque-vivant. Бүтээгдэхүүнийг үүгээр таньна.",
    width: 24,
    examples: ["example-masque-vivant", "example-serum-vit-c"],
  },
  {
    key: "name",
    header: "Нэр (латин)",
    aliases: ["нэр", "name"],
    required: true,
    note: "Брэндийн нэр латинаар, орчуулахгүй. Жишээ: MASQUE VIVANT",
    width: 26,
    examples: ["ЖИШЭЭ MASQUE VIVANT", "ЖИШЭЭ SÉRUM VIT C"],
  },
  {
    key: "tagline",
    header: "Tagline",
    note: "Нэрийн доорх богино тайлбар (160 тэмдэгт хүртэл)",
    width: 30,
    examples: ["Арьсыг тэнцвэржүүлэх нүүрний маск", "Гэрэлтүүлэх серум"],
  },
  {
    key: "recommendedFor",
    header: "Хэнд тохиромжтой",
    aliases: ["recommended for"],
    note: "Нэг өгүүлбэр (300 тэмдэгт хүртэл)",
    width: 32,
    examples: ["Тос ихтэй, батга гарах хандлагатай арьсанд.", "Бүдэг, өнгө жигд бус арьсанд."],
  },
  {
    key: "benefits",
    header: "Ашиг тус",
    aliases: ["benefits"],
    note: "«;»-ээр тусгаарлана, 6 хүртэл, тус бүр 40 тэмдэгт хүртэл",
    width: 30,
    examples: ["Тайвшруулах; Нүх сүв нарийсгах", "Гэрэлтүүлэх; Өнгө жигдрүүлэх"],
  },
  {
    key: "description",
    header: "Тайлбар",
    aliases: ["description"],
    required: true,
    note: "Бүтээгдэхүүний дэлгэрэнгүй тайлбар",
    width: 40,
    examples: ["Арьсны тэнцвэрийг сэргээдэг маск.", "Витамин C агуулсан серум."],
  },
  {
    key: "howToUse",
    header: "Хэрэглэх заавар",
    aliases: ["how to use"],
    note: "Алхам бүрийг «;»-ээр тусгаарлана (12 хүртэл)",
    width: 40,
    examples: ["Цэвэр арьсанд түрхэнэ; 10 минутын дараа угаана", "Өглөө, орой 2-3 дусал түрхэнэ"],
  },
  {
    key: "ingredients",
    header: "Найрлага",
    aliases: ["найрлага (inci)", "ingredients", "inci"],
    note: "INCI — латинаар",
    width: 30,
    examples: ["Aqua, Glycerin, Kaolin", "Aqua, Ascorbic Acid"],
  },
  {
    key: "badge",
    header: "Badge",
    note: "ШИНЭ / ИКОНИК / ХЯЗГААРЛАГДМАЛ / ЗӨВХӨН ОНЛАЙН / хоосон. Байгаа бүтээгдэхүүнд хоосон бол өөрчлөхгүй.",
    width: 18,
    examples: ["ИКОНИК", ""],
  },
  {
    key: "categories",
    header: "Ангилал",
    aliases: ["categories"],
    note: "Ангиллын slug-ууд «;»-ээр («Лавлах» sheet-ийг үз). Байгаа бүтээгдэхүүнд бөглөвөл ангиллыг яг үүгээр солино.",
    width: 24,
    examples: ["masks", "serums"],
  },
  {
    key: "concerns",
    header: "Арьсны асуудал",
    aliases: ["concerns"],
    note: "Арьсны асуудлын slug-ууд «;»-ээр («Лавлах» sheet-ийг үз)",
    width: 24,
    examples: ["acne", "pigmentation"],
  },
  {
    key: "isPublished",
    header: "Нийтлэх",
    aliases: ["published"],
    note: "тийм / үгүй. Хоосон: шинэ бол үгүй (ноорог), байгаа бол өөрчлөхгүй.",
    width: 12,
    examples: ["тийм", "үгүй"],
  },
  {
    key: "images",
    header: "Зургийн URL",
    aliases: ["зургийн url-ууд", "зураг", "images"],
    note: "https://… хаягууд «;»-ээр (JPG/PNG/WEBP, 5MB хүртэл). Зөвхөн зураггүй бүтээгдэхүүнд татна.",
    width: 40,
    examples: ["https://example.com/masque.jpg", ""],
  },
];

export const VARIANT_COLUMNS: ColumnDef<VariantColumn>[] = [
  {
    key: "productSlug",
    header: "Бүтээгдэхүүний slug",
    aliases: ["slug", "product slug"],
    required: true,
    note: "«Бүтээгдэхүүн» sheet-ийн slug",
    width: 26,
    examples: ["example-masque-vivant", "example-serum-vit-c"],
  },
  {
    key: "sku",
    header: "SKU",
    required: true,
    note: "Латин том үсэг, тоо, зураас. Давхардахгүй. Хувилбарыг үүгээр таньна.",
    width: 18,
    examples: ["EX-MV-50", "EX-VITC-30"],
  },
  {
    key: "barcode",
    header: "Баркод",
    aliases: ["barcode", "ean"],
    note: "Заавал биш. Тоо, латин үсэг (4–32). Давхардахгүй. Хоосон: байгаа хувилбарт өөрчлөхгүй.",
    width: 18,
    examples: ["", ""],
  },
  {
    key: "size",
    header: "Хэмжээ",
    aliases: ["size"],
    required: true,
    note: "Жишээ: 50 мл",
    width: 12,
    examples: ["50 мл", "30 мл"],
  },
  {
    key: "price",
    header: "Үнэ",
    aliases: ["үнэ (₮)", "price"],
    required: true,
    note: "Төгрөг, бүхэл тоо",
    width: 12,
    examples: [185000, 240000],
  },
  {
    key: "costPrice",
    header: "Өртөг",
    aliases: ["өртөг (₮)", "cost"],
    note: "Төгрөг. Хоосон: шинэ бол 0, байгаа бол өөрчлөхгүй.",
    width: 12,
    examples: [92000, 120000],
  },
  {
    key: "initialStock",
    header: "Эхний үлдэгдэл",
    aliases: ["үлдэгдэл", "stock"],
    note: "Зөвхөн ШИНЭ хувилбарт «Орлого» болж бүртгэгдэнэ",
    width: 14,
    examples: [12, 6],
  },
  {
    key: "lowStockAt",
    header: "Бага үлдэгдлийн босго",
    aliases: ["босго", "low stock"],
    note: "Үүнээс бага болоход анхааруулна. Хоосон: 3",
    width: 14,
    examples: [3, 2],
  },
];

/** "Үнэ (₮) *" → "үнэ (₮)" */
export const normalizeHeader = (s: string) =>
  s.replace(/\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export const BADGE_INPUT: Record<string, "NEW" | "ICONIC" | "LIMITED" | "ONLINE_EXCLUSIVE"> = {
  "шинэ": "NEW",
  "иконик": "ICONIC",
  "хязгаарлагдмал": "LIMITED",
  "зөвхөн онлайн": "ONLINE_EXCLUSIVE",
  new: "NEW",
  iconic: "ICONIC",
  limited: "LIMITED",
  online_exclusive: "ONLINE_EXCLUSIVE",
};

export const TRUE_WORDS = new Set(["тийм", "тиймээ", "yes", "y", "true", "1", "нийтлэх"]);
export const FALSE_WORDS = new Set(["үгүй", "үгүйээ", "no", "n", "false", "0"]);
