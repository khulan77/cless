/**
 * Цагийн баталгаажуулалт / өөрчлөлт / цуцлалт / сануулга (React Email). Айлчлалын имэйлтэй ижил загвар.
 */
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from "@react-email/components";
import { render } from "@react-email/render";
import { t } from "@/i18n";
import { formatDateLabel, formatTime } from "@/lib/time";

export type ApptEmailKind = "created" | "changed" | "cancelled" | "reminder";
export type ApptEmailData = {
  kind: ApptEmailKind;
  salon: { name: string; address: string | null; phone: string | null };
  customerName: string;
  startsAt: Date;
  endsAt: Date;
  service: string;
  staff: string;
};

const s = t.email.appt;
const font = "Helvetica, Arial, sans-serif";
const label = { fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#8a8378", margin: "16px 0 4px" };
const body = { fontSize: 14, lineHeight: "22px", color: "#1d1b18", margin: 0 };

export function AppointmentEmail(d: ApptEmailData) {
  const cancelled = d.kind === "cancelled";
  return (
    <Html lang="mn">
      <Head />
      <Preview>{s.intro[d.kind]}</Preview>
      <Body style={{ backgroundColor: "#f6f3ee", fontFamily: font, margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", maxWidth: 560, padding: "32px 28px" }}>
          <Heading as="h1" style={{ fontSize: 18, letterSpacing: 4, margin: "0 0 24px", fontWeight: 400 }}>
            {d.salon.name}
          </Heading>
          <Text style={body}>{s.greeting(d.customerName)}</Text>
          <Text style={{ ...body, marginTop: 8 }}>{s.intro[d.kind]}</Text>
          <Section>
            <Text style={label}>{s.when}</Text>
            <Text style={{ ...body, fontSize: 16, fontWeight: 700, textDecoration: cancelled ? "line-through" : undefined }}>
              {formatDateLabel(d.startsAt)} · {formatTime(d.startsAt)}–{formatTime(d.endsAt)}
            </Text>
            <Text style={label}>{s.service}</Text>
            <Text style={body}>{d.service}</Text>
            <Text style={label}>{s.staff}</Text>
            <Text style={body}>{d.staff}</Text>
            {d.salon.address && (
              <>
                <Text style={label}>{s.address}</Text>
                <Text style={body}>{d.salon.address}</Text>
              </>
            )}
          </Section>
          <Hr style={{ borderColor: "#e8e2d8", margin: "24px 0 8px" }} />
          <Text style={body}>{s.outro}</Text>
          <Text style={{ ...body, color: "#8a8378", fontSize: 12, marginTop: 8 }}>
            {[d.salon.name, d.salon.address, d.salon.phone].filter(Boolean).join(" · ")}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderAppointmentEmail(d: ApptEmailData) {
  const el = <AppointmentEmail {...d} />;
  const [html, text] = await Promise.all([render(el), render(el, { plainText: true })]);
  return { subject: s.subject[d.kind](d.salon.name), html, text };
}
