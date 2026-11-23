import { describe, expect, it } from "vitest";
import { matchImage, sizeOf, words } from "./image-match";

const products = [
  { slug: "creme-masque-vernix", name: "CRÈME MASQUE VERNIX", sizes: ["50 мл", "100 мл"] },
  { slug: "lotion-p50", name: "LOTION P50", sizes: ["50 мл", "150 мл", "250 мл"] },
  { slug: "lotion-p50-pigm-400", name: "LOTION P50 PIGM 400", sizes: ["150 мл"] },
  { slug: "serum-vivant", name: "SÉRUM VIVANT", sizes: ["8 мл", "30 мл"] },
];

describe("image file → product", () => {
  it("brand file names", () => {
    expect(matchImage("Crème_Masque_Vernix VG_50ml_RVB_MD.jpg", products)).toEqual({ slug: "creme-masque-vernix", size: "50 мл", score: 3 });
    expect(matchImage("Serum_Vivant_30ml_RVB.png", products)).toMatchObject({ slug: "serum-vivant", size: "30 мл" });
  });
  it("prefers the longer (more specific) name", () => {
    expect(matchImage("Lotion_P50_PIGM_400_150ml.jpg", products)?.slug).toBe("lotion-p50-pigm-400");
    expect(matchImage("Lotion-P50-250ml.jpg", products)).toMatchObject({ slug: "lotion-p50", size: "250 мл" });
  });
  it("unknown size → product image without a size; no match → null", () => {
    expect(matchImage("Lotion_P50_1000ml.jpg", products)).toMatchObject({ slug: "lotion-p50", size: null });
    expect(matchImage("Salon_interior_01.jpg", products)).toBeNull();
  });
  it("helpers", () => {
    expect(words("Crème_Masque_Vernix VG_50ml_RVB_MD.jpg")).toEqual(["creme", "masque", "vernix"]);
    expect(sizeOf("x_1,5ml.jpg")).toBe("1.5 мл");
  });
});
