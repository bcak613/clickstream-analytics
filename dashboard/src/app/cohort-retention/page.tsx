'use client';

import React, { useEffect, useState } from 'react';
import { useDuckDB } from '@/components/providers/DuckDBProvider';
import { useLang } from '@/components/providers/LangProvider';
import { ContentCard } from '@/components/cards/ContentCard';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Users, TrendingDown, Clock, Activity } from 'lucide-react';

interface CohortData {
  cohort_week: string;
  cohort_size: number;
  weeks_since_acquisition: number;
  retained_users: number;
  retention_rate: number;
}

interface DecayData {
  weeks_since_acquisition: number;
  avg_retention_rate: number;
  total_retained: number;
  total_size: number;
}

export default function CohortRetentionPage() {
  const { loading, error, query } = useDuckDB();
  const { t } = useLang();
  const [cohorts, setCohorts] = useState<CohortData[]>([]);
  const [decayCurve, setDecayCurve] = useState<DecayData[]>([]);
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
        // 1. Fetch cohort retention detailed data
        const cohortSql = `
          SELECT 
            strftime(cohort_week, '%Y-%m-%d') as cohort_week,
            cohort_size,
            weeks_since_acquisition,
            retained_users,
            retention_rate
          FROM cohort_retention
          ORDER BY cohort_week, weeks_since_acquisition
        `;
        const cohortResult = await query(cohortSql);
        setCohorts(cohortResult);

        // 2. Fetch decay curve aggregate average retention rate
        const decaySql = `
          SELECT 
            weeks_since_acquisition,
            SUM(retained_users)::DOUBLE / SUM(cohort_size) as avg_retention_rate,
            SUM(retained_users) as total_retained,
            SUM(cohort_size) as total_size
          FROM cohort_retention
          GROUP BY weeks_since_acquisition
          ORDER BY weeks_since_acquisition
        `;
        const decayResult = await query(decaySql);
        setDecayCurve(decayResult);

        setQueryError(null);
      } catch (err: any) {
        console.error('Error fetching cohort retention metrics:', err);
        setQueryError(err.message || 'Failed to fetch cohort analysis.');
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
          message={error || queryError || 'Failed to query cohort retention analysis.'} 
          className="max-w-md"
        />
      </div>
    );
  }

  if (loading || !isClient || cohorts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-surface-container rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 gap-6">
          <SkeletonCard height="h-[360px]" />
          <SkeletonCard height="h-[300px]" />
        </div>
      </div>
    );
  }

  // Format Helpers
  const formatPercent = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(val);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('en-US').format(val);
  };

  const formatDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Group cohorts data for matrix drawing
  // Get all unique cohort weeks
  const uniqueCohorts = Array.from(new Set(cohorts.map(c => c.cohort_week))).sort();
  // Get all unique weeks since acquisition (usually 0 to 4+)
  const uniqueWeeks = Array.from(new Set(cohorts.map(c => c.weeks_since_acquisition))).sort((a,b)=>a-b);

  // Helper to find specific record in cohorts list
  const getCohortCell = (cohortWeek: string, weekIndex: number): CohortData | undefined => {
    return cohorts.find(c => c.cohort_week === cohortWeek && c.weeks_since_acquisition === weekIndex);
  };

  // Get color for cohort matrix cells based on retention rate percentage
  // Monochromatic green scale: #F5F5F0 (0%) to #2D6A4F (100%)
  const getHeatmapColor = (rate: number) => {
    if (rate === 0) return '#F5F5F0';
    if (rate <= 0.05) return '#D1E7DD';
    if (rate <= 0.10) return '#A3D5C0';
    if (rate <= 0.20) return '#6DC5A3';
    if (rate <= 0.35) return '#40B080';
    return '#2D6A4F';
  };

  // Get text color based on background (contrast rules)
  const getHeatmapTextColor = (rate: number) => {
    return rate > 0.20 ? '#FFFFFF' : '#1C1B1A';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-on-surface">
          {t('Phân tích Nhóm Khách hàng theo Tuần (Weekly Cohort)', 'Weekly Cohort Retention Analysis')}
        </h1>
        <p className="text-xs text-on-surface-variant mt-0.5">
          {t('Theo dõi nhóm khách hàng qua từng tuần, đo lường mức độ rời bỏ và xu hướng suy giảm gắn bó trung bình.', 'Track acquisition cohorts over week boundaries, analyzing user churn levels and average consumer decay trends.')}
        </p>
      </div>

      {/* Cohort Heatmap Heatmap (CSS Grid) */}
      <ContentCard
        title={t('Ma trận Nhiệt độ Nhóm Khách hàng', 'Acquisition Cohorts Matrix Heatmap')}
        subtitle={t('Tỷ lệ giữ chân tuyệt đối theo từng tuần, phân theo mốc mua hàng đầu tiên', 'Week-over-week absolute customer retention rates mapped to acquisition boundaries')}
      >
        <div className="w-full overflow-x-auto mt-2 pb-2">
          <div className="min-w-[700px] flex flex-col border border-outline-variant rounded-xl overflow-hidden bg-surface-container-lowest">
            
            {/* Heatmap Column Headers */}
            <div className="grid grid-cols-8 gap-1 px-4 py-3 bg-surface-container-low border-b border-outline-variant text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant text-center items-center">
              <div className="col-span-2 text-start font-bold text-xs pl-2 text-on-surface select-none">
                {t('Tuần mua hàng đầu tiên (Cohort)', 'Cohort Acquisition Week')}
              </div>
              <div className="col-span-1 text-center select-none pl-1">{t('Quy mô', 'Size')}</div>
              {uniqueWeeks.map(week => (
                <div key={week} className="col-span-1 select-none font-bold">
                  {t('Tuần', 'Week')} {week}
                </div>
              ))}
            </div>

            {/* Heatmap Rows */}
            <div className="divide-y divide-outline-variant/20 p-2 space-y-1">
              {uniqueCohorts.map(cohortWeek => {
                // Find sizes from any first week or default
                const cell0 = getCohortCell(cohortWeek, 0);
                const cohortSize = cell0 ? cell0.cohort_size : 0;

                return (
                  <div 
                    key={cohortWeek}
                    className="grid grid-cols-8 gap-1 py-1 px-2 items-center text-center text-xs font-semibold"
                  >
                    {/* Cohort Identification Column */}
                    <div className="col-span-2 text-start text-xs font-bold text-on-surface pl-2 uppercase tracking-wide">
                      {formatDate(cohortWeek)}
                    </div>

                    {/* Cohort Absolute Size Column */}
                    <div className="col-span-1 font-extrabold text-on-surface-variant/80">
                      {formatNumber(cohortSize)}
                    </div>

                    {/* Weeks Cells */}
                    {uniqueWeeks.map(weekIndex => {
                      const cell = getCohortCell(cohortWeek, weekIndex);
                      if (!cell) {
                        return (
                          <div 
                            key={`${cohortWeek}-${weekIndex}`}
                            className="col-span-1 h-9 rounded-md bg-surface-container-lowest border border-outline-variant/10 text-[10px] text-on-surface-variant/30 flex items-center justify-center font-normal"
                          >
                            -
                          </div>
                        );
                      }

                      const cellColor = getHeatmapColor(cell.retention_rate);
                      const textColor = getHeatmapTextColor(cell.retention_rate);

                      return (
                        <div 
                          key={`${cohortWeek}-${weekIndex}`}
                          style={{ backgroundColor: cellColor, color: textColor }}
                          className="col-span-1 h-9 rounded-md flex flex-col items-center justify-center font-extrabold text-xs shadow-sm hover:scale-[1.02] active:scale-95 transition-all duration-150 relative group cursor-pointer border border-outline-variant/10"
                        >
                          <span>{formatPercent(cell.retention_rate)}</span>
                          
                          {/* Tooltip Overlay */}
                          <div className="absolute z-20 hidden group-hover:block bottom-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[11px] p-3 rounded-lg border border-outline-variant whitespace-nowrap shadow-md space-y-1 text-start">
                            <p className="font-extrabold border-b border-outline-variant/20 pb-0.5 uppercase tracking-wide">
                              Cohort {formatDate(cohortWeek)}
                            </p>
                            <p className="flex justify-between gap-4 font-semibold text-on-surface-variant">
                              Interval: <span>Week {weekIndex}</span>
                            </p>
                            <p className="flex justify-between gap-4 font-semibold text-on-surface-variant">
                              Retained: <span className="text-primary font-bold">{formatNumber(cell.retained_users)} users</span>
                            </p>
                            <p className="flex justify-between gap-4 font-semibold text-on-surface-variant">
                              Retention: <span className="text-success font-extrabold">{formatPercent(cell.retention_rate)}</span>
                            </p>
                          </div>
                        </div>
                      );
                    })}

                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </ContentCard>

      {/* Cohort Decay Curve Line Chart */}
      <ContentCard
        title={t('Đường Cong Suy giảm Nhóm (Aggregate Decay Curve)', 'Aggregate Cohort Retention Decay Curve')}
        subtitle={t('Tỷ lệ giữ chân trung bình giảm dần qua các tuần — tính trên toàn bộ nhóm khách hàng', 'Average cumulative retention drop-off computed dynamically over the 5-week acquisition cycle')}
      >
        <div className="h-[280px] w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={decayCurve} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(73, 69, 79, 0.05)" />
              <XAxis 
                dataKey="weeks_since_acquisition" 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(tick) => `Week ${tick}`}
                tick={{ fontSize: 10, fill: '#49454F', fontWeight: 'bold' }}
                dy={8}
              />
              <YAxis 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(tick) => formatPercent(tick)}
                tick={{ fontSize: 10, fill: '#49454F' }}
                domain={[0, 1.1]}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as DecayData;
                    return (
                      <div className="bg-foreground text-background p-4 rounded-xl border border-outline-variant text-xs shadow-md space-y-2">
                        <p className="font-bold border-b border-outline-variant/20 pb-1 mb-1">Interval: Week {data.weeks_since_acquisition}</p>
                        <div className="space-y-1">
                          <p className="flex justify-between gap-6">
                            <span className="text-on-surface-variant/80">Avg Retention:</span>
                            <span className="font-semibold text-success">{formatPercent(data.avg_retention_rate)}</span>
                          </p>
                          <p className="flex justify-between gap-6">
                            <span className="text-on-surface-variant/80">Retained Customers:</span>
                            <span className="font-semibold text-primary">{formatNumber(data.total_retained)}</span>
                          </p>
                          <p className="flex justify-between gap-6">
                            <span className="text-on-surface-variant/80">Initial Cohort Size:</span>
                            <span className="font-semibold text-tertiary">{formatNumber(data.total_size)}</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="avg_retention_rate" 
                stroke="#2D6A4F" 
                strokeWidth={3}
                dot={{ stroke: '#2D6A4F', strokeWidth: 2, r: 4, fill: '#FAFAF5' }}
                activeDot={{ r: 6, strokeWidth: 0, fill: '#2D6A4F' }}
                name="Retention Decay Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Decay Callout Box */}
        <div className="mt-4 flex items-center justify-between border-t border-outline-variant/30 pt-3 text-[11px] font-bold text-on-surface-variant uppercase">
          <span className="flex items-center gap-1">
            <TrendingDown className="w-4 h-4 text-error" /> {t('Tỷ lệ rời bỏ (Churn Rate) trung bình — Tuần 0 sang Tuần 1:', 'Average Churn Rate (Week 0 to Week 1):')}
          </span>
          {decayCurve.length > 1 && (
            <span className="text-error text-xs font-extrabold">
              -{formatPercent(1 - decayCurve[1].avg_retention_rate)} {t('Rời bỏ', 'Churn')}
            </span>
          )}
        </div>
      </ContentCard>
    </div>
  );
}
