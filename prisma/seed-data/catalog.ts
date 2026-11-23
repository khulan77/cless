/**
 * Каталогийн seed өгөгдөл. Бүх текст PROMPT 3 §1.3-ийн толь бичгээр.
 *
 * АНХААР: Тайлбар, INCI, үнэ нь PLACEHOLDER — бодит мэдээллийг дистрибьютер
 * админаас оруулна. Эмчилгээний амлалт бичихгүй ("тусална", "сайжруулна").
 */
import type { BadgeType } from "../../src/generated/prisma/client";

// ─────────────────────────── Ангилал ───────────────────────────

export type SeedCollection = {
  slug: string;
  name: string;
  kind: "CATEGORY" | "CONCERN";
  parent?: string;
  heading?: string;
  intro: string;
  seoText: string;
  banner?: number;
  tile?: string;
  showOnHome?: boolean;
  showInMenu?: boolean;
};

export const collections: SeedCollection[] = [
  // ── CATEGORY: дээд түвшин
  {
    slug: "face-care",
    name: "Нүүрний арчилгаа",
    kind: "CATEGORY",
    banner: 1,
    intro: "Арьсны төлөв байдалд тань тохирсон цэвэрлэгээнээс эхлээд серум, крем хүртэлх бүрэн арчилгаа.",
    seoText:
      "Biologique Recherche-ийн нүүрний арчилгаа нь арьсны өнөөгийн төлөв байдлыг үндэслэн сонгогдоно. Цэвэрлэгч, Лосьон P50, серум, маск, кремийг дарааллаар нь хэрэглэснээр арьсны харагдах байдлыг жигд сайжруулахад тусална. Өөрт тохирох арчилгаагаа сонгоход манай салоны гоо сайханчид зөвлөгөө өгнө.",
  },
  {
    slug: "body",
    name: "Биеийн арчилгаа",
    kind: "CATEGORY",
    banner: 2,
    tile: "/placeholders/category-7.svg",
    intro: "Биеийн арьсыг чийгшүүлж, зөөлөн, тэгш харагдуулахад зориулсан арчилгаа.",
    seoText:
      "Биеийн арчилгааны бүтээгдэхүүнүүд нь арьсны чийгшлийг хадгалж, илүү зөөлөн, нягт харагдуулахад тусална. Өдөр бүрийн хэрэглээнд тохиромжтой.",
  },
  {
    slug: "hair",
    name: "Үсний арчилгаа",
    kind: "CATEGORY",
    banner: 3,
    tile: "/placeholders/category-8.svg",
    intro: "Хуйх болон үсийг зөөлөн цэвэрлэж, тэжээх арчилгаа.",
    seoText: "Үсний арчилгааны цуглуулга удахгүй өргөжнө. Хуйхны төлөв байдалд тохирсон бүтээгдэхүүнээ гоо сайханчаасаа асууна уу.",
  },
  {
    slug: "gifts",
    name: "Бэлэг",
    kind: "CATEGORY",
    banner: 4,
    intro: "Хайртай хүмүүстээ зориулсан арчилгааны багц.",
    seoText: "Арчилгааны багцууд нь хэд хэдэн бүтээгдэхүүнийг нэг дор, арчилгааны алхмын дарааллаар нь хослуулсан тул бэлэг болгоход тохиромжтой.",
  },
  // ── Нүүрний арчилгаа ›
  {
    slug: "cleansers-milks",
    name: "Цэвэрлэгч ба сүү",
    kind: "CATEGORY",
    parent: "face-care",
    tile: "/placeholders/category-1.svg",
    intro: "Арьсыг хуурайшуулахгүйгээр будаг, бохирдлыг зөөлөн арилгах цэвэрлэгч сүү.",
    seoText: "Цэвэрлэгээ бол арчилгааны эхний алхам. Арьсны төрөлд тохирсон сүүг сонгосноор дараагийн алхмуудын үйлчлэлд арьсыг бэлтгэнэ.",
  },
  {
    slug: "lotion-p50",
    name: "Лосьон P50",
    kind: "CATEGORY",
    parent: "face-care",
    tile: "/placeholders/category-2.svg",
    showOnHome: true,
    intro: "Арьсны тэнцвэрийг сэргээх хальслагч лосьонууд.",
    seoText:
      "Лосьон P50 нь цэвэрлэгээний дараа хэрэглэх хальслагч, тэнцвэржүүлэгч лосьон юм. Арьсны төрөл, мэдрэг байдлаас хамааран өөр өөр хувилбартай тул гоо сайханчаасаа зөвлөгөө аваарай.",
  },
  {
    slug: "serum",
    name: "Серум",
    kind: "CATEGORY",
    parent: "face-care",
    tile: "/placeholders/category-3.svg",
    showOnHome: true,
    banner: 2,
    intro: "Арьсны хэрэгцээ бүрт зориулсан өндөр идэвхт серумууд — хөгшрөлтийн эсрэг, чийгшүүлэх, чангалах, батганы эсрэг.",
    seoText:
      "Серум нь лосьоны дараа, кремийн өмнө хэрэглэгдэх идэвхт бодисоор баялаг арчилгаа юм. Нэг дор хэд хэдэн серумыг хослуулан хэрэглэж болно. Арьсныхаа өнөөгийн байдалд тохирохыг сонгоорой.",
  },
  {
    slug: "creams",
    name: "Крем",
    kind: "CATEGORY",
    parent: "face-care",
    tile: "/placeholders/category-4.svg",
    showOnHome: true,
    intro: "Арчилгааны сүүлийн алхам — арьсыг тэжээж, хамгаалах кремүүд.",
    seoText: "Крем нь серумын үйлчлэлийг бэхжүүлж, арьсны хамгаалах давхаргыг дэмжинэ. Өдөр, шөнийн хэрэглээнд тохирохыг сонгоорой.",
  },
  {
    slug: "eyes-lips",
    name: "Нүд ба уруул",
    kind: "CATEGORY",
    parent: "face-care",
    tile: "/placeholders/category-6.svg",
    intro: "Нүдний орчим, уруулын эмзэг арьсанд зориулсан арчилгаа.",
    seoText: "Нүдний орчмын арьс нимгэн, эмзэг тул тусгай арчилгаа шаарддаг. Эдгээр бүтээгдэхүүн нь хавагнасан, ядарсан харагдах байдлыг багасгахад тусална.",
  },
  {
    slug: "masks",
    name: "Маск",
    kind: "CATEGORY",
    parent: "face-care",
    tile: "/placeholders/category-5.svg",
    showOnHome: true,
    intro: "Долоо хоногт 1–2 удаа хэрэглэх цэвэршүүлэх, чийгшүүлэх маскууд.",
    seoText: "Маск нь арчилгааг гүнзгийрүүлэх нэмэлт алхам юм. Арьсны тухайн үеийн хэрэгцээнд тохирсон маскийг сонгоорой.",
  },
  // ── Серум ›
  {
    slug: "serum-anti-ageing",
    name: "Хөгшрөлтийн эсрэг",
    kind: "CATEGORY",
    parent: "serum",
    intro: "Үрчлээ, уян хатан чанар алдагдах шинжийн харагдах байдлыг багасгахад туслах серум.",
    seoText: "Хөгшрөлтийн эсрэг серумууд нь арьсыг илүү гөлгөр, дүүрэн харагдуулахад тусална.",
  },
  {
    slug: "serum-hydrating",
    name: "Чийгшүүлэх",
    kind: "CATEGORY",
    parent: "serum",
    intro: "Хуурай, чийгшил алдсан арьсанд зориулсан серум.",
    seoText: "Чийгшүүлэх серумууд нь арьсны чийгшлийг хадгалж, тав тухтай мэдрэмж өгнө.",
  },
  {
    slug: "serum-firming",
    name: "Чангалах",
    kind: "CATEGORY",
    parent: "serum",
    intro: "Арьсны нягтрал, уян хатан чанарыг дэмжих серум.",
    seoText: "Чангалах серумууд нь нүүрний контурыг илүү тод, арьсыг нягт харагдуулахад тусална.",
  },
  {
    slug: "serum-blemish",
    name: "Батганы эсрэг",
    kind: "CATEGORY",
    parent: "serum",
    intro: "Батга гарах хандлагатай арьсанд зориулсан цэвэршүүлэх серум.",
    seoText: "Батганы эсрэг серумууд нь тосны ялгаралтыг тэнцвэржүүлж, арьсыг цэвэр харагдуулахад тусална.",
  },
  // ── CONCERN (арьсны хэрэгцээ)
  ...(
    [
      ["pigmentation", "Пигментаци ба толбо", "ПИГМЕНТАЦИЙН ПРОТОКОЛ", "Толбо, жигд бус өнгөний харагдах байдлыг багасгахад туслах арчилгааны дараалал.", 1],
      ["anti-ageing", "Хөгшрөлтийн эсрэг", "ХӨГШРӨЛТИЙН ЭСРЭГ ПРОТОКОЛ", "Үрчлээ, уян хатан чанар алдагдах шинжид зориулсан арчилгааны дараалал.", 2],
      ["blemishes", "Батга ба арьсны согог", "БАТГАНЫ ЭСРЭГ ПРОТОКОЛ", "Батга гарах хандлагатай, тос ихтэй арьсанд зориулсан арчилгааны дараалал.", 3],
      ["hydration", "Чийгшүүлэлт", "ЧИЙГШҮҮЛЭЛТИЙН ПРОТОКОЛ", "Хуурай, чийгшил дутсан арьсанд зориулсан арчилгааны дараалал.", 4],
      ["skin-texture", "Арьсны чанар", "АРЬСНЫ ЧАНАРЫН ПРОТОКОЛ", "Нүх сүв, арьсны гадаргууг илүү тэгш харагдуулах арчилгааны дараалал.", 5],
      ["sensitive-skin", "Мэдрэг арьс", "МЭДРЭГ АРЬСНЫ ПРОТОКОЛ", "Амархан улайдаг, мэдрэг арьсанд зориулсан зөөлөн арчилгааны дараалал.", 6],
      ["plumping", "Дүүргэлт", "ДҮҮРГЭЛТИЙН ПРОТОКОЛ", "Арьсыг илүү дүүрэн, гөлгөр харагдуулах арчилгааны дараалал.", 7],
      ["firming", "Чангалах", "ЧАНГАЛАХ ПРОТОКОЛ", "Арьсны нягтрал, нүүрний контурыг дэмжих арчилгааны дараалал.", 8],
    ] as const
  ).map(
    ([slug, name, heading, intro, n]): SeedCollection => ({
      slug,
      name,
      heading,
      kind: "CONCERN",
      intro,
      seoText: `${name} — арьсны энэ хэрэгцээнд зориулсан бүтээгдэхүүнүүдийг арчилгааны алхмын дарааллаар нь (цэвэрлэгээ, лосьон, серум, маск, крем) байрлуулсан. Алхам бүрийг дараалуулан хэрэглэснээр арчилгааны үр нөлөө бүрэн илэрнэ. Өөрт тохирох дарааллыг сонгоход салоны арьсны оношлогоо тусална.`,
      tile: `/placeholders/concern-${n}.svg`,
      banner: ((n - 1) % 4) + 1,
      showOnHome: true,
    }),
  ),
];

