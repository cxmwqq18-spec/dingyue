import "server-only";
import type { PlatformState } from "@/lib/types";
import { prisma } from "@/lib/prisma";

const DOCUMENT_ID = "platform";

export function usePostgresPlatformState(): boolean {
  return process.env.PERSISTENCE_BACKEND === "postgres";
}

export async function readPlatformStateFromPostgres(): Promise<PlatformState | undefined> {
  const document = await prisma.platformStateDocument.findUnique({ where: { id: DOCUMENT_ID } });
  return document?.state as PlatformState | undefined;
}

export async function writePlatformStateToPostgres(state: PlatformState): Promise<PlatformState> {
  await prisma.platformStateDocument.upsert({
    where: { id: DOCUMENT_ID },
    create: { id: DOCUMENT_ID, state },
    update: { state }
  });
  return state;
}

export async function resetPlatformStateInPostgres(state: PlatformState): Promise<PlatformState> {
  await prisma.platformStateDocument.upsert({
    where: { id: DOCUMENT_ID },
    create: { id: DOCUMENT_ID, state },
    update: { state }
  });
  return state;
}
