import type { Metadata } from "next";
import { headers } from "next/headers";
import { isSpanishStorefrontRequestIdentity } from "@/lib/spanish-storefronts";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Subscription Platform",
  description: "Multi-site AI subscription platform with store-style theme designer."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const language = isSpanishStorefrontRequestIdentity(host) ? "es" : "en";
  return (
    <html lang={language} suppressHydrationWarning translate="yes">
      <head>
        <meta httpEquiv="Content-Language" content={language} />
      </head>
      <body translate="yes">
        {children}
      </body>
    </html>
  );
}
