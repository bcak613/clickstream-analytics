'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Users, Tag, Calendar, Database, Presentation, Zap, FileText, X } from 'lucide-react';
import { useDuckDBPerf } from '@/components/providers/DuckDBProvider';
import { LangToggle, useLang } from '@/components/providers/LangProvider';
import { useSidebar } from '@/components/providers/SidebarProvider';

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { lastQueryMs, totalQueriesRun, queryStats } = useDuckDBPerf();
  const { t } = useLang();
  const { isOpen, close } = useSidebar();

  const overviewItems: SidebarItem[] = [
    { label: t('Dashboard', 'Dashboard'), href: '/', icon: <Presentation className="w-5 h-5" /> }
  ];

  const analyticItems: SidebarItem[] = [
    { label: t('Xu hướng Doanh thu', 'Sales Trends'),     href: '/sales-trends',     icon: <Calendar  className="w-5 h-5" /> },
    { label: t('Nhóm Khách hàng',       'Cohort Retention'),  href: '/cohort-retention', icon: <Users     className="w-5 h-5" /> },
    { label: t('Thị hiếu Thương hiệu', 'Brand Preferences'), href: '/brand-preferences', icon: <Tag      className="w-5 h-5" /> },
    { label: t('Phân khúc RFM',         'RFM Segmentation'),  href: '/rfm-segmentation', icon: <BarChart3 className="w-5 h-5" /> },
    { label: t('Báo cáo Chiến lược',   'Strategy Report'),   href: '/report',           icon: <FileText  className="w-5 h-5" /> },
  ];

  const renderNavGroup = (title: string, items: SidebarItem[]) => {
    return (
      <div className="mb-6">
        <h3 className="text-[11px] font-bold tracking-[0.08em] text-on-surface-variant/60 uppercase px-4 mb-2">
          {title}
        </h3>
        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-container text-primary font-semibold shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    );
  };

  // Total rows returned across all tracked queries
  const totalRowsProcessed = queryStats.reduce((sum, s) => sum + s.rowCount, 0);

  // Speed classification
  const getSpeedInfo = (ms: number) => {
    if (ms < 50)  return { label: 'Blazing', color: 'text-emerald-500' };
    if (ms < 200) return { label: 'Fast',    color: 'text-primary'     };
    if (ms < 500) return { label: 'Good',    color: 'text-[#E8A317]'   };
    return               { label: 'Slow',    color: 'text-red-500'     };
  };

  const speedInfo = lastQueryMs !== null ? getSpeedInfo(lastQueryMs) : null;

  return (
    <>
      {/* Backdrop — mobile only, click to close */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={close}
        />
      )}

      <aside className={`
        w-[240px] bg-surface-container-lowest border-r border-outline-variant flex flex-col h-screen
        md:sticky md:top-0 md:translate-x-0
        fixed top-0 left-0 z-40 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `}>
      {/* Brand Header */}
      <div className="p-5 border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wide uppercase text-on-surface">
              Clickstream
            </h1>
            <span className="text-[11px] font-medium text-on-surface-variant">
              Analytics Platform
            </span>
          </div>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={close}
          className="md:hidden p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors"
          aria-label="Close menu"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 py-6 overflow-y-auto">
        {renderNavGroup(t('Tổng quan', 'Overview'), overviewItems)}
        {renderNavGroup(t('Phân tích', 'Analytics'), analyticItems)}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-outline-variant bg-surface-container-lowest space-y-3">

        {/* Language toggle */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">Language</span>
          <LangToggle />
        </div>

        {/* DuckDB Engine Performance Widget */}
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-3 space-y-2.5">

          {/* Widget header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-extrabold text-on-surface tracking-wider uppercase">
                DuckDB Engine
              </span>
            </div>
            {/* Animated live indicator — appears once a query has run */}
            {lastQueryMs !== null && (
              <span className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                <span className="text-[10px] font-bold text-primary">LIVE</span>
              </span>
            )}
          </div>

          {/* Metrics — shown only after first query fires */}
          {lastQueryMs !== null ? (
            <div className="space-y-1.5">
              {/* Last query duration — big number hero */}
              <div className="flex items-end justify-between">
                <span className="text-[10px] font-medium text-on-surface-variant">{t('Truy vấn cuối', 'Last Query')}</span>
                <div className="flex items-baseline gap-0.5">
                  <span className={`text-lg font-black tabular-nums leading-none ${speedInfo?.color}`}>
                    {lastQueryMs < 1000 ? lastQueryMs : (lastQueryMs / 1000).toFixed(1)}
                  </span>
                  <span className="text-[9px] font-bold text-on-surface-variant">
                    {lastQueryMs < 1000 ? 'ms' : 's'}
                  </span>
                </div>
              </div>

              {/* Speed classification */}
              {speedInfo && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-on-surface-variant font-medium">{t('Tốc độ', 'Speed')}</span>
                  <span className={`text-[10px] font-extrabold uppercase tracking-wide ${speedInfo.color}`}>
                    ⚡ {speedInfo.label}
                  </span>
                </div>
              )}

              {/* Rows returned */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-on-surface-variant font-medium">{t('Số dòng trả về', 'Rows Returned')}</span>
                <span className="text-[10px] font-extrabold text-on-surface tabular-nums">
                  {totalRowsProcessed.toLocaleString()}
                </span>
              </div>

              {/* Total queries count */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-on-surface-variant font-medium">{t('Truy vấn đã chạy', 'Queries Run')}</span>
                <span className="text-[10px] font-extrabold text-on-surface tabular-nums">
                  {totalQueriesRun}
                </span>
              </div>
            </div>
          ) : (
            /* Skeleton while loading */
            <div className="space-y-2">
              <div className="h-2 bg-surface-container rounded-full w-3/4 animate-pulse" />
              <div className="h-2 bg-surface-container rounded-full w-1/2 animate-pulse" />
            </div>
          )}

          {/* Dataset attribution */}
          <div className="pt-1.5 border-t border-outline-variant/40">
            <span className="text-[9px] font-medium text-on-surface-variant/50 leading-tight">
              68M Events · Oct–Nov 2019 · In-browser WASM
            </span>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
};
