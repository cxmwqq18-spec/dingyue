import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma, runPrismaWriteWithReconnect } from "@/lib/prisma";
import { getCustomerPasswordPolicyError, normalizeCustomerPassword } from "@/lib/customer-password-policy";
import { StoreError } from "@/lib/server-store";
import {
  hashRelationalPassword,
  relationalUid,
  toPublicCustomerRelational,
  verifyRelationalPassword
} from "@/lib/stores/prisma-mappers";
import type { PublicCustomer } from "@/lib/types";

type DbClient = PrismaClient;

function cleanDisplayName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim().replace(/\s+/g, " ").slice(0, 80);
  return name || undefined;
}

async function assertProfileAvatarAsset(params: { siteId: string; customerId: string; avatarAssetId: string }, client: DbClient): Promise<void> {
  const asset = await client.assetUpload.findFirst({
    where: {
      id: params.avatarAssetId,
      siteId: params.siteId,
      customerId: params.customerId,
      deletedAt: null,
      subjectRole: "profile_avatar",
      mimeType: { startsWith: "image/" }
    },
    select: { id: true }
  });
  if (!asset) throw new StoreError("profile_avatar_asset_invalid", 400);
}

export async function updateCustomerSelfProfileRelational(
  params: { siteId: string; customerId: string; name?: unknown; avatarAssetId?: string | null },
  client: DbClient = prisma
): Promise<{ customer: PublicCustomer }> {
  const updateProfile = async () => {
    const nextName = cleanDisplayName(params.name);
    const wantsNameUpdate = typeof params.name === "string";
    const wantsAvatarUpdate = Object.prototype.hasOwnProperty.call(params, "avatarAssetId");
    if (!wantsNameUpdate && !wantsAvatarUpdate) throw new StoreError("profile_update_empty", 400);
    if (wantsNameUpdate && !nextName) throw new StoreError("customer_name_required", 400);
    const existing = await client.customer.findFirst({
      where: { id: params.customerId, siteId: params.siteId },
      select: { id: true }
    });
    if (!existing) throw new StoreError("customer_not_found_for_site", 404);
    const avatarAssetId = typeof params.avatarAssetId === "string" && params.avatarAssetId.trim()
      ? params.avatarAssetId.trim()
      : params.avatarAssetId === null
      ? null
      : undefined;
    if (avatarAssetId) {
      await assertProfileAvatarAsset({ siteId: params.siteId, customerId: params.customerId, avatarAssetId }, client);
    }
    const customer = await client.$transaction(async (tx) => {
      if (wantsNameUpdate && nextName) {
        await tx.customer.update({
          where: { id: params.customerId },
          data: { name: nextName }
        });
      }
      if (wantsAvatarUpdate) {
        await tx.customerProfile.upsert({
          where: { customerId: params.customerId },
          create: {
            id: relationalUid("cprof"),
            siteId: params.siteId,
            customerId: params.customerId,
            avatarAssetId: avatarAssetId ?? undefined
          },
          update: { avatarAssetId: avatarAssetId ?? null }
        });
      }
      return tx.customer.findFirstOrThrow({
        where: { id: params.customerId, siteId: params.siteId },
        include: { balance: true, profile: { include: { avatarAsset: true } } }
      });
    });
    return { customer: toPublicCustomerRelational(customer as unknown as Record<string, unknown>) };
  };
  return client === prisma
    ? runPrismaWriteWithReconnect(updateProfile, { label: "customer self profile update" })
    : updateProfile();
}

export async function updateCustomerSelfPasswordRelational(
  params: { siteId: string; customerId: string; currentPassword?: string; newPassword?: string; confirmPassword?: string },
  client: DbClient = prisma
): Promise<{ customer: PublicCustomer; deletedSessionIds: string[] }> {
  const updatePassword = async () => {
    const currentPassword = normalizeCustomerPassword(params.currentPassword);
    if (!currentPassword) throw new StoreError("current_password_required", 400);
    const passwordError = getCustomerPasswordPolicyError(params.newPassword, params.confirmPassword);
    if (passwordError) throw new StoreError(passwordError, 400);
    const newPassword = normalizeCustomerPassword(params.newPassword);
    const existing = await client.customer.findFirst({
      where: { id: params.customerId, siteId: params.siteId },
      select: { id: true, passwordHash: true }
    });
    if (!existing) throw new StoreError("customer_not_found_for_site", 404);
    if (!verifyRelationalPassword(currentPassword, existing.passwordHash)) {
      throw new StoreError("current_password_incorrect", 401);
    }
    const result = await client.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id: params.customerId },
        data: { passwordHash: hashRelationalPassword(newPassword) },
        include: { balance: true, profile: { include: { avatarAsset: true } } }
      });
      const sessions = await tx.customerSession.findMany({
        where: { siteId: params.siteId, customerId: params.customerId },
        select: { id: true }
      });
      await tx.customerSession.deleteMany({
        where: { siteId: params.siteId, customerId: params.customerId }
      });
      return { customer: updated, deletedSessionIds: sessions.map((session) => session.id) };
    });
    return {
      customer: toPublicCustomerRelational(result.customer as unknown as Record<string, unknown>),
      deletedSessionIds: result.deletedSessionIds
    };
  };
  return client === prisma
    ? runPrismaWriteWithReconnect(updatePassword, { label: "customer self password update" })
    : updatePassword();
}
