import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { AdminModuleDefinition, AdminModuleLink, AdminTone } from "@/lib/admin-menu";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  group?: string;
  badge?: string;
};

export type AdminBreadcrumb = {
  label: string;
  href?: string;
};

export type AdminWorkspace = {
  label: string;
  name: string;
  meta?: string;
  statusLabel?: string;
  statusTone?: AdminTone;
};

export type AdminWorkspaceSummary = Pick<AdminWorkspace, "name" | "meta" | "statusLabel" | "statusTone">;

export type AdminQuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  detail?: string;
  tone?: AdminTone;
};

export type AdminCommandAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  tone?: AdminTone;
};

export type AdminStatBadge = {
  label: string;
  value: string;
  tone?: AdminTone;
  href?: string;
};

export type AdminShellProps = {
  brand: string;
  eyebrow: string;
  title: string;
  titleBadge?: string;
  subtitle?: string;
  showWorkspaceSummary?: boolean;
  breadcrumbs?: AdminBreadcrumb[];
  nav: AdminNavItem[];
  action?: { label: string; href: string };
  account?: ReactNode;
  workspace?: AdminWorkspace;
  commandActions?: AdminCommandAction[];
  quickActions?: AdminQuickAction[];
  stats?: AdminStatBadge[];
  headerStats?: AdminStatBadge[];
  toolbarStats?: AdminStatBadge[];
  rightRail?: ReactNode;
  rightRailMode?: "aside" | "stacked";
  activeModuleCode?: string;
  siteSlug?: string;
  moduleLinks?: AdminModuleLink[];
  primaryModules?: AdminModuleDefinition[];
  shellLabel?: string;
  children: ReactNode;
};
