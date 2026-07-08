import fs from "node:fs";
import path from "node:path";

const nextEnvPath = path.join(process.cwd(), "next-env.d.ts");
const tsconfigPath = path.join(process.cwd(), "tsconfig.json");
const stableContent = `/// <reference types="next" />
/// <reference types="next/image-types/global" />
/// <reference path="./.next/types/routes.d.ts" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`;

if (fs.existsSync(nextEnvPath) && fs.readFileSync(nextEnvPath, "utf8") !== stableContent) {
  fs.writeFileSync(nextEnvPath, stableContent);
}

if (fs.existsSync(tsconfigPath)) {
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
  const stableNextTypeIncludes = new Set([
    ".next-3010/types/**/*.ts",
    ".next-dev/types/**/*.ts",
    ".next/types/**/*.ts"
  ]);
  tsconfig.include = Array.from(
    new Set(
      (tsconfig.include ?? []).filter((item) => {
        if (typeof item !== "string") return false;
        if (!item.startsWith(".next-")) return true;
        return stableNextTypeIncludes.has(item);
      })
    )
  );
  if (!tsconfig.include.includes(".next/types/**/*.ts")) tsconfig.include.push(".next/types/**/*.ts");
  if (!tsconfig.include.includes("next-env.d.ts")) tsconfig.include.push("next-env.d.ts");
  fs.writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
}
