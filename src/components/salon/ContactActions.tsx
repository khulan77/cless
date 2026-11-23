import { MapPin, MessageCircle, Phone } from "lucide-react";
import { SocialIcon } from "@/components/layout/SocialIcon";
import { t } from "@/i18n";

export type SalonContact = {
  phone: string;
  instagram: string | null;
  messenger: string | null;
  address: string;
  mapsUrl: string | null;
  hoursLines: string[];
};

const btn = "flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-body transition-colors";

/** Call (primary), Instagram / Messenger DM — buttons are hidden when the link is not configured */
export function ContactButtons({ salon }: { salon: SalonContact }) {
  const tel = salon.phone.replace(/[^\d+]/g, "");
  return (
    <div className="space-y-2.5">
      {tel && (
        <a href={`tel:${tel}`} className={`${btn} bg-navy text-white hover:bg-navy/90`}>
          <Phone className="size-[18px]" strokeWidth={1.5} aria-hidden />
          {t.salon.call(salon.phone)}
        </a>
      )}
      {salon.instagram && (
        <a href={salon.instagram} target="_blank" rel="noopener noreferrer" className={`${btn} border border-navy hover:bg-navy/5`}>
          <SocialIcon network="instagram" className="size-[18px]" />
          {t.salon.instagram}
        </a>
      )}
      {salon.messenger && (
        <a href={salon.messenger} target="_blank" rel="noopener noreferrer" className={`${btn} border border-navy hover:bg-navy/5`}>
          <MessageCircle className="size-[18px]" strokeWidth={1.5} aria-hidden />
          {t.salon.messenger}
        </a>
      )}
    </div>
  );
}

export function SalonDetails({ salon }: { salon: SalonContact }) {
  return (
    <dl className="space-y-4 text-body">
      {salon.hoursLines.length > 0 && (
        <div>
          <dt className="text-micro text-muted">{t.salon.hours}</dt>
          <dd className="mt-1 space-y-0.5">
            {salon.hoursLines.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </dd>
        </div>
      )}
      {salon.address && (
        <div>
          <dt className="text-micro text-muted">{t.salon.address}</dt>
          <dd className="mt-1 whitespace-pre-line">{salon.address}</dd>
          {salon.mapsUrl && (
            <dd className="mt-1.5">
              <a href={salon.mapsUrl} target="_blank" rel="noopener noreferrer" className="link-underline inline-flex items-center gap-1.5">
                <MapPin className="size-4" strokeWidth={1.5} aria-hidden />
                {t.salon.openMap}
              </a>
            </dd>
          )}
        </div>
      )}
    </dl>
  );
}
