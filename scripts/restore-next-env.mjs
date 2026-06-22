import fs from "node:fs";
import path from "node:path";

const nextEnvPath = path.join(process.cwd(), "next-env.d.ts");
const stableContent = `/// <reference types="next" />
/// <reference types="next/image-types/global" />
/// <reference path="./.next/types/routes.d.ts" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`;

if (fs.existsSync(nextEnvPath) && fs.readFileSync(nextEnvPath, "utf8") !== stableContent) {
  fs.writeFileSync(nextEnvPath, stableContent);
}
