'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useDuckDB } from '@/components/providers/DuckDBProvider';
import { useLang, LangToggle } from '@/components/providers/LangProvider';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { TrendingUp, Users, Tag, BarChart3, ChevronDown, ChevronUp, AlertTriangle, AlertCircle } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DailySales { event_date: string; view_count: number; cart_count: number; purchase_count: number; daily_revenue: number; }
interface CohortRow  { cohort_week: string; weeks_since_acquisition: number; retention_rate: number; retained_users: number; }
interface BrandRow   { brand: string; total_revenue: number; purchase_count: number; avg_price: number; conversion_rate: number; }
interface RfmRow     { segment: string; user_count: number; avg_monetary: number; avg_frequency: number; avg_recency: number; segment_revenue: number; }

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt    = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));
const fmtUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ─── Language toggle ──────────────────────────────────────────────────────────
// (Provided globally via LangProvider — imported above)

// ─── Section accordion ────────────────────────────────────────────────────────
const Section: React.FC<{
  idx: number; icon: React.ReactNode;
  title: string; subtitle: string;
  children: React.ReactNode;
}> = ({ idx, icon, title, subtitle, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-6 py-5 hover:bg-surface-container-low transition-colors text-left"
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-black shrink-0">{idx}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-on-surface leading-tight">{title}</p>
          <p className="text-[11px] font-medium text-on-surface-variant mt-0.5">{subtitle}</p>
        </div>
        <span className="shrink-0 text-primary">{icon}</span>
        <span className="shrink-0 text-on-surface-variant">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>
      {open && <div className="px-6 pb-6 border-t border-outline-variant/40 space-y-4">{children}</div>}
    </div>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────
const Stat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = 'text-primary' }) => (
  <div className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/50">
    <p className="text-[9px] font-bold uppercase text-on-surface-variant tracking-wider">{label}</p>
    <p className={`text-base font-black mt-1 ${color}`}>{value}</p>
  </div>
);

// ─── Insight panel ────────────────────────────────────────────────────────────
const Insight: React.FC<{ title: string; warning?: boolean; children: React.ReactNode }> = ({ title, warning, children }) => (
  <div className={`border rounded-xl p-4 ${warning ? 'bg-amber-50/60 border-amber-200/80' : 'bg-surface-container-low border-outline-variant/50'}`}>
    <div className="flex items-center gap-2 mb-3">
      {warning
        ? <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        : <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
      }
      <p className={`text-[10px] font-extrabold uppercase tracking-widest ${warning ? 'text-amber-700' : 'text-on-surface-variant'}`}>{title}</p>
    </div>
    <div className="space-y-2 pl-3.5">{children}</div>
  </div>
);

