
// ─── Plan Page ────────────────────────────────────────────────────────────────
const PLAN_CATEGORIES = ['Cash', 'Investments', 'CPF', 'Properties'];
const DEFAULT_TARGETS = { Cash: 15, Investments: 50, CPF: 30, Properties: 5 };
const CAT_COLORS = { Cash: 'text-blue-400', Investments: 'text-emerald-400', CPF: 'text-purple-400', Properties: 'text-amber-400' };
const CAT_BG = { Cash: 'bg-blue-500', Investments: 'bg-emerald-500', CPF: 'bg-purple-500', Properties: 'bg-amber-500' };

function PlanPage() {
  const FX_USD = 1.34;
  const profile = db.get('profile', {});
  const initTargets = profile.allocation_targets ? JSON.parse(profile.allocation_targets) : DEFAULT_TARGETS;
  const [targets, setTargets] = React.useState(initTargets);
  const [saved, setSaved] = React.useState(false);

  // Derive actuals
  const cashAccounts = db.get('cash', []);
  const holdings = db.get('holdings', []);
  const cpf = db.get('cpf', { oa:0, sa:0, ma:0, ra:0, srs:0 });

  const totalCash = cashAccounts.reduce((s,a) => s + (a.currency==='USD' ? a.balance*FX_USD : a.balance), 0);
  const totalInv  = holdings.reduce((s,h) => {
    const price = h.latest_price || h.avg_cost;
    const val = h.units * price;
    return s + (h.currency === 'USD' ? val * FX_USD : val);
  }, 0);
  const totalCPF  = (cpf.oa||0) + (cpf.sa||0) + (cpf.ma||0) + (cpf.ra||0) + (cpf.srs||0);

  const actual = { Cash: totalCash, Investments: totalInv, CPF: totalCPF, Properties: 0 };
  const totalActual = Object.values(actual).reduce((s,v) => s+v, 0);
  const gaps = calcAllocationGaps(actual, targets);
  const targetTotal = Object.values(targets).reduce((s,v) => s + (parseFloat(v)||0), 0);

  function setTarget(cat, val) {
    setTargets(t => ({ ...t, [cat]: parseFloat(val) || 0 }));
  }

  function handleSave() {
    const total = Object.values(targets).reduce((s,v) => s + (parseFloat(v)||0), 0);
    if (Math.round(total) !== 100) { alert(`Targets must sum to 100%. Currently ${total.toFixed(1)}%`); return; }
    const p = db.get('profile', {});
    db.set('profile', { ...p, allocation_targets: JSON.stringify(targets) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-6">
      <PageHeader right={
        <button onClick={handleSave} disabled={Math.round(targetTotal) !== 100}
          className="btn-primary flex items-center gap-1.5 disabled:opacity-40">
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          {saved ? 'Saved!' : 'Save targets'}
        </button>
      } />

      {/* Target sliders */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-stone-100">Target Allocation</h2>
          <span className={`text-xs font-semibold ${Math.round(targetTotal) === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {targetTotal.toFixed(1)}% {Math.round(targetTotal) !== 100 && '— must equal 100%'}
          </span>
        </div>
        <div className="space-y-5">
          {PLAN_CATEGORIES.map(cat => (
            <div key={cat}>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`text-sm font-semibold ${CAT_COLORS[cat]}`}>{cat}</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="100" step="1"
                    value={targets[cat] ?? 0}
                    onChange={e => setTarget(cat, e.target.value)}
                    className="w-16 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-100 text-xs text-right focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                  <span className="text-xs text-stone-500">%</span>
                </div>
              </div>
              <input type="range" min="0" max="100" step="1"
                value={targets[cat] ?? 0}
                onChange={e => setTarget(cat, e.target.value)}
                className="w-full"
                style={{ accentColor: cat === 'Cash' ? '#60a5fa' : cat === 'Investments' ? '#10b981' : cat === 'CPF' ? '#a78bfa' : '#f59e0b' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Actual vs Target */}
      <div className="card">
        <h2 className="text-sm font-semibold text-stone-100 mb-5">Actual vs Target</h2>
        <div className="space-y-5">
          {gaps.map(({ key, actualAmt, actualPct, targetPct, gap }) => (
            <div key={key}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className={`font-semibold ${CAT_COLORS[key]}`}>{key}</span>
                <div className="flex items-center gap-3 text-stone-400">
                  <span className="tabular-nums">{fmtSGD(actualAmt)}</span>
                  <span className={`font-semibold ${gap >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {actualPct.toFixed(1)}% {gap > 0 ? `(+${gap}%)` : gap < 0 ? `(${gap}%)` : '✓'}
                  </span>
                  <span className="text-stone-600">target {targetPct}%</span>
                </div>
              </div>
              <div className="relative h-3 bg-stone-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${CAT_BG[key]} opacity-75 transition-all duration-500`}
                  style={{ width: `${Math.min(actualPct, 100)}%` }} />
                <div className="absolute top-0 bottom-0 w-px bg-white/40" style={{ left: `${Math.min(targetPct,100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rebalancing Actions */}
      <div className="card">
        <h2 className="text-sm font-semibold text-stone-100 mb-4">Rebalancing Actions</h2>
        <div className="space-y-2">
          {gaps.filter(g => Math.abs(g.gap) >= 1).sort((a,b) => Math.abs(b.gap)-Math.abs(a.gap)).map(({ key, gap }) => {
            const delta = (gap / 100) * totalActual;
            const action = gap > 0 ? 'Reduce' : 'Increase';
            const isPos = gap > 0;
            return (
              <div key={key} className={`flex items-center justify-between px-4 py-3 rounded-xl ${isPos ? 'bg-amber-400/8 border border-amber-400/20' : 'bg-emerald-400/8 border border-emerald-400/20'}`}>
                <span className={`text-sm font-medium ${isPos ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {action} <strong>{key}</strong> by {Math.abs(gap).toFixed(1)}%
                </span>
                <span className={`text-sm font-bold tabular-nums ${isPos ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {action === 'Reduce' ? '–' : '+'}{fmtSGD(Math.abs(delta))}
                </span>
              </div>
            );
          })}
          {gaps.every(g => Math.abs(g.gap) < 1) && (
            <div className="flex items-center justify-center gap-2 py-6 text-emerald-400">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              <p className="text-sm font-medium">Portfolio is well-balanced — no actions needed.</p>
            </div>
          )}
        </div>
        <p className="text-xs text-stone-600 mt-4">Targets are set by you. Not financial advice.</p>
      </div>
    </div>
  );
}

Object.assign(window, { PlanPage });
