import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell,
} from 'recharts';
import { Plus, Trash2, Edit2, TrendingUp, TrendingDown, X, AlertCircle } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { api, investmentsApi } from '../lib/api.js';
import { fmtSGD, fmtPct, fmtDate } from '../lib/formatters.js';
import { calcXIRR } from '../lib/calculations.js';

const EMPTY_FORM = {
  ticker: '', name: '', assetClass: 'Equity', currency: 'SGD',
  units: '', avgCost: '', currentPrice: '', purchaseDate: '', notes: '',
};

function InvestmentModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const cost  = parseFloat(form.units) * parseFloat(form.avgCost)    || 0;
  const value = parseFloat(form.units) * parseFloat(form.currentPrice) || 0;
  const gain  = value - cost;

  async function submit(e) {
    e.preventDefault();
    if (!form.ticker || !form.units || !form.currentPrice) {
      setError('Ticker, units, and current price are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        units:         parseFloat(form.units),
        avgCost:       parseFloat(form.avgCost)      || 0,
        currentPrice:  parseFloat(form.currentPrice),
        currentValue:  parseFloat(form.units) * parseFloat(form.currentPrice),
      };
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#e8ddd0] font-medium text-sm">{initial?.id ? 'Edit Investment' : 'Add Investment'}</h2>
          <button onClick={onClose} className="text-[#57534e] hover:text-[#a8a29e]"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1">Ticker *</label>
              <input value={form.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase())}
                placeholder="CSPX" className="input" />
            </div>
            <div>
              <label className="section-label block mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="input">
                {['SGD','USD','GBP','EUR','HKD','JPY','AUD'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="section-label block mb-1">Name</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="iShares Core S&P 500 UCITS ETF" className="input" />
          </div>

          <div>
            <label className="section-label block mb-1">Asset Class</label>
            <select value={form.assetClass} onChange={(e) => set('assetClass', e.target.value)} className="input">
              {['Equity','Bond','REIT','ETF','Crypto','Cash Equivalent','Other'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1">Units *</label>
              <input type="number" step="any" value={form.units} onChange={(e) => set('units', e.target.value)}
                placeholder="100" className="input" />
            </div>
            <div>
              <label className="section-label block mb-1">Avg Cost / Unit</label>
              <input type="number" step="any" value={form.avgCost} onChange={(e) => set('avgCost', e.target.value)}
                placeholder="450.00" className="input" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1">Current Price *</label>
              <input type="number" step="any" value={form.currentPrice} onChange={(e) => set('currentPrice', e.target.value)}
                placeholder="520.00" className="input" />
            </div>
            <div>
              <label className="section-label block mb-1">Purchase Date</label>
              <input type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} className="input" />
            </div>
          </div>

          {/* P&L preview */}
          {cost > 0 && value > 0 && (
            <div className="bg-[#0c0a09] rounded-lg px-3 py-2.5 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-[#57534e]">Cost</p>
                <p className="text-[#e8ddd0] tabular-nums">{fmtSGD(cost)}</p>
              </div>
              <div>
                <p className="text-[#57534e]">Value</p>
                <p className="text-[#e8ddd0] tabular-nums">{fmtSGD(value)}</p>
              </div>
              <div>
                <p className="text-[#57534e]">P&L</p>
                <p className={`tabular-nums font-medium ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {gain >= 0 ? '+' : ''}{fmtSGD(gain)}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="section-label block mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
              rows={2} placeholder="Optional notes…" className="input resize-none" />
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
    </div>
  );
}

export default function Investments() {
  const { data: investments, loading, refetch } = useApi('/investments');
  const [modal, setModal]       = useState(null); // null | 'add' | investment object
  const [deleting, setDeleting] = useState(null);

  const sorted = useMemo(() => {
    if (!investments) return [];
    return [...investments].sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0));
  }, [investments]);

  const totals = useMemo(() => {
    const cost  = sorted.reduce((s, i) => s + (i.units * i.avgCost || 0), 0);
    const value = sorted.reduce((s, i) => s + (i.currentValue || 0), 0);
    return { cost, value, gain: value - cost, pct: cost ? ((value - cost) / cost) * 100 : 0 };
  }, [sorted]);

  const chartData = useMemo(() => {
    const byClass = {};
    sorted.forEach((inv) => {
      const cls = inv.assetClass || 'Other';
      byClass[cls] = (byClass[cls] || 0) + (inv.currentValue || 0);
    });
    return Object.entries(byClass)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [sorted]);

  const BAR_COLORS = ['#059669', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

  async function handleSave(payload) {
    if (payload.id) {
      await investmentsApi.update(payload.id, payload);
    } else {
      await investmentsApi.create(payload);
    }
    await refetch();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this investment?')) return;
    setDeleting(id);
    try {
      await investmentsApi.delete(id);
      await refetch();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="page-title">Investments</h1>
        <button onClick={() => setModal('add')} className="btn-primary flex items-center gap-1.5 shrink-0">
          <Plus size={13} />Add holding
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Market Value', value: fmtSGD(totals.value, true), color: 'text-[#e8ddd0]' },
          { label: 'Cost Basis',   value: fmtSGD(totals.cost,  true), color: 'text-[#78716c]' },
          { label: 'Unrealised P&L', value: `${totals.gain >= 0 ? '+' : ''}${fmtSGD(totals.gain, true)}`,
            color: totals.gain >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Total Return',  value: fmtPct(totals.pct),
            color: totals.pct >= 0 ? 'text-emerald-400' : 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card">
            <p className="section-label mb-1">{label}</p>
            <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Allocation chart */}
      {chartData.length > 0 && (
        <div className="card">
          <p className="section-label mb-4">By Asset Class</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#292524" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#78716c', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Holdings table */}
      <div className="card overflow-x-auto">
        <p className="section-label mb-4">Holdings</p>
        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
          </div>
        )}
        {!loading && sorted.length === 0 && (
          <div className="text-center py-10">
            <p className="text-[#57534e] text-sm">No investments recorded yet.</p>
            <button onClick={() => setModal('add')} className="btn-primary mt-3 flex items-center gap-1.5 mx-auto">
              <Plus size={13} />Add your first holding
            </button>
          </div>
        )}
        {!loading && sorted.length > 0 && (
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-[#292524]">
                {['Ticker', 'Name', 'Units', 'Avg Cost', 'Price', 'Value', 'P&L', ''].map((h) => (
                  <th key={h} className="section-label text-left pb-2 pr-4 last:pr-0 last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#292524]/50">
              {sorted.map((inv) => {
                const cost  = (inv.units || 0) * (inv.avgCost || 0);
                const value = inv.currentValue || 0;
                const gain  = value - cost;
                const pct   = cost ? (gain / cost) * 100 : 0;
                const Icon  = gain >= 0 ? TrendingUp : TrendingDown;
                return (
                  <tr key={inv.id} className="hover:bg-white/2 transition-colors">
                    <td className="py-3 pr-4 font-semibold text-[#e8ddd0]">{inv.ticker}</td>
                    <td className="py-3 pr-4 text-[#78716c] max-w-[160px] truncate">{inv.name || '—'}</td>
                    <td className="py-3 pr-4 tabular-nums text-[#a8a29e]">{inv.units}</td>
                    <td className="py-3 pr-4 tabular-nums text-[#78716c]">{fmtSGD(inv.avgCost)}</td>
                    <td className="py-3 pr-4 tabular-nums text-[#a8a29e]">{fmtSGD(inv.currentPrice)}</td>
                    <td className="py-3 pr-4 tabular-nums font-medium text-[#e8ddd0]">{fmtSGD(value)}</td>
                    <td className="py-3 pr-4">
                      <div className={`flex items-center gap-1 ${gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        <Icon size={12} />
                        <span className="tabular-nums text-xs">{fmtPct(pct)}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setModal(inv)}
                          className="p-1.5 rounded-lg text-[#57534e] hover:text-[#a8a29e] hover:bg-white/5 transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(inv.id)}
                          disabled={deleting === inv.id}
                          className="p-1.5 rounded-lg text-[#57534e] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#292524]">
                <td colSpan={5} className="pt-3 text-[#57534e] text-xs">Total ({sorted.length} holdings)</td>
                <td className="pt-3 tabular-nums font-semibold text-[#e8ddd0]">{fmtSGD(totals.value)}</td>
                <td className={`pt-3 tabular-nums text-xs font-medium ${totals.gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totals.gain >= 0 ? '+' : ''}{fmtSGD(totals.gain)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {(modal === 'add' || (modal && typeof modal === 'object')) && (
        <InvestmentModal
          initial={modal === 'add' ? {} : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
