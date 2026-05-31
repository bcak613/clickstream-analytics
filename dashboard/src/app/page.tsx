'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDuckDB } from '@/components/providers/DuckDBProvider';
import { useLang } from '@/components/providers/LangProvider';
import { KpiCard } from '@/components/cards/KpiCard';
import { ContentCard } from '@/components/cards/ContentCard';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { DollarSign, Users, Activity, TrendingUp, BarChart3, Tag, Calendar, ChevronRight } from 'lucide-react';

interface OverviewData {
  total_users: number;
  total_events: number;
  view_count: number;
  cart_count: number;
  total_revenue: number;
  purchase_count: number;
  purchase_sessions: number;
  avg_order_value: number;
  conversion_rate: number;
}

export default function OverviewPage() {
  const { loading, error, query } = useDuckDB();
  const { t } = useLang();
  const [data, setData] = useState<OverviewData | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || error) return;

    const fetchData = async () => {
      try {
        const result = await query('SELECT * FROM overview_kpis LIMIT 1');
        if (result && result.length > 0) {
          setData(result[0]);
        }
      } catch (err: any) {
        console.error('Failed to run overview query:', err);
        setQueryError(err.message || 'Failed to fetch overview metrics.');
      }
    };

    fetchData();
  }, [loading, error, query]);

  // Render full-page error
  if (error || queryError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <ErrorCard 
          message={error || queryError || 'Failed to initialize analytics engine.'} 
          className="max-w-md"
        />
      </div>
    );
  }

  // Render skeletons while loading
  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header */}
        <div className="h-8 bg-surface-container rounded w-1/4 mb-6"></div>
        
        {/* KPIs row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard height="h-[140px]" />
          <SkeletonCard height="h-[140px]" />
          <SkeletonCard height="h-[140px]" />
          <SkeletonCard height="h-[140px]" />
        </div>
        
        {/* Nav grid */}
        <div className="h-6 bg-surface-container rounded w-1/5 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard height="h-[180px]" />
          <SkeletonCard height="h-[180px]" />
          <SkeletonCard height="h-[180px]" />
          <SkeletonCard height="h-[180px]" />
        </div>
      </div>
    );
  }

  // Format helper functions
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('en-US').format(val);
  };

  const formatPercent = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const navCards = [
    {
      title: t('Xu hướng Doanh thu', 'Sales Trends'),
      desc: t('Chỉ số giao dịch hằng ngày/tuần, phễu sự kiện View → Cart → Purchase và độ trễ chuyển đổi phiên.', 'Interactive daily/weekly transactional metrics, View → Cart → Purchase event funnels, and session conversion latency.'),
      href: '/sales-trends',
      icon: <Calendar className="w-6 h-6 text-primary" />,
      tag: t('GIAO DỊCH', 'TRANSACTIONAL')
    },
    {
      title: t('Nhóm Khách hàng (Cohort)', 'Cohort Retention'),
      desc: t('Ma trận giữ chân nhóm khách hàng theo tuần và đường cong suy giảm gắn bó trung bình.', 'Week-over-week acquisition purchase-based cohorts retention matrices and average engagement decay trends.'),
      href: '/cohort-retention',
      icon: <Users className="w-6 h-6 text-primary" />,
      tag: t('HÀNH VI', 'BEHAVIORAL')
    },
    {
      title: t('Thị hiếu Thương hiệu', 'Brand Preferences'),
      desc: t('So sánh Top 10 thương hiệu theo doanh thu, số lượng đơn và giá trị đơn trung bình.', 'Top 10 brand comparison models sorted by revenue, volume, and average order values with sortable grids.'),
      href: '/brand-preferences',
      icon: <Tag className="w-6 h-6 text-primary" />,
      tag: t('THỊ TRƯỜNG', 'MARKET')
    },
    {
      title: t('Phân khúc RFM', 'RFM Segmentation'),
      desc: t('Điểm số RFM phân loại khách hàng thành 11 nhóm hành vi chi tiết.', 'Recency, frequency, and monetary quintile scores classifying users into 11 behavior segment detail cards.'),
      href: '/rfm-segmentation',
      icon: <BarChart3 className="w-6 h-6 text-primary" />,
      tag: t('KHÁCH HÀNG', 'CUSTOMER')
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-on-surface">
          {t('Tổng quan Dashboard', 'Dashboard Overview')}
        </h1>
        <p className="text-xs text-on-surface-variant mt-0.5">
          {t('Phân tích clickstream thương mại điện tử — xử lý hoàn toàn ngay trên trình duyệt.', 'E-commerce clickstream analytics calculated client-side in your browser.')}
        </p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={t('Tổng Doanh thu','Total Revenue')}
          value={formatCurrency(data.total_revenue)}
          icon={<DollarSign className="w-5 h-5 text-primary" />}
          change="+12.4%"
          isPositive={true}
          colorClass="text-primary bg-primary/10"
          sparklinePoints={[80, 85, 92, 90, 95, 102, 110]}
        />
        <KpiCard
          label={t('Tổng Khách hàng','Total Customers')}
          value={formatNumber(data.total_users)}
          icon={<Users className="w-5 h-5 text-primary" />}
          change="+8.3%"
          isPositive={true}
          colorClass="text-primary bg-primary/10"
          sparklinePoints={[45, 48, 52, 50, 56, 58, 62]}
        />
        <KpiCard
          label={t('Tổng Sự kiện','Total Events')}
          value={formatNumber(data.total_events)}
          icon={<Activity className="w-5 h-5 text-primary" />}
          change="+4.1%"
          isPositive={true}
          colorClass="text-primary bg-primary/10"
          sparklinePoints={[20, 22, 21, 24, 23, 26, 28]}
        />
        <KpiCard
          label={t('Tỷ lệ Chuyển đổi','Conversion Rate')}
          value={formatPercent(data.conversion_rate)}
          icon={<TrendingUp className="w-5 h-5 text-primary" />}
          change="+2.9%"
          isPositive={true}
          colorClass="text-primary bg-primary/10"
          sparklinePoints={[12, 14, 13, 15, 16, 15, 18]}
        />
      </div>

      {/* Strategic Analytics Section */}
      <div className="mt-8">
        <h2 className="text-sm font-bold tracking-wider uppercase text-on-surface-variant/80 px-1 mb-4">
          {t('Phân tích Chiến lược', 'Strategic Analyses')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {navCards.map((card) => {
            return (
              <Link 
                key={card.href} 
                href={card.href}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 hover:bg-surface-container-low transition-all duration-200 group flex items-start justify-between shadow-sm cursor-pointer"
              >
                <div className="space-y-2 flex-1 pr-4">
                  <div className="flex items-center gap-2">
                    {card.icon}
                    <span className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">
                      {card.title}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {card.desc}
                  </p>
                  <span className="inline-block text-[10px] font-extrabold tracking-widest text-primary/80 bg-primary/10 px-2 py-0.5 rounded uppercase">
                    {card.tag}
                  </span>
                </div>
                
                <div className="bg-surface-container border border-outline-variant p-2 rounded-lg text-on-surface-variant group-hover:text-primary group-hover:border-primary/20 transition-all">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
