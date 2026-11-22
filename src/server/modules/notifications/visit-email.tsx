/**
 * Айлчлалын имэйл (React Email). Зураг оруулаагүй — олон имэйл клиент SVG/WebP-г харуулдаггүй,
 * бүтээгдэхүүн бүрт сайтын холбоос өгнө.
 */
import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { absoluteUrl } from "@/lib/site-url";
import { ubDateKey } from "@/lib/ub-time";

export type VisitEmailData = {
  salon: { name: string; address: string | null; phone: string | null };
  customerName: string;
  date: Date;
  conductedBy: string;
  skinType: keyof typeof t.email.skinTypes | null;
  concerns: string[];
  notes: string | null;
  recommendations: { name: string; size: string; slug: string; instructions: string | null; purchased: boolean }[];
  sale: { number: string | null; total: number; services: string[] } | null;
};

const s = t.email.visit;
const font = "Helvetica, Arial, sans-serif";
const label = { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#8a8378", margin: "16px 0 4px" };
const body = { fontSize: 14, lineHeight: "22px", color: "#1d1b18", margin: 0 };

export function VisitEmail(d: VisitEmailData) {
  return (
    <Html lang="mn">
      <Head />
      <Preview>{s.preview}</Preview>
      <Body style={{ backgroundColor: "#f6f3ee", fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", maxWidth: 560, padding: "32px 28px" }}>
          <Heading as="h1" style={{ fontSize: 18, letterSpacing: 4, margin: "0 0 24px", fontWeight: 400 }}>
            {d.salon.name}
          </Heading>
          <Text style={body}>{s.greeting(d.customerName)}</Text>
          <Text style={{ ...body, marginTop: 8 }}>{s.intro(d.salon.name)}</Text>

          <Section>
            <Text style={label}>{s.date}</Text>
            <Text style={body}>{ubDateKey(d.date)}</Text>
            <Text style={label}>{s.conductedBy}</Text>
            <Text style={body}>{d.conductedBy}</Text>
            {d.skinType && (
              <>
                <Text style={label}>{s.skinType}</Text>
                <Text style={body}>{t.email.skinTypes[d.skinType]}</Text>
              </>
            )}
            {d.concerns.length > 0 && (
              <>
                <Text style={label}>{s.concerns}</Text>
                <Text style={body}>{d.concerns.join(", ")}</Text>
              </>
            )}
            {d.notes && (
              <>
                <Text style={label}>{s.notes}</Text>
                <Text style={{ ...body, whiteSpace: "pre-line" }}>{d.notes}</Text>
              </>
            )}
          </Section>

          {d.recommendations.length > 0 && (
            <Section>
              <Hr style={{ borderColor: "#e8e2d8", margin: "24px 0 8px" }} />
              <Text style={label}>{s.recommendations}</Text>
              {d.recommendations.map((r, i) => (
                <Section key={i} style={{ margin: "12px 0" }}>
                  <Text style={{ ...body, fontWeight: 700 }}>
                    {r.name} · {r.size}
                    {r.purchased ? ` — ${s.purchased}` : ""}
                  </Text>
                  {r.instructions && <Text style={{ ...body, whiteSpace: "pre-line", color: "#4a463f" }}>{r.instructions}</Text>}
                  <Link href={absoluteUrl(`/products/${r.slug}`)} style={{ fontSize: 12, color: "#8a6d3b" }}>
                    {s.viewProduct}
                  </Link>
                </Section>
              ))}
            </Section>
          )}

          {d.sale && (
            <Section>
              <Hr style={{ borderColor: "#e8e2d8", margin: "24px 0 8px" }} />
              {d.sale.services.length > 0 && (
                <>
                  <Text style={label}>{s.services}</Text>
                  <Text style={body}>{d.sale.services.join(", ")}</Text>
                </>
              )}
              <Text style={label}>{s.receipt}</Text>
              <Text style={body}>
                {d.sale.number ? `${s.saleNumber}: ${d.sale.number} · ` : ""}
                {s.total}: {formatMNT(d.sale.total)}
              </Text>
            </Section>
          )}

          <Hr style={{ borderColor: "#e8e2d8", margin: "24px 0 8px" }} />
          <Text style={body}>{s.outro}</Text>
          <Text style={{ ...body, color: "#8a8378", fontSize: 12, marginTop: 8 }}>
            {[d.salon.name, d.salon.address, d.salon.phone].filter(Boolean).join(" · ")}
          </Text>
          <Text style={{ ...body, color: "#8a8378", fontSize: 11, marginTop: 12 }}>{s.disclaimer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderVisitEmail(d: VisitEmailData) {
  const el = <VisitEmail {...d} />;
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
  return { subject: s.subject(d.salon.name), html, text };
}
