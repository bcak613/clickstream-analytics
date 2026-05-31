import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  change?: string;
  isPositive?: boolean;
  colorClass?: string; // e.g. 'text-primary bg-primary/10'
  sparklinePoints?: number[];
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  unit = '',
  icon,
  change,
  isPositive = true,
  colorClass = 'text-primary bg-primary/15',
  sparklinePoints = [10, 15, 8, 22, 18, 30, 25]
}) => {
  // Generate points path for SVG sparkline
  const width = 100;
  const height = 16;
  const maxVal = Math.max(...sparklinePoints);
  const minVal = Math.min(...sparklinePoints);
  const range = maxVal - minVal || 1;
  const points = sparklinePoints
    .map((val, index) => {
      const x = (index / (sparklinePoints.length - 1)) * width;
      const y = height - ((val - minVal) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col justify-between w-full h-[140px] relative overflow-hidden">
      {/* Top Details */}
      <div className="flex items-center justify-between w-full">
        <div className={`p-2.5 rounded-lg flex items-center justify-center ${colorClass}`}>
          {icon}
        </div>
        
        {change && (
          <div className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
            isPositive 
              ? 'text-success bg-success/10' 
              : 'text-error bg-error/10'
          }`}>
            {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            <span>{change}</span>
          </div>
        )}
      </div>

      {/* Main KPI Value */}
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-extrabold tracking-tight text-on-surface">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-normal text-on-surface-variant">
            {unit}
          </span>
        )}
      </div>

      {/* KPI Label */}
      <div className="text-[11px] font-bold tracking-wider uppercase text-on-surface-variant/80 mt-1">
        {label}
      </div>

      {/* Bottom Sparkline */}
      <div className="absolute bottom-0 left-0 right-0 h-4 opacity-40">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="#2D6A4F"
            strokeWidth="1.5"
            points={points}
          />
        </svg>
      </div>
    </div>
  );
};
