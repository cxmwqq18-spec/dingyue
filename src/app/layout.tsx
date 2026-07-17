import type { Metadata } from "next";
import { HtmlLangSync } from "@/components/storefront/html-lang-sync";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Subscription Platform",
  description: "Multi-site AI subscription platform with store-style theme designer."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning translate="yes">
      <head>
        <meta httpEquiv="Content-Language" content="en" />
      </head>
      <body translate="yes">
        <HtmlLangSync />
        {children}
      </body>
    </html>
  );
}
