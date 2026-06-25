type PublicRouteLoadingProps = {
  mode?: "pricing" | "tools" | "tool";
};

function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-slate-200/85 ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <SkeletonBar className="h-4 w-24" />
      <SkeletonBar className="mt-7 h-9 w-28" />
      <div className="mt-6 space-y-3">
        <SkeletonBar className="h-3 w-full bg-slate-100" />
        <SkeletonBar className="h-3 w-4/5 bg-slate-100" />
        <SkeletonBar className="h-3 w-2/3 bg-slate-100" />
      </div>
      <SkeletonBar className="mt-7 h-10 w-full bg-slate-100" />
    </div>
  );
}

export function PublicRouteLoading({ mode = "tools" }: PublicRouteLoadingProps) {
  const cardCount = mode === "tool" ? 2 : 3;

  return (
    <main className="min-h-screen bg-white text-slate-950" aria-label="Loading page" aria-busy="true">
      <div className="h-[3px] w-full overflow-hidden bg-slate-100">
        <div className="h-full w-1/3 animate-[admin-progress_1.05s_ease-in-out_infinite] bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.62)]" />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col px-5 py-7 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 border-b border-slate-100 pb-5">
          <SkeletonBar className="h-8 w-36" />
          <div className="hidden items-center gap-4 sm:flex">
            <SkeletonBar className="h-3 w-16 bg-slate-100" />
            <SkeletonBar className="h-3 w-20 bg-slate-100" />
            <SkeletonBar className="h-3 w-14 bg-slate-100" />
          </div>
        </div>

        <section className="py-12 sm:py-16">
          <SkeletonBar className="h-4 w-28" />
          <SkeletonBar className="mt-5 h-11 w-full max-w-xl sm:h-14" />
          <div className="mt-6 max-w-2xl space-y-3">
            <SkeletonBar className="h-3 w-full bg-slate-100" />
            <SkeletonBar className="h-3 w-4/5 bg-slate-100" />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: cardCount }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </section>
      </div>
    </main>
  );
}
