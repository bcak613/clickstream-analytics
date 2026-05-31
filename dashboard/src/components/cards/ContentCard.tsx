import React from 'react';

interface ContentCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  title,
  subtitle,
  children,
  className = '',
  headerActions
}) => {
  return (
    <div className={`bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col w-full shadow-sm ${className}`}>
      {/* Header Area */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-extrabold text-on-surface uppercase tracking-wider">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {headerActions && <div>{headerActions}</div>}
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full relative">
        {children}
      </div>
    </div>
  );
};
