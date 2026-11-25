/**
 * Нягтлан руу: өдрийн тайлан (A11). Зөвхөн нийлбэр дүн — үйлчлүүлэгчийн мэдээлэл агуулахгүй.
 * Дэлгэрэнгүй — хавсралт Excel.
 */
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import type { DailySummary } from "@/server/modules/reports/accountant";

const s = t.email.accountant;
const font = "Helvetica, Arial, sans-serif";
const cell = { fontSize: 14, lineHeight: "22px", color: "#1d1b18", padding: "6px 0", borderBottom: "1px solid #ece7df" };

/** downloadUrl: WeSend хавсралт дэмждэггүй үед Excel-ийг системээс (нэвтэрч) татах холбоос */
export type AccountantEmailData = { salonName: string; summary: DailySummary; lines: [string, number | string][]; downloadUrl?: string | null };

export function AccountantEmail({ salonName, summary, lines, downloadUrl }: AccountantEmailData) {
  return (
    <Html lang="mn">
      <Head />
      <Preview>{s.subject(salonName, summary.day)}</Preview>
      <Body style={{ backgroundColor: "#f6f3ee", fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", maxWidth: 560, padding: "32px 28px" }}>
          <Heading as="h1" style={{ fontSize: 18, letterSpacing: 4, margin: "0 0 8px", fontWeight: 400 }}>
            {salonName}
          </Heading>
          <Text style={{ fontSize: 14, color: "#8a8378", margin: "0 0 20px" }}>{s.intro(summary.day)}</Text>
          <Section>
            <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
              <tbody>
                {lines.map(([label, value]) => (
                  <tr key={label}>
                    <td style={cell}>{label}</td>
                    <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{typeof value === "number" ? formatMNT(value) : value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Text style={{ fontSize: 13, color: "#8a8378", marginTop: 20 }}>
            {downloadUrl ? (
              <>
                Үйлчилгээ, бүтээгдэхүүний задаргааг Excel-ээр татах (нэвтэрсэн байх шаардлагатай):{" "}
                <a href={downloadUrl} style={{ color: "#8a6d3b" }}>{downloadUrl}</a>
              </>
            ) : (
              s.attachment
            )}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderAccountantEmail(d: AccountantEmailData) {
  const el = <AccountantEmail {...d} />;
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
  return { subject: s.subject(d.salonName, d.summary.day), html, text };
}
