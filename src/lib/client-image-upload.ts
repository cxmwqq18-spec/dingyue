export type PreparedCustomerImageUpload = {
  file: File;
  compressed: boolean;
  originalSize: number;
  uploadSize: number;
};

const defaultTargetBytes = 8 * 1024 * 1024;
const compressionPlans = [
  { maxDimension: 2200, quality: 0.86 },
  { maxDimension: 1800, quality: 0.78 },
  { maxDimension: 1500, quality: 0.7 }
];

function canCompressImage(file: File): boolean {
  const type = file.type.toLowerCase();
  if (!type.startsWith("image/")) return false;
  return type !== "image/gif" && type !== "image/svg+xml";
}

function jpegName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "upload";
  return `${baseName}.jpg`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_decode_failed"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("image_encode_failed"));
    }, "image/jpeg", quality);
  });
}

async function compressToJpeg(file: File, maxDimension: number, quality: number): Promise<File> {
  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error("image_dimensions_missing");
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_context_missing");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  const blob = await canvasToBlob(canvas, quality);
  return new File([blob], jpegName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
}

export async function prepareCustomerImageUploadFile(
  file: File,
  options: { targetBytes?: number } = {}
): Promise<PreparedCustomerImageUpload> {
  const targetBytes = options.targetBytes ?? defaultTargetBytes;
  if (!canCompressImage(file) || file.size <= targetBytes) {
    return { file, compressed: false, originalSize: file.size, uploadSize: file.size };
  }

  let best: File | undefined;
  for (const plan of compressionPlans) {
    try {
      const candidate = await compressToJpeg(file, plan.maxDimension, plan.quality);
      if (!best || candidate.size < best.size) best = candidate;
      if (candidate.size <= targetBytes) {
        return { file: candidate, compressed: true, originalSize: file.size, uploadSize: candidate.size };
      }
    } catch {
      break;
    }
  }

  if (best && best.size < file.size) {
    return { file: best, compressed: true, originalSize: file.size, uploadSize: best.size };
  }
  return { file, compressed: false, originalSize: file.size, uploadSize: file.size };
}

export function customerImageUploadErrorMessage(fileName: string, error: string | undefined, spanish = false): string {
  if (error === "asset_file_too_large" || error?.startsWith("asset_data_too_large")) {
    return spanish
      ? `${fileName} sigue siendo demasiado grande para subirlo. Elige una imagen mas pequena e intentalo de nuevo.`
      : `${fileName} is still too large to upload. Choose a smaller image and try again.`;
  }
  if (error === "asset_file_must_be_image" || error === "asset_file_required") {
    return spanish
      ? `${fileName} no parece ser una imagen compatible. Elige un archivo JPG, PNG o WebP.`
      : `${fileName} does not look like a supported image. Choose a JPG, PNG, or WebP file.`;
  }
  if (error === "rate_limited") {
    return spanish
      ? "Se iniciaron demasiadas subidas a la vez. Espera un minuto e intentalo de nuevo."
      : "Too many uploads were started at once. Wait a minute, then try again.";
  }
  return spanish
    ? `No pudimos subir ${fileName}. Intentalo de nuevo.`
    : `We could not upload ${fileName}. Please try again.`;
}
