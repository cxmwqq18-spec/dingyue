import type { Metadata } from "next";
import { CustomerAccountClientPage } from "@/components/storefront/customer-bootstrap-client";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Account" };
}

export default async function CustomerAccountPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  return <CustomerAccountClientPage siteSlug={siteSlug} />;
}
