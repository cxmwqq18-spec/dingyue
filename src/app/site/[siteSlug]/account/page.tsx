import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { publicSiteSlug } from "@/lib/domain-routing";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Workspace", robots: { index: false, follow: false } };
}

export default async function CustomerAccountPage({
  params
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const headerStore = await headers();
  const publicSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: "/account",
    siteSlug
  });
  redirect(`/site/${publicSiteSlug(publicSlug)}/app/create`);
}
