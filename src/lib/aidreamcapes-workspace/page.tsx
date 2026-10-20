import "server-only";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { csrfCookieName } from "@/lib/security/csrf";
import { AidreamcapesWorkspace, type WorkspaceView } from "@/components/aidreamcapes-workspace/workspace";
import type { WorkspaceImageTool } from "@/components/aidreamcapes-workspace/image-tool-picker";
import { getWorkspaceCatalog } from "./provider";
import { catalogForCustomer } from "./api";
import { AIVIDEOSUGC_SITE_ID, type SceneId } from "./types";
import { isWorkspaceView } from "./navigation";
import { presetRequestFromQuery, type WorkspacePreset, type WorkspacePresetRequest } from "./preset-contract";
import { getWorkspaceTemplateGallery, resolveWorkspacePreset } from "./presets.server";
import { aidreamcapesCreateIntentFromSearchParams } from "@/lib/aidreamcapes-create-intent";
import { workspaceHandoffFromSearchParams, workspaceHandoffHref, type WorkspaceHandoff } from "./handoff";
import { getAidreamcapesInspirationCards } from "@/lib/aidreamcapes-inspirations";
import { inspirationCreateHref } from "@/lib/aidreamcapes-inspirations-types";

export const aidreamcapesWorkspaceMetadata: Metadata = {
  title: "Workspace | AIVideosUGC",
  description: "Create, edit and download your product videos.",
  robots: { index: false, follow: false },
};

const workspaceHosts = new Set(["www.aivideosugc.com", "aivideosugc.com", "www.aidreamcapes.com", "aidreamcapes.com"]);

export async function renderAidreamcapesWorkspace({
  routeSlug,
  initialView = "home",
  taskId,
  sceneId,
  imageTool,
  initialProductUrl,
  presetRequest,
  resolvedPreset,
  sceneRouteSlug,
  sceneRoutePath,
  invalidPreset = false,
  handoff,
  resumeDraft = false,
}: {
  routeSlug: "aivideosugc" | "aidreamcapes";
  initialView?: WorkspaceView;
  taskId?: string;
  sceneId?: SceneId;
  imageTool?: WorkspaceImageTool;
  initialProductUrl?: string;
  presetRequest?: WorkspacePresetRequest;
  resolvedPreset?: WorkspacePreset;
  sceneRouteSlug?: string;
  sceneRoutePath?: string;
  invalidPreset?: boolean;
  handoff?: WorkspaceHandoff;
  resumeDraft?: boolean;
}) {
  if (!taskId && invalidPreset) notFound();
  const initialPreset = !taskId ? resolvedPreset ?? (presetRequest ? await resolveWorkspacePreset(AIVIDEOSUGC_SITE_ID, presetRequest) : undefined) : undefined;
  if (!taskId && presetRequest && !initialPreset) notFound();
  const [current, cookieStore, headerStore, templateGallery, inspirationCards] = await Promise.all([
    getCurrentCustomerForSite(AIVIDEOSUGC_SITE_ID),
    cookies(),
    headers(),
    routeSlug === "aidreamcapes" ? getWorkspaceTemplateGallery(AIVIDEOSUGC_SITE_ID) : Promise.resolve(undefined),
    initialView === "inspirations"
      ? getAidreamcapesInspirationCards().then((cards) => cards.map((card) => ({
        id: card.id, label: card.label, imageSrc: card.imageSrc, imageAlt: card.imageAlt,
        pageTitle: card.pageTitle, kind: card.kind, description: card.description,
        category: card.category, createHref: inspirationCreateHref(card),
      })))
      : Promise.resolve(undefined),
  ]);
  const catalog = current ? await catalogForCustomer(AIVIDEOSUGC_SITE_ID, current.customer.id) : await getWorkspaceCatalog(AIVIDEOSUGC_SITE_ID);
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "").split(",")[0].trim().split(":")[0].toLowerCase();
  const hostMode = workspaceHosts.has(host);
  const basePath = hostMode ? "" : `/site/${routeSlug}`;
  const accountBase = hostMode ? "" : "/site/aidreamcapes";
  const safeHandoff = !initialPreset && !taskId && !resumeDraft ? handoff : undefined;
  const returnQuery = new URLSearchParams(safeHandoff ? workspaceHandoffHref("", safeHandoff).split("?")[1] : undefined);
  if (initialPreset && !sceneRouteSlug) { returnQuery.set("source", initialPreset.sourcePage); returnQuery.set("preset", initialPreset.presetId); }
  if (taskId) returnQuery.set("task", taskId);
  if (!initialPreset && !taskId && initialView !== "home") returnQuery.set("view", initialView);
  if (!initialPreset && !taskId && resumeDraft) returnQuery.set("resumeDraft", "1");
  if (!initialPreset && !taskId && initialProductUrl) {
    returnQuery.set("tool", "url-to-video");
    returnQuery.set("url", initialProductUrl);
  }
  const returnPath = sceneRoutePath
    ? `${basePath}${sceneRoutePath}`
    : sceneRouteSlug
    ? `${basePath}/app/create/scene/${encodeURIComponent(sceneRouteSlug)}`
    : returnQuery.size ? `${basePath}/app/create?${returnQuery}` : `${basePath}/app`;
  return <AidreamcapesWorkspace
    key={initialPreset ? `${initialPreset.presetId}:${initialPreset.sourceUpdatedAt}` : taskId ?? "workspace"}
    siteId={AIVIDEOSUGC_SITE_ID}
    basePath={basePath}
    initialView={initialPreset ? initialPreset.kind === "photo" ? "images" : "home" : initialView}
    initialTaskId={taskId}
    initialSceneId={sceneId}
    initialProductUrl={initialProductUrl}
    initialImageTool={imageTool}
    initialPreset={initialPreset}
    initialHandoff={safeHandoff}
    initialTemplateGallery={templateGallery}
    initialInspirations={inspirationCards}
    initialCatalog={catalog}
    csrfToken={cookieStore.get(csrfCookieName(`customer:${AIVIDEOSUGC_SITE_ID}`))?.value}
    customer={current ? { id: current.customer.id, name: current.customer.name, email: current.customer.email, balance: current.customer.balance.available } : undefined}
    loginPath={`${accountBase}/login?next=${encodeURIComponent(returnPath)}`}
    accountPath={`${accountBase}/account`}
    logoutPath={`${accountBase}/logout`}
    supportPath={`${accountBase}/contact-us`}
    presenterStudioEnabled={routeSlug === "aidreamcapes"}
  />;
}