// ─────────────────────────── Бүтээгдэхүүн ───────────────────────────

/** Арчилгааны алхам — CONCERN доторх дараалал */
export const STEP = { cleanse: 1, lotion: 2, serum: 3, mask: 4, cream: 5, eye: 6, body: 7, hair: 8, set: 9 } as const;

export type SeedVariant = { size: string; price: number; cost: number; stock: number };

export type SeedProduct = {
  slug: string;
  name: string;
  kind?: "SINGLE" | "BUNDLE";
  badge?: BadgeType;
  step: number;
  tagline: string;
  recommendedFor: string;
  benefits: string[];
  description: string;
  skinScience: string;
  howToUse: string[];
  ingredients: string;
  categories: string[];
  concerns: string[];
  variants: SeedVariant[];
  clinical?: boolean;
};

const INCI = {
  milk: "Aqua, Caprylic/Capric Triglyceride, Glycerin, Cetearyl Alcohol, Glyceryl Stearate, Panthenol, Allantoin, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin.",
  lotion: "Aqua, Alcohol Denat., Propylene Glycol, Niacinamide, Lactic Acid, Citric Acid, Allantoin, Sodium Hydroxide, Phenoxyethanol.",
  serum: "Aqua, Glycerin, Butylene Glycol, Sodium Hyaluronate, Panthenol, Hydrolyzed Yeast Protein, Xanthan Gum, Phenoxyethanol, Ethylhexylglycerin.",
  mask: "Aqua, Kaolin, Glycerin, Zinc Oxide, Bentonite, Salicylic Acid, Panthenol, Xanthan Gum, Phenoxyethanol.",
  cream: "Aqua, Caprylic/Capric Triglyceride, Glycerin, Cetearyl Alcohol, Butyrospermum Parkii Butter, Tocopherol, Sodium Hyaluronate, Phenoxyethanol.",
  hair: "Aqua, Sodium Cocoyl Isethionate, Cocamidopropyl Betaine, Glycerin, Panthenol, Citric Acid, Phenoxyethanol.",
};

