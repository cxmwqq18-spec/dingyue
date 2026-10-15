import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AivideosugcStorefrontEntry({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const query = searchParams ? await searchParams : {};
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (typeof value === "string") {
      params.set(key, value);
    }
  }

  const suffix = params.toString();
  redirect(`/site/aidreamcapes${suffix ? `?${suffix}` : ""}`);
}