export function aidreamcapesWorkspaceEntry(query: Record<string, string | string[] | undefined>) {
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : undefined;
  const handoff = workspaceHandoffFromSearchParams({ get: (key) => value(key) ?? null });
  const tool = value("tool");
  const scene = value("scene");
  const imageTools: WorkspaceImageTool[] = ["custom", "change-background", "white-background", "model-photos", "lifestyle-photos"];
  const queryView = value("view");
  const createIntent = aidreamcapesCreateIntentFromSearchParams({ get: (key) => value(key) ?? null });
  const requestedScene: SceneId | undefined = scene === "presenter_showcase" || scene === "process_demo" || scene === "texture_closeup" ? scene : undefined;
  const sceneByTool: Record<string, SceneId> = {
    "video-ads": "presenter_showcase",
    "spokesperson-videos": "presenter_showcase",
    "product-videos": "process_demo",
    "before-after-videos": "process_demo",
    "unboxing-videos": "process_demo",
  };
  const sceneId = requestedScene ?? (createIntent?.kind === "video" ? sceneByTool[createIntent.tool] : undefined);
  const intentView: WorkspaceView | undefined = createIntent?.kind === "video" ? createIntent.tool === "url-to-video" ? "product" : "video" : undefined;
  const initialView: WorkspaceView | undefined = isWorkspaceView(queryView) ? queryView : value("tool_id") === "image_generator" || (tool && imageTools.includes(tool as WorkspaceImageTool)) ? "images" : intentView;
  const imageTool = initialView === "images" && tool && imageTools.includes(tool as WorkspaceImageTool) ? tool as WorkspaceImageTool : undefined;
  const presetRequest = presetRequestFromQuery(query);
  const invalidPreset = Boolean(query.source !== undefined || query.preset !== undefined) && !presetRequest;
  return {
    taskId: value("task"), sceneId, initialView, imageTool,
    initialProductUrl: createIntent?.kind === "video" ? createIntent.productUrl : undefined,
    presetRequest, invalidPreset, handoff, resumeDraft: value("resumeDraft") === "1",
  };
}
