import "server-only";
import type { Prisma } from "@prisma/client";
import type { PlatformState } from "@/lib/types";
import { prisma } from "@/lib/prisma";

const DOCUMENT_ID = "platform";

function toPrismaJson(state: PlatformState): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(state)) as Prisma.InputJsonValue;
}

export function usePostgresPlatformState(): boolean {
  return true;
}

export async function readPlatformStateFromPostgres(): Promise<PlatformState | undefined> {
  const document = await prisma.platformStateDocument.findUnique({ where: { id: DOCUMENT_ID } });
  return document?.state as PlatformState | undefined;
}

export async function writePlatformStateToPostgres(state: PlatformState): Promise<PlatformState> {
  const stateJson = toPrismaJson(state);
  await prisma.platformStateDocument.upsert({
    where: { id: DOCUMENT_ID },
    create: { id: DOCUMENT_ID, state: stateJson },
    update: { state: stateJson }
  });
  return state;
}

export async function resetPlatformStateInPostgres(state: PlatformState): Promise<PlatformState> {
  const stateJson = toPrismaJson(state);
  await prisma.platformStateDocument.upsert({
    where: { id: DOCUMENT_ID },
    create: { id: DOCUMENT_ID, state: stateJson },
    update: { state: stateJson }
  });
  return state;
}
