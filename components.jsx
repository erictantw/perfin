
// ─── Shared UI Components ─────────────────────────────────────────────────────

// StatCard
function StatCard({ title, value, subValue, icon: Icon, trend, className = '', onClick, loading = false }) {
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

// Modal
function Modal({ open, onClose, title, children, size = 'md' }) {
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;
  const maxW = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size] ?? 'max-w-lg';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative z-10 w-full ${maxW} bg-stone-900 rounded-2xl border border-stone-700 shadow-2xl flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-700/60 flex-shrink-0">
          <h2 className="text-base font-semibold text-stone-50">{title}</h2>
          <button onClick={onClose} className="p-1 rounded text-stone-400 hover:text-stone-100 transition-colors">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// EmptyState
function EmptyState({ icon: Icon, title, description, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
      {Icon && <div className="p-3 rounded-2xl bg-stone-800 text-stone-500 mb-3"><Icon size={24} /></div>}
      <p className="text-sm font-semibold text-stone-300 mb-1">{title}</p>
      <p className="text-xs text-stone-500 mb-4">{description}</p>
      {action && (
        <button onClick={onAction} className="btn-primary text-xs px-4 py-2">{action}</button>
      )}
    </div>
  );
}

// Input / Select helpers
function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input(props) {
  return <input {...props} className={`input ${props.className || ''}`} />;
}

function Select({ children, ...props }) {
  return <select {...props} className={`input ${props.className || ''}`}>{children}</select>;
}

// AllocationBar
function AllocationBar({ label, actualPct, targetPct, gap, color }) {
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

// PageHeader — consistent greeting + date used on every page
function PageHeader({ right } = {}) {
  const name = window.__userName || 'Alex';
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
      <div>
        <h1 style={{ fontFamily:"'Lora',Georgia,serif", fontWeight:400, fontSize:'clamp(1.35rem,3vw,1.85rem)', color:'#f0ebe4', letterSpacing:'-0.02em', lineHeight:1.15, margin:0 }}>
          {greet()}, {name}
        </h1>
        <p style={{ fontSize:'0.72rem', color:'#6b6057', marginTop:4, fontFamily:'Inter,sans-serif' }}>{todayLong()}</p>
      </div>
      {right && <div style={{ flexShrink:0, paddingTop:4 }}>{right}</div>}
    </div>
  );
}

// Export all to window
Object.assign(window, { StatCard, Modal, EmptyState, Field, Input, Select, AllocationBar, PageHeader });
