'use client';

import React, { useEffect, useState } from 'react';
import { useDuckDB } from '@/components/providers/DuckDBProvider';
import { ContentCard } from '@/components/cards/ContentCard';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { InsightCallout } from '@/components/ui/InsightCallout';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { TrendingUp, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';

interface BrandData {
  brand: string;
  view_count: number;
  cart_count: number;
  purchase_count: number;
  total_revenue: number;
  avg_price: number;
  conversion_rate: number;
}

type SortField = 'brand' | 'view_count' | 'cart_count' | 'purchase_count' | 'total_revenue' | 'conversion_rate';
type SortOrder = 'asc' | 'desc';

export default function BrandPreferencesPage() {
  const { loading, error, query } = useDuckDB();
  const [brands, setBrands] = useState<BrandData[]>([]);
  const [metric, setMetric] = useState<'total_revenue' | 'purchase_count' | 'avg_price'>('total_revenue');
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  
  // Sort State
  const [sortField, setSortField] = useState<SortField>('total_revenue');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

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
            coalesce(brand, 'unknown') as brand,
            view_count,
            cart_count,
            purchase_count,
            total_revenue,
            avg_price,
            conversion_rate
          FROM brand_preferences
          WHERE brand IS NOT NULL AND brand != 'unknown'
          ORDER BY total_revenue DESC
        `;
        const result = await query(sql);
        setBrands(result);
        setQueryError(null);
      } catch (err: any) {
        console.error('Error querying brand preferences:', err);
        setQueryError(err.message || 'Failed to fetch brand metrics.');
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
          message={error || queryError || 'Failed to query brand market preferences.'} 
          className="max-w-md"
        />
      </div>
    );
  }

  if (loading || !isClient || brands.length === 0) {
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

  // 1. Chart Data Extraction (Top 10 brands)
  // Re-sort based on current metric choice
  const top10Brands = [...brands]
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, 10);

  // 2. Tabular Sort Logic
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedBrands = [...brands].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortOrder === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40 ml-1.5" />;
    return sortOrder === 'asc' 
      ? <ChevronUp className="w-3.5 h-3.5 text-primary ml-1.5" /> 
      : <ChevronDown className="w-3.5 h-3.5 text-primary ml-1.5" />;
  };

  // Highlighting Colors: Apple = green, Samsung = blue, Xiaomi = gold/amber, Others = muted
  const getBrandColor = (brand: string) => {
    const cleanBrand = brand.toLowerCase().trim();
    if (cleanBrand === 'apple') return '#2D6A4F';       // Forest Green
    if (cleanBrand === 'samsung') return '#4A90D9';     // Sleek Blue
    if (cleanBrand === 'xiaomi') return '#E0A96D';      // Amber Gold
    return '#DFDFD9';                                   // Muted Gray-Green
  };

  const getMetricLabel = () => {
    if (metric === 'total_revenue') return 'Total Revenue';
    if (metric === 'purchase_count') return 'Units Sold';
    return 'Avg Order Value';
  };

  const formatMetricValue = (val: number) => {
    if (metric === 'total_revenue' || metric === 'avg_price') return formatCurrency(val);
    return formatNumber(val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-on-surface">
            Brand Market Preferences
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Compare brand revenues, sales volumes, average order sizes, and customer checkout conversion metrics.
          </p>
        </div>

        {/* Metric Toggles */}
        <div className="flex bg-surface-container-low border border-outline-variant p-0.5 rounded-full self-start">
          <button
            onClick={() => setMetric('total_revenue')}
            className={`px-4 py-1 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 uppercase ${
              metric === 'total_revenue'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Revenue
          </button>
          <button
            onClick={() => setMetric('purchase_count')}
            className={`px-4 py-1 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 uppercase ${
              metric === 'purchase_count'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Units Sold
          </button>
          <button
            onClick={() => setMetric('avg_price')}
            className={`px-4 py-1 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 uppercase ${
              metric === 'avg_price'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            Avg Price
          </button>
        </div>
      </div>

      {/* Grouped Bar Chart of Top 10 Brands */}
      <ContentCard
        title={`Top 10 Market Leaders by ${getMetricLabel()}`}
        subtitle="Highlighted comparison model for major consumer tech brands (Apple, Samsung, Xiaomi)"
      >
        <div className="h-[320px] w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top10Brands} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(73, 69, 79, 0.05)" />
              <XAxis 
                dataKey="brand" 
                tickLine={false} 
                axisLine={false}
                tick={{ fontSize: 10, fill: '#49454F', fontWeight: 'bold' }}
                dy={8}
              />
              <YAxis 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(tick) => formatMetricValue(tick)}
                tick={{ fontSize: 10, fill: '#49454F' }}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as BrandData;
                    return (
                      <div className="bg-foreground text-background p-4 rounded-xl border border-outline-variant text-xs shadow-md space-y-2">
                        <p className="font-bold border-b border-outline-variant/20 pb-1 mb-1 uppercase tracking-wide">{data.brand}</p>
                        <div className="space-y-1">
                          <p className="flex justify-between gap-6">
                            <span className="text-on-surface-variant/80">Total Revenue:</span>
                            <span className="font-semibold text-primary">{formatCurrency(data.total_revenue)}</span>
                          </p>
                          <p className="flex justify-between gap-6">
                            <span className="text-on-surface-variant/80">Units Sold:</span>
                            <span className="font-semibold text-tertiary">{formatNumber(data.purchase_count)}</span>
                          </p>
                          <p className="flex justify-between gap-6">
                            <span className="text-on-surface-variant/80">Avg Price:</span>
                            <span className="font-semibold">{formatCurrency(data.avg_price)}</span>
                          </p>
                          <p className="flex justify-between gap-6">
                            <span className="text-on-surface-variant/80">Conversion:</span>
                            <span className="font-semibold text-success">{formatPercent(data.conversion_rate)}</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey={metric}
                radius={[4, 4, 0, 0]}
              >
                {top10Brands.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getBrandColor(entry.brand)} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend Indicator */}
        <div className="mt-4 flex flex-wrap gap-4 items-center justify-center text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#2D6A4F]"></span>
            <span>Apple</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#4A90D9]"></span>
            <span>Samsung</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#E0A96D]"></span>
            <span>Xiaomi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#DFDFD9]"></span>
            <span>Other Brands</span>
          </div>
        </div>
        {/* Dynamic insight based on selected metric */}
        {(() => {
          const topBrand = top10Brands[0];
          if (!topBrand) return null;
          const appleData = brands.find(b => b.brand.toLowerCase() === 'apple');
          const samsungData = brands.find(b => b.brand.toLowerCase() === 'samsung');
          if (metric === 'avg_price') {
            const bigThreeInTop10 = top10Brands.filter(b =>
              ['apple','samsung','xiaomi'].includes(b.brand.toLowerCase())
            ).length;
            return (
              <InsightCallout insights={[
                {
                  type: 'insight' as const,
                  title: `${topBrand.brand} leads average order value at ${formatCurrency(topBrand.avg_price)} — but is NOT a consumer tech giant`,
                  body: `When sorted by Avg Price, niche premium brands (professional audio, luxury watches, German appliances) outrank Apple/Samsung/Xiaomi. Consumer tech brands sell across all price tiers, diluting their average. ${bigThreeInTop10 === 0 ? 'None of the Big 3 appear in top 10 avg price — they compete on volume, not AOV.' : `Only ${bigThreeInTop10} of the Big 3 appear here.`} Strategy: negotiate higher shelf placement fees with premium niche brands as they drive higher AOV and margin.`
                },
                {
                  type: 'strategy' as const,
                  title: 'Strategy: Create a “Premium Picks” curated category',
                  body: 'Bundle these high-AOV brands into a "Premium" or "Professional Grade" storefront section. Customers spending $1,800+ per order are high-LTV segments — invest in white-glove onboarding and extended warranty upsells to maximize revenue per user.'
                }
              ]} />
            );
          }
          if (metric === 'total_revenue') {
            const appleRank = brands.findIndex(b => b.brand.toLowerCase() === 'apple') + 1;
            return (
              <InsightCallout insights={[
                {
                  type: 'insight' as const,
                  title: `${topBrand.brand} is the top revenue contributor${appleData && appleRank > 0 ? ` — Apple ranks #${appleRank} overall` : ''}`,
                  body: `Revenue concentration risk: if the top 3 brands account for >50% of total revenue, the business is over-reliant on few supplier relationships. Validate gross margin per brand — high-revenue brands may have lower margins due to negotiated bulk discounts.`
                },
                {
                  type: 'strategy' as const,
                  title: 'Strategy: Cross-reference conversion rate vs revenue rank',
                  body: 'Switch to the table below and sort by Conversion %. Brands that convert well but rank low in revenue are under-marketed — increase their Product Detail Page traffic via sponsored placement or homepage feature slots.'
                }
              ]} />
            );
          }
          return (
            <InsightCallout insights={[
              {
                type: 'insight' as const,
                title: `${topBrand.brand} dominates unit volume — compare with Revenue view to spot margin gaps`,
                body: `High unit count with low revenue rank signals lower-priced items or discount-driven sales. ${samsungData && appleData ? 'Samsung typically outsells Apple on unit count (accessories, mid-range devices) while Apple drives higher revenue per transaction.' : 'Switch to Revenue view to compare AOV gaps across the top sellers.'}`
              }
            ]} />
          );
        })()}
      </ContentCard>

      {/* Sortable Brand Conversion Grid Table */}
      <ContentCard
        title="Brand Conversion Metrics Table"
        subtitle="Complete performance breakdown across every registered brand (Click columns to sort)"
      >
        <div className="w-full mt-2 overflow-hidden border border-outline-variant rounded-xl bg-surface-container-lowest">
          
          {/* Table Header (CSS Grid) */}
          <div className="grid grid-cols-6 gap-4 px-6 py-3 border-b border-outline-variant bg-surface-container-low text-[11px] font-bold uppercase tracking-wider text-on-surface-variant select-none">
            <div className="col-span-1 flex items-center cursor-pointer" onClick={() => handleSort('brand')}>
              Brand {getSortIcon('brand')}
            </div>
            <div className="col-span-1 flex items-center justify-end cursor-pointer" onClick={() => handleSort('view_count')}>
              Views {getSortIcon('view_count')}
            </div>
            <div className="col-span-1 flex items-center justify-end cursor-pointer" onClick={() => handleSort('cart_count')}>
              Carts {getSortIcon('cart_count')}
            </div>
            <div className="col-span-1 flex items-center justify-end cursor-pointer" onClick={() => handleSort('purchase_count')}>
              Purchases {getSortIcon('purchase_count')}
            </div>
            <div className="col-span-1 flex items-center justify-end cursor-pointer" onClick={() => handleSort('total_revenue')}>
              Revenue {getSortIcon('total_revenue')}
            </div>
            <div className="col-span-1 flex items-center justify-end cursor-pointer" onClick={() => handleSort('conversion_rate')}>
              Conversion % {getSortIcon('conversion_rate')}
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-outline-variant/30 max-h-[350px] overflow-y-auto">
            {sortedBrands.map((brand) => (
              <div 
                key={brand.brand}
                className="grid grid-cols-6 gap-4 px-6 py-3 text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors items-center"
              >
                <div className="col-span-1 font-bold text-on-surface uppercase tracking-wide flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getBrandColor(brand.brand) }}></span>
                  {brand.brand}
                </div>
                <div className="col-span-1 text-end text-on-surface-variant">
                  {formatNumber(brand.view_count)}
                </div>
                <div className="col-span-1 text-end text-on-surface-variant">
                  {formatNumber(brand.cart_count)}
                </div>
                <div className="col-span-1 text-end text-on-surface-variant">
                  {formatNumber(brand.purchase_count)}
                </div>
                <div className="col-span-1 text-end font-extrabold text-primary">
                  {formatCurrency(brand.total_revenue)}
                </div>
                <div className="col-span-1 text-end text-success font-extrabold flex items-center justify-end gap-1">
                  <TrendingUp className="w-3 h-3 text-success" />
                  {formatPercent(brand.conversion_rate)}
                </div>
              </div>
            ))}
          </div>

        </div>
      </ContentCard>
    </div>
  );
}
