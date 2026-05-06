import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell,
} from 'recharts';
import { Plus, Trash2, Edit2, X, AlertCircle } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { dividendsApi } from '../lib/api.js';
import { fmtSGD, fmtDate, isoDate } from '../lib/formatters.js';
import { calcRunRate, buildDividendMonthlyData } from '../lib/calculations.js';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const EMPTY_FORM = {
  ticker: '', name: '', amount: '', date: isoDate(), currency: 'SGD',
  type: 'Dividend', notes: '',
};

function DividendModal({ initial, onSave, onClose }) {
  const [form, setForm]     = useState({ ...EMPTY_FORM, ...initial });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.ticker || !form.amount || !form.date) {
      setError('Ticker, amount, and date are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSave({ ...form, amount: parseFloat(form.amount) });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#e8ddd0] font-medium text-sm">
            {initial?.id ? 'Edit Dividend' : 'Record Dividend'}
          </h2>
          <button onClick={onClose} className="text-[#57534e] hover:text-[#a8a29e]"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1">Ticker *</label>
              <input value={form.ticker}
                onChange={(e) => set('ticker', e.target.value.toUpperCase())}
                placeholder="CSPX" className="input" />
            </div>
            <div>
              <label className="section-label block mb-1">Type</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className="input">
                {['Dividend','Distribution','Special','Scrip','Interest'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="section-label block mb-1">Company / Fund Name</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="iShares Core S&P 500" className="input" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#57534e] text-sm">S$</span>
                <input type="number" step="0.01" value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  placeholder="0.00" className="input pl-8" />
              </div>
            </div>
            <div>
              <label className="section-label block mb-1">Date *</label>
              <input type="date" value={form.date}
                onChange={(e) => set('date', e.target.value)} className="input" />
            </div>
          </div>

          <div>
            <label className="section-label block mb-1">Currency</label>
            <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="input">
              {['SGD','USD','GBP','EUR','HKD','AUD'].map((c) => <option key={c}>{c}</option>)}
            </select>
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
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c1917] border border-[#292524] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-[#78716c] mb-1">{label}</p>
      <p className="text-[#e8ddd0] tabular-nums">{fmtSGD(payload[0].value)}</p>
      {payload[0].payload.count != null && (
        <p className="text-[#57534e]">{payload[0].payload.count} payment{payload[0].payload.count !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

export default function Dividends() {
  const { data: dividends, loading, refetch } = useApi('/dividends');
  const [modal, setModal]       = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [filterTicker, setFilterTicker] = useState('');

  const sorted = useMemo(() => {
    if (!dividends) return [];
    return [...dividends].sort((a, b) => new Date(b.date || b.ex_date) - new Date(a.date || a.ex_date));
  }, [dividends]);

  const filtered = useMemo(() => {
    if (!filterTicker) return sorted;
    return sorted.filter((d) => (d.ticker || '').toUpperCase().includes(filterTicker.toUpperCase()));
  }, [sorted, filterTicker]);

  const runRate      = useMemo(() => calcRunRate(sorted), [sorted]);
  const monthlyData  = useMemo(() => buildDividendMonthlyData(sorted), [sorted]);
  const totalAllTime = useMemo(() => sorted.reduce((s, d) => s + (d.amount || 0), 0), [sorted]);

  // Build last-12-months calendar
  const calendarYear = new Date().getFullYear();
  const calendar = useMemo(() => MONTHS_SHORT.map((m, i) => ({
    month: m,
    items: sorted.filter((d) => {
      const dt = new Date(d.date || d.ex_date);
      return dt.getFullYear() === calendarYear && dt.getMonth() === i;
    }),
  })), [sorted, calendarYear]);

  const byTicker = useMemo(() => {
    const map = {};
    sorted.forEach((d) => {
      if (!map[d.ticker]) map[d.ticker] = { ticker: d.ticker, name: d.name, total: 0, count: 0 };
      map[d.ticker].total += d.amount || 0;
      map[d.ticker].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [sorted]);

  async function handleSave(payload) {
    if (payload.id) {
      await dividendsApi.update(payload.id, payload);
    } else {
      await dividendsApi.create(payload);
    }
    await refetch();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this dividend record?')) return;
    setDeleting(id);
    try {
      await dividendsApi.delete(id);
      await refetch();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="page-title">Dividends</h1>
        <button onClick={() => setModal('add')} className="btn-primary flex items-center gap-1.5 shrink-0">
          <Plus size={13} />Record dividend
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card">
          <p className="section-label mb-1">12-Month Run Rate</p>
          <p className="text-xl font-semibold tabular-nums text-emerald-400">{fmtSGD(runRate)}</p>
          <p className="text-xs text-[#57534e] mt-0.5">{fmtSGD(runRate / 12)}/month avg</p>
        </div>
        <div className="card">
          <p className="section-label mb-1">All-Time Total</p>
          <p className="text-xl font-semibold tabular-nums text-[#e8ddd0]">{fmtSGD(totalAllTime)}</p>
          <p className="text-xs text-[#57534e] mt-0.5">{sorted.length} payments</p>
        </div>
        <div className="card col-span-2 sm:col-span-1">
          <p className="section-label mb-1">Top Payer</p>
          {byTicker[0] ? (
            <>
              <p className="text-xl font-semibold text-[#e8ddd0]">{byTicker[0].ticker}</p>
              <p className="text-xs text-[#57534e] mt-0.5">{fmtSGD(byTicker[0].total)} total</p>
            </>
          ) : (
            <p className="text-[#57534e] text-sm">—</p>
          )}
        </div>
      </div>

      {/* Monthly chart */}
      {monthlyData.length > 1 && (
        <div className="card">
          <p className="section-label mb-4">Monthly Income (All Time)</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#292524" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#78716c', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis hide />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                  {monthlyData.map((d, i) => (
                    <Cell key={i} fill={d.amount > 0 ? '#059669' : '#292524'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Dividend calendar */}
      <div className="card">
        <p className="section-label mb-4">Dividend Calendar {calendarYear}</p>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {calendar.map(({ month, items }) => (
            <div
              key={month}
              className={`rounded-xl p-3 border transition-colors ${
                items.length > 0
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'bg-[#292524]/40 border-[#292524]'
              }`}
            >
              <p className="text-xs font-semibold text-[#78716c] mb-1">{month}</p>
              {items.length === 0 ? (
                <p className="text-xs text-[#44403c]">—</p>
              ) : (
                <div className="space-y-0.5">
                  {items.slice(0, 3).map((d, i) => (
                    <p key={i} className="text-xs text-emerald-400 font-medium truncate">{d.ticker}</p>
                  ))}
                  {items.length > 3 && (
                    <p className="text-xs text-[#57534e]">+{items.length - 3}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Transaction log */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 gap-3">
          <p className="section-label">Transaction Log</p>
          <input
            value={filterTicker}
            onChange={(e) => setFilterTicker(e.target.value)}
            placeholder="Filter by ticker…"
            className="input w-36 py-1 text-xs"
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-[#57534e] text-sm">No dividend records yet.</p>
            <button onClick={() => setModal('add')} className="btn-primary mt-3 flex items-center gap-1.5 mx-auto">
              <Plus size={13} />Record your first dividend
            </button>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-[#292524]">
                  {['Date','Ticker','Type','Amount',''].map((h) => (
                    <th key={h} className="section-label text-left pb-2 pr-4 last:pr-0 last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#292524]/50">
                {filtered.map((div) => (
                  <tr key={div.id} className="hover:bg-white/2 transition-colors">
                    <td className="py-2.5 pr-4 text-[#78716c] tabular-nums whitespace-nowrap">
                      {fmtDate(div.date || div.ex_date)}
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-[#e8ddd0]">{div.ticker}</td>
                    <td className="py-2.5 pr-4">
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                        {div.type || div.confidence_tier || 'Dividend'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums font-medium text-emerald-400">
                      +{fmtSGD(div.amount)}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setModal(div)}
                          className="p-1.5 rounded-lg text-[#57534e] hover:text-[#a8a29e] hover:bg-white/5 transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(div.id)}
                          disabled={deleting === div.id}
                          className="p-1.5 rounded-lg text-[#57534e] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(modal === 'add' || (modal && typeof modal === 'object')) && (
        <DividendModal
          initial={modal === 'add' ? {} : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
