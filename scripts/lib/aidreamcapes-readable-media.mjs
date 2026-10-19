const IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpg", "jpeg", "png", "svg", "webp"]);
const VIDEO_EXTENSIONS = new Set(["m4v", "mov", "mp4", "webm"]);
const AUDIO_EXTENSIONS = new Set(["m4a", "mp3", "ogg", "wav"]);

export const READABLE_STATIC_RE = /^\/(ai-image-generation|ai-video-generation|ai-actors)\/(?:actors\/)?[a-z0-9][a-z0-9._-]{0,159}\.(?:avif|gif|jpe?g|m4a|m4v|mov|mp3|mp4|ogg|png|svg|wav|webm|webp)$/i;

export function readableMediaTarget(sourcePath, extension, isActor, usedNames = new Set()) {
  const ext = extension.toLowerCase();
  const isVideo = VIDEO_EXTENSIONS.has(ext);
  const isAudio = AUDIO_EXTENSIONS.has(ext);
  if (!isVideo && !isAudio && !IMAGE_EXTENSIONS.has(ext)) throw new Error(`unsupported_media_extension:${ext}`);
  const sourceLeaf = sourcePath.split("/").at(-1).replace(/--sha256-[a-f0-9]{64}(?=\.[^.]+$)/i, "");
  const originalStem = sourceLeaf.slice(0, -(ext.length + 1));
  let stem = originalStem.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 112).replace(/-+$/g, "") || "asset";
  const publicPrefix = isActor ? (isAudio ? "/ai-actors/" : isVideo ? "/ai-video-generation/actors/" : "/ai-image-generation/actors/")
    : isAudio ? "/ai-actors/" : isVideo ? "/ai-video-generation/" : "/ai-image-generation/";
  const physicalFolder = isActor || isAudio ? "actor" : isVideo ? "video" : "image";
  let name = `${stem}.${ext}`;
  let serial = 2;
  while (usedNames.has(`${publicPrefix}${name}`)) name = `${stem}-${serial++}.${ext}`;
  const targetUrl = `${publicPrefix}${name}`;
  usedNames.add(targetUrl);
  return { targetUrl, relativeOutput: `${physicalFolder}/${name}` };
}
