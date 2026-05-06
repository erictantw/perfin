import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { Plus, Trash2, X, AlertCircle } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { snapshotsApi } from '../lib/api.js';
import { fmtSGD, fmtDate, isoDate } from '../lib/formatters.js';
import { calcNetWorth, buildNetWorthHistory } from '../lib/calculations.js';

const EMPTY_FORM = {
  date: isoDate(), cash: '', investments: '', cpf: '', srs: '', properties: '', loans: '', notes: '',
};

// ── helpers ──────────────────────────────────────────────────────────────────

function snapDate(s) { return s.snapshot_date ?? s.date ?? s.created_at ?? ''; }

function buildChartData(snapshots) {
  return [...snapshots]
    .sort((a, b) => new Date(snapDate(a)) - new Date(snapDate(b)))
    .map((s) => ({
      date: snapDate(s).split('T')[0],
      netWorth:    s.net_worth ?? s.netWorth ?? calcNetWorth(s),
      investments: s.investments || 0,
      cash:        s.cash        || 0,
    }));
}

// Build a 52-week × 7-day contribution heatmap
function buildHeatmap(snapshots) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 363);
  start.setDate(start.getDate() - start.getDay()); // align to Sunday

  const dates = new Set(
    snapshots.map((s) => snapDate(s).split('T')[0])
  );

  const weeks = [];
  let cur = new Date(start);
  for (let w = 0; w < 52; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const iso = cur.toISOString().split('T')[0];
      days.push({ date: iso, active: dates.has(iso), future: cur > today });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
}

function heatmapMonthLabels(weeks) {
  const labels = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const m = new Date(week[0].date).getMonth();
    if (m !== lastMonth) {
      labels.push({ wi, label: new Date(week[0].date).toLocaleString('en-SG', { month: 'short' }) });
      lastMonth = m;
    }
  });
  return labels;
}

// ── modals ───────────────────────────────────────────────────────────────────

