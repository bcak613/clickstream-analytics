import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorCardProps {
  message?: string;
  className?: string;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({ 
  message = 'Unable to load data.', 
  className = '' 
}) => {
  return (
    <div className={`bg-surface-container-lowest border border-error-container rounded-xl p-6 flex flex-col items-center justify-center text-center w-full min-h-[200px] ${className}`}>
      <AlertCircle className="w-8 h-8 text-error mb-2" />
      <p className="text-on-surface font-medium text-sm">{message}</p>
    </div>
  );
};
