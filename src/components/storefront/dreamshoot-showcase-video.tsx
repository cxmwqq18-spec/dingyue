type DreamshootShowcaseVideoProps = { src: string; poster: string; label: string; className?: string; priority?: boolean };

export function DreamshootShowcaseVideo({ src, poster, label, className, priority = false }: DreamshootShowcaseVideoProps) {
  return <video aria-label={label} autoPlay className={className} loop muted playsInline poster={poster} preload={priority ? "auto" : "metadata"} src={src} title={label} />;
}
