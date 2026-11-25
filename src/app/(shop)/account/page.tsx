import Link from "next/link";
import { redirect } from "next/navigation";
import { CancelAppointmentButton, EmailForm, NameForm, SignOutButton } from "@/components/customer/AccountActions";
import { pillClass } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { t } from "@/i18n";
import { formatMNT } from "@/lib/money";
import { formatDateLabel, formatTime } from "@/lib/time";
import { myPurchases, mySkin } from "@/server/modules/customer-auth/account";
import { getCurrentCustomer } from "@/server/modules/customer-auth/session";
import { myAppointments } from "@/server/modules/online-booking/service";

export const metadata = { title: t.pages.account.title, robots: { index: false } };

const STATUS: Record<string, string> = {
  PENDING: "Батлахыг хүлээж буй",
  BOOKED: "Бүртгэгдсэн",
  CONFIRMED: "Баталгаажсан",
  ARRIVED: "Ирсэн",
  IN_PROGRESS: "Үйлчилгээнд",
  DONE: "Дууссан",
  CANCELLED: "Цуцлагдсан",
  NO_SHOW: "Ирээгүй",
};

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-h3">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Миний бүртгэл (сайт): цагууд, худалдан авалт, арьсны мэдээлэл, профайл. Дотоод тэмдэглэл, зураг харагдахгүй. */
export default async function AccountPage() {
  const me = await getCurrentCustomer();
  if (!me) redirect("/login?next=/account");
  const [appts, purchases, skin] = await Promise.all([myAppointments(me.id), myPurchases(me.id), mySkin(me.id)]);
  const skinLabel = skin.skinType ? t.admin.skinTypes[skin.skinType] : null;

  return (
    <Container as="section" className="py-16 md:py-24">
      <div className="mx-auto max-w-[880px] space-y-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-section">Миний бүртгэл</h1>
            <p className="mt-2 text-muted">{me.name} · {me.phone}</p>
          </div>
          <SignOutButton />
        </header>

        <Section title="Миний цагууд" action={<Link href="/booking" className={pillClass("navy")}>Цаг захиалах</Link>}>
          {appts.upcoming.length === 0 ? (
            <p className="text-muted">Ирэх цаг алга.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {appts.upcoming.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="text-body font-medium">{formatDateLabel(a.startsAt)} · {formatTime(a.startsAt)}</p>
                    <p className="text-[14px] text-muted">{a.service.name} · {a.staff.name} · <span className={a.status === "PENDING" ? "text-[#8a5a00]" : ""}>{STATUS[a.status]}</span></p>
                  </div>
                  {a.canCancel ? <CancelAppointmentButton id={a.id} /> : <span className="text-[13px] text-muted">Цуцлахын тулд салон руу залгана уу ({appts.cancelHours} цагаас бага үлдсэн)</span>}
                </li>
              ))}
            </ul>
          )}
          {appts.past.length > 0 && (
            <details className="mt-5">
              <summary className="cursor-pointer text-[14px] text-muted">Өмнөх цагууд ({appts.past.length})</summary>
              <ul className="mt-3 space-y-2 text-[14px]">
                {appts.past.map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2">
                    <span>{formatDateLabel(a.startsAt)} · {a.service.name}</span>
                    <span className="text-muted">{STATUS[a.status]}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Section>

        <Section title="Миний арьсны мэдээлэл">
          {!skin.visit && !skinLabel ? (
            <p className="text-muted">Оношлогоо хийлгэсний дараа энд харагдана.</p>
          ) : (
            <div className="space-y-4">
              {skinLabel && <p className="text-body"><span className="text-muted">Арьсны төрөл:</span> {skinLabel}</p>}
              {skin.visit && (
                <>
                  <p className="text-[14px] text-muted">Сүүлийн оношлогоо: {formatDateLabel(skin.visit.date)} · {skin.visit.by}</p>
                  {skin.visit.concerns.length > 0 && <p className="text-body"><span className="text-muted">Анхаарах асуудал:</span> {skin.visit.concerns.join(", ")}</p>}
                  {skin.visit.summary && <p className="whitespace-pre-line text-body">{skin.visit.summary}</p>}
                  {skin.visit.recommendations.length > 0 && (
                    <ul className="grid gap-px bg-line sm:grid-cols-2">
                      {skin.visit.recommendations.map((r) => (
                        <li key={r.slug + r.size} className="bg-white p-5">
                          <Link href={`/products/${r.slug}`} className="link-underline font-medium">{r.name}</Link>
                          <p className="text-[13px] text-muted">{r.size}</p>
                          {r.instructions && <p className="mt-2 whitespace-pre-line text-[14px]">{r.instructions}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </Section>

        <Section title="Миний худалдан авалт">
          {purchases.length === 0 ? (
            <p className="text-muted">Худалдан авалт алга.</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line text-[15px]">
              {purchases.map((p, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-3 py-3">
                  <span>{p.name}{p.qty > 1 ? ` × ${p.qty}` : ""}</span>
                  <span className="text-muted tabular-nums">{formatDateLabel(p.at)} · {formatMNT(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Профайл">
          <div className="space-y-6">
            <NameForm initial={me.name} />
            <EmailForm email={me.email} verified={Boolean(me.emailVerifiedAt)} consent={Boolean(me.emailConsentAt)} />
          </div>
        </Section>
      </div>
    </Container>
  );
}
