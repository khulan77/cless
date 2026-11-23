import { redirect } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";

export const instant = false;

/** Old single settings page (?tab=…) → one page per topic */
const LEGACY: Record<string, string> = { salon: "salon", shop: "shop", pos: "pos", email: "email", qpay: "payments" };

export default async function SettingsIndex({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePagePermission("settings:write");
  const { tab } = await searchParams;
  redirect(`/admin/settings/${(tab && LEGACY[tab]) || "salon"}`);
}
