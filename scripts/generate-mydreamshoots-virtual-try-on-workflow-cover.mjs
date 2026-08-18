import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, "public/assets/dreamshoot/generated/blog/virtual-try-on-workflow-cover.webp");
const sourcePaths = [
  path.join(repoRoot, "public/assets/dreamshoot/generated/pack-galleries/virtual-try-on/virtual-try-on-01.webp"),
  path.join(repoRoot, "public/assets/dreamshoot/generated/pack-galleries/virtual-try-on/virtual-try-on-02.webp"),
  path.join(repoRoot, "public/assets/dreamshoot/generated/pack-galleries/virtual-try-on/virtual-try-on-03.webp")
];

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const panelWidth = 640;
const panelHeight = 640;
const labelHeight = 76;
const panels = await Promise.all(sourcePaths.map((sourcePath) => sharp(sourcePath)
  .resize(panelWidth, panelHeight - labelHeight, { fit: "cover", position: "centre" })
  .toBuffer()));

const labels = ["Source portrait example", "Outfit reference example", "AI preview example"];
const labelSvg = labels.map((label, index) => ({
  input: Buffer.from(`<svg width="${panelWidth}" height="${labelHeight}"><rect width="100%" height="100%" fill="#111827"/><text x="28" y="48" fill="#ffffff" font-family="Arial, sans-serif" font-size="26" font-weight="700">${label}</text></svg>`),
  top: panelHeight - labelHeight,
  left: index * panelWidth
}));

await sharp({
  create: {
    width: panelWidth * panels.length,
    height: panelHeight,
    channels: 3,
    background: "#111827"
  }
})
  .composite([
    ...panels.map((input, index) => ({ input, left: index * panelWidth, top: 0 })),
    ...labelSvg
  ])
  .webp({ quality: 86 })
  .toFile(outputPath);

console.log(JSON.stringify({ ok: true, outputPath, panels: labels }, null, 2));
