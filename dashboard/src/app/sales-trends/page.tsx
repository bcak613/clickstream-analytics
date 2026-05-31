'use client';

import React, { useEffect, useState } from 'react';
import { useDuckDB } from '@/components/providers/DuckDBProvider';
import { useLang } from '@/components/providers/LangProvider';
import { ContentCard } from '@/components/cards/ContentCard';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { InsightCallout } from '@/components/ui/InsightCallout';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { TrendingUp, Clock } from 'lucide-react';

interface DailySalesData {
  event_date: string;
  view_count: number;
  cart_count: number;
  purchase_count: number;
  daily_revenue: number;
  cumulative_revenue: number;
  conversion_rate: number;
}

interface LagData {
  lag_bucket: string;
  lag_count: number;
  mean_lag: number;
  median_lag: number;
}

export default function SalesTrendsPage() {
  const { loading, error, query } = useDuckDB();
  const { t } = useLang();
  
  // States for query results
  const [dailySales, setDailySales] = useState<DailySalesData[]>([]);
  const [lags, setLags] = useState<LagData[]>([]);
  const [funnelData, setFunnelData] = useState<{ views: number; carts: number; purchases: number } | null>(null);
  
  const [timeResolution, setTimeResolution] = useState<'daily' | 'weekly'>('daily');
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
        // 1. Fetch sales trends data
        let salesQuery = '';
        if (timeResolution === 'daily') {
          salesQuery = `
            SELECT 
              strftime(event_date, '%Y-%m-%d') as event_date,
              view_count,
              cart_count,
              purchase_count,
              daily_revenue,
              cumulative_revenue,
              conversion_rate
            FROM sales_trends 
            WHERE metric_type = 'daily_sales' 
            ORDER BY event_date
          `;
        } else {
          salesQuery = `
            SELECT 
              strftime(date_trunc('week', event_date), '%Y-%m-%d') as event_date,
              SUM(view_count) as view_count,
              SUM(cart_count) as cart_count,
              SUM(purchase_count) as purchase_count,
              SUM(daily_revenue) as daily_revenue,
              MAX(cumulative_revenue) as cumulative_revenue,
              (SUM(purchase_count)::DOUBLE / NULLIF(SUM(view_count), 0)) as conversion_rate
            FROM sales_trends 
            WHERE metric_type = 'daily_sales' 
            GROUP BY 1 
            ORDER BY 1
          `;
        }

        const salesResult = await query(salesQuery);
        setDailySales(salesResult);

        // 2. Fetch lag distribution
        const lagQuery = `
          SELECT 
            lag_bucket,
            lag_count,
            mean_lag,
            median_lag
          FROM sales_trends 
          WHERE metric_type = 'lag_distribution'
          ORDER BY 
            CASE lag_bucket
              WHEN '0-5m' THEN 1
              WHEN '5-15m' THEN 2
              WHEN '15-30m' THEN 3
              WHEN '30m-1h' THEN 4
              WHEN '1h+' THEN 5
              ELSE 6
            END
        `;
        const lagResult = await query(lagQuery);
        setLags(lagResult);

        // 3. Fetch aggregated funnel metrics
        const funnelQuery = `
          SELECT 
            SUM(view_count) as views,
            SUM(cart_count) as carts,
            SUM(purchase_count) as purchases
          FROM sales_trends
          WHERE metric_type = 'daily_sales'
        `;
        const funnelResult = await query(funnelQuery);
        if (funnelResult && funnelResult.length > 0) {
          setFunnelData({
            views: funnelResult[0].views || 0,
            carts: funnelResult[0].carts || 0,
            purchases: funnelResult[0].purchases || 0
          });
        }

        setQueryError(null);
      } catch (err: any) {
        console.error('Error fetching sales trends data:', err);
        setQueryError(err.message || 'Failed to query database.');
      } finally {
        setIsQuerying(false);
      }
    };

    fetchData();
  }, [loading, error, query, timeResolution]);

  if (error || queryError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <ErrorCard 
          message={error || queryError || 'Failed to query transactional metrics.'} 
          className="max-w-md"
        />
      </div>
    );
  }

  if (loading || !isClient || (dailySales.length === 0 && isQuerying)) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-surface-container rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 gap-6">
          <SkeletonCard height="h-[380px]" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonCard height="h-[300px]" />
            <SkeletonCard height="h-[300px]" />
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

  const formatPercent = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  // Funnel conversions calculation
  const totalViews = funnelData?.views || 1;
  const totalCarts = funnelData?.carts || 0;
  const totalPurchases = funnelData?.purchases || 0;

  const cartDropoff = totalViews > 0 ? (totalViews - totalCarts) / totalViews : 0;
  const purchaseDropoff = totalCarts > 0 ? (totalCarts - totalPurchases) / totalCarts : 0;
  const overallConversion = totalViews > 0 ? totalPurchases / totalViews : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-on-surface">
            {t('Xu hướng Doanh thu & Phân tích Mô hình Mua hàng', 'Sales & Ingestion Analytics')}
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {t('Phân phối doanh thu theo thời gian, mức độ rơi chạn phễu chuyển đổi và phân tích độ trễ duyệt web.', 'Temporal sales revenue distribution, transaction conversion drop-offs, and browsing latency analysis.')}
          </p>
        </div>

        {/* Filter Pills for Resolution */}
        <div className="flex bg-surface-container-low border border-outline-variant p-0.5 rounded-full self-start">
          <button
            onClick={() => setTimeResolution('daily')}
            className={`px-4 py-1 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 uppercase ${
              timeResolution === 'daily'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
                      {t('Hằng ngày', 'Daily')}
          </button>
          <button
            onClick={() => setTimeResolution('weekly')}
            className={`px-4 py-1 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 uppercase ${
              timeResolution === 'weekly'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {t('Hằng tuần', 'Weekly')}
          </button>
        </div>
      </div>

      {/* Main Revenue Area Chart */}
      <ContentCard 
        title="Revenue & Order Frequency Over Time" 
        subtitle={`Continuous monitoring of absolute transactions and transactional value (${timeResolution === 'daily' ? 'Daily' : 'Weekly'} basis)`}
        className="w-full"
      >
        <div className={`h-[350px] w-full mt-2 transition-opacity duration-150 ${isQuerying ? 'opacity-50' : 'opacity-100'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailySales} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(73, 69, 79, 0.05)" />
              <XAxis 
                dataKey="event_date" 
                tickLine={false} 
                axisLine={false}
                tick={{ fontSize: 10, fill: '#49454F' }}
                dy={10}
              />
              <YAxis 
                yAxisId="left"
                tickLine={false} 
                axisLine={false}
                tickFormatter={(tick) => formatCurrency(tick)}
                tick={{ fontSize: 10, fill: '#2D6A4F' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tickLine={false} 
                axisLine={false}
                tickFormatter={(tick) => formatNumber(tick)}
                tick={{ fontSize: 10, fill: '#4A90D9' }}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as DailySalesData;
                    return (
                      <div className="bg-foreground text-background p-4 rounded-xl border border-outline-variant text-xs shadow-md space-y-2">
                        <p className="font-bold border-b border-outline-variant/20 pb-1 mb-1">{data.event_date}</p>
                        <div className="space-y-1">
                          <p className="flex justify-between gap-6">
                            <span className="text-on-surface-variant/80">Revenue:</span>
                            <span className="font-semibold text-primary">{formatCurrency(data.daily_revenue)}</span>
                          </p>
                          <p className="flex justify-between gap-6">
                            <span className="text-on-surface-variant/80">Purchases:</span>
                            <span className="font-semibold text-tertiary">{formatNumber(data.purchase_count)}</span>
                          </p>
                          <p className="flex justify-between gap-6">
                            <span className="text-on-surface-variant/80">Conversions:</span>
                            <span className="font-semibold">{formatPercent(data.conversion_rate)}</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="daily_revenue" 
                stroke="#2D6A4F" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
                name="Revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {(() => {
          if (dailySales.length === 0) return null;
          // Detect spike: any day with revenue > 3x the median
          const revenues = dailySales.map(d => d.daily_revenue).filter(r => r > 0);
          const sorted = [...revenues].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)] || 1;
          const maxRevDay = dailySales.reduce((a, b) => b.daily_revenue > a.daily_revenue ? b : a, dailySales[0]);
          const spikeRatio = maxRevDay.daily_revenue / median;
          const insights = [];
          if (spikeRatio > 3) {
            insights.push({
              type: 'warning' as const,
              title: `Revenue spike detected on ${maxRevDay.event_date} — ${spikeRatio.toFixed(1)}x above median`,
              body: `This ${spikeRatio.toFixed(0)}x spike is consistent with a major promotional event (e.g. 11.11 Singles Day, flash sale). Validate that the SCD Type 2 price join is not inflating purchase values during this window — then leverage this as a benchmark for planning future campaign budgets.`
            });
          }
          const avgConv = dailySales.reduce((acc, d) => acc + (d.conversion_rate || 0), 0) / dailySales.length;
          insights.push({
            type: 'insight' as const,
            title: `Average daily conversion rate: ${(avgConv * 100).toFixed(2)}% over the period`,
            body: `E-commerce industry benchmark is 1–3%. ${avgConv >= 0.01 ? 'You are within or above the benchmark — focus on increasing AOV rather than volume.' : 'Below benchmark — prioritize friction removal in the checkout funnel and A/B test product page CTAs.'}`
          });
          return <InsightCallout insights={insights} />;
        })()}
      </ContentCard>

      {/* Funnel and Lag Distribution Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Horizontal Conversion Funnel Card */}
        <ContentCard 
          title="Checkout Event Funnel" 
          subtitle="Complete tracking of user transition volume and drop-off ratios"
        >
          <div className="flex flex-col justify-center h-[260px] py-4 space-y-5">
            {/* Views Row */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-on-surface flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary/20 border border-primary"></span>
                  Product Views
                </span>
                <span className="text-on-surface-variant">{formatNumber(totalViews)}</span>
              </div>
              <div className="w-full bg-surface-container-low h-5 rounded-full overflow-hidden border border-outline-variant">
                <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: '100%' }}></div>
              </div>
            </div>

            {/* Cart Adds Row */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-on-surface flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-tertiary/20 border border-tertiary"></span>
                  Cart Additions
                </span>
                <span className="text-on-surface-variant flex items-center gap-2">
                  {formatNumber(totalCarts)}
                  <span className="text-[10px] bg-error-container text-error px-2 py-0.5 rounded-full font-bold">
                    -{formatPercent(cartDropoff)} Drop
                  </span>
                </span>
              </div>
              <div className="w-full bg-surface-container-low h-5 rounded-full overflow-hidden border border-outline-variant">
                <div 
                  className="bg-tertiary h-full rounded-full transition-all duration-500" 
                  style={{ width: `${(totalCarts / totalViews) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Purchases Row */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-on-surface flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E8A317]/20 border border-[#E8A317]"></span>
                  Purchases Completed
                </span>
                <span className="text-on-surface-variant flex items-center gap-2">
                  {formatNumber(totalPurchases)}
                  <span className="text-[10px] bg-error-container text-error px-2 py-0.5 rounded-full font-bold">
                    -{formatPercent(purchaseDropoff)} Drop
                  </span>
                </span>
              </div>
              <div className="w-full bg-surface-container-low h-5 rounded-full overflow-hidden border border-outline-variant">
                <div 
                  className="bg-[#E8A317] h-full rounded-full transition-all duration-500" 
                  style={{ width: `${(totalPurchases / totalViews) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Overall Conversion Indicator */}
            <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-variant/80 uppercase">Overall Ingestion-to-Purchase Conversion</span>
              <span className="text-sm font-extrabold text-primary flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {formatPercent(overallConversion)}
              </span>
            </div>
          </div>
          <InsightCallout insights={[
            {
              type: purchaseDropoff > 0.80 ? 'warning' : 'insight',
              title: `Cart-to-purchase drop-off is ${formatPercent(purchaseDropoff)} — ${purchaseDropoff > 0.80 ? 'critically high' : 'within normal range'}`,
              body: purchaseDropoff > 0.80
                ? 'Over 80% of users abandon cart before completing payment. Immediate actions: (1) Add persistent cart reminders via email/push, (2) Review payment gateway friction and add local payment methods, (3) Show trust signals (reviews, return policy) at checkout.'
                : 'Cart abandonment is within acceptable range. Focus on growing top-of-funnel traffic and repeat purchase rates through loyalty programs.'
            },
            {
              type: 'strategy',
              title: 'Strategy: Retarget cart abandoners within 1-hour window',
              body: `${formatPercent(cartDropoff)} of visitors who add to cart never checkout. Implement automated abandoned cart recovery emails at 1h, 24h, and 72h post-abandonment with a time-limited 5–10% discount. Industry average recovery rate: 5–15% of abandoned carts.`
            }
          ]} />
        </ContentCard>

        {/* Lag Distribution Card */}
        <ContentCard 
          title="Browsing-to-Purchase Latency" 
          subtitle="Duration interval from first view to absolute transaction (same session)"
        >
          <div className="h-[230px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lags} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(73, 69, 79, 0.05)" />
                <XAxis 
                  dataKey="lag_bucket" 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#49454F' }}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(tick) => formatNumber(tick)}
                  tick={{ fontSize: 10, fill: '#49454F' }}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as LagData;
                      return (
                        <div className="bg-foreground text-background p-4 rounded-xl border border-outline-variant text-xs shadow-md space-y-2">
                          <p className="font-bold border-b border-outline-variant/20 pb-1 mb-1">Bucket: {data.lag_bucket}</p>
                          <div className="space-y-1">
                            <p className="flex justify-between gap-6">
                              <span className="text-on-surface-variant/80">Purchases:</span>
                              <span className="font-semibold text-primary">{formatNumber(data.lag_count)}</span>
                            </p>
                            <p className="flex justify-between gap-6">
                              <span className="text-on-surface-variant/80">Mean Latency:</span>
                              <span className="font-semibold">{formatTime(data.mean_lag)}</span>
                            </p>
                            <p className="flex justify-between gap-6">
                              <span className="text-on-surface-variant/80">Median Latency:</span>
                              <span className="font-semibold text-tertiary">{formatTime(data.median_lag)}</span>
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="lag_count" radius={[4, 4, 0, 0]}>
                  {lags.map((entry, index) => {
                    // Set alternating shades for visualization depth
                    const colors = ['#2D6A4F', '#40B080', '#4A90D9', '#E8A317', '#9CA3AF'];
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Metrics Overlay */}
          {lags.length > 0 && (
            <div className="mt-3 flex items-center justify-between border-t border-outline-variant/30 pt-2 text-[11px] font-bold text-on-surface-variant uppercase">
              <span className="flex items-center gap-1 text-on-surface-variant">
                <Clock className="w-4 h-4 text-primary" /> Average session lag:
              </span>
              <span className="text-on-surface text-xs font-extrabold lowercase">
                ~ {formatTime(lags[0].mean_lag)}
              </span>
            </div>
          )}
          {lags.length > 0 && (() => {
            const fastBucket = lags.find(l => l.lag_bucket === '0-5m');
            const slowBucket = lags.find(l => l.lag_bucket === '1h+');
            const fastPct = fastBucket && lags.length > 0 ? fastBucket.lag_count / lags.reduce((s, l) => s + l.lag_count, 0) : 0;
            return (
              <InsightCallout insights={[{
                type: 'strategy',
                title: `${(fastPct * 100).toFixed(0)}% of purchases happen within 5 minutes of first view`,
                body: `Impulse buying is dominant. Ensure product pages load in <2s and checkout is frictionless for mobile. ${slowBucket ? `The ${slowBucket.lag_count.toLocaleString()} customers who take 1h+ are likely price-comparing — target them with a real-time "only X left" urgency indicator.` : ''}`
              }]} />
            );
          })()}
        </ContentCard>

      </div>
    </div>
  );
}
