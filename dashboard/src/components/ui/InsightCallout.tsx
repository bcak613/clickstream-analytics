import React from 'react';
import { Lightbulb, TrendingUp, AlertTriangle, Info } from 'lucide-react';

type InsightType = 'insight' | 'warning' | 'strategy' | 'info';

interface Insight {
  type: InsightType;
  title: string;
  body: string;
}

interface InsightCalloutProps {
  insights: Insight[];
  className?: string;
}

const iconMap: Record<InsightType, React.ReactNode> = {
  insight: <Lightbulb className="w-4 h-4 flex-shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 flex-shrink-0" />,
  strategy: <TrendingUp className="w-4 h-4 flex-shrink-0" />,
  info: <Info className="w-4 h-4 flex-shrink-0" />,
};

const colorMap: Record<InsightType, string> = {
  insight: 'bg-primary/8 border-primary/20 text-primary',
  warning: 'bg-[#E8A317]/8 border-[#E8A317]/25 text-[#9A6B00]',
  strategy: 'bg-tertiary/8 border-tertiary/20 text-tertiary',
  info: 'bg-surface-container border-outline-variant text-on-surface-variant',
};

const bodyColorMap: Record<InsightType, string> = {
  insight: 'text-on-surface',
  warning: 'text-on-surface',
  strategy: 'text-on-surface',
  info: 'text-on-surface-variant',
};

export const InsightCallout: React.FC<InsightCalloutProps> = ({ insights, className = '' }) => {
  if (!insights || insights.length === 0) return null;

  return (
    <div className={`mt-4 pt-4 border-t border-outline-variant/30 space-y-2 ${className}`}>
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant/50 mb-3">
        📊 Key Insights & Recommendations
      </p>
      {insights.map((insight, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-xs ${colorMap[insight.type]}`}
        >
          <span className="mt-0.5">{iconMap[insight.type]}</span>
          <div className="space-y-0.5 flex-1">
            <p className="font-bold leading-tight">{insight.title}</p>
            <p className={`font-normal leading-relaxed ${bodyColorMap[insight.type]}`}>
              {insight.body}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
