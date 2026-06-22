import { cache } from "react";
import { readPlatformState } from "@/lib/server-store";

export const readStorefrontPlatformState = cache(() => readPlatformState());
