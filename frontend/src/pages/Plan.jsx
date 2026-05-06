import React, { useState, useEffect, useMemo } from 'react';
import { Save, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { api } from '../lib/api.js';
import { fmtSGD, fmtPct } from '../lib/formatters.js';
import { calcAllocationGaps } from '../lib/calculations.js';

const ASSET_CLASSES = [
  { key: 'cash',        label: 'Cash & Savings', color: '#d97706' },
  { key: 'investments', label: 'Investments',     color: '#059669' },
  { key: 'cpf',         label: 'CPF',             color: '#3b82f6' },
  { key: 'properties',  label: 'Properties',      color: '#f59e0b' },
];

const DEFAULT_TARGETS = { cash: 25, investments: 50, cpf: 20, properties: 5 };

function SliderRow({ assetClass, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#a8a29e]">{assetClass.label}</label>
        <span className="text-sm font-semibold tabular-nums" style={{ color: assetClass.color }}>
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${assetClass.color} ${value}%, #292524 ${value}%)`,
          accentColor: assetClass.color,
        }}
      />
    </div>
  );
}

export default function Plan() {
  const { data: profile }   = useApi('/profile');
  const { data: snapshots } = useApi('/snapshots');

  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  // Load saved targets from profile
  useEffect(() => {
    if (!profile) return;
    try {
      const raw = profile.rebalanceTargets || profile.rebalance_targets;
      if (!raw) return;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      setTargets({ ...DEFAULT_TARGETS, ...parsed });
    } catch {
      // keep defaults
    }
  }, [profile]);

  // Derive actual allocation from the latest snapshot
  const actual = useMemo(() => {
    if (!snapshots?.length) return { cash: 0, investments: 0, cpf: 0, properties: 0 };
    const sorted = [...snapshots].sort(
      (a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at)
    );
    const snap = sorted[0];
    return {
      cash:        snap.cash        || 0,
      investments: snap.investments || 0,
      cpf:         snap.cpf         || 0,
      properties:  snap.properties  || 0,
    };
  }, [snapshots]);

  const sum = Object.values(targets).reduce((s, v) => s + v, 0);

  const gaps = useMemo(() => calcAllocationGaps(actual, targets), [actual, targets]);
  const totalActual = Object.values(actual).reduce((s, v) => s + v, 0);

  const rebalanceActions = useMemo(
    () => gaps.filter((g) => Math.abs(g.gapPct) >= 1).sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct)),
    [gaps]
  );

  function setTarget(key, value) {
    setTargets((t) => ({ ...t, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (sum !== 100) { setError('Targets must sum to exactly 100%.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.patch('/profile', { rebalanceTargets: targets });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="page-title">Portfolio Plan</h1>
        <button
          onClick={handleSave}
          disabled={saving || sum !== 100}
          className="btn-primary flex items-center gap-1.5 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={13} />
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save targets'}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Target sliders */}
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-[#e8ddd0] font-medium text-sm">Target Allocation</p>
            <span className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full ${
              sum === 100 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {sum}%{sum === 100 ? ' ✓' : ` (${sum > 100 ? '+' : ''}${sum - 100})`}
            </span>
          </div>

          {ASSET_CLASSES.map((ac) => (
            <SliderRow
              key={ac.key}
              assetClass={ac}
              value={targets[ac.key] ?? 0}
              onChange={(v) => setTarget(ac.key, v)}
            />
          ))}

          {sum !== 100 && (
            <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <Info size={13} className="shrink-0" />
              <span>Targets must sum to 100%. Currently at {sum}%.</span>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {/* Quick-set presets */}
          <div>
            <p className="section-label mb-2">Presets</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Aggressive', values: { cash: 10, investments: 70, cpf: 15, properties: 5 } },
                { label: 'Balanced',   values: { cash: 20, investments: 55, cpf: 20, properties: 5 } },
                { label: 'Conservative', values: { cash: 30, investments: 35, cpf: 30, properties: 5 } },
              ].map(({ label, values }) => (
                <button
                  key={label}
                  onClick={() => { setTargets(values); setSaved(false); }}
                  className="btn-secondary text-[10px] py-1 px-2.5"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actual vs Target */}
        <div className="card">
          <p className="text-[#e8ddd0] font-medium text-sm mb-4">Actual vs Target</p>

          {totalActual === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#57534e] text-sm">No portfolio data yet.</p>
              <p className="text-[#44403c] text-xs mt-1">Add a snapshot on the History page to see your allocation.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {ASSET_CLASSES.map((ac) => {
                const gap = gaps.find((g) => g.assetClass === ac.key);
                if (!gap) return null;
                const Icon = gap.gapPct > 0 ? TrendingUp : gap.gapPct < 0 ? TrendingDown : Minus;
                const gapColor = gap.gapPct > 0 ? 'text-emerald-400' : gap.gapPct < 0 ? 'text-red-400' : 'text-[#57534e]';
                return (
                  <div key={ac.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ac.color }} />
                        <span className="text-sm text-[#a8a29e]">{ac.label}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs tabular-nums">
                        <span className="text-[#78716c]">
                          {fmtSGD(actual[ac.key])} ({gap.actualPct}%)
                        </span>
                        <span className="text-[#44403c]">→</span>
                        <span style={{ color: ac.color }}>{gap.targetPct}%</span>
                        <span className={`flex items-center gap-0.5 font-semibold ${gapColor}`}>
                          <Icon size={10} />
                          {Math.abs(gap.gapPct)}%
                        </span>
                      </div>
                    </div>
                    {/* Dual bar: actual vs target */}
                    <div className="relative h-2 rounded-full bg-[#292524] overflow-visible">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, gap.actualPct)}%`,
                          backgroundColor: ac.color,
                          opacity: 0.65,
                        }}
                      />
                      {/* Target marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 rounded-full"
                        style={{ left: `${Math.min(100, gap.targetPct)}%`, backgroundColor: ac.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Rebalancing recommendations */}
      {rebalanceActions.length > 0 && (
        <div className="card">
          <p className="text-[#e8ddd0] font-medium text-sm mb-4">Rebalancing Recommendations</p>
          <div className="space-y-3">
            {rebalanceActions.map((g) => {
              const ac    = ASSET_CLASSES.find((a) => a.key === g.assetClass);
              const isBuy = g.gapPct > 0;
              return (
                <div
                  key={g.assetClass}
                  className="flex items-center justify-between gap-4 p-3 rounded-xl border border-[#292524] bg-[#0c0a09]"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: `${ac?.color}20`, color: ac?.color }}
                    >
                      {isBuy ? '↑' : '↓'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#a8a29e]">{ac?.label}</p>
                      <p className="text-xs text-[#57534e]">
                        {isBuy ? 'Increase' : 'Reduce'} by {Math.abs(g.gapPct)}%
                        {' '}({fmtSGD(Math.abs(g.gapAmt))})
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    isBuy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {isBuy ? 'Buy' : 'Sell/Reduce'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <Info size={11} className="text-[#57534e] shrink-0" />
            <p className="text-xs text-[#57534e]">
              Only shows assets with ≥1% deviation from target. Based on your latest snapshot.
            </p>
          </div>
        </div>
      )}

      {/* Info card */}
      <div className="card border-emerald-500/10 bg-emerald-500/3">
        <p className="section-label mb-3">Planning Tips</p>
        <ul className="space-y-2 text-xs text-[#78716c]">
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">•</span>
            Review and rebalance your portfolio <strong className="text-[#a8a29e]">quarterly</strong> or when drift exceeds 5%.
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">•</span>
            Prioritise <strong className="text-[#a8a29e]">CPF Special Account</strong> top-ups for tax relief and higher guaranteed interest.
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">•</span>
            Consider <strong className="text-[#a8a29e]">SRS contributions</strong> before year-end for immediate tax savings.
          </li>
          <li className="flex gap-2">
            <span className="text-emerald-400 shrink-0">•</span>
            An emergency fund of <strong className="text-[#a8a29e]">3–6 months</strong> of expenses is recommended in Cash.
          </li>
        </ul>
      </div>
    </div>
  );
}
