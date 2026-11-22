/**
 * Worker-ийн имэйл render-ийг production image дотор шалгана (DB-гүй).
 *   docker compose … run --rm --no-deps worker bun worker/email-smoke.js
 * Bun 1.3.11-ийн react-dom/server bug-ийн тойруу замыг (scripts/build-worker.ts) баталгаажуулна.
 */
import { renderVisitEmail } from "../src/server/modules/notifications/visit-email";

const mail = await renderVisitEmail({
  salon: { name: "CLÉSS", address: "Улаанбаатар", phone: "7011 2233" },
  customerName: "Туршилтын үйлчлүүлэгч",
  date: new Date(),
  conductedBy: "Гоо засалч",
  skinType: null,
  concerns: ["Хуурайшилт"],
  notes: "Smoke test",
  recommendations: [{ name: "MASQUE VIVANT", size: "50 мл", slug: "masque-vivant", instructions: "Орой", purchased: false }],
  sale: { number: "CL-0001", total: 185000, services: ["Нүүрний арчилгаа"] },
});

const ok = mail.html.startsWith("<!DOCTYPE html") && mail.html.includes("Туршилтын үйлчлүүлэгч") && mail.text.length > 0;
console.log(JSON.stringify({ ok, bun: Bun.version, nodeEnv: process.env.NODE_ENV, subject: mail.subject, htmlBytes: mail.html.length }));
process.exit(ok ? 0 : 1);
