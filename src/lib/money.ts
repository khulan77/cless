const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Төгрөгийн дүнг "450,000₮" хэлбэрт оруулна. */
export function formatMNT(amount: number): string {
  return `${formatter.format(Math.round(amount))}₮`;
}
