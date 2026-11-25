/** Хүлээн авагчийг log, дэлгэцэнд маскалж харуулна: 99112233 → 99****33, anna@cless.mn → a***@cless.mn */
export function maskPhone(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("976")) d = d.slice(3);
  return d.length >= 4 ? `${d.slice(0, 2)}${"*".repeat(Math.max(2, d.length - 4))}${d.slice(-2)}` : "****";
}

export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 1) || "*"}***@${domain || "***"}`;
}

export const maskTarget = (to: string) => (to.includes("@") ? maskEmail(to) : maskPhone(to));
