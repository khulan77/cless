import { z } from "zod";
import { idSchema } from "@/lib/validation/common";
import type { DiscountInput } from "./pricing";

/** UI-ээс: мөнгө (₮) эсвэл хувь (12.5 = 12.5%) */
export const discountSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("AMOUNT"), value: z.number().int("Бүхэл тоо оруулна уу.").min(0, "Сөрөг байж болохгүй.") }),
    z.object({ type: z.literal("PERCENT"), percent: z.number().min(0, "Сөрөг байж болохгүй.").max(100, "100%-иас ихгүй.") }),
  ])
  .nullish();

export type DiscountField = z.infer<typeof discountSchema>;

export function toDiscountInput(d: DiscountField): DiscountInput | null {
  if (!d) return null;
  return d.type === "AMOUNT" ? { type: "AMOUNT", value: d.value } : { type: "PERCENT", bp: Math.round(d.percent * 100) };
}

const isPositive = (d: DiscountField) => Boolean(d && (d.type === "AMOUNT" ? d.value > 0 : d.percent > 0));

const reason = z.string().trim().max(200).nullish();

export const cartItemSchema = z
  .object({
    kind: z.enum(["SERVICE", "PRODUCT"]),
    variantId: idSchema.nullish(),
    serviceId: idSchema.nullish(),
    qty: z.number().int().min(1, "Тоо 1-ээс багагүй.").max(999),
    staffId: idSchema.nullish(),
    /** PRODUCT: зарсан ажилтан (PROMPT 14 §5). Хоосон бол: цагийн гоо сайханч, эсвэл кассчин */
    sellerId: idSchema.nullish(),
    lineDiscount: discountSchema,
    lineDiscountReason: reason,
  })
  .superRefine((i, ctx) => {
    if (i.kind === "PRODUCT" && !i.variantId) ctx.addIssue({ code: "custom", path: ["variantId"], message: "Бүтээгдэхүүн сонгоно уу." });
    if (i.kind === "SERVICE" && !i.serviceId) ctx.addIssue({ code: "custom", path: ["serviceId"], message: "Үйлчилгээ сонгоно уу." });
    if (isPositive(i.lineDiscount) && !i.lineDiscountReason) {
      ctx.addIssue({ code: "custom", path: ["lineDiscountReason"], message: "Хөнгөлөлтийн шалтгааныг бичнэ үү." });
    }
  });

export const cartSchema = z
  .object({
    /** Засварт буцаасан (DRAFT) борлуулалт */
    saleId: idSchema.nullish(),
    customerId: idSchema.nullish(),
    visitId: idSchema.nullish(),
    appointmentId: idSchema.nullish(),
    items: z.array(cartItemSchema).min(1, "Сагс хоосон байна.").max(100),
    saleDiscount: discountSchema,
    saleDiscountReason: reason,
    note: z.string().trim().max(500).nullish(),
  })
  .superRefine((c, ctx) => {
    if (isPositive(c.saleDiscount) && !c.saleDiscountReason) {
      ctx.addIssue({ code: "custom", path: ["saleDiscountReason"], message: "Хөнгөлөлтийн шалтгааныг бичнэ үү." });
    }
  });

export type CartInput = z.input<typeof cartSchema>;
export type Cart = z.output<typeof cartSchema>;

/** Хязгаараас хэтэрсэн хөнгөлөлтөд ADMIN-ий баталгаажуулалт */
export const approvalSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Имэйл хаяг буруу байна.")),
  password: z.string().min(1, "Нууц үг оруулна уу.").max(200),
});
export type ApprovalInput = z.input<typeof approvalSchema>;
