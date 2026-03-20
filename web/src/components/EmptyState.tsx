interface EmptyStateProps {
  type: 'files' | 'trash' | 'favorites' | 'shares' | 'explore' | 'search';
  onAction?: () => void;
}

const CONFIG: Record<
  EmptyStateProps['type'],
  { title: string; subtitle: string; actionLabel?: string; svg: JSX.Element }
> = {
  files: {
    title: 'No files yet',
    subtitle: 'Upload your first file to get started',
    actionLabel: 'Upload',
    svg: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="text-slate-300 dark:text-slate-600">
        <rect x="12" y="20" width="56" height="44" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M12 28h56" stroke="currentColor" strokeWidth="2" />
        <path d="M12 24a4 4 0 014-4h16l4 4h24a4 4 0 014 4" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="40" y1="36" x2="40" y2="54" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="31" y1="45" x2="40" y2="36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="49" y1="45" x2="40" y2="36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  trash: {
    title: 'Trash is empty',
    subtitle: 'Items you delete will appear here',
    svg: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="text-slate-300 dark:text-slate-600">
        <rect x="22" y="28" width="36" height="36" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M18 28h44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M32 28v-4a4 4 0 014-4h8a4 4 0 014 4v4" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="34" y1="36" x2="34" y2="56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="40" y1="36" x2="40" y2="56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="46" y1="36" x2="46" y2="56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  favorites: {
    title: 'No favorites',
    subtitle: 'Star files to find them quickly',
    svg: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="text-slate-300 dark:text-slate-600">
        <polygon
          points="40,14 47,30 65,32 52,44 55,62 40,54 25,62 28,44 15,32 33,30"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  shares: {
    title: 'No shared links',
    subtitle: 'Share files to collaborate with others',
    svg: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="text-slate-300 dark:text-slate-600">
        <circle cx="28" cy="40" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="56" cy="26" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="56" cy="54" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="35" y1="36" x2="50" y2="28" stroke="currentColor" strokeWidth="2" />
        <line x1="35" y1="44" x2="50" y2="52" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  explore: {
    title: 'Nothing to explore',
    subtitle: 'Publicly shared files will appear here',
    svg: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="text-slate-300 dark:text-slate-600">
        <circle cx="40" cy="40" r="24" stroke="currentColor" strokeWidth="2" fill="none" />
        <polygon points="40,22 34,44 46,44" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
        <polygon points="40,58 46,36 34,36" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
      </svg>
    ),
  },
  search: {
    title: 'No results found',
    subtitle: 'Try a different search term',
    svg: (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="text-slate-300 dark:text-slate-600">
        <circle cx="36" cy="36" r="16" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="48" y1="48" x2="62" y2="62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="30" y1="30" x2="42" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="42" y1="30" x2="30" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
};

export function EmptyState({ type, onAction }: EmptyStateProps) {
  const cfg = CONFIG[type];

  return (
    <div className="flex flex-col items-center justify-center h-80 text-center">
      <div className="mb-6 w-24 h-24 bg-gray-50 dark:bg-white/[0.04] rounded-full flex items-center justify-center animate-float">
        {cfg.svg}
      </div>
      <p className="text-lg font-medium bg-gradient-to-r from-slate-700 to-slate-500 dark:from-slate-200 dark:to-slate-400 bg-clip-text text-transparent">{cfg.title}</p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">{cfg.subtitle}</p>
      {cfg.actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-5 py-2.5 text-white rounded-xl text-sm font-medium upgrade-cta shadow-sm hover:shadow-md transition-shadow"
        >
          {cfg.actionLabel}
        </button>
      )}
    </div>
  );
}
