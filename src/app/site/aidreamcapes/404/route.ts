import { aidreamcapesNotFoundResponse } from "@/lib/aidreamcapes-not-found";

export const dynamic = "force-dynamic";
export function GET(): Response {
  return aidreamcapesNotFoundResponse();
}
