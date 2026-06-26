import type { Metadata } from "next";
import { renderCustomerWorkspacePageBySlug } from "@/lib/storefront-render";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Create photo request" };
}

export default async function CustomerWorkspaceCreatePage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const query = searchParams ? await searchParams : {};
  return renderCustomerWorkspacePageBySlug({ siteSlug, slug: "/app/create", query, routeMode: "path" });
}
