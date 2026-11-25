/** @db.Date ↔ "YYYY-MM-DD" (UTC шөнө дунд — Prisma Date баганын дүрэм) */
export const toDbDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
export const fromDbDate = (d: Date) => d.toISOString().slice(0, 10);
