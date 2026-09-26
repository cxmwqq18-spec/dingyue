type DreamshootShowcaseVideoProps = {
  src: string;
  poster: string;
  label: string;
  className?: string;
  priority?: boolean;
  controls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  width?: number;
  height?: number;
};

export function DreamshootShowcaseVideo({
  src,
  poster,
  label,
  className,
  priority = false,
  controls = false,
  autoPlay = true,
  loop = true,
  muted = true,
  width = 1280,
  height = 720
}: DreamshootShowcaseVideoProps) {
  const videoMimeType = /\.webm(?:[?#]|$)/i.test(src) ? "video/webm" : /\.(?:mp4|m4v|mov)(?:[?#]|$)/i.test(src) ? "video/mp4" : undefined;
  return (
    <video aria-label={label} autoPlay={autoPlay} className={className} controls={controls} height={height} loop={loop} muted={muted} playsInline poster={poster} preload={priority ? "auto" : "metadata"} title={label} width={width}>
      {videoMimeType ? <source src={src} type={videoMimeType} /> : <source src={src} />}
    </video>
  );
}
