import type { Metadata } from "next";
import { Inter, Noto_Serif_Display } from "next/font/google";
import { Toaster } from "sonner";

// Admin type: bold high-contrast serif headings (Ө Ү live in cyrillic-ext) + Inter body text
const display = Noto_Serif_Display({
  variable: "--font-admin-display",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["500", "600", "700"],
  display: "swap",
});
const sans = Inter({
  variable: "--font-admin-sans",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Удирдлага", template: "%s · Удирдлага" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`admin-root ${display.variable} ${sans.variable}`}>
      {children}
      <Toaster
        position="top-right"
        closeButton
        toastOptions={{
          style: { fontFamily: "var(--font-admin-sans)", fontSize: 14, borderRadius: 14, border: "1px solid #ECEAE6", color: "#1C2230" },
          classNames: { success: "admin-toast-success", error: "admin-toast-error" },
        }}
      />
    </div>
  );
}
