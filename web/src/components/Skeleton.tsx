export function FileSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0F172A] border border-gray-100 dark:border-white/[0.05] rounded-2xl p-4">
      <div className="skeleton w-full h-24 mb-3" style={{ borderRadius: '12px' }} />
      <div className="skeleton w-3/4 h-3 mb-2" />
      <div className="skeleton w-1/2 h-2.5" />
    </div>
  );
}

export function FileListSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#0F172A] border border-gray-100/80 dark:border-white/[0.05] rounded-xl">
      <div className="skeleton w-8 h-8 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="skeleton w-48 h-3 mb-1.5" />
        <div className="skeleton w-24 h-2.5" />
      </div>
      <div className="skeleton w-16 h-3 hidden sm:block" />
      <div className="skeleton w-20 h-3 hidden sm:block" />
    </div>
  );
}

export function FileGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <FileSkeleton key={i} />
      ))}
    </div>
  );
}

export function FileListSkeletonGroup() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 12 }).map((_, i) => (
        <FileListSkeleton key={i} />
      ))}
    </div>
  );
}
