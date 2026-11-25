import { connection } from "next/server";
import { BookingSheetButton } from "@/components/salon/BookingSheet";
import { BookingWizard } from "@/components/customer/BookingWizard";
import { Container } from "@/components/ui/Container";
import { getCurrentCustomer } from "@/server/modules/customer-auth/session";
import { bookingDates, onlineServices } from "@/server/modules/online-booking/service";
import { getOnlineBookingSettings } from "@/server/modules/online-booking/settings";
import { getSalonInfo } from "@/server/queries/storefront";

export const metadata = { title: "Цаг захиалах" };
// Үйлчлүүлэгчийн session (cookie) уншдаг — request бүрт render
export const instant = false;

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  // Үйлчлүүлэгчийн session, одоогийн цаг — request бүрт (prerender хийхгүй)
  await connection();
  const [settings, salon, customer, sp] = await Promise.all([getOnlineBookingSettings(), getSalonInfo(), getCurrentCustomer(), searchParams]);
  const contact = { phone: salon.phone, instagram: salon.instagram, messenger: salon.messenger, address: salon.address, mapsUrl: salon.mapsUrl, hoursLines: salon.hoursLines, onlineBooking: false };
  if (!settings.enabled) {
    return (
      <Container as="section" className="py-16 md:py-24">
        <div className="mx-auto max-w-[560px] text-center">
          <h1 className="text-section">Цаг захиалах</h1>
          <p className="mt-4 text-muted">Онлайн захиалга одоогоор хаалттай байна. Утсаар эсвэл мессежээр холбогдоно уу.</p>
          <div className="mt-8"><BookingSheetButton salon={contact} /></div>
        </div>
      </Container>
    );
  }
  const [services, dates] = await Promise.all([onlineServices(settings), bookingDates()]);
  const initial = services.find((s) => s.slug === sp.service || s.id === sp.service)?.id ?? null;
  return (
    <Container as="section" className="py-12 md:py-20">
      <header className="mb-10">
        <h1 className="text-section">Цаг захиалах</h1>
        <p className="mt-3 text-muted">{settings.mode === "APPROVAL" ? "Хүсэлт илгээсний дараа ресепшн баталгаажуулж SMS илгээнэ." : "Сонгосон цаг шууд баталгаажна."}</p>
      </header>
      <BookingWizard services={services} dates={dates} loggedIn={Boolean(customer)} customerName={customer?.name ?? null} initialServiceId={initial} approval={settings.mode === "APPROVAL"} />
    </Container>
  );
}
