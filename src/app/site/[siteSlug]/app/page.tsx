import type { Metadata } from "next";
import { CustomerWorkspaceClientPage } from "@/components/storefront/customer-bootstrap-client";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Workspace" };
}

export default async function CustomerWorkspacePage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const query = searchParams ? await searchParams : {};
  return <CustomerWorkspaceClientPage initialCreativePackId={typeof query.pack === "string" ? query.pack : undefined} siteSlug={siteSlug} />;
}
