import React from 'react';

export default function StatCard({ title, value, subValue, icon: Icon, trend, className = '', onClick, loading = false }) {
  const pos = trend > 0, neg = trend < 0;
  return (
    <div onClick={onClick} className={`card ${onClick ? 'cursor-pointer hover:border-stone-600 transition-colors' : ''} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">{title}</p>
        {Icon && <div className="p-1.5 rounded-lg bg-stone-800/60 text-stone-400 flex-shrink-0"><Icon size={14} /></div>}
      </div>
      {loading ? (
        <div className="mt-2 space-y-2">
          <div className="h-7 w-32 bg-stone-800 rounded animate-pulse" />
          <div className="h-4 w-20 bg-stone-800 rounded animate-pulse" />
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-2xl font-bold text-stone-50 tracking-tight">{value}</p>
          {(trend !== undefined && trend !== null || subValue) && (
            <div className="flex items-center gap-2 mt-1">
              {trend !== undefined && trend !== null && (
                <span className={`text-xs font-medium ${pos ? 'text-emerald-400' : neg ? 'text-red-400' : 'text-stone-400'}`}>
                  {pos ? '▲' : neg ? '▼' : '–'} {Math.abs(trend).toFixed(1)}%
                </span>
              )}
              {subValue && <span className="text-xs text-stone-400">{subValue}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
