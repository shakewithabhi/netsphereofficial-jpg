import React, { useEffect, useRef, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface ContextMenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ items, x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    if (x + rect.width > vw - 8) adjustedX = vw - rect.width - 8;
    if (y + rect.height > vh - 8) adjustedY = vh - rect.height - 8;
    if (adjustedX < 8) adjustedX = 8;
    if (adjustedY < 8) adjustedY = 8;

    menuRef.current.style.left = `${adjustedX}px`;
    menuRef.current.style.top = `${adjustedY}px`;
  }, [x, y]);

  useEffect(() => {
    reposition();
  }, [reposition]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleScroll() {
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-[#0F172A] rounded-xl shadow-2xl border border-gray-100 dark:border-white/[0.05] py-1.5 min-w-[200px] animate-fade-in"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {item.divider && idx > 0 && (
            <div className="my-1 border-t border-slate-100 dark:border-white/[0.05]" />
          )}
          <button
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-left ${
              item.danger
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08]'
            }`}
          >
            <item.icon size={15} />
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
