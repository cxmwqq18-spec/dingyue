import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  return { title: /(?:-xby|_xby)/i.test(siteSlug) ? "Espacio privado" : "Workspace", robots: { index: false, follow: false } };
}

export default async function CustomerWorkspacePage({
  params
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const headerStore = await headers();
  const publicSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: "/app",
    siteSlug
  });
  redirect(`/site/${publicSlug}/app/create`);
}