const HOW = {
  milk: [
    "Өглөө, орой хуурай арьсанд хуруугаараа бага зэрэг түрхэнэ.",
    "Зөөлөн дугуйлан иллэгээр будаг, бохирдлыг уусгана.",
    "Чийгтэй хөвөн самбайгаар арчиж арилгана.",
  ],
  lotion: [
    "Цэвэрлэгээний дараа хөвөн дээр хангалттай хэмжээгээр дусаана.",
    "Нүүр, хүзүү, энгэрээр доороос дээш чиглэлд арчина.",
    "Нүдний орчимд хүргэхгүй. Угаахгүй.",
  ],
  serum: [
    "Лосьоны дараа 2–3 дусал авна.",
    "Нүүр, хүзүүнд зөөлөн тэгшлэн түрхэж шингээнэ.",
    "Өглөө, оройд хэрэглэх боломжтой. Дараа нь кремээ түрхэнэ.",
  ],
  mask: [
    "Нүүр, хүзүү, энгэрт жигд түрхэнэ.",
    "15 минут байлгана.",
    "Хүйтэн усаар зөөлөн хөөсрүүлж, чийгтэй хөвөн самбайгаар арчиж угаана.",
    "Нүд болон нүдний орчимд хүргэхгүй. Зөвхөн гадуур хэрэглэнэ.",
  ],
  cream: [
    "Серумын дараа сувдны хэмжээтэй крем авна.",
    "Нүүр, хүзүүнд дээшээ чиглэлтэй зөөлөн иллэгээр түрхэнэ.",
    "Өглөө, орой хэрэглэнэ.",
  ],
  eye: [
    "Нүдний орчмын арьсанд маш бага хэмжээгээр хэрэглэнэ.",
    "Хурууны үзүүрээр зөөлөн товшиж шингээнэ.",
    "Нүдэнд шууд хүргэхгүй.",
  ],
  body: ["Шүршүүрийн дараа чийгтэй арьсанд түрхэнэ.", "Дээшээ чиглэлтэй иллэгээр бүрэн шингээнэ.", "Өдөр бүр хэрэглэнэ."],
  hair: ["Нойтон үсэнд бага хэмжээгээр түрхэнэ.", "Хуйхыг зөөлөн иллэж хөөсрүүлнэ.", "Бүлээн усаар сайтар зайлна."],
};

