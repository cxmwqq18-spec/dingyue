import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".next-*/**",
      ".next-build/**",
      ".codex/**",
      "node_modules/**",
      "next-env.d.ts",
      "tsconfig.tsbuildinfo",
      ".tmp-*.cjs",
      "tmp/**",
      "data/**",
      "public/**",
      "coverage/**"
    ]
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@next/next/no-img-element": "warn",
      "react/no-unescaped-entities": "off"
    }
  },
  {
    files: [
      "src/components/admin/creative-pack-editor.tsx",
      "src/components/admin/customer-asset-review-panel.tsx",
      "src/components/admin/theme-manager-panel.tsx",
      "src/components/admin/theme-media-panel.tsx",
      "src/components/admin/video-theme-editor.tsx",
      "src/components/app/assets-panel.tsx",
      "src/components/app/job-assets-panel.tsx",
      "src/components/app/job-create-form.tsx",
      "src/components/designer/designer-resource-primitives.tsx",
      "src/components/designer/field-editor-registry.tsx",
      "src/components/storefront/customer-shell-header.tsx",
      "src/components/storefront/customer-workspace-shell.tsx",
      "src/components/storefront/dreamshoot-package-catalog-client.tsx",
      "src/components/storefront/dreamshoot-showcase-preview.tsx",
      "src/components/storefront/package-taxonomy-client.tsx",
      "src/components/theme-renderer.tsx"
    ],
    rules: {
      "@next/next/no-img-element": "off"
    }
  }
];

export default eslintConfig;
