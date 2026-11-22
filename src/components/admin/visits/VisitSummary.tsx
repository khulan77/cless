import { Badge } from "@/components/admin/ui";
import { t } from "@/i18n";

const v = t.admin.visit;

export type VisitSummaryData = {
  conductedBy: string;
  date: string;
  skinType: keyof typeof t.admin.skinTypes | null;
  /** Already resolved from CONCERN collection slugs to names */
  concerns: string[];
  notes: string | null;
  recommendations: { id: string; name: string; instructions: string | null; purchased: boolean }[];
};

/** Diagnosis summary — sale detail and customer profile */
export function VisitSummary({ visit }: { visit: VisitSummaryData }) {
  return (
    <div className="space-y-3 text-[13.5px]">
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[140px_minmax(0,1fr)]">
        <dt className="text-navy/55">{v.conductedBy}</dt>
        <dd>
          {visit.conductedBy} <span className="text-navy/50">· {visit.date}</span>
        </dd>
        <dt className="text-navy/55">{v.skinType}</dt>
        <dd>{visit.skinType ? t.admin.skinTypes[visit.skinType] : v.none}</dd>
        <dt className="text-navy/55">{v.concerns}</dt>
        <dd className="flex flex-wrap gap-1">
          {visit.concerns.length === 0
            ? v.none
            : visit.concerns.map((c) => (
                <span key={c} className="rounded-full border border-line px-2 py-0.5 text-[12px]">
                  {c}
                </span>
              ))}
        </dd>
        {visit.notes && (
          <>
            <dt className="text-navy/55">{v.notes}</dt>
            <dd className="whitespace-pre-line">{visit.notes}</dd>
          </>
        )}
      </dl>
      {visit.recommendations.length > 0 && (
        <div>
          <p className="mb-1.5 text-[12px] font-medium uppercase tracking-[0.4px] text-navy/55">{v.recommendations}</p>
          <ul className="space-y-2">
            {visit.recommendations.map((r) => (
              <li key={r.id} className="rounded-md border border-line px-3 py-2">
                <p className="font-medium">
                  {r.name} {r.purchased && <Badge tone="green">{v.purchased}</Badge>}
                </p>
                {r.instructions && <p className="mt-1 whitespace-pre-line text-navy/70">{r.instructions}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
