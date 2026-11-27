import { Layers } from "lucide-react";
import { PackageSettingsForm, TemplateButton } from "@/components/admin/packages/PackageForms";
import { Badge, Card, EmptyState, PageHeader, Table, tdClass, thClass } from "@/components/admin/ui";
import { formatMNT } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requirePageAnyPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { expiredUnused, getPackageSettings, listTemplates, packageLiability } from "@/server/modules/packages/service";

export const metadata = { title: "Багц үйлчилгээ" };
export const instant = false;

/** Багцын загвар (PROMPT 27 §4): ACCOUNTANT / ADMIN засна; MANAGER харна */
export default async function PackagesPage() {
  const user = await requirePageAnyPermission("package:write", "package:redeem");
  const canWrite = can(user.role, "package:write");
  const [templates, services, settings, liability, expired, active] = await Promise.all([
    listTemplates(),
    db.service.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, price: true } }),
    getPackageSettings(),
    packageLiability(),
    expiredUnused(),
    db.customerPackage.count({ where: { status: "ACTIVE" } }),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Спа"
        title="Багц үйлчилгээ"
        description="10+1 г.м. — төлөх тоо + бонус = нийт удаа. Худалдсан мөнгө урьдчилгаа, ашиглах бүрт 1 удаагийн өртгөөр орлого танигдана."
        actions={canWrite && <TemplateButton services={services} label="Шинэ багц" />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card><p className="text-[13px] text-ink-soft">Идэвхтэй багц</p><p className="mt-1 text-[26px] font-light tabular-nums">{active}</p></Card>
        <Card><p className="text-[13px] text-ink-soft">Багцын үлдэгдэл өр</p><p className="mt-1 text-[26px] font-light tabular-nums">{formatMNT(liability)}</p></Card>
        <Card><p className="text-[13px] text-ink-soft">Хугацаа дууссан — ашиглаагүй удаа</p><p className="mt-1 text-[26px] font-light tabular-nums">{expired}</p></Card>
      </div>
      {templates.length === 0 ? (
        <EmptyState icon={Layers} title="Багц алга" action={canWrite && <TemplateButton services={services} label="Эхний багцаа нэмэх" />}>
          Жишээ: «Нүүрний эмчилгээ 10+1» — 10 удаагийн үнээр 11 удаа.
        </EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={thClass}>Багц</th>
              <th className={thClass}>Үйлчилгээ</th>
              <th className={`${thClass} text-right`}>Удаа</th>
              <th className={`${thClass} text-right`}>Үнэ</th>
              <th className={`${thClass} text-right`}>1 удаа</th>
              <th className={`${thClass} text-right`}>Хугацаа</th>
              <th className={`${thClass} text-right`}>Худалдсан</th>
              {canWrite && <th className={thClass}><span className="sr-only">Засах</span></th>}
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const total = t.paidSessions + t.bonusSessions;
              return (
                <tr key={t.id}>
                  <td className={tdClass}>
                    <span className="font-medium">{t.name}</span>
                    {!t.isActive && <span className="ml-2"><Badge>Идэвхгүй</Badge></span>}
                    {t.isPublic && t.isActive && <span className="ml-2"><Badge tone="info">Сайтад</Badge></span>}
                  </td>
                  <td className={`${tdClass} text-[13px] text-ink-soft`}>{t.services.map((s) => s.service.name).join(", ")}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{t.paidSessions}{t.bonusSessions ? `+${t.bonusSessions}` : ""} = {total}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatMNT(t.price)}</td>
                  <td className={`${tdClass} text-right tabular-nums text-ink-soft`}>{formatMNT(Math.floor(t.price / total))}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{t.validDays ? `${t.validDays} хоног` : "—"}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{t._count.customerPackages}</td>
                  {canWrite && (
                    <td className={tdClass}>
                      <TemplateButton
                        label="Засах"
                        services={services}
                        template={{ id: t.id, name: t.name, description: t.description, serviceIds: t.services.map((s) => s.serviceId), paidSessions: t.paidSessions, bonusSessions: t.bonusSessions, price: t.price, validDays: t.validDays, isActive: t.isActive, isPublic: t.isPublic, sortOrder: t.sortOrder }}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {canWrite && (
        <Card title="Тохиргоо" className="mt-6" description="Нягтлан баталгаажуулна.">
          <PackageSettingsForm initial={settings} />
        </Card>
      )}
    </>
  );
}
