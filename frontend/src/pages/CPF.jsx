import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { Save, Info } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { cpfApi } from '../lib/api.js';
import { fmtSGD, fmtDate } from '../lib/formatters.js';
import { CPF_RATES, FRS_2024, projectCpfGrowth, frsAtAge } from '../lib/calculations.js';

function ProjectionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c1917] border border-[#292524] rounded-xl px-3 py-2.5 text-xs shadow-xl space-y-1">
      <p className="text-[#78716c] mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[#a8a29e]">{p.name}:</span>
          <span className="text-[#e8ddd0] tabular-nums">{fmtSGD(p.value)}</span>
        </div>
      ))}
      {payload[0]?.payload?.total != null && (
        <div className="border-t border-[#292524] pt-1 flex justify-between">
          <span className="text-[#57534e]">Total</span>
          <span className="text-emerald-400 tabular-nums">{fmtSGD(payload[0].payload.total)}</span>
        </div>
      )}
    </div>
  );
}

export default function CPF() {
  const { data: cpf, loading, refetch } = useApi('/cpf');

  const [form, setForm] = useState({ oa: '', sa: '', ma: '', age: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  // Populate form when data loads
  React.useEffect(() => {
    if (cpf) {
      setForm({
        oa:  cpf.oa  ?? '',
        sa:  cpf.sa  ?? '',
        ma:  cpf.ma  ?? '',
        age: cpf.age ?? '',
      });
    }
  }, [cpf]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const oa    = parseFloat(form.oa)  || 0;
  const sa    = parseFloat(form.sa)  || 0;
  const ma    = parseFloat(form.ma)  || 0;
  const age   = parseInt(form.age)   || null;
  const total = oa + sa + ma;

  const projection = useMemo(() => projectCpfGrowth(oa, sa, ma, 30), [oa, sa, ma]);

  const targetFRS = useMemo(() => {
    if (!age) return FRS_2024;
    return frsAtAge(age, 55);
  }, [age]);

  const saAtFiftyFive = useMemo(() => {
    if (!age || age >= 55) return sa;
    const yearsTo55 = 55 - age;
    const saIdx = Math.min(yearsTo55, projection.length - 1);
    return projection[saIdx]?.sa || 0;
  }, [age, sa, projection]);

  const frsProgress = targetFRS > 0 ? Math.min((saAtFiftyFive / targetFRS) * 100, 100) : 0;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await cpfApi.update({
        oa: parseFloat(form.oa) || 0,
        sa: parseFloat(form.sa) || 0,
        ma: parseFloat(form.ma) || 0,
        age: parseInt(form.age) || null,
        updatedAt: new Date().toISOString(),
      });
      await refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="page-title">CPF Accounts</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Input form */}
        <div className="card lg:col-span-1 self-start">
          <p className="section-label mb-4">Current Balances</p>
          <form onSubmit={handleSave} className="space-y-3">
            {[
              { key: 'oa', label: 'Ordinary Account (OA)', rate: CPF_RATES.OA, color: '#3b82f6' },
              { key: 'sa', label: 'Special Account (SA)',  rate: CPF_RATES.SA, color: '#8b5cf6' },
              { key: 'ma', label: 'MediSave (MA)',         rate: CPF_RATES.MA, color: '#10b981' },
            ].map(({ key, label, rate, color }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="section-label">{label}</label>
                  <span className="text-xs text-[#57534e]">{(rate * 100).toFixed(1)}% p.a.</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#57534e] text-sm">S$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    placeholder="0"
                    className="input pl-8"
                  />
                </div>
              </div>
            ))}

            <div>
              <label className="section-label block mb-1">Current Age</label>
              <input
                type="number"
                value={form.age}
                onChange={(e) => set('age', e.target.value)}
                placeholder="e.g. 32"
                className="input"
                min={18}
                max={80}
              />
              <p className="text-xs text-[#57534e] mt-1">Used to project your FRS at 55.</p>
            </div>

            {/* Total */}
            <div className="bg-[#0c0a09] rounded-lg px-3 py-2.5 flex justify-between items-center">
              <span className="section-label">Total</span>
              <span className="text-[#e8ddd0] font-semibold tabular-nums">{fmtSGD(total)}</span>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Save size={13} />
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save balances'}
            </button>
          </form>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* FRS progress */}
          {age != null && age < 55 && (
            <div className="card">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="section-label mb-1">FRS Progress (at age 55)</p>
                  <p className="text-[#e8ddd0] text-sm">
                    Projected SA: <span className="font-semibold tabular-nums text-[#f0ebe4]">{fmtSGD(saAtFiftyFive)}</span>
                    {' '}/ <span className="text-[#78716c]">{fmtSGD(targetFRS)} FRS</span>
                  </p>
                </div>
                <span className={`text-lg font-bold tabular-nums ${frsProgress >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {frsProgress.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-[#292524] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${frsProgress}%`,
                    backgroundColor: frsProgress >= 100 ? '#059669' : frsProgress >= 60 ? '#d97706' : '#ef4444',
                  }}
                />
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <Info size={11} className="text-[#57534e] shrink-0" />
                <p className="text-xs text-[#57534e]">
                  FRS estimate for {55 - age} years from now (~{targetFRS > FRS_2024 ? '3.5%' : '0%'} annual increase).
                </p>
              </div>
            </div>
          )}

          {/* Projection chart */}
          {total > 0 && (
            <div className="card">
              <p className="section-label mb-4">30-Year Projection</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projection} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      {[
                        { id: 'oa', color: '#3b82f6' },
                        { id: 'sa', color: '#8b5cf6' },
                        { id: 'ma', color: '#10b981' },
                      ].map(({ id, color }) => (
                        <linearGradient key={id} id={`cpf-${id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid stroke="#292524" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: '#78716c', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval={4}
                    />
                    <YAxis
                      hide
                      tickFormatter={(v) => fmtSGD(v, true)}
                    />
                    <Tooltip content={<ProjectionTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', color: '#78716c', paddingTop: '8px' }}
                    />
                    {[
                      { key: 'oa', color: '#3b82f6', name: 'OA' },
                      { key: 'sa', color: '#8b5cf6', name: 'SA' },
                      { key: 'ma', color: '#10b981', name: 'MA' },
                    ].map(({ key, color, name }) => (
                      <Area
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={name}
                        stroke={color}
                        strokeWidth={1.5}
                        fill={`url(#cpf-${key})`}
                        dot={false}
                        stackId="1"
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-[#57534e] mt-2 flex items-center gap-1.5">
                <Info size={11} />
                Projection assumes no additional contributions — interest only.
              </p>
            </div>
          )}

          {/* Account breakdown */}
          <div className="card">
            <p className="section-label mb-4">Account Summary</p>
            <div className="space-y-3">
              {[
                { label: 'Ordinary Account (OA)', value: oa, rate: CPF_RATES.OA, color: '#3b82f6',
                  note: 'Use for housing, education, investment' },
                { label: 'Special Account (SA)',  value: sa, rate: CPF_RATES.SA, color: '#8b5cf6',
                  note: 'Retirement savings, counts towards FRS' },
                { label: 'MediSave (MA)',         value: ma, rate: CPF_RATES.MA, color: '#10b981',
                  note: 'Healthcare & approved insurance' },
              ].map(({ label, value, rate, color, note }) => (
                <div key={label} className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: color }} />
                    <div className="min-w-0">
                      <p className="text-[#a8a29e] text-sm font-medium">{label}</p>
                      <p className="text-[#57534e] text-xs truncate">{note}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[#e8ddd0] tabular-nums font-medium">{fmtSGD(value)}</p>
                    <p className="text-[#57534e] text-xs">{(value * rate).toFixed(0) !== '0' ? `+${fmtSGD(value * rate)}/yr` : '—'}</p>
                  </div>
                </div>
              ))}
              <div className="border-t border-[#292524] pt-3 flex justify-between">
                <span className="text-[#78716c] text-sm font-medium">Total CPF</span>
                <span className="text-emerald-400 tabular-nums font-semibold">{fmtSGD(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
