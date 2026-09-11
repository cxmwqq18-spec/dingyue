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
  muted = true
}: DreamshootShowcaseVideoProps) {
  return <video aria-label={label} autoPlay={autoPlay} className={className} controls={controls} loop={loop} muted={muted} playsInline poster={poster} preload={priority ? "auto" : "metadata"} src={src} title={label} />;
}
