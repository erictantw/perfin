import React from 'react';

export default function AllocationBar({ label, actualPct, targetPct, gap, color }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className={`font-medium ${color}`}>{label}</span>
        <div className="flex items-center gap-3 text-stone-400">
          <span className={`font-semibold ${gap >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {actualPct.toFixed(1)}%
          </span>
          <span className="text-stone-600">target {targetPct}%</span>
          <span className={`text-xs font-medium ${gap >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
            {gap > 0 ? `+${gap}%` : gap < 0 ? `${gap}%` : '✓'}
          </span>
        </div>
      </div>
      <div className="relative h-2 bg-stone-800 rounded-full overflow-hidden">
        <div className="absolute top-0 bottom-0 w-px bg-stone-500/60 z-10" style={{ left: `${Math.min(targetPct, 100)}%` }} />
        <div className={`h-full rounded-full transition-all duration-500 ${gap >= 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${Math.min(actualPct, 100)}%` }} />
      </div>
    </div>
  );
}
