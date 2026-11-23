import Link from "next/link";
import { btnClass } from "@/components/admin/ui";
import { t } from "@/i18n";

export default function AdminNotFound() {
  return (
    <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-hairline bg-white p-6">
      <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-ink-soft">{t.notFound.code}</p>
      <h1 className="mt-1 text-[18px] font-medium">{t.notFound.title}</h1>
      <p className="mt-2 text-[14px] text-ink-soft">{t.notFound.text}</p>
      <Link href="/admin" className={`${btnClass("secondary")} mt-5`}>
        {t.serverError.adminHome}
      </Link>
    </div>
  );
}
