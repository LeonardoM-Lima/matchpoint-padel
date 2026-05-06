interface ScreenSkeletonProps {
  rows?: number;
}

export function ScreenSkeleton({ rows = 3 }: ScreenSkeletonProps) {
  return (
    <div className="grid gap-3" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="relative animate-pulse overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-slate-800/80" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded-full bg-slate-800/80" />
              <div className="h-2.5 w-1/2 rounded-full bg-slate-800/60" />
            </div>
            <div className="h-8 w-12 rounded-lg bg-slate-800/80" />
          </div>
        </div>
      ))}
    </div>
  );
}
