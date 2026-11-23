import Link from "next/link";
import { PageHeader, btnClass } from "@/components/admin/ui";
import { infra } from "@/i18n/mn.infra";
import { requirePagePermission } from "@/server/auth/session";
import { ImportWizard } from "./ImportWizard";

const T = infra.import;

export const metadata = { title: T.title };
// Нэвтэрсэн хэрэглэгчийн динамик хуудас — request бүрт render (Cache Components validation-аас гаргана)
export const instant = false;

export default async function ProductImportPage() {
  await requirePagePermission("product:write");
  return (
    <>
      <PageHeader
        title={T.title}
        description={T.description}
        actions={<Link href="/admin/products" className={btnClass("secondary", "md", "max-sm:h-11")}>{T.back}</Link>}
      />
      <ImportWizard />
    </>
  );
}
