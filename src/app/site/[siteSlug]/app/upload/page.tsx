import type { Metadata } from "next";
import { renderCustomerWorkspacePageBySlug } from "@/lib/storefront-render";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Upload photos" };
}

export default async function CustomerWorkspaceUploadPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const query = searchParams ? await searchParams : {};
  return renderCustomerWorkspacePageBySlug({ siteSlug, slug: "/app/upload", query, routeMode: "path" });
}
