/**
 * Ресепшн руу: "Салонд захиалах" шинэ хүсэлт (React Email). Бусад имэйлтэй ижил загвар.
 */
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import type { InquiryItem } from "@/server/modules/inquiries/service";

export type InquiryEmailData = { salonName: string; name: string; phone: string; items: InquiryItem[]; note: string | null; adminUrl: string };

const s = t.email.inquiry;
const font = "Helvetica, Arial, sans-serif";
const label = { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#8a8378", margin: "16px 0 4px" };
const body = { fontSize: 14, lineHeight: "22px", color: "#1d1b18", margin: 0 };

export function InquiryEmail(d: InquiryEmailData) {
  return (
    <Html lang="mn">
      <Head />
      <Preview>{s.subject(d.name, d.phone)}</Preview>
      <Body style={{ backgroundColor: "#f6f3ee", fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", maxWidth: 560, padding: "32px 28px" }}>
          <Heading as="h1" style={{ fontSize: 18, letterSpacing: 4, margin: "0 0 24px", fontWeight: 400 }}>
            {d.salonName}
          </Heading>
          <Text style={body}>{s.intro}</Text>
          <Section>
            <Text style={label}>{s.customer}</Text>
            <Text style={{ ...body, fontSize: 16, fontWeight: 700 }}>
              {d.name} · <a href={`tel:${d.phone}`}>{d.phone}</a>
            </Text>
            <Text style={label}>{s.items}</Text>
            {d.items.map((i) => (
              <Text key={i.variantId} style={body}>
                {i.productName} — {i.size} × {i.qty} ({formatMNT(i.price * i.qty)})
              </Text>
            ))}
            {d.note && (
              <>
                <Text style={label}>{s.note}</Text>
                <Text style={body}>{d.note}</Text>
              </>
            )}
          </Section>
          <Section style={{ marginTop: 24 }}>
            <Button href={d.adminUrl} style={{ backgroundColor: "#1b2a41", color: "#ffffff", padding: "12px 20px", fontSize: 14, borderRadius: 999 }}>
              {s.open}
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderInquiryEmail(d: InquiryEmailData) {
  const el = <InquiryEmail {...d} />;
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
  return { subject: s.subject(d.name, d.phone), html, text };
}
