/**
 * Infra хөгжүүлэгчийн нэмсэн UI текст (Excel импорт, контент хуудас).
 * mn.ts-тэй зөрчилдөхгүйн тулд тусдаа файл — хэрэглэх газраа шууд import хийнэ.
 */

const row = (sheet: string, n: number) => `${sheet} ${n}-р мөр`;

export const infra = {
  import: {
    button: "Excel-ээс импорт",
    title: "Excel-ээс бүтээгдэхүүн импортлох",
    description: "Загварыг татаж бөглөөд оруулна. Эхлээд урьдчилан харж, алдаагүй бол импортлоно.",
    back: "← Бүтээгдэхүүн",
    step1: "1. Загвар татах",
    step1Text:
      "2 sheet: «Бүтээгдэхүүн», «Хувилбар». 2-р мөрөнд баганын тайлбар, дараа нь 2 жишээ мөр бий — жишээ мөрүүдийг устгаад өөрийн бараагаа бичнэ. «Лавлах» sheet-д ангиллын slug-ууд байна.",
    downloadTemplate: "Загвар татах (.xlsx)",
    step2: "2. Файл оруулах",
    chooseFile: "Excel файл сонгох",
    fileHint: ".xlsx, 2MB хүртэл",
    preview: "Урьдчилан харах",
    previewing: "Шалгаж байна…",
    step3: "3. Шалгах ба импортлох",
    run: "Импортлох",
    running: "Импортлож байна…",
    runDisabled: "Алдаатай мөрүүдийг Excel-д засаад файлаа дахин оруулна уу.",
    nothingToDo: "Шинэ эсвэл өөрчлөгдсөн бүтээгдэхүүн алга.",
    confirm: (n: number) => `${n} бүтээгдэхүүнийг импортлох уу? Энэ үйлдлийг буцаах боломжгүй.`,
    rules: [
      "SKU-гаар хувилбарыг таньж, байгаа бол шинэчилнэ (upsert). Бүтээгдэхүүнийг slug-аар таньна.",
      "Байгаа бүтээгдэхүүнд хоосон нүд нь «өөрчлөхгүй» гэсэн үг. Excel-д байхгүй хувилбарууд хэвээр үлдэнэ.",
      "Эхний үлдэгдэл зөвхөн ШИНЭ хувилбарт «Орлого» болж бүртгэгдэнэ — байгаа барааны үлдэгдэлд хүрэхгүй.",
      "Зургийг зөвхөн зураггүй бүтээгдэхүүнд татна (JPG, PNG, WEBP, 5MB хүртэл).",
    ],
    summary: {
      create: "Шинэ",
      update: "Шинэчлэгдэх",
      unchanged: "Өөрчлөлтгүй",
      error: "Алдаатай",
    },
    action: {
      create: "Шинэ",
      update: "Шинэчлэгдэнэ",
      unchanged: "Өөрчлөлтгүй",
      error: "Алдаа",
    },
    col: {
      row: "Мөр",
      product: "Бүтээгдэхүүн",
      variants: "Хувилбар",
      status: "Төлөв",
      notes: "Алдаа / анхааруулга",
    },
    globalErrors: "Файлын алдаа",
    warnings: "Анхааруулга",
    report: {
      title: "Импорт дууслаа",
      line: (r: { created: number; updated: number; failed: number }) =>
        `${r.created} шинэ, ${r.updated} шинэчлэгдсэн, ${r.failed} алдаа`,
      stock: (n: number) => `${n} хувилбарт эхний үлдэгдэл бүртгэгдлээ`,
      images: (n: number) => `${n} зураг татагдлаа`,
      again: "Өөр файл импортлох",
      toList: "Бүтээгдэхүүний жагсаалт",
    },
    // ─── Алдаа, анхааруулга ───
    err: {
      row,
      noFile: "Файл сонгоогүй байна.",
      notXlsx: "Зөвхөн .xlsx файл оруулна (Excel → Save As → Excel Workbook).",
      tooLarge: "Файл 2MB-аас ихгүй байх ёстой.",
      unreadable: "Excel файлыг уншиж чадсангүй. Файл гэмтсэн эсвэл .xlsx биш байна.",
      missingSheet: (name: string) => `«${name}» sheet олдсонгүй. Загвар файлыг ашиглана уу.`,
      missingColumn: (sheet: string, col: string) => `«${sheet}» sheet-д «${col}» багана алга.`,
      tooManyRows: (sheet: string, max: number) => `«${sheet}» sheet-д ${max}-аас олон мөр байна.`,
      noRows: "Импортлох мөр алга.",
      notNumber: (r: string, label: string) => `${r}: ${label} тоо биш байна`,
      required: (r: string, label: string) => `${r}: ${label} заавал бөглөнө`,
      badBool: (r: string, v: string) => `${r}: «Нийтлэх» нь «тийм» эсвэл «үгүй» байна (олдсон: «${v}»)`,
      badBadge: (r: string, v: string) => `${r}: badge «${v}» буруу — ШИНЭ, ИКОНИК, ХЯЗГААРЛАГДМАЛ, ЗӨВХӨН ОНЛАЙН эсвэл хоосон`,
      exampleRow: (r: string) => `${r}: жишээ мөр байна — устгана уу`,
      dupSlug: (r: string, slug: string, other: number) => `${r}: slug «${slug}» давхардсан (${other}-р мөртэй)`,
      dupSku: (r: string, sku: string, other: number) => `${r}: SKU «${sku}» давхардсан (${other}-р мөртэй)`,
      skuOwned: (r: string, sku: string, slug: string) => `${r}: SKU «${sku}» өөр бүтээгдэхүүнд («${slug}») ашиглагдсан`,
      unknownProduct: (r: string, slug: string) => `${r}: «${slug}» slug-тай бүтээгдэхүүн «Бүтээгдэхүүн» sheet-д алга`,
      unknownCategory: (r: string, slug: string) => `${r}: ангилал «${slug}» олдсонгүй`,
      unknownConcern: (r: string, slug: string) => `${r}: арьсны асуудал «${slug}» олдсонгүй`,
      noVariants: (r: string) => `${r}: хувилбар алга — «Хувилбар» sheet-д дор хаяж нэг мөр нэмнэ үү`,
      tooManyImages: (r: string, max: number) => `${r}: ${max}-аас олон зураг`,
      badImageUrl: (r: string, url: string) => `${r}: зургийн хаяг буруу «${url}» (https://… эсвэл /uploads/…)`,
      field: (r: string, label: string, msg: string) => `${r}: ${label} — ${msg}`,
      changedSinceReview: "Урьдчилан харснаас хойш өгөгдөл өөрчлөгдсөн байна. Дахин урьдчилан харна уу.",
    },
    warn: {
      notLatin: (r: string) => `${r}: нэр латин үсгээр биш байна (брэндийн нэрийг латинаар бичдэг)`,
      stockIgnored: (r: string, sku: string) =>
        `${r}: «${sku}» аль хэдийн байгаа тул эхний үлдэгдлийг алгасна (үлдэгдлийг «Үлдэгдэл» хэсгээс засна)`,
      archivedVariant: (r: string, sku: string) => `${r}: «${sku}» архивлагдсан хувилбар — идэвхжүүлэхгүй`,
      imagesIgnored: (r: string) => `${r}: бүтээгдэхүүнд зураг аль хэдийн байгаа тул зургийн URL-уудыг алгасна`,
      bundleKept: (r: string) => `${r}: багц бүтээгдэхүүн — бүрэлдэхүүнийг өөрчлөхгүй`,
      imageFailed: (slug: string, url: string, reason: string) => `«${slug}»: зураг татаж чадсангүй (${url}) — ${reason}`,
      stockFailed: (sku: string, reason: string) => `«${sku}»: эхний үлдэгдэл бүртгэгдсэнгүй — ${reason}`,
    },
    image: {
      badUrl: "хаяг буруу",
      privateHost: "дотоод сүлжээний хаяг зөвшөөрөгдөхгүй",
      httpStatus: (s: number) => `сервер ${s} буцаалаа`,
      tooLarge: "5MB-аас их",
      badType: "зөвхөн JPG, PNG, WEBP",
      tooManyRedirects: "хэт олон redirect",
      timeout: "хугацаа хэтэрсэн",
      network: "холбогдож чадсангүй",
    },
  },
} as const;
