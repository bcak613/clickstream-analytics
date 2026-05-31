'use client';

import React, { useEffect, useState } from 'react';
import { useDuckDB } from '@/components/providers/DuckDBProvider';
import { useLang } from '@/components/providers/LangProvider';
import { ContentCard } from '@/components/cards/ContentCard';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { BarChart3, Users, Coins, Zap } from 'lucide-react';

interface RFMSegment {
  segment: string;
  user_count: number;
  avg_recency: number;
  avg_frequency: number;
  avg_monetary: number;
  segment_revenue: number;
}

export default function RFMSegmentationPage() {
  const { loading, error, query } = useDuckDB();
  const { t } = useLang();
  const [segments, setSegments] = useState<RFMSegment[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (loading || error) return;

    const fetchData = async () => {
      setIsQuerying(true);
      try {
        const sql = `
          SELECT 
            coalesce(segment, 'Needs Attention') as segment,
            user_count,
            avg_recency,
            avg_frequency,
            avg_monetary,
            segment_revenue
          FROM rfm_segmentation
          ORDER BY user_count DESC
        `;
        const result = await query(sql);
        setSegments(result);
        setQueryError(null);
      } catch (err: any) {
        console.error('Error fetching RFM segments:', err);
        setQueryError(err.message || 'Failed to fetch customer segments.');
      } finally {
        setIsQuerying(false);
      }
    };

    fetchData();
  }, [loading, error, query]);

  if (error || queryError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <ErrorCard 
          message={error || queryError || 'Failed to query RFM customer segmentation.'} 
          className="max-w-md"
        />
      </div>
    );
  }

  if (loading || !isClient || segments.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-surface-container rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 gap-6">
          <SkeletonCard height="h-[360px]" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SkeletonCard height="h-[180px]" />
            <SkeletonCard height="h-[180px]" />
            <SkeletonCard height="h-[180px]" />
          </div>
        </div>
      </div>
    );
  }

  // Format Helpers
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

  // RFM Health Colors mapping
  const getSegmentColor = (segmentName: string) => {
    const name = segmentName.toLowerCase().trim();
    if (name === 'champions') return '#2D6A4F';           // Forest Green
    if (name === 'loyal') return '#40B080';               // Medium Green
    if (name === 'potential loyalist') return '#4A90D9';  // Blue
    if (name === 'new customers') return '#14B8A6';       // Cyan
    if (name === 'promising') return '#8B5CF6';           // Purple
    if (name === 'needs attention') return '#E8A317';     // Yellow Gold
    if (name === 'about to sleep') return '#F97316';      // Orange
    if (name === 'at risk') return '#EA580C';             // Deep Orange
    if (name === 'cant lose them') return '#C62828';      // Dark Red
    if (name === 'hibernating') return '#9CA3AF';         // Light Gray
    if (name === 'lost') return '#6B7280';                // Dark Gray
    return '#EBEBE6';                                     // Default Surface
  };

  // Static marketing recommendations for each of the 11 segments
  const getMarketingRecommendation = (segmentName: string) => {
    const name = segmentName.toLowerCase().trim();
    if (name === 'champions') {
      return "Reward with exclusive VIP early access, personalized perks, and referral programs to drive high-impact brand advocacy.";
    }
    if (name === 'loyal') {
      return "Engage with personalized loyalty tiers, request reviews, and recommend higher-value upgrades to secure retention.";
    }
    if (name === 'potential loyalist') {
      return "Recommend high-converting complementary categories and offer custom product bundles to expand lifetime share-of-wallet.";
    }
    if (name === 'new customers') {
      return "Trigger a structured onboarding email series, explain core values, and offer a welcome reward on their second purchase.";
    }
    if (name === 'promising') {
      return "Highlight user-favorites, popular trending items, and offer limited-duration coupons to build consistent purchase patterns.";
    }
    if (name === 'needs attention') {
      return "Send personalized reactivation offers, limited discount incentives, and survey to identify any friction points.";
    }
    if (name === 'about to sleep') {
      return "Re-engage with targeted high-relevance newsletters, helpful usage tips, and highlight major new product announcements.";
    }
    if (name === 'at risk') {
      return "Deliver aggressive win-back deals, premium vouchers, and conduct immediate surveys to locate service complaints.";
    }
    if (name === 'cant lose them') {
      return "Offer premium dedicated customer service contact, major price discount incentives, and exclusive high-value renewals.";
    }
    if (name === 'hibernating') {
      return "Run seasonal sales promotions, unique collection updates, and low-frequency emails to slowly spark interest.";
    }
    if (name === 'lost') {
      return "Deploy low-cost automated recovery emails; prioritize active marketing budgets on other higher-yield cohorts.";
    }
    return "Establish contact with personalized interest surveys and direct core customer-loyalty team outreach.";
  };

  // Convert DB segments list to Treemap compatible format
  const treemapData = segments.map((item) => ({
    name: item.segment,
    value: item.user_count, // Size of box proportional to customer count
    revenue: item.segment_revenue,
    bg: getSegmentColor(item.segment),
  }));

  // Recharts Treemap custom cell content renderer
  const CustomizedTreemapContent = (props: any) => {
    const { depth, x, y, width, height, name, bg } = props;
    if (depth !== 1) return null;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: bg,
            stroke: '#FAFAF5',
            strokeWidth: 2.5,
          }}
          className="hover:brightness-95 active:brightness-90 transition-all duration-150"
        />
        {width > 80 && height > 35 && (
          <foreignObject x={x + 6} y={y + 6} width={width - 12} height={height - 12}>
            <div className="text-[10px] font-extrabold text-white truncate uppercase tracking-wider select-none">
              {name}
            </div>
          </foreignObject>
        )}
      </g>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-on-surface">
          {t('Phân khúc Hành vi Khách hàng theo Mô hình RFM', 'RFM Behavioral Customer Segmentation')}
        </h1>
        <p className="text-xs text-on-surface-variant mt-0.5">
          {t('Phân loại hành vi mua sắm bằng điểm số RFM (Độ gần đây, Tần suất, Chi tiêu) thành 11 nhóm phân khúc khác nhau.', 'Classify consumer behavior profiles using Recency, Frequency, and Monetary quintile scores into 11 distinct cohorts.')}
        </p>
      </div>

      {/* Interactive Treemap Card */}
      <ContentCard
        title={t('Phân bố số lượng khách hàng theo phân khúc', 'Customer Segment Volume Distribution')}
        subtitle={t('Kích thước ô tỷ lệ thuận với số khách hàng (di chuột để xem chi tiết)', 'Relative customer segment sizes mapped by total volume proportion (Hover to inspect value contribution)')}
      >
        <div className="h-[340px] w-full mt-2 bg-surface-container-low rounded-xl overflow-hidden p-2 border border-outline-variant/30">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treemapData}
              dataKey="value"
              aspectRatio={4 / 3}
              stroke="#FFF"
              content={<CustomizedTreemapContent />}
            >
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-foreground text-background p-4 rounded-xl border border-outline-variant text-xs shadow-md space-y-2">
                        <p className="font-bold border-b border-outline-variant/20 pb-1 mb-1 uppercase tracking-wide">{data.name}</p>
                        <div className="space-y-1">
                          <p className="flex justify-between gap-6">
                            <span className="text-on-surface-variant/80">{t('Số khách hàng:','Segment Volume:')}</span>
                            <span className="font-semibold text-primary">{formatNumber(data.value)} {t('khách','users')}</span>
                          </p>
                          <p className="flex justify-between gap-6">
                            <span className="text-on-surface-variant/80">{t('Doanh thu nhóm:','Segment Revenue:')}</span>
                            <span className="font-semibold text-tertiary">{formatCurrency(data.revenue)}</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </div>
      </ContentCard>

      {/* Detailed Segment Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold tracking-wider uppercase text-on-surface-variant/80 px-1">
          {t('Chi tiết Nhóm & Chiến lược Tiếp thị', 'Behavioral Cohort Descriptions & Actionable Marketing Strategies')}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map((seg) => {
            const color = getSegmentColor(seg.segment);
            return (
              <div 
                key={seg.segment}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden"
              >
                {/* Visual accent left line */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: color }}></div>
                
                {/* Card Title & Volume Badge */}
                <div className="space-y-2 pl-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                      {seg.segment}
                    </span>
                    <span className="text-[10px] font-extrabold text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {formatNumber(seg.user_count)} {t('khách hàng','users')}
                    </span>
                  </div>

                  {/* Description Marketing Strategy Text */}
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {getMarketingRecommendation(seg.segment)}
                  </p>
                </div>

                {/* Score & Revenue Summary Table */}
                <div className="mt-4 pt-3 border-t border-outline-variant/30 grid grid-cols-3 gap-2 pl-2 text-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <div className="space-y-0.5">
                    <span className="block text-on-surface-variant/60 font-semibold">{t('Độ gần đây','Recency')}</span>
                    <span className="block font-extrabold text-on-surface text-xs">{Math.round(seg.avg_recency)}d</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-on-surface-variant/60 font-semibold">{t('Tần suất','Frequency')}</span>
                    <span className="block font-extrabold text-on-surface text-xs">{seg.avg_frequency.toFixed(1)}x</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-on-surface-variant/60 font-semibold">{t('Doanh thu','Revenue')}</span>
                    <span className="block font-extrabold text-primary text-xs truncate">{formatCurrency(seg.segment_revenue)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