export const products: SeedProduct[] = [
  // ── Цэвэрлэгч
  {
    slug: "lait-vip-o2",
    name: "LAIT VIP O2",
    step: STEP.cleanse,
    tagline: "Арьсыг сэргээх цэвэрлэгч сүү",
    recommendedFor: "Бүх төрлийн арьсанд, ялангуяа ядарсан, бүдэг харагдах арьсанд тохиромжтой.",
    benefits: ["Будаг арилгах", "Сэргээх", "Гэрэлтүүлэх"],
    description:
      "Зөөлөн бүтэцтэй энэхүү сүү нь будаг, өдрийн бохирдлыг хуурайшуулалгүй арилгана. Цэвэрлэгээний дараа арьс сэргэг, гэрэлтэй харагдана.",
    skinScience: "Хотын орчин, ядаргаа арьсыг бүдэг харагдуулдаг. Цэвэрлэгээ нь дараагийн арчилгааны үйлчлэлд арьсыг бэлтгэх анхны алхам юм.",
    howToUse: HOW.milk,
    ingredients: INCI.milk,
    categories: ["cleansers-milks"],
    concerns: ["skin-texture", "hydration", "anti-ageing"],
    variants: [
      { size: "250 мл", price: 180_000, cost: 90_000, stock: 10 },
      { size: "100 мл", price: 95_000, cost: 48_000, stock: 2 },
    ],
  },
  {
    slug: "lait-sr",
    name: "LAIT S.R.",
    step: STEP.cleanse,
    tagline: "Мэдрэг арьсанд зориулсан тайвшруулах сүү",
    recommendedFor: "Мэдрэг, амархан улайдаг арьсанд тохиромжтой.",
    benefits: ["Тайвшруулах", "Будаг арилгах", "Хамгаалах давхаргыг дэмжих"],
    description:
      "Эмзэг арьсыг тайвшруулах орцтой энэхүү сүү нь будгийг зөөлөн арилгана. Цэвэрлэгээний дараа арьс тав тухтай, татагдсан мэдрэмжгүй байна.",
    skinScience: "Мэдрэг арьсны хамгаалах давхарга сул байдаг тул зөөлөн цэвэрлэгээ нь арьсны тав тухыг хадгалахад чухал.",
    howToUse: HOW.milk,
    ingredients: INCI.milk,
    categories: ["cleansers-milks"],
    concerns: ["sensitive-skin", "hydration", "pigmentation"],
    variants: [
      { size: "250 мл", price: 175_000, cost: 88_000, stock: 8 },
      { size: "50 мл", price: 55_000, cost: 27_000, stock: 15 },
    ],
  },
  {
    slug: "lait-e",
    name: "LAIT E",
    step: STEP.cleanse,
    tagline: "Тос ихтэй арьсанд зориулсан цэвэрлэгч сүү",
    recommendedFor: "Холимог болон тос ихтэй арьсанд тохиромжтой.",
    benefits: ["Цэвэршүүлэх", "Тэнцвэржүүлэх"],
    description:
      "Хөнгөн бүтэцтэй сүү нь илүүдэл тос, бохирдлыг арилгаж, арьсыг цэвэр, гялбаагүй үлдээнэ. Өдөр бүрийн цэвэрлэгээнд тохиромжтой.",
    skinScience: "Тосны илүүдэл ялгаралт нүх сүвийг томруулж харагдуулдаг. Тэнцвэртэй цэвэрлэгээ нь арьсыг хуурайшуулахгүйгээр цэвэрлэнэ.",
    howToUse: HOW.milk,
    ingredients: INCI.milk,
    categories: ["cleansers-milks"],
    concerns: ["blemishes", "skin-texture"],
    variants: [{ size: "250 мл", price: 170_000, cost: 85_000, stock: 6 }],
  },
  // ── Лосьон P50
  {
    slug: "lotion-p50",
    name: "LOTION P50",
    badge: "ICONIC",
    step: STEP.lotion,
    tagline: "Арьсны тэнцвэрийг сэргээх хальслагч лосьон",
    recommendedFor: "Хэвийн, холимог, тос ихтэй арьсанд тохиромжтой.",
    benefits: ["Хальслах", "Тэнцвэржүүлэх", "Арьсны чанар"],
    description:
      "Энэхүү лосьон нь үхсэн эсийг зөөлөн хальсалж, арьсны гадаргууг тэгш харагдуулна. Арьсыг дараагийн арчилгаанд бэлтгэж, илүү гэрэлтэй болгоно.",
    skinScience: "Арьсны гадаргуу дахь үхсэн эсийн давхарга арьсыг бүдэг харагдуулдаг. Тогтмол, зөөлөн хальслалт нь арьсны жигд байдлыг сайжруулахад тусална.",
    howToUse: HOW.lotion,
    ingredients: INCI.lotion,
    categories: ["lotion-p50"],
    concerns: ["blemishes", "skin-texture", "firming", "pigmentation"],
    variants: [
      { size: "250 мл", price: 280_000, cost: 150_000, stock: 14 },
      { size: "150 мл", price: 190_000, cost: 100_000, stock: 9 },
      { size: "50 мл", price: 80_000, cost: 40_000, stock: 12 },
    ],
    clinical: true,
  },
  {
    slug: "lotion-p50-pigm-400",
    name: "LOTION P50 PIGM 400",
    badge: "ICONIC",
    step: STEP.lotion,
    tagline: "Толбо ихтэй арьсанд зориулсан лосьон",
    recommendedFor: "Пигментацитай, жигд бус өнгөтэй арьсанд тохиромжтой.",
    benefits: ["Толбоны эсрэг", "Өнгө жигдрүүлэх", "Хальслах"],
    description:
      "Энэхүү лосьон нь арьсыг зөөлөн хальсалж, толбоны харагдах байдлыг багасгахад тусална. Тогтмол хэрэглэхэд арьсны өнгө илүү жигд харагдана.",
    skinScience: "Нарны туяа, дааврын өөрчлөлт пигментацийг идэвхжүүлдэг. Хальслалт ба өнгө жигдрүүлэх орцын хослол нь толбыг бүдгэрүүлэхэд тусална.",
    howToUse: [...HOW.lotion, "Өдөр нь нарны хамгаалалт заавал хэрэглэнэ."],
    ingredients: INCI.lotion,
    categories: ["lotion-p50"],
    concerns: ["pigmentation"],
    variants: [
      { size: "250 мл", price: 320_000, cost: 170_000, stock: 6 },
      { size: "150 мл", price: 220_000, cost: 115_000, stock: 0 },
    ],
  },
  {
    slug: "lotion-p50w",
    name: "LOTION P50W",
    step: STEP.lotion,
    tagline: "Мэдрэг арьсанд зориулсан зөөлөн лосьон",
    recommendedFor: "Мэдрэг, хуурай арьсанд тохиромжтой.",
    benefits: ["Тайвшруулах", "Хальслах", "Чийгшүүлэх"],
    description: "Лосьон P50-ийн зөөлөн хувилбар нь мэдрэг арьсыг цочроохгүйгээр хальсалж, чийгшлийг хадгалахад тусална.",
    skinScience: "Мэдрэг арьсанд хальслалт хэрэгтэй ч зөөлөн байх ёстой. Чийгшүүлэх орц нь арьсны тав тухыг хадгална.",
    howToUse: HOW.lotion,
    ingredients: INCI.lotion,
    categories: ["lotion-p50"],
    concerns: ["sensitive-skin", "hydration"],
    variants: [
      { size: "250 мл", price: 280_000, cost: 150_000, stock: 5 },
      { size: "150 мл", price: 190_000, cost: 100_000, stock: 4 },
    ],
  },
  // ── Серум
  {
    slug: "serum-vivant",
    name: "SÉRUM VIVANT",
    badge: "NEW",
    step: STEP.serum,
    tagline: "Батга гарах хандлагатай арьсанд зориулсан серум",
    recommendedFor: "Тос ихтэй, батга гарах хандлагатай арьсанд тохиромжтой.",
    benefits: ["Цэвэршүүлэх", "Тосны ялгаралт тохируулах", "Нүх сүв нарийсгах"],
    description:
      "Хөнгөн бүтэцтэй энэхүү серум нь тосны ялгаралтыг тэнцвэржүүлж, батганы харагдах байдлыг багасгахад тусална. Арьс цэвэр, гялбаагүй харагдана.",
    skinScience: "Илүүдэл тос, бактерийн тэнцвэр алдагдах нь батга гарах гол шалтгаан. Цэвэршүүлэх орц нь арьсны тэнцвэрийг дэмжинэ.",
    howToUse: HOW.serum,
    ingredients: INCI.serum,
    categories: ["serum", "serum-blemish"],
    concerns: ["blemishes", "skin-texture"],
    variants: [
      { size: "30 мл", price: 240_000, cost: 120_000, stock: 11 },
      { size: "8 мл", price: 85_000, cost: 40_000, stock: 9 },
    ],
  },
  {
    slug: "progeskin",
    name: "PROGESKIN",
    badge: "NEW",
    step: STEP.serum,
    tagline: "Арьсыг дүүргэж, гөлгөр харагдуулах серум",
    recommendedFor: "Уян хатан чанараа алдаж буй, үрчлээтэй арьсанд тохиромжтой.",
    benefits: ["Дүүргэх", "Хөгшрөлтийн эсрэг", "Тэгшлэх"],
    description: "Энэхүү серум нь арьсыг илүү дүүрэн, гөлгөр харагдуулж, нарийн үрчлээний харагдах байдлыг багасгахад тусална.",
    skinScience: "Нас ахих тусам арьсны нягтрал буурч, үрчлээ тод харагддаг. Дүүргэх орц нь арьсны гадаргууг тэгш харагдуулна.",
    howToUse: HOW.serum,
    ingredients: INCI.serum,
    categories: ["serum", "serum-anti-ageing"],
    concerns: ["anti-ageing", "plumping"],
    variants: [
      { size: "30 мл", price: 420_000, cost: 210_000, stock: 8 },
      { size: "8 мл", price: 140_000, cost: 70_000, stock: 0 },
    ],
    clinical: true,
  },
  {
    slug: "serum-colostrum",
    name: "SÉRUM COLOSTRUM",
    step: STEP.serum,
    tagline: "Мэдрэг арьсыг тайвшруулах серум",
    recommendedFor: "Мэдрэг, хуурай, улайх хандлагатай арьсанд тохиромжтой.",
    benefits: ["Тайвшруулах", "Нөхөн сэргээх", "Чийгшүүлэх"],
    description: "Зөөлөн бүтэцтэй серум нь эмзэг арьсыг тайвшруулж, тав тухтай мэдрэмж өгнө. Арьсны хамгаалах давхаргыг дэмжинэ.",
    skinScience: "Хамгаалах давхарга суларсан арьс гадны нөлөөнд амархан хариу үйлдэл үзүүлдэг. Тайвшруулах орц нь арьсны тэнцвэрийг сэргээхэд тусална.",
    howToUse: HOW.serum,
    ingredients: INCI.serum,
    categories: ["serum", "serum-hydrating"],
    concerns: ["hydration", "sensitive-skin"],
    variants: [
      { size: "30 мл", price: 260_000, cost: 130_000, stock: 12 },
      { size: "8 мл", price: 90_000, cost: 45_000, stock: 3 },
    ],
  },
  {
    slug: "serum-matriskin",
    name: "SÉRUM MATRISKIN",
    step: STEP.serum,
    tagline: "Арьсны нягтралыг дэмжих серум",
    recommendedFor: "Уян хатан чанар, нягтралаа алдаж буй арьсанд тохиромжтой.",
    benefits: ["Нягтруулах", "Чангалах", "Үрчлээний эсрэг"],
    description: "Энэхүү серум нь арьсыг илүү нягт, уян харагдуулахад тусалж, нүүрний контурыг тод болгоно.",
    skinScience: "Арьсны дэд давхаргын бүтэц сулрах нь нүүрний контур бүдгэрэх шалтгаан болдог. Нягтруулах орц нь арьсыг бат бөх харагдуулна.",
    howToUse: HOW.serum,
    ingredients: INCI.serum,
    categories: ["serum", "serum-anti-ageing"],
    concerns: ["anti-ageing", "firming", "plumping"],
    variants: [{ size: "30 мл", price: 380_000, cost: 190_000, stock: 7 }],
  },
  {
    slug: "serum-biofixine",
    name: "SÉRUM BIOFIXINE",
    step: STEP.serum,
    tagline: "Нүүрний контурыг тодотгох чангалах серум",
    recommendedFor: "Сулралттай, контур нь бүдгэрсэн арьсанд тохиромжтой.",
    benefits: ["Чангалах", "Тэгшлэх"],
    description: "Хөнгөн бүтэцтэй серум нь арьсыг агшин зуур чангарсан мэдрэмжтэй болгож, нүүрний контурыг тод харагдуулахад тусална.",
    skinScience: "Чангалах орц нь арьсны гадаргуу дээр нимгэн давхарга үүсгэж, нягт харагдуулна.",
    howToUse: HOW.serum,
    ingredients: INCI.serum,
    categories: ["serum", "serum-firming"],
    concerns: ["firming", "anti-ageing"],
    variants: [{ size: "30 мл", price: 350_000, cost: 175_000, stock: 5 }],
  },
  {
    slug: "serum-hyaluronique",
    name: "SÉRUM HYALURONIQUE",
    step: STEP.serum,
    tagline: "Гүн чийгшүүлэх серум",
    recommendedFor: "Хуурай, чийгшил дутсан арьсанд тохиромжтой.",
    benefits: ["Чийгшүүлэх", "Дүүргэх"],
    description: "Гиалуроны хүчлээр баялаг серум нь арьсны чийгшлийг хадгалж, илүү дүүрэн, гөлгөр харагдуулна.",
    skinScience: "Чийгшил дутсан арьс нарийн үрчлээг тод харагдуулдаг. Гиалуроны хүчил нь арьсанд чийгийг барихад тусална.",
    howToUse: HOW.serum,
    ingredients: INCI.serum,
    categories: ["serum", "serum-hydrating"],
    concerns: ["hydration", "plumping", "sensitive-skin"],
    variants: [
      { size: "30 мл", price: 260_000, cost: 130_000, stock: 10 },
      { size: "8 мл", price: 90_000, cost: 45_000, stock: 6 },
    ],
  },
  {
    slug: "serum-pigm-400",
    name: "SÉRUM PIGM 400",
    step: STEP.serum,
    tagline: "Толбоны эсрэг гэрэлтүүлэх серум",
    recommendedFor: "Толбо, жигд бус өнгөтэй арьсанд тохиромжтой.",
    benefits: ["Толбоны эсрэг", "Гэрэлтүүлэх", "Өнгө жигдрүүлэх"],
    description: "Энэхүү серум нь толбоны харагдах байдлыг багасгаж, арьсны өнгийг илүү жигд, гэрэлтэй харагдуулахад тусална.",
    skinScience: "Пигментаци нь арьсны зарим хэсэгт меланин хуримтлагдсанаас үүсдэг. Өнгө жигдрүүлэх орц нь толбыг бүдгэрүүлэхэд тусална.",
    howToUse: [...HOW.serum, "Өдөр нь нарны хамгаалалт заавал хэрэглэнэ."],
    ingredients: INCI.serum,
    categories: ["serum"],
    concerns: ["pigmentation"],
    variants: [{ size: "30 мл", price: 330_000, cost: 165_000, stock: 4 }],
  },
  // ── Маск
  {
    slug: "masque-vivant",
    name: "MASQUE VIVANT",
    badge: "ICONIC",
    step: STEP.mask,
    tagline: "Арьсыг тэнцвэржүүлэх нүүрний маск",
    recommendedFor: "Тос ихтэй, батга гарах хандлагатай арьсанд тохиромжтой.",
    benefits: ["Тайвшруулах", "Нүх сүв нарийсгах", "Тэнцвэржүүлэх"],
    description:
      "Цэвэршүүлэх идэвхт бодисоор баялаг энэхүү маск нь илүүдэл тосны ялгаралт болон батганы харагдах байдлыг багасгахад тусалж, арьсыг цэвэр, сэргэг, гялбаагүй болгоно.",
    skinScience: "Тосны илүүдэл ялгаралт нүх сүвийг бөглөж, батга гарах нөхцөл бүрдүүлдэг. Шавар, цайрын исэл агуулсан маск нь илүүдэл тосыг шингээж, арьсыг цэвэр харагдуулна.",
    howToUse: HOW.mask,
    ingredients: INCI.mask,
    categories: ["masks"],
    concerns: ["blemishes", "skin-texture"],
    variants: [
      { size: "100 мл", price: 260_000, cost: 130_000, stock: 7 },
      { size: "30 мл", price: 95_000, cost: 47_000, stock: 10 },
    ],
    clinical: true,
  },
  {
    slug: "creme-masque-vernix",
    name: "CRÈME MASQUE VERNIX",
    badge: "NEW",
    step: STEP.mask,
    tagline: "Тэжээх, чийгшүүлэх кремэн маск",
    recommendedFor: "Хуурай, мэдрэг арьсанд тохиромжтой.",
    benefits: ["Чийгшүүлэх", "Нөхөн сэргээх", "Тайвшруулах"],
    description: "Зөөлөн кремэн бүтэцтэй маск нь арьсыг тэжээж, чийгшүүлэн, зөөлөн тав тухтай мэдрэмж үлдээнэ.",
    skinScience: "Хуурай арьсны липидийн давхарга сул байдаг. Тэжээх орц нь арьсны хамгаалах давхаргыг дэмжинэ.",
    howToUse: ["Цэвэр арьсанд зузаавтар түрхэнэ.", "10–15 минут байлгана.", "Илүүдлийг хөвөн самбайгаар арчина. Үлдсэнийг шингээж болно."],
    ingredients: INCI.cream,
    categories: ["masks"],
    concerns: ["hydration", "sensitive-skin", "plumping"],
    variants: [{ size: "100 мл", price: 300_000, cost: 150_000, stock: 6 }],
  },
  {
    slug: "masque-vip-o2",
    name: "MASQUE VIP O2",
    step: STEP.mask,
    tagline: "Арьсыг сэргээх гэрэлтүүлэх маск",
    recommendedFor: "Бүдэг, ядарсан харагдах арьсанд тохиромжтой.",
    benefits: ["Сэргээх", "Гэрэлтүүлэх", "Арьсны чанар"],
    description: "Энэхүү маск нь арьсыг сэргээж, илүү гэрэлтэй, амьд харагдуулахад тусална.",
    skinScience: "Хотын орчин, ядаргаа арьсыг бүдэг харагдуулдаг. Сэргээх орц нь арьсны гэрэлтэлтийг дэмжинэ.",
    howToUse: HOW.mask.slice(0, 3),
    ingredients: INCI.mask,
    categories: ["masks"],
    concerns: ["skin-texture", "pigmentation"],
    variants: [{ size: "50 мл", price: 240_000, cost: 120_000, stock: 5 }],
  },
  // ── Крем
  {
    slug: "creme-mec",
    name: "CRÈME M.E.C.",
    badge: "ICONIC",
    step: STEP.cream,
    tagline: "Хөгшрөлтийн эсрэг тэжээллэг крем",
    recommendedFor: "Хэвийн болон хуурай, нас ахисан арьсанд тохиромжтой.",
    benefits: ["Хөгшрөлтийн эсрэг", "Чангалах", "Тосжилт нөхөх"],
    description: "Баялаг бүтэцтэй энэхүү крем нь арьсыг тэжээж, илүү нягт, уян харагдуулахад тусална.",
    skinScience: "Нас ахих тусам арьсны липид, чийгшил буурдаг. Тэжээх орц нь арьсны тав тухыг хадгална.",
    howToUse: HOW.cream,
    ingredients: INCI.cream,
    categories: ["creams"],
    concerns: ["anti-ageing", "firming"],
    variants: [
      { size: "50 мл", price: 450_000, cost: 230_000, stock: 5 },
      { size: "15 мл", price: 150_000, cost: 75_000, stock: 4 },
    ],
  },
  {
    slug: "creme-dermopurifiante",
    name: "CRÈME DERMOPURIFIANTE",
    step: STEP.cream,
    tagline: "Тос ихтэй арьсанд зориулсан хөнгөн крем",
    recommendedFor: "Холимог, тос ихтэй, батга гарах хандлагатай арьсанд тохиромжтой.",
    benefits: ["Гялбаа арилгах", "Тэнцвэржүүлэх", "Цэвэршүүлэх"],
    description: "Хөнгөн бүтэцтэй крем нь арьсыг чийгшүүлэхийн зэрэгцээ гялбааг багасгаж, цэвэр харагдуулна.",
    skinScience: "Тос ихтэй арьс ч чийгшил шаарддаг. Хөнгөн бүтэц нь нүх сүвийг бөглөхгүйгээр чийгшүүлнэ.",
    howToUse: HOW.cream,
    ingredients: INCI.cream,
    categories: ["creams"],
    concerns: ["blemishes"],
    variants: [
      { size: "50 мл", price: 210_000, cost: 105_000, stock: 0 },
      { size: "15 мл", price: 75_000, cost: 37_000, stock: 8 },
    ],
  },
  {
    slug: "creme-grand-millesime",
    name: "CRÈME GRAND MILLÉSIME",
    badge: "LIMITED",
    step: STEP.cream,
    tagline: "Онцгой тэжээллэг хөгшрөлтийн эсрэг крем",
    recommendedFor: "Нас ахисан, тэжээл шаардлагатай арьсанд тохиромжтой.",
    benefits: ["Хөгшрөлтийн эсрэг", "Нягтруулах", "Дүүргэх"],
    description: "Хязгаарлагдмал тоогоор гарсан энэхүү крем нь арьсыг гүн тэжээж, илүү дүүрэн, гэрэлтэй харагдуулахад тусална.",
    skinScience: "Тэжээллэг орцын баялаг хослол нь арьсны нягтрал, уян хатан чанарыг дэмжинэ.",
    howToUse: HOW.cream,
    ingredients: INCI.cream,
    categories: ["creams"],
    concerns: ["anti-ageing", "firming", "plumping"],
    variants: [{ size: "50 мл", price: 980_000, cost: 490_000, stock: 2 }],
  },
  // ── Нүд ба уруул
  {
    slug: "serum-contour-des-yeux",
    name: "SÉRUM CONTOUR DES YEUX",
    step: STEP.eye,
    tagline: "Нүдний орчмыг сэргээх серум",
    recommendedFor: "Ядарсан, хавагнасан харагдах нүдний орчимд тохиромжтой.",
    benefits: ["Нүдний доорх харлалтын эсрэг", "Сэргээх", "Тэгшлэх"],
    description: "Хөнгөн серум нь нүдний орчмын хаван, харлалтын харагдах байдлыг багасгаж, харцыг сэргэг болгоход тусална.",
    skinScience: "Нүдний орчмын арьс нимгэн тул ядаргаа, нойргүйдэл хамгийн түрүүнд илэрдэг.",
    howToUse: HOW.eye,
    ingredients: INCI.serum,
    categories: ["eyes-lips"],
    concerns: ["anti-ageing"],
    variants: [{ size: "15 мл", price: 230_000, cost: 115_000, stock: 9 }],
  },
  {
    slug: "baume-levres",
    name: "BAUME LÈVRES",
    step: STEP.eye,
    tagline: "Уруулыг тэжээх бальзам",
    recommendedFor: "Хуурай, хагарсан уруулд тохиромжтой.",
    benefits: ["Чийгшүүлэх", "Хамгаалах"],
    description: "Тэжээллэг бальзам нь уруулыг чийгшүүлж, хүйтэн, хуурай агаараас хамгаалахад тусална.",
    skinScience: "Уруулын арьсанд тосны булчирхай байдаггүй тул амархан хуурайшдаг.",
    howToUse: ["Шаардлагатай үед уруулдаа түрхэнэ.", "Өдөрт хэд хэдэн удаа хэрэглэж болно."],
    ingredients: INCI.cream,
    categories: ["eyes-lips"],
    concerns: ["hydration"],
    variants: [{ size: "15 мл", price: 65_000, cost: 32_000, stock: 14 }],
  },
  // ── Бие, үс
  {
    slug: "creme-corps",
    name: "CRÈME CORPS",
    step: STEP.body,
    tagline: "Биеийн арьсыг чийгшүүлэх крем",
    recommendedFor: "Хуурай, уян хатан чанараа алдаж буй биеийн арьсанд тохиромжтой.",
    benefits: ["Чийгшүүлэх", "Чангалах"],
    description: "Хурдан шингэдэг крем нь биеийн арьсыг чийгшүүлж, зөөлөн, нягт харагдуулна.",
    skinScience: "Биеийн арьс хүйтэн, хуурай агаарт чийгшлээ хурдан алддаг.",
    howToUse: HOW.body,
    ingredients: INCI.cream,
    categories: ["body"],
    concerns: ["hydration", "firming"],
    variants: [{ size: "200 мл", price: 190_000, cost: 95_000, stock: 20 }],
  },
  {
    slug: "shampooing",
    name: "SHAMPOOING",
    step: STEP.hair,
    tagline: "Хуйхыг зөөлөн цэвэрлэх шампунь",
    recommendedFor: "Бүх төрлийн үсэнд тохиромжтой.",
    benefits: ["Цэвэршүүлэх", "Тэнцвэржүүлэх"],
    description: "Зөөлөн шампунь нь хуйх, үсийг хуурайшуулалгүй цэвэрлэж, үсийг зөөлөн, гялалзсан харагдуулна.",
    skinScience: "Хуйх бол арьс. Зөөлөн цэвэрлэгээ нь хуйхны тэнцвэрийг хадгалахад чухал.",
    howToUse: HOW.hair,
    ingredients: INCI.hair,
    categories: ["hair"],
    concerns: [],
    variants: [{ size: "250 мл", price: 120_000, cost: 60_000, stock: 0 }],
  },
  // ── Багц
  {
    slug: "routine-imperfections",
    name: "ROUTINE IMPERFECTIONS",
    kind: "BUNDLE",
    badge: "ONLINE_EXCLUSIVE",
    step: STEP.set,
    tagline: "Батганы эсрэг 5 алхамт багц",
    recommendedFor: "Батга гарах хандлагатай, тос ихтэй арьсанд тохиромжтой.",
    benefits: ["Цэвэршүүлэх", "Тэнцвэржүүлэх", "Удаан арилдаггүй батга"],
    description:
      "Цэвэрлэгээнээс крем хүртэлх таван алхмыг аяллын хэмжээгээр нэг дор хослуулсан багц. Арчилгааны дарааллыг туршиж үзэхэд тохиромжтой.",
    skinScience: "Батгын арчилгаанд алхам бүрийг тогтмол, дарааллаар нь хэрэглэх нь чухал.",
    howToUse: [
      "Өглөө, орой LAIT S.R.-ээр цэвэрлэнэ.",
      "LOTION P50-ээр арьсаа арчина.",
      "SÉRUM VIVANT-ийг 2–3 дусал түрхэнэ.",
      "Долоо хоногт 1–2 удаа MASQUE VIVANT хэрэглэнэ.",
      "Эцэст нь CRÈME DERMOPURIFIANTE түрхэнэ.",
    ],
    ingredients: "Бүрэлдэхүүн бүтээгдэхүүн тус бүрийн найрлагыг харна уу.",
    categories: ["gifts"],
    concerns: ["blemishes"],
    variants: [{ size: "1 багц", price: 380_000, cost: 190_000, stock: 0 }],
  },
];

/** Багцын бүрэлдэхүүн: [slug, size, qty] */
export const bundleItems: Record<string, [string, string, number][]> = {
  "routine-imperfections": [
    ["lait-sr", "50 мл", 1],
    ["lotion-p50", "50 мл", 1],
    ["serum-vivant", "8 мл", 1],
    ["masque-vivant", "30 мл", 1],
    ["creme-dermopurifiante", "15 мл", 1],
  ],
};

export const ENVIRONMENTAL = {
  "Үйлдвэрлэсэн улс": "Франц",
  "Савлагааны мэдээлэл": "Албан ёсны материалаас нэмэгдэнэ",
};

export const CLINICAL_NOTE = "Клиник судалгааны үр дүнг брэндийн албан ёсны материалаас нэмнэ.";

/** "Төгс хослол" (BUNDLE_SUGGESTION): бараа → хамт хэрэглэх бараа. Батганы бараанд багц автоматаар. */
export const PERFECT_MATCH: Record<string, string> = {
  "lait-vip-o2": "lotion-p50",
  progeskin: "serum-contour-des-yeux",
  "serum-matriskin": "masque-vip-o2",
  "serum-colostrum": "creme-masque-vernix",
  "serum-hyaluronique": "creme-masque-vernix",
};
