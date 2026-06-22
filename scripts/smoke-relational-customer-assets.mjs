import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const requiredModels = {
  Customer: ["id", "siteId", "email", "name", "status", "passwordHash"],
  CustomerSession: ["id", "siteId", "customerId", "createdAt", "expiresAt"],
  AssetUpload: ["id", "siteId", "customerId", "label", "storageKey", "mimeType", "role", "visibility", "reviewStatus", "createdAt", "deletedAt"],
  CustomerModel: ["id", "siteId", "customerId", "status", "inputAssetCount", "updatedAt"],
  Album: ["id", "siteId", "customerId", "status", "outputCount", "updatedAt"]
};

function fieldsFor(modelName) {
  const model = prisma._runtimeDataModel.models[modelName];
  return new Set((model?.fields ?? []).map((field) => field.name));
}

async function main() {
  const schema = {};
  const missing = [];
  for (const [modelName, fields] of Object.entries(requiredModels)) {
    const available = fieldsFor(modelName);
    schema[modelName] = {
      available: Boolean(available.size),
      missingFields: fields.filter((field) => !available.has(field))
    };
    if (!available.size) missing.push(`${modelName} model`);
    for (const field of schema[modelName].missingFields) missing.push(`${modelName}.${field}`);
  }

  const delegates = ["customer", "assetUpload", "customerModel", "album", "customerSession"];
  const missingDelegates = delegates.filter((delegate) => !(delegate in prisma));
  for (const delegate of missingDelegates) missing.push(`delegate:${delegate}`);

  if (missing.length) {
    console.log(JSON.stringify({ ok: false, reason: "relational_schema_incomplete", missing, schema, delegates: { missing: missingDelegates } }, null, 2));
    process.exitCode = 1;
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.log(JSON.stringify({ ok: true, schema, db: { checked: false, reason: "DATABASE_URL_missing" } }, null, 2));
    return;
  }

  const [site, customer, asset] = await Promise.all([
    prisma.site.findFirst({ select: { id: true, slug: true } }),
    prisma.customer.findFirst({ include: { balance: true } }),
    prisma.assetUpload.findFirst()
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        schema,
        sample: {
          siteId: site?.id ?? null,
          customerId: customer?.id ?? null,
          assetId: asset?.id ?? null
        }
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
