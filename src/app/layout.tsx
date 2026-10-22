import type { Metadata } from "next";
import { headers } from "next/headers";
import { isSpanishStorefrontRequestIdentity } from "@/lib/spanish-storefronts";
import { storefrontLocaleForRequestIdentity } from "@/lib/storefront-locale";
import "./globals.css";

/**
 * The fallback description of a route that has no description of its own.
 *
 * The default describes the platform that runs the storefronts, which is
 * internal information and must not appear on a customer's page. The
 * Aidreamcapes storefront therefore gets copy that describes what a visitor
 * does there, and every other store keeps the text it had.
 */
export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase()
    .split(":")[0] ?? "";
  if (host === "www.aivideosugc.com" || host === "aivideosugc.com") {
    return {
      title: "AIVideosUGC",
      description: "Create AI UGC video ads and product photos from a product link, an image or a prompt."
    };
  }
  return {
    title: "AI Subscription Platform",
    description: "Multi-site AI subscription platform with store-style theme designer."
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const requestIdentity = `${host} ${requestHeaders.get("x-storefront-request-identity") ?? ""}`;
  const language = storefrontLocaleForRequestIdentity(requestIdentity) === "fr"
    ? "fr"
    : isSpanishStorefrontRequestIdentity(requestIdentity)
      ? "es"
      : "en";
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
