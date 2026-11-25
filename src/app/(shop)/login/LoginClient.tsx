"use client";

import { useRouter } from "next/navigation";
import { CustomerLogin } from "@/components/customer/CustomerLogin";

export function LoginClient({ next }: { next: string }) {
  const router = useRouter();
  return (
    <CustomerLogin
      onDone={() => {
        router.replace(next);
        router.refresh();
      }}
    />
  );
}
