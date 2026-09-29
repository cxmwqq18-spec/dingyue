import rawMedia from "./aidreamcapes-ugc-video-media.json";

export type AidreamcapesUgcVideoMedia = {
  directory: string;
  slug: string;
  route: string;
  label: string;
  videoPath: string;
};

export const aidreamcapesUgcVideoMedia: AidreamcapesUgcVideoMedia[] = rawMedia.map((item) => ({
  ...item,
  videoPath: `/assets/sites/site_aidreamcapes/ugc-video-themes/${item.slug}.mp4`
}));

export const aidreamcapesUgcVideoMediaByRoute = new Map(
  aidreamcapesUgcVideoMedia.map((item) => [item.route, item])
);

export const aidreamcapesUgcVideoMediaBySlug = new Map(
  aidreamcapesUgcVideoMedia.map((item) => [item.slug, item])
);
