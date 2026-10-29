import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/toasts";

export const metadata: Metadata = {
  title: "Reelch | Performance advertising that rewards results",
  description:
    "Reelch connects businesses with promoters and rewards verified advertising outcomes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}<Toaster /></body>
    </html>
  );
}
