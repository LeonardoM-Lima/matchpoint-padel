interface ScreenSkeletonProps {
  rows?: number;
}

export function ScreenSkeleton({ rows = 3 }: ScreenSkeletonProps) {
  return (
    <div className="grid gap-3" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-lg border border-slate-800 bg-slate-900/70 p-4"
        >
          <div className="h-4 w-2/3 rounded bg-slate-800" />
          <div className="mt-3 h-3 w-full rounded bg-slate-800" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-800" />
        </div>
      ))}
    </div>
  );
}