function SnapshotModal({ onSave, onClose }) {
  const [form, setForm]     = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const preview = useMemo(() => calcNetWorth({
    cash:        parseFloat(form.cash)        || 0,
    investments: parseFloat(form.investments) || 0,
    cpf:         parseFloat(form.cpf)         || 0,
    srs:         parseFloat(form.srs)         || 0,
    properties:  parseFloat(form.properties)  || 0,
    loans:       parseFloat(form.loans)       || 0,
  }), [form]);

  async function submit(e) {
    e.preventDefault();
    if (!form.date) { setError('Date is required.'); return; }
    setLoading(true);
    setError('');
    try {
      await onSave({
        snapshot_date: form.date,
        net_worth:     preview,
        cash:          parseFloat(form.cash)        || 0,
        investments:   parseFloat(form.investments) || 0,
        cpf:           parseFloat(form.cpf)         || 0,
        srs:           parseFloat(form.srs)         || 0,
        properties:    parseFloat(form.properties)  || 0,
        loans:         parseFloat(form.loans)       || 0,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const FIELDS = [
    { key: 'cash',        label: 'Cash & Savings',   color: '#d97706' },
    { key: 'investments', label: 'Investments',       color: '#059669' },
    { key: 'cpf',         label: 'CPF (OA+SA+MA)',    color: '#3b82f6' },
    { key: 'srs',         label: 'SRS',               color: '#8b5cf6' },
    { key: 'properties',  label: 'Property',          color: '#f59e0b' },
    { key: 'loans',       label: 'Total Loans (–)',   color: '#ef4444' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#e8ddd0] font-medium text-sm">Record Snapshot</h2>
          <button onClick={onClose} className="text-[#57534e] hover:text-[#a8a29e]"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="section-label block mb-1">Date *</label>
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="input" />
          </div>

          {FIELDS.map(({ key, label, color }) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <label className="section-label">{label}</label>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#57534e] text-sm">S$</span>
                <input type="number" step="any" value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  placeholder="0" className="input pl-8" />
              </div>
            </div>
          ))}

          <div className="bg-[#0c0a09] rounded-lg px-3 py-2.5 flex justify-between items-center">
            <span className="section-label">Net Worth</span>
            <span className={`font-semibold tabular-nums ${preview >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtSGD(preview)}
            </span>
          </div>

          <div>
            <label className="section-label block mb-1">Notes</label>
            <input value={form.notes} onChange={(e) => set('notes', e.target.value)}
              placeholder="Optional…" className="input" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle size={13} /><span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving…' : 'Save snapshot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c1917] border border-[#292524] rounded-xl px-3 py-2.5 text-xs shadow-xl min-w-[140px]">
      <p className="text-[#78716c] mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-[#78716c]">{p.name}:</span>
          <span className="text-[#e8ddd0] tabular-nums font-medium">{fmtSGD(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function History() {
  const { data: snapshots, loading, refetch } = useApi('/snapshots');
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting]   = useState(null);

  const sorted = useMemo(() => {
    if (!snapshots) return [];
    return [...snapshots].sort(
      (a, b) => new Date(snapDate(b)) - new Date(snapDate(a))
    );
  }, [snapshots]);

  const chartData    = useMemo(() => buildChartData(snapshots || []), [snapshots]);
  const heatmapWeeks = useMemo(() => buildHeatmap(snapshots || []), [snapshots]);
  const monthLabels  = useMemo(() => heatmapMonthLabels(heatmapWeeks), [heatmapWeeks]);

  const latest   = sorted[0];
  const previous = sorted[1];
  const latestNW = latest ? (latest.netWorth ?? latest.net_worth ?? calcNetWorth(latest)) : null;
  const prevNW   = previous ? (previous.netWorth ?? previous.net_worth ?? calcNetWorth(previous)) : null;
  const change   = latestNW != null && prevNW != null ? latestNW - prevNW : null;

  async function handleSave(payload) {
    await snapshotsApi.create(payload);
    await refetch();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this snapshot?')) return;
    setDeleting(id);
    try {
      await snapshotsApi.delete(id);
      await refetch();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="page-title">Net Worth History</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 shrink-0">
          <Plus size={13} />Record snapshot
        </button>
      </div>

      {/* Latest value header */}
      {latestNW != null && (
        <div className="card">
          <p className="section-label mb-1">Current Net Worth</p>
          <p className="net-worth-num text-[#f0ebe4] tabular-nums"
            style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', lineHeight: 1.1 }}>
            {fmtSGD(latestNW)}
          </p>
          {change != null && (
            <p className={`text-sm mt-1.5 tabular-nums ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {change >= 0 ? '+' : ''}{fmtSGD(change)} vs previous snapshot
            </p>
          )}
        </div>
      )}

      {/* Net Worth chart */}
      {chartData.length > 1 && (
        <div className="card">
          <p className="section-label mb-4">Net Worth Over Time</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#292524" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#78716c', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
                  }}
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#44403c' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#78716c' }} />
                <Area type="monotone" dataKey="netWorth" name="Net Worth"
                  stroke="#059669" strokeWidth={2} fill="url(#histGrad)"
                  dot={chartData.length <= 30}
                  activeDot={{ r: 4, fill: '#059669', stroke: '#1c1917', strokeWidth: 2 }}
                />
                <Line type="monotone" dataKey="investments" name="Investments"
                  stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 2" dot={false}
                  activeDot={{ r: 3, fill: '#3b82f6' }}
                />
                <Line type="monotone" dataKey="cash" name="Cash"
                  stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" dot={false}
                  activeDot={{ r: 3, fill: '#f59e0b' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Activity heatmap */}
      <div className="card">
        <p className="section-label mb-4">Snapshot Activity (52 weeks)</p>
        <div className="overflow-x-auto">
          {/* Month labels */}
          <div style={{ position: 'relative', height: 16, minWidth: 52 * 14 }}>
            {monthLabels.map(({ wi, label }) => (
              <span key={wi} style={{
                position: 'absolute', left: wi * 14,
                fontSize: 10, color: '#78716c', whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 2, minWidth: 52 * 14 }}>
            {heatmapWeeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {week.map((day) => (
                  <div key={day.date} title={day.date} style={{
                    width: 10, height: 10, borderRadius: 2,
                    background: day.future ? 'transparent' : day.active ? '#059669' : '#292524',
                    opacity: day.future ? 0 : 1,
                    transition: 'background 0.15s',
                  }} />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span style={{ fontSize: 10, color: '#57534e' }}>Less</span>
            {['#292524', '#065f46', '#059669', '#34d399'].map((c, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
            ))}
            <span style={{ fontSize: 10, color: '#57534e' }}>More</span>
          </div>
        </div>
      </div>

      {/* Snapshot table */}
      <div className="card overflow-x-auto">
        <p className="section-label mb-4">Snapshot History</p>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div className="text-center py-10">
            <p className="text-[#57534e] text-sm mb-2">No snapshots recorded yet.</p>
            <p className="text-[#44403c] text-xs mb-4">
              Periodically record your balances to track your net worth growth over time.
            </p>
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 mx-auto">
              <Plus size={13} />Record your first snapshot
            </button>
          </div>
        )}

        {!loading && sorted.length > 0 && (
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-[#292524]">
                {['Date','Net Worth','Cash','Investments','CPF','SRS','Loans',''].map((h) => (
                  <th key={h} className="section-label text-left pb-2 pr-3 last:pr-0 last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#292524]/50">
              {sorted.map((snap, idx) => {
                const nw   = snap.netWorth ?? snap.net_worth ?? calcNetWorth(snap);
                const prev = sorted[idx + 1];
                const prevNW = prev ? (prev.netWorth ?? prev.net_worth ?? calcNetWorth(prev)) : null;
                const diff = prevNW != null ? nw - prevNW : null;
                return (
                  <tr key={snap.id} className="hover:bg-white/2 transition-colors">
                    <td className="py-2.5 pr-3 text-[#a8a29e] tabular-nums whitespace-nowrap">
                      {fmtDate(snapDate(snap))}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold tabular-nums text-emerald-400">{fmtSGD(nw)}</span>
                      {diff != null && (
                        <span className={`text-xs ml-2 tabular-nums ${diff >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                          {diff >= 0 ? '+' : ''}{fmtSGD(diff)}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-[#78716c]">
                      {snap.cash ? fmtSGD(snap.cash) : '—'}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-[#78716c]">
                      {snap.investments ? fmtSGD(snap.investments) : '—'}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-[#78716c]">
                      {snap.cpf ? fmtSGD(snap.cpf) : '—'}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-[#78716c]">
                      {snap.srs ? fmtSGD(snap.srs) : '—'}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-red-400/70">
                      {snap.loans ? fmtSGD(snap.loans) : '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(snap.id)}
                        disabled={deleting === snap.id}
                        className="p-1.5 rounded-lg text-[#57534e] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <SnapshotModal onSave={handleSave} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
