import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function summarize(state) {
  return {
    sites: state.sites?.length ?? 0,
    customers: state.customers?.length ?? 0,
    products: state.products?.length ?? 0,
    jobs: state.jobs?.length ?? 0,
    assets: state.assetUploads?.length ?? 0,
    albums: state.albums?.length ?? 0
  };
}

async function main() {
  const document = await prisma.platformStateDocument.findUnique({ where: { id: "platform" } });
  if (!document?.state) throw new Error("platform_state_document_missing");
  const summary = summarize(document.state);
  if (summary.sites <= 0) throw new Error("platform_state_has_no_sites");
  if (summary.products <= 0) throw new Error("platform_state_has_no_products");
  console.log(JSON.stringify({ ok: true, backend: "postgres", summary }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
