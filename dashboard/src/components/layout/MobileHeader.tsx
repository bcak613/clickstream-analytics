'use client';

import React from 'react';
import { Menu, Database } from 'lucide-react';
import { useSidebar } from '@/components/providers/SidebarProvider';

/** Thin top bar — only visible on mobile (md:hidden) */
export function MobileHeader() {
  const { toggle } = useSidebar();
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-surface-container-lowest border-b border-outline-variant flex items-center justify-between px-4 shadow-sm">
      <button
        onClick={toggle}
        aria-label="Open menu"
        className="p-2 -ml-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2">
        <div className="bg-primary/10 p-1.5 rounded-lg text-primary">
          <Database className="w-4 h-4" />
        </div>
        <div className="leading-tight">
          <span className="text-xs font-extrabold tracking-wide uppercase text-on-surface">Clickstream</span>
          <span className="block text-[10px] font-medium text-on-surface-variant">Analytics Platform</span>
        </div>
      </div>

      {/* Spacer for symmetry */}
      <div className="w-9" />
    </header>
  );
}
