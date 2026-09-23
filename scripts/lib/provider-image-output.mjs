import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

function extensionForFormat(format) {
  switch (String(format || "").toLowerCase()) {
    case "jpeg":
    case "jpg":
      return "jpg";
    case "png":
      return "png";
    case "webp":
      return "webp";
    case "avif":
      return "avif";
    default:
      throw new Error(`provider_image_unknown_format:${format || "unknown"}`);
  }
}

function aspectRatio(width, height) {
  return Number(width) / Number(height);
}

export async function assertProviderAspectRatio({ filePath, expectedWidth, expectedHeight, label, tolerance = 0.01 }) {
  const metadata = await sharp(filePath).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`${label}:provider_image_dimensions_unavailable`);
  const actualRatio = aspectRatio(metadata.width, metadata.height);
  const expectedRatio = aspectRatio(expectedWidth, expectedHeight);
  if (Math.abs(actualRatio - expectedRatio) > tolerance) {
    throw new Error(`${label}:refusing_to_crop_aspect_ratio_mismatch:${metadata.width}x${metadata.height}:expected_ratio=${expectedWidth}x${expectedHeight}`);
  }
  return metadata;
}

/**
 * Persist the provider response byte-for-byte, then create a display derivative
 * that preserves the provider aspect ratio. No provider output may be cropped.
 */
export async function writeProviderImageBundle({ buffer, originalPathBase, displayPath, displayWidth = 3840, label }) {
  const source = sharp(buffer).rotate();
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) throw new Error(`${label}:provider_image_dimensions_unavailable`);

  const originalExtension = extensionForFormat(metadata.format);
  const originalStem = originalPathBase.replace(/\.[^.]+$/, "");
  const originalPath = `${originalStem}.original.${originalExtension}`;
  await fs.mkdir(path.dirname(originalPath), { recursive: true });
  await fs.writeFile(originalPath, buffer, { flag: "wx" });

  const displayHeight = Math.max(1, Math.round(displayWidth * metadata.height / metadata.width));
  await fs.mkdir(path.dirname(displayPath), { recursive: true });
  await source
    .resize(displayWidth, displayHeight, { fit: "inside", withoutEnlargement: false })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(displayPath);

  const displayMetadata = await sharp(displayPath).metadata();
  if (displayMetadata.width !== displayWidth || displayMetadata.height !== displayHeight || displayMetadata.format !== "jpeg") {
    throw new Error(`${label}:provider_display_output_invalid:${displayMetadata.width}x${displayMetadata.height}:${displayMetadata.format}`);
  }

  return {
    originalPath,
    originalFormat: metadata.format,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
    displayPath,
    displayWidth,
    displayHeight,
    displayFormat: displayMetadata.format
  };
}
