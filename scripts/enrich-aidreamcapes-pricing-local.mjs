import assert from "node:assert/strict";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
import { PrismaClient } from "@prisma/client";

loadRuntimeEnv();
assertDatabaseTarget({ expectedTarget: "local" });

const SITE_ID = "site_aidreamcapes";
const APPLY = hasArgument("--apply-local");
const OUTPUT_ESTIMATE_NOTE = "These are alternative estimates from the same credit allowance. Exact costs vary by workflow and settings.";
const prisma = new PrismaClient();

const plans = [
  {
    id: "prod_aidreamcapes_starter",
    name: "Starter",
    badgeLabel: "Good to start",
    baseline: {
      summary: "For trying video ads and product photos.",
      features: [
        "About 8 product photos or 3 fifteen-second videos a month",
        "Videos and photos",
        "All templates",
        "9:16, 1:1, 16:9, 4:3 and 3:4 video sizes",
        "No watermark"
      ]
    },
    next: {
      summary: "A flexible first plan for testing product photos and short video ads.",
      outputEstimate: { photos: 8, fifteenSecondVideos: 3, note: OUTPUT_ESTIMATE_NOTE },
      features: [
        "Plan product photos and short video ads in the same workspace.",
        "Browse all available scene templates.",
        "Choose from five video formats: 9:16, 1:1, 16:9, 4:3, and 3:4.",
        "Generated outputs are watermark-free.",
        "Review the credit estimate before starting a creation.",
        "Use one credit allowance across photo and video workflows.",
        "A clear starting point for testing a first product campaign."
      ]
    },
    previous: {
      summary: "A flexible first plan for testing product photos and short video ads.",
      outputEstimate: { photos: 8, fifteenSecondVideos: 3 },
      features: [
        "Plan product photos and short video ads in the same workspace.",
        "Browse all available scene templates.",
        "Choose from five video formats: 9:16, 1:1, 16:9, 4:3, and 3:4.",
        "Generated outputs are watermark-free.",
        "Review the credit estimate before starting a creation.",
        "Use one credit allowance across photo and video workflows.",
        "A clear starting point for testing a first product campaign."
      ]
    }
  },
  {
    id: "prod_aidreamcapes_pro",
    name: "Pro",
    badgeLabel: "Most popular",
    baseline: {
      summary: "For stores testing new ads every week.",
      features: [
        "About 12 product photos or 5 fifteen-second videos a month",
        "Everything in Starter",
        "100 more credits than Starter",
        "Room for weekly ad testing"
      ]
    },
    next: {
      summary: "For stores building a regular cadence of product photo and video ad tests.",
      outputEstimate: { photos: 12, fifteenSecondVideos: 5, note: OUTPUT_ESTIMATE_NOTE },
      features: [
        "Includes Starter photo and video workflows, templates, formats, and watermark-free outputs.",
        "A larger credit allowance than Starter.",
        "Use one credit allowance across photo and video workflows.",
        "Make room for regular weekly ad testing.",
        "Build more creative variations before choosing an ad direction.",
        "A fit for stores refreshing product ads on a regular schedule."
      ]
    },
    previous: {
      summary: "For stores building a regular cadence of product photo and video ad tests.",
      outputEstimate: { photos: 12, fifteenSecondVideos: 5 },
      features: [
        "Includes Starter photo and video workflows, templates, formats, and watermark-free outputs.",
        "A larger credit allowance than Starter.",
        "Use one credit allowance across photo and video workflows.",
        "Make room for regular weekly ad testing.",
        "Build more creative variations before choosing an ad direction.",
        "A fit for stores refreshing product ads on a regular schedule."
      ]
    }
  },
  {
    id: "prod_aidreamcapes_premium",
    name: "Premium",
    badgeLabel: "Best value",
    baseline: {
      summary: "For brands and agencies with many products.",
      features: [
        "About 25 product photos or 10 fifteen-second videos a month",
        "Everything in Pro",
        "Twice the credits of Pro",
        "Most room for new products"
      ]
    },
    next: {
      summary: "For brands and agencies creating assets across a broader product range.",
      outputEstimate: { photos: 25, fifteenSecondVideos: 10, note: OUTPUT_ESTIMATE_NOTE },
      features: [
        "Includes Pro photo and video workflows, templates, formats, and watermark-free outputs.",
        "Double Pro's credit allowance.",
        "Use one credit allowance across photo and video workflows.",
        "Create more variations across a broader product lineup.",
        "Make more room to compare campaign concepts before launch.",
        "Designed for brands and agencies working with many products."
      ]
    },
    previous: {
      summary: "For brands and agencies creating assets across a broader product range.",
      outputEstimate: { photos: 25, fifteenSecondVideos: 10 },
      features: [
        "Includes Pro photo and video workflows, templates, formats, and watermark-free outputs.",
        "Double Pro's credit allowance.",
        "Use one credit allowance across photo and video workflows.",
        "Create more variations across a broader product lineup.",
        "Make more room to compare campaign concepts before launch.",
        "Designed for brands and agencies working with many products."
      ]
    }
  }
];

function sameJson(left, right) {
  const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    }
    return value;
  };
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

try {
  const result = await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { siteId: SITE_ID, id: { in: plans.map((plan) => plan.id) }, type: "subscription" },
      select: { id: true, siteId: true, name: true, status: true, metadata: true }
    });
    assert.equal(products.length, plans.length, "expected exactly the three Aidreamcapes subscription products");

    const updates = [];
    for (const plan of plans) {
      const product = products.find((candidate) => candidate.id === plan.id);
      assert.ok(product, `missing Aidreamcapes product ${plan.id}`);
      assert.equal(product.siteId, SITE_ID, `wrong owner for ${plan.id}`);
      assert.equal(product.name, plan.name, `unexpected plan name for ${plan.id}`);
      assert.equal(product.status, "active", `unexpected plan status for ${plan.id}`);
      const metadata = product.metadata && typeof product.metadata === "object" && !Array.isArray(product.metadata)
        ? product.metadata
        : {};
      const expected = {
        summary: plan.next.summary,
        badgeLabel: plan.badgeLabel,
        outputEstimate: plan.next.outputEstimate,
        features: plan.next.features
      };
      const current = {
        summary: metadata.summary,
        badgeLabel: metadata.badgeLabel,
        outputEstimate: metadata.outputEstimate,
        features: metadata.features
      };
      if (sameJson(current, expected)) {
        updates.push({ id: plan.id, changed: false, featureCount: plan.next.features.length });
        continue;
      }

      const acceptedSources = [plan.baseline, plan.previous].filter(Boolean).map((source) => ({
        summary: source.summary,
        badgeLabel: plan.badgeLabel,
        outputEstimate: source.outputEstimate,
        features: source.features
      }));
      assert.ok(acceptedSources.some((source) => sameJson(current, source)), `pricing copy changed outside this task for ${plan.id}`);

      updates.push({ id: plan.id, changed: true, featureCount: plan.next.features.length });
      if (APPLY) {
        await tx.product.update({
          where: { id: plan.id, siteId: SITE_ID },
          data: { metadata: { ...metadata, ...expected } }
        });
      }
    }
    return updates;
  }, { isolationLevel: "Serializable" });

  console.log(JSON.stringify({
    mode: APPLY ? "apply-local" : "dry-run",
    siteId: SITE_ID,
    writes: APPLY ? result.filter((item) => item.changed).length : 0,
    plans: result
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
