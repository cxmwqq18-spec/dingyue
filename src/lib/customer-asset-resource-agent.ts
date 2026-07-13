import type { AssetUpload } from "@/lib/types";

export type CustomerAssetResourceSurface = "workspace-gallery" | "source-picker" | "workspace-runtime" | "admin-review";

export function customerAssetRolesForSurface(surface: CustomerAssetResourceSurface): AssetUpload["role"][] | undefined {
  if (surface === "workspace-gallery") return ["output"];
  if (surface === "source-picker") return ["input", "training_input"];
  if (surface === "workspace-runtime") return ["input", "training_input", "output"];
  return undefined;
}

export function shouldShowAssetOnSurface(asset: Pick<AssetUpload, "role">, surface: CustomerAssetResourceSurface): boolean {
  const roles = customerAssetRolesForSurface(surface);
  return !roles || roles.includes(asset.role);
}