// ─── Bullet item ─────────────────────────────────────────────────────────────
const Bullet: React.FC<{ text: string; accent?: string }> = ({ text, accent }) => (
  <div className="flex items-start gap-2">
    <span className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${accent ?? 'bg-primary/50'}`} />
    <p className="text-xs text-on-surface leading-relaxed">{text}</p>
  </div>
);

// ─── Recommendation row ───────────────────────────────────────────────────────
const Rec: React.FC<{ label: string; text: string; color?: string }> = ({ label, text, color = 'text-primary bg-primary/8 border-primary/20' }) => (
  <div className={`rounded-xl border px-4 py-3 ${color}`}>
    <p className="text-[9px] font-extrabold uppercase tracking-widest mb-1 opacity-70">{label}</p>
    <p className="text-xs leading-relaxed">{text}</p>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const { loading, error: dbError, query } = useDuckDB();
  const { t } = useLang();
  const [isClient, setIsClient]   = useState(false);
  const [ready, setReady]         = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dailySales, setDailySales] = useState<DailySales[]>([]);
  const [cohortData, setCohortData] = useState<CohortRow[]>([]);
  const [brandData,  setBrandData]  = useState<BrandRow[]>([]);
  const [rfmData,    setRfmData]    = useState<RfmRow[]>([]);

  useEffect(() => { setIsClient(true); }, []);

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const [sales, cohort, brands, rfm] = await Promise.all([
        query(`SELECT strftime(event_date,'%Y-%m-%d') as event_date, view_count, cart_count, purchase_count, daily_revenue
               FROM sales_trends WHERE metric_type='daily_sales' ORDER BY event_date`),
        query(`SELECT cohort_week, weeks_since_acquisition, retention_rate, retained_users
               FROM cohort_retention ORDER BY cohort_week, weeks_since_acquisition`),
        query(`SELECT brand, total_revenue, purchase_count, avg_price, conversion_rate
               FROM brand_preferences WHERE brand IS NOT NULL AND brand != 'unknown'
               ORDER BY total_revenue DESC LIMIT 20`),
        query(`SELECT segment, user_count, avg_monetary, avg_frequency, avg_recency, segment_revenue
               FROM rfm_segmentation ORDER BY avg_monetary DESC`),
      ]);
      setDailySales(sales);
      setCohortData(cohort);
      setBrandData(brands);
      setRfmData(rfm);
      setReady(true);
    } catch (e: any) {
      setLoadError(String(e?.message ?? e));
    }
  }, [query]);

  useEffect(() => {
    if (!isClient || loading || dbError) return;
    loadData();
  }, [isClient, loading, dbError, loadData]);



  if (!isClient || loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-surface-container rounded-xl w-1/2" />
        {[1,2,3,4].map(i => <div key={i} className="h-40 bg-surface-container rounded-2xl" />)}
      </div>
    );
  }

  if (dbError || loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertTriangle className="w-10 h-10 text-red-500" />
        <p className="font-bold text-on-surface">{t('Lỗi tải dữ liệu', 'Data load error')}</p>
        <pre className="text-xs text-red-500 bg-surface-container p-4 rounded-xl max-w-xl text-left overflow-auto">
          {String(dbError ?? loadError)}
        </pre>
        <button onClick={loadData} className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold">
          {t('Thử lại', 'Retry')}
        </button>
      </div>
    );
  }

  // ─── Derived analytics ─────────────────────────────────────────────────────

  // 1. Sales spike
  const revenues  = dailySales.map(d => d.daily_revenue);
  const sortedRev = [...revenues].filter(r => r > 0).sort((a, b) => a - b);
  const median    = sortedRev[Math.floor(sortedRev.length / 2)] || 1;
  const emptyDay  = { event_date: 'N/A', daily_revenue: 0, view_count: 0, cart_count: 0, purchase_count: 0 };
  const peakDay   = dailySales.reduce((a, b) => b.daily_revenue > a.daily_revenue ? b : a, emptyDay);
  const peakRatio = peakDay.daily_revenue / median;
  const peakIdx   = dailySales.findIndex(d => d.event_date === peakDay.event_date);
  const medianView = [...dailySales.map(d => d.view_count)].sort((a,b)=>a-b)[Math.floor(dailySales.length/2)] || 1;
  const viewBefore2 = peakIdx >= 2 ? dailySales[peakIdx-2].view_count / medianView : 1;
  const viewBefore3 = peakIdx >= 3 ? dailySales[peakIdx-3].view_count / medianView : 1;
  const lagConfirmed = viewBefore2 > 1.5 || viewBefore3 > 1.5;
  const lagPct = ((Math.max(viewBefore2, viewBefore3) - 1) * 100).toFixed(0);
  const peakWindow = dailySales.slice(Math.max(0, peakIdx - 5), peakIdx + 5);

  // 2. Cohort
  const avgRetentionAt = (w: number) => {
    const rows = cohortData.filter(r => r.weeks_since_acquisition === w);
    return rows.length ? rows.reduce((s, r) => s + r.retention_rate, 0) / rows.length : 0;
  };
  const w1 = avgRetentionAt(1), w4 = avgRetentionAt(4), w8 = avgRetentionAt(8);
  const cohortChart = [0,1,2,3,4,5,6,7,8].map(w => ({ week: `W+${w}`, pct: parseFloat((avgRetentionAt(w)*100).toFixed(1)) }));

  // 3. Brands
  const find = (name: string) => brandData.find(b => b.brand?.toLowerCase() === name);
  const apple   = find('apple');
  const samsung = find('samsung');
  const xiaomi  = find('xiaomi');
  const brandChart = [apple, samsung, xiaomi].filter(Boolean).map(b => ({
    brand: b!.brand,
    rev: Math.round(b!.total_revenue / 1000),
    units: b!.purchase_count,
  }));
  const brandColors: Record<string,string> = { apple:'#2D6A4F', samsung:'#4A90D9', xiaomi:'#E0A96D' };
  const appleRevRank   = brandData.findIndex(b => b.brand?.toLowerCase() === 'apple') + 1;
  const samsungVolRank = [...brandData].sort((a,b)=>b.purchase_count-a.purchase_count).findIndex(b=>b.brand?.toLowerCase()==='samsung')+1;

  // 4. RFM
  const totalUsers = rfmData.reduce((s, r) => s + (r.user_count || 0), 0);
  const champ  = rfmData.find(r => r.segment?.toLowerCase().includes('champion'));
  const loyal  = rfmData.find(r => r.segment?.toLowerCase().includes('loyal'));
  const atRisk = rfmData.find(r => r.segment?.toLowerCase().includes('risk'));
  const lost   = rfmData.find(r => r.segment?.toLowerCase().includes('lost'));
  const rfmColorMap: Record<string,string> = {
    champions:'#2D6A4F', loyal:'#4A90D9', 'potential loyalist':'#6B8EBF',
    promising:'#7DC98F', 'new customers':'#A8D8A8',
    'about to sleep':'#E8A317', 'at risk':'#E07B39', 'cant lose them':'#C03A2B',
    hibernating:'#9CA3AF', lost:'#E53E3E', 'needs attention':'#B0B8C8',
  };
  const getRfmColor = (seg: string) => {
    const key = Object.keys(rfmColorMap).find(k => seg?.toLowerCase().includes(k));
    return key ? rfmColorMap[key] : '#9CA3AF';
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-12">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black tracking-tight text-on-surface">
            {t('Báo cáo Phân tích Chiến lược', 'Strategic Analytics Report')}
          </h1>
          <p className="text-xs text-on-surface-variant mt-1">
            {t('Dữ liệu Clickstream · 68 triệu sự kiện · Tháng 10–11/2019', 'Clickstream Dataset · 68M Events · Oct–Nov 2019')}
          </p>
        </div>
        <LangToggle />
      </div>

      {!ready && !loadError && (
        <div className="flex items-center gap-3 text-xs text-on-surface-variant bg-surface-container p-3 rounded-xl">
          <div className="w-3 h-3 rounded-full bg-primary animate-ping" />
          {t('Đang truy vấn DuckDB…', 'Querying DuckDB…')}
        </div>
      )}

      {/* ── SECTION 1: Sales Trends ────────────────────────────────────── */}
      <Section idx={1} icon={<TrendingUp className="w-5 h-5" />}
        title={t('Xu hướng Doanh thu — Phát hiện Đột biến & Độ trễ mua hàng', 'Sales Trend — Revenue Spike & Purchase Lag Detection')}
        subtitle={t('Ngày đỉnh doanh thu, hệ số đột biến, và hiệu ứng độ trễ 2–3 ngày', 'Peak day, spike ratio, and 2–3 day purchase lag pattern')}
      >
        {ready && peakWindow.length > 0 ? (
          <>
            <div className="h-48 mt-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                {t('Biểu đồ trong vòng 5 ngày trước và sau đỉnh doanh thu', 'Chart: 5-day window before and after the revenue peak')}
              </p>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={peakWindow} margin={{ top:4, right:8, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gView" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4A90D9" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#4A90D9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(73,69,79,0.06)" />
                  <XAxis dataKey="event_date" tick={{ fontSize:8 }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="r" tickFormatter={v=>`$${(v/1e6).toFixed(0)}M`} tick={{fontSize:8}} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="v" orientation="right" tickFormatter={v=>`${(v/1e6).toFixed(1)}M`} tick={{fontSize:8}} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v:any,n:any)=>n==='daily_revenue'?fmtUSD(v):fmt(v)} />
                  <Area yAxisId="v" type="monotone" dataKey="view_count" stroke="#4A90D9" strokeWidth={1.5} fill="url(#gView)" name={t('Lượt xem','Views')} />
                  <Area yAxisId="r" type="monotone" dataKey="daily_revenue" stroke="#2D6A4F" strokeWidth={2} fill="url(#gRev)" name={t('Doanh thu','Revenue')} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label={t('Ngày đỉnh doanh thu','Peak Day')} value={peakDay.event_date} />
              <Stat label={t('Doanh thu cao nhất','Peak Revenue')} value={fmtUSD(peakDay.daily_revenue)} />
              <Stat label={t('Hệ số đột biến (so với trung bình ngày)','Spike Ratio vs Daily Median')} value={`${peakRatio.toFixed(1)}x`} />
            </div>

            <Insight title={t('Nhận định phân tích', 'Analysis Findings')}>
              <Bullet text={t(
                `Đỉnh doanh thu rơi vào ngày ${peakDay.event_date} (Chủ nhật), đạt ${fmtUSD(peakDay.daily_revenue)} — gấp ${peakRatio.toFixed(1)} lần mức trung bình ngày thường (~${fmtUSD(median)}). Dataset này xuất phát từ sàn TMDT điện tử tại Nga (Oct–Nov 2019).`,
                `Revenue peaked on ${peakDay.event_date} (Sunday) at ${fmtUSD(peakDay.daily_revenue)}, which is ${peakRatio.toFixed(1)}x above the daily median (~${fmtUSD(median)}). This dataset originates from a Russian electronics e-commerce store (Oct–Nov 2019).`
              )} />
              <Bullet text={t(
                'Khả năng cao nhất — Ngày cuối sale AliExpress 11.11: AliExpress (top 3 TMDT tại Nga) tổ chức Global Shopping Festival kéo dài từ 11/11 đến 17/11/2019 cho thị trường Nga và Đông Âu. Ngày 17/11 là Chủ nhật — ngày cuối đợt sale → rush mua vào phút chót.',
                'Most likely cause — AliExpress 11.11 Final Day: AliExpress (top 3 e-commerce in Russia) ran its Global Shopping Festival from Nov 11–17, 2019 for the Russian and Eastern European market. Nov 17 being a Sunday — last day of the sale — triggered a last-minute purchase rush.'
              )} accent="bg-green-500/60" />
              <Bullet text={t(
                'Yếu tố cộng hưởng — Hiệu ứng lương giữa tháng: Lương nhà nước và quân đội Nga được trả định kỳ ngày 15–20 mỗi tháng. Ngày 17/11 (Chủ nhật) ngay sau kỳ lương giữa tháng → purchasing power tăng đột biến trùng với ngày cuối sale.',
                'Compounding factor — Mid-month payday effect: Russian government and military salaries are regularly disbursed on the 15th–20th of each month. Nov 17 (Sunday) falls right after mid-month payday — a confluence of increased purchasing power and sale deadline urgency.'
              )} accent="bg-blue-500/60" />
              {lagConfirmed ? (
                <Bullet text={t(
                  `Xác nhận hiệu ứng Độ trễ mua hàng (Purchase Lag): lượt xem tại D-2 và D-3 trước đỉnh cao hơn trung bình ${lagPct}%. Hành vi khảo giá và nghiên cứu sản phẩm 2–3 ngày trước, rồi đồng loạt chốt đơn vào ngày cao điểm — điển hình của rush cuối kỳ sale có thời hạn.`,
                  `Purchase lag confirmed: view traffic at D-2 and D-3 before peak was ${lagPct}% above median. Browse-and-research behavior 2–3 days ahead, then synchronized purchases on the deadline day — textbook behavior for time-limited sale events.`
                )} accent="bg-green-500/60" />
              ) : (
                <Bullet text={t(
                  'Lượt xem và doanh thu tăng cùng lúc — hành vi mua theo cảm hứng (Impulse Buying), không quan sát thấy độ trễ rõ ràng.',
                  'Views and revenue spike simultaneously — impulse-driven buying behavior, no clear purchase lag observed.'
                )} />
              )}
            </Insight>

            <Insight title={t('Đề xuất chiến lược', 'Strategic Recommendations')}>
              <Bullet text={t(
                'Kích hoạt chiến dịch Khởi động trước (Warm-Up) 3 ngày trước siêu sale: chạy quảng cáo bám đuổi (Retargeting) nhắm vào nhóm đã xem nhưng chưa mua, kèm nhắc nhở danh sách yêu thích (Wishlist Reminder) và đồng hồ đếm ngược.',
                'Launch a 3-day Warm-Up Campaign before the next flash sale: run retargeting ads targeting view-not-purchase users, with wishlist reminders and countdown timers.'
              )} />
              <Bullet text={t(
                'Điều tra điểm tụt doanh thu tại D-1 (gần 0 USD): xác định đây là lỗi dữ liệu do kỹ thuật nối bảng giá lịch sử (SCD Type 2 Price Join) hay khách hàng thực sự nhịn mua để chờ sale khai mạc.',
                'Investigate the near-zero D-1 revenue dip: determine whether it is an ETL artifact from the SCD Type 2 price join logic, or genuine customer hold-back behavior ahead of the sale.'
              )} accent="bg-amber-400/60" />
            </Insight>
          </>
        ) : ready ? (
          <p className="text-xs text-on-surface-variant py-4">{t('Không có dữ liệu xu hướng doanh thu.', 'No sales trend data available.')}</p>
        ) : null}
      </Section>

      {/* ── SECTION 2: Cohort Retention ───────────────────────────────── */}
      <Section idx={2} icon={<Users className="w-5 h-5" />}
        title={t('Phân tích Nhóm Khách hàng (Cohort) — Mức độ Gắn bó theo Tuần', 'Cohort Analysis — Weekly Retention & Engagement Decline')}
        subtitle={t('Lưu ý: chỉ số tuần không phù hợp với ngành điện tử tiêu dùng — xem giải thích bên dưới', 'Note: weekly metrics are inherently low for electronics retail — see domain context below')}
      >
        {ready && cohortChart.length > 0 ? (
          <>
            <div className="h-44 mt-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                {t('Tỷ lệ quay lại mua hàng trung bình theo tuần — toàn bộ nhóm khách hàng', 'Average retention rate by week across all cohorts')}
              </p>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cohortChart} margin={{ top:4, right:8, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="gRet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4A90D9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4A90D9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(73,69,79,0.06)" />
                  <XAxis dataKey="week" tick={{fontSize:8}} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v=>`${v}%`} tick={{fontSize:8}} tickLine={false} axisLine={false} domain={[0,100]} />
                  <Tooltip formatter={(v:any)=>`${v}%`} />
                  <Area type="monotone" dataKey="pct" stroke="#4A90D9" strokeWidth={2} fill="url(#gRet)" name="Retention" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Stat label={t('Tuần W+1 — 7 ngày sau lần mua đầu', 'W+1 — 7 days after first purchase')} value={fmtPct(w1)} color="text-tertiary" />
              <Stat label={t('Tuần W+4 — sau 1 tháng', 'W+4 — after 1 month')} value={fmtPct(w4)} color="text-tertiary" />
              <Stat label={t('Tuần W+8 — sau 2 tháng', 'W+8 — after 2 months')} value={fmtPct(w8)} color="text-red-500" />
            </div>

            <Insight title={t('Cảnh báo phân tích — sai chỉ số cho ngành', 'Analytics Warning — Wrong Metric for This Industry')} warning>
              <Bullet text={t(
                `Tỷ lệ quay lại theo tuần thấp (${fmtPct(w1)} tại W+1) là hoàn toàn bình thường với ngành điện tử tiêu dùng. Chu kỳ thay thế thiết bị trung bình là 12–24 tháng — không ai mua điện thoại mới mỗi tuần.`,
                `Low weekly return rate (${fmtPct(w1)} at W+1) is completely normal for consumer electronics. The average device replacement cycle is 12–24 months — nobody buys a new phone every week.`
              )} accent="bg-amber-500/50" />
              <Bullet text={t(
                'Dùng chỉ số cohort theo tuần để đánh giá mức độ gắn bó trong ngành điện tử là sai mô hình và dẫn đến kết luận sai.',
                'Using weekly cohort retention to assess loyalty in electronics retail is a misapplied model and leads to incorrect conclusions.'
              )} accent="bg-amber-500/50" />
              <Bullet text={t(
                'Mức chuẩn ngành thực tế: Tỷ lệ mua lại trong 90 ngày (90-Day Repeat Purchase Rate) chỉ khoảng 8,26%; Tỷ lệ giữ chân hằng năm (Customer Retention Rate — CRR) đạt 18–35% được coi là tốt.',
                'Actual industry benchmarks: 90-Day Repeat Purchase Rate ~8.26%; Annual Customer Retention Rate (CRR) of 18–35% is considered healthy.'
              )} accent="bg-amber-500/50" />
            </Insight>

            <Insight title={t('Chỉ số phù hợp cho điện tử tiêu dùng', 'Correct Metrics for Consumer Electronics')}>
              <Bullet text={t(
                'Thay thế cohort tuần bằng Tỷ lệ mua lại trong 90 ngày (90-Day Repeat Purchase Rate — RPR). Mức chuẩn ngành ~8,26%; đạt trên 15% là xuất sắc cho danh mục điện thoại và thiết bị.',
                'Replace weekly cohort with 90-Day Repeat Purchase Rate (RPR). Industry benchmark ~8.26%; above 15% is exceptional for phones and devices.'
              )} />
              <Bullet text={t(
                'Theo dõi Thời gian giữa các lần mua (Time Between Purchases — TBP): tính khoảng cách trung bình giữa hai đơn hàng, từ đó tự động gửi chiến dịch tái tiếp cận đúng thời điểm khách hàng sắp đến vòng thay thế thiết bị tiếp theo.',
                'Track Time Between Purchases (TBP): calculate the average gap between orders, then auto-trigger re-engagement campaigns precisely when customers approach their next device replacement window.'
              )} />
              <Bullet text={t(
                'Đo lường Tỷ lệ mua phụ kiện sau thiết bị chính (Accessory Attach Rate): sau khi khách mua điện thoại, có mua thêm ốp lưng, tai nghe, hay cáp sạc không? Đây mới là chỉ số phản ánh mức độ gắn bó thực sự trong ngành điện tử.',
                'Measure Accessory Attach Rate: after a customer buys a phone, do they also purchase cases, earphones, or chargers? This is the true engagement indicator for electronics retail.'
              )} />
            </Insight>
          </>
        ) : ready ? (
          <p className="text-xs text-on-surface-variant py-4">{t('Không có dữ liệu cohort.', 'No cohort data available.')}</p>
        ) : null}
      </Section>

      {/* ── SECTION 3: Brand Preferences ──────────────────────────────── */}
      <Section idx={3} icon={<Tag className="w-5 h-5" />}
        title={t('Thị hiếu Thương hiệu — Apple, Samsung, Xiaomi', 'Brand Preferences — Apple, Samsung, Xiaomi')}
        subtitle={t('Vì sao Apple dẫn đầu về doanh thu nhưng Samsung áp đảo về số lượng đơn hàng?', 'Why does Apple lead revenue while Samsung dominates unit volume?')}
      >
        {ready && brandChart.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t('Doanh thu (nghìn USD)', 'Revenue (K USD)')}</p>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={brandChart} margin={{top:4,right:4,left:0,bottom:0}}>
                      <XAxis dataKey="brand" tick={{fontSize:9,fontWeight:'bold'}} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={v=>`$${v}K`} tick={{fontSize:8}} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v:any)=>`$${v}K`} />
                      <Bar dataKey="rev" radius={[4,4,0,0]} name={t('Doanh thu','Revenue')}>
                        {brandChart.map((b,i) => <Cell key={i} fill={brandColors[b.brand.toLowerCase()] ?? '#9CA3AF'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">{t('Số lượng đơn hàng', 'Units Sold')}</p>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={brandChart} margin={{top:4,right:4,left:0,bottom:0}}>
                      <XAxis dataKey="brand" tick={{fontSize:9,fontWeight:'bold'}} tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={v=>fmt(v)} tick={{fontSize:8}} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v:any)=>fmt(v)} />
                      <Bar dataKey="units" radius={[4,4,0,0]} name={t('Đơn hàng','Units')}>
                        {brandChart.map((b,i) => <Cell key={i} fill={brandColors[b.brand.toLowerCase()] ?? '#9CA3AF'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { b: apple,   color:'#2D6A4F', label:'Apple'   },
                { b: samsung, color:'#4A90D9', label:'Samsung' },
                { b: xiaomi,  color:'#E0A96D', label:'Xiaomi'  },
              ].filter(x => x.b).map(({ b, color, label }) => (
                <div key={label} className="bg-surface-container-low rounded-xl p-3 border border-outline-variant/50 space-y-1">
                  <p className="text-xs font-extrabold" style={{color}}>{label}</p>
                  <p className="text-[10px] text-on-surface-variant">{t('Doanh thu','Revenue')}: <span className="font-bold text-on-surface">{fmtUSD(b!.total_revenue)}</span></p>
                  <p className="text-[10px] text-on-surface-variant">{t('Số đơn','Units')}: <span className="font-bold text-on-surface">{fmt(b!.purchase_count)}</span></p>
                  <p className="text-[10px] text-on-surface-variant">{t('Giá trị đơn TB (AOV)','Avg Order Value (AOV)')}: <span className="font-bold text-on-surface">{fmtUSD(b!.avg_price)}</span></p>
                  <p className="text-[10px] text-on-surface-variant">{t('Tỷ lệ chuyển đổi (CVR)','Conversion Rate (CVR)')}: <span className="font-bold text-on-surface">{fmtPct(b!.conversion_rate)}</span></p>
                </div>
              ))}
            </div>

            <Insight title={t('Nhận định phân tích', 'Analysis Findings')}>
              <Bullet text={t(
                `Apple xếp hạng ${appleRevRank} về doanh thu${apple ? ` (${fmtUSD(apple.total_revenue)})` : ''}. Sức mạnh đến từ Giá trị đơn hàng trung bình (AOV — Average Order Value) cao — ${apple ? fmtUSD(apple.avg_price) : 'N/A'} mỗi đơn — khách hàng tự nguyện chi thêm cho hệ sinh thái Apple mà không cần khuyến mãi.`,
                `Apple ranks #${appleRevRank} by revenue${apple ? ` (${fmtUSD(apple.total_revenue)})` : ''}. Its strength comes from a high Average Order Value (AOV) of ${apple ? fmtUSD(apple.avg_price) : 'N/A'} per transaction — customers willingly pay a premium for the Apple ecosystem.`
              )} />
              <Bullet text={t(
                `Samsung thống trị về số lượng đơn hàng (hạng ${samsungVolRank} về số đơn bán ra): chiến lược đại trà, phủ toàn bộ phân khúc từ bình dân đến cao cấp để tối đa hoá thị phần, dẫn đến AOV thấp hơn Apple nhưng tổng lượng khách rộng hơn nhiều.`,
                `Samsung dominates unit volume (rank #${samsungVolRank} in units sold) via a mass-market strategy covering all price tiers from entry-level to flagship. This maximizes market reach but dilutes AOV compared to Apple.`
              )} />
              {xiaomi && (
                <Bullet text={t(
                  `Xiaomi với AOV ${fmtUSD(xiaomi.avg_price)} nhắm thẳng vào phân khúc khách hàng nhạy cảm về giá (Price-Sensitive), đặt cược vào số lượng lớn và chiến lược thu hồi lợi nhuận qua hệ sinh thái nhà thông minh.`,
                  `Xiaomi at AOV ${fmtUSD(xiaomi.avg_price)} targets the price-sensitive segment, betting on high volume and recovering margin through smart home ecosystem products.`
                )} />
              )}
            </Insight>

            <Insight title={t('Đề xuất chiến lược', 'Strategic Recommendations')}>
              <Rec
                label="Apple"
                text={t(
                  'Tập trung bán chéo sản phẩm liên quan (Cross-sell): AppleCare, phụ kiện chính hãng. Gói combo iPhone và AirPods có thể tăng giá trị đơn hàng trung bình (AOV) thêm 25%. Không cần đuổi theo số lượng — bảo vệ biên lợi nhuận (Margin).',
                  'Focus on cross-sell: AppleCare, official accessories. An iPhone and AirPods bundle can increase AOV by 25%. No need to chase volume — protect margin.'
                )}
                color="text-[#2D6A4F] bg-[#2D6A4F]/8 border-[#2D6A4F]/20"
              />
              <Rec
                label="Samsung"
                text={t(
                  'Tận dụng khối lượng đơn hàng lớn để đàm phán giảm chi phí đầu vào (COGS — Cost of Goods Sold) với nhà cung cấp. Triển khai chương trình đổi máy cũ lấy mới (Trade-in) để nâng cấp khách hàng từ phân khúc tầm trung lên cao cấp, cải thiện AOV.',
                  'Leverage unit volume to negotiate lower COGS with suppliers. Launch a trade-in program to upsell customers from mid-range to flagship, improving AOV.'
                )}
                color="text-[#2D5A8E] bg-[#4A90D9]/8 border-[#4A90D9]/20"
              />
              <Rec
                label="Xiaomi"
                text={t(
                  'Áp dụng chiến lược Thiết bị đầu tiên (First Device Strategy): bán điện thoại với biên lợi nhuận thấp, thu hồi lợi nhuận qua nhà thông minh và phụ kiện. Đây là mô hình Xiaomi đã áp dụng thành công tại thị trường Trung Quốc.',
                  'Apply the First Device Strategy: sell phones at thin margin, recover profit through smart home and accessories. This mirrors Xiaomi\'s proven playbook in its home market.'
                )}
                color="text-[#8B5E00] bg-[#E0A96D]/12 border-[#E0A96D]/25"
              />
            </Insight>
          </>
        ) : ready ? (
          <p className="text-xs text-on-surface-variant py-4">{t('Không có dữ liệu thương hiệu.', 'No brand data available.')}</p>
        ) : null}
      </Section>

      {/* ── SECTION 4: RFM Segmentation ───────────────────────────────── */}
      <Section idx={4} icon={<BarChart3 className="w-5 h-5" />}
        title={t('Phân khúc Khách hàng theo Mô hình RFM', 'Customer Segmentation — RFM Model')}
        subtitle={t('RFM = Độ gần đây (Recency) · Tần suất mua (Frequency) · Tổng chi tiêu (Monetary) — chiến lược tiếp thị từng nhóm', 'Recency · Frequency · Monetary — per-segment marketing playbook')}
      >
        {ready && rfmData.length > 0 ? (
          <>
            <div className="mt-2 space-y-2">
              {rfmData.map(seg => {
                const pct = totalUsers > 0 ? (seg.user_count / totalUsers) * 100 : 0;
                return (
                  <div key={seg.segment} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-on-surface uppercase tracking-wide">{seg.segment}</span>
                      <span className="text-on-surface-variant">
                        {fmt(seg.user_count)} {t('khách hàng', 'users')} · {fmtUSD(seg.avg_monetary)} {t('chi tiêu TB', 'avg spend')} · {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width:`${pct}%`, backgroundColor: getRfmColor(seg.segment) }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              {[
                { seg: champ, label: t('Khách VIP — Champions', 'Champions'), color:'#2D6A4F', bg:'bg-[#2D6A4F]/8 border-[#2D6A4F]/20',
                  vi: 'Trao quyền trải nghiệm sản phẩm mới sớm nhất (Early Access) và mời tham gia nhóm thử nghiệm beta. Tuyệt đối không giảm giá — nhóm này mua vì trải nghiệm cao cấp, không phải vì khuyến mãi.',
                  en: 'Grant Early Access to new product launches and invite to beta testing. Never offer discounts — this group buys for the premium experience, not promotions.' },
                { seg: loyal, label: t('Khách Trung thành — Loyal', 'Loyal Customers'), color:'#4A90D9', bg:'bg-[#4A90D9]/8 border-[#4A90D9]/20',
                  vi: 'Triển khai chương trình giới thiệu bạn bè (Referral Program): thưởng điểm hoặc tiền mặt cho mỗi người dùng mới được giới thiệu thành công. Đây là nhóm có tiềm năng trở thành đại sứ thương hiệu cao nhất.',
                  en: 'Launch a Referral Program: reward points or cash for each successful referral. This group has the highest potential to become brand ambassadors.' },
                { seg: atRisk, label: t('Nguy cơ rời bỏ — At Risk', 'At-Risk Customers'), color:'#E8A317', bg:'bg-[#E8A317]/8 border-[#E8A317]/25',
                  vi: 'Triển khai chiến dịch thu hồi khẩn cấp (Win-Back) trong vòng 7 ngày với ưu đãi cá nhân hóa theo danh mục sản phẩm yêu thích. Đặt thời hạn rõ ràng để tạo cảm giác cấp bách, thúc đẩy hành động.',
                  en: 'Launch an urgent Win-Back campaign within 7 days with personalized offers based on favorite product categories. Set a clear deadline to create urgency and drive action.' },
                { seg: lost, label: t('Đã mất — Lost', 'Lost Customers'), color:'#E53E3E', bg:'bg-red-500/6 border-red-300/40',
                  vi: 'Không lãng phí ngân sách vào quảng cáo bám đuổi (Retargeting). Thay vào đó, gửi khảo sát mức độ hài lòng ngắn (NPS — Net Promoter Score) để nắm nguyên nhân rời bỏ, từ đó cải thiện sản phẩm cho các nhóm khác.',
                  en: 'Do not waste retargeting budget on this group. Instead, send a short NPS survey (Net Promoter Score) to understand churn reasons, then use the findings to improve the product for other segments.' },
              ].filter(x => x.seg).map(({ seg, label, color, bg, vi, en }) => (
                <div key={seg!.segment} className={`rounded-xl p-4 border ${bg} space-y-2`}>
                  <div>
                    <p className="text-xs font-extrabold" style={{color}}>{label}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      {fmt(seg!.user_count)} {t('khách hàng', 'users')} · {t('chi tiêu TB', 'avg spend')} {fmtUSD(seg!.avg_monetary)} · {t('tần suất', 'freq')} {seg!.avg_frequency?.toFixed(1)}x
                    </p>
                  </div>
                  <p className="text-xs text-on-surface leading-relaxed">{t(vi, en)}</p>
                </div>
              ))}
            </div>

            <Insight title={t('Đề xuất phân bổ ngân sách tiếp thị', 'Marketing Budget Allocation')}>
              <Bullet text={t(
                `Tổng cộng ${fmt(totalUsers)} khách hàng được phân thành ${rfmData.length} nhóm.`,
                `Total of ${fmt(totalUsers)} customers distributed across ${rfmData.length} segments.`
              )} />
              <Bullet text={t(
                'Phân bổ ngân sách đề xuất: 40% cho nhóm Nguy cơ rời bỏ (tỷ suất hoàn vốn — ROI của chiến dịch thu hồi cao nhất); 30% cho nhóm Trung thành (nâng cấp và giới thiệu bạn bè); 20% cho nhóm VIP (đầu tư trải nghiệm cao cấp); 10% cho nhóm Đã mất (chỉ để nghiên cứu nguyên nhân rời bỏ qua NPS).',
                'Recommended budget split: 40% for At-Risk (highest win-back ROI); 30% for Loyal (upsell and referral); 20% for Champions (VIP experience investment); 10% for Lost (NPS research only).'
              )} />
              <Bullet text={t(
                'Nhóm VIP dù ít người nhưng thường đóng góp hơn 40% tổng doanh thu. Bảo vệ nhóm này là ưu tiên tuyệt đối số một.',
                'Champions, though small in count, typically drive over 40% of total revenue. Protecting this segment is the absolute top priority.'
              )} accent="bg-[#2D6A4F]/60" />
            </Insight>
          </>
        ) : ready ? (
          <p className="text-xs text-on-surface-variant py-4">{t('Không có dữ liệu RFM.', 'No RFM data available.')}</p>
        ) : null}
      </Section>

    </div>
  );
}
