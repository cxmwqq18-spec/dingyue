import "server-only";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { csrfCookieName } from "@/lib/security/csrf";
import { AidreamcapesWorkspace, type WorkspaceView } from "@/components/aidreamcapes-workspace/workspace";
import type { WorkspaceImageTool } from "@/components/aidreamcapes-workspace/image-tool-picker";
import { getWorkspaceCatalog } from "./provider";
import { catalogForCustomer } from "./api";
import { AIVIDEOSUGC_SITE_ID, type SceneId } from "./types";
import { isWorkspaceView } from "./navigation";
import { getAidreamcapesInspirationCards } from "@/lib/aidreamcapes-inspirations";
import { presetRequestFromQuery, type WorkspacePresetRequest } from "./preset-contract";
import { getWorkspaceTemplateGallery, resolveWorkspacePreset } from "./presets.server";

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
  presetRequest,
  invalidPreset = false,
}: {
  routeSlug: "aivideosugc" | "aidreamcapes";
  initialView?: WorkspaceView;
  taskId?: string;
  sceneId?: SceneId;
  imageTool?: WorkspaceImageTool;
  presetRequest?: WorkspacePresetRequest;
  invalidPreset?: boolean;
}) {
  if (!taskId && invalidPreset) notFound();
  const initialPreset = !taskId && presetRequest ? await resolveWorkspacePreset(AIVIDEOSUGC_SITE_ID, presetRequest) : undefined;
  if (!taskId && presetRequest && !initialPreset) notFound();
  const [current, cookieStore, headerStore, templateGallery] = await Promise.all([
    getCurrentCustomerForSite(AIVIDEOSUGC_SITE_ID),
    cookies(),
    headers(),
    routeSlug === "aidreamcapes" ? getWorkspaceTemplateGallery(AIVIDEOSUGC_SITE_ID) : Promise.resolve(undefined),
  ]);
  const catalog = current ? await catalogForCustomer(AIVIDEOSUGC_SITE_ID, current.customer.id) : await getWorkspaceCatalog(AIVIDEOSUGC_SITE_ID);
  const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "").split(",")[0].trim().split(":")[0].toLowerCase();
  const hostMode = workspaceHosts.has(host);
  const basePath = hostMode ? "" : `/site/${routeSlug}`;
  const accountBase = hostMode ? "" : "/site/aidreamcapes";
  const returnQuery = new URLSearchParams();
  if (initialPreset) { returnQuery.set("source", initialPreset.sourcePage); returnQuery.set("preset", initialPreset.presetId); }
  if (taskId) returnQuery.set("task", taskId);
  if (!initialPreset && !taskId && initialView !== "home") returnQuery.set("view", initialView);
  const returnPath = returnQuery.size ? `${basePath}/app/create?${returnQuery}` : `${basePath}/app`;
  return <AidreamcapesWorkspace
    key={initialPreset ? `${initialPreset.presetId}:${initialPreset.sourceUpdatedAt}` : taskId ?? "workspace"}
    siteId={AIVIDEOSUGC_SITE_ID}
    basePath={basePath}
    initialView={initialPreset ? initialPreset.kind === "photo" ? "images" : "home" : initialView}
    initialTaskId={taskId}
    initialSceneId={sceneId}
    initialImageTool={imageTool}
    initialPreset={initialPreset}
    initialTemplateGallery={templateGallery}
    initialCatalog={catalog}
    initialInspirations={initialView === "inspirations" ? await getAidreamcapesInspirationCards() : []}
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
  const tool = value("tool");
  const scene = value("scene");
  const sceneId: SceneId | undefined = scene === "presenter_showcase" || scene === "process_demo" || scene === "texture_closeup" ? scene : undefined;
  const imageTools: WorkspaceImageTool[] = ["custom", "change-background", "white-background", "model-photos", "lifestyle-photos"];
  const queryView = value("view");
  const initialView: WorkspaceView | undefined = isWorkspaceView(queryView) ? queryView : value("tool_id") === "image_generator" || (tool && imageTools.includes(tool as WorkspaceImageTool)) ? "images" : undefined;
  const imageTool = initialView === "images" && tool && imageTools.includes(tool as WorkspaceImageTool) ? tool as WorkspaceImageTool : undefined;
  const presetRequest = presetRequestFromQuery(query);
  const invalidPreset = Boolean(query.source !== undefined || query.preset !== undefined) && !presetRequest;
  return { taskId: value("task"), sceneId, initialView, imageTool, presetRequest, invalidPreset };
}
