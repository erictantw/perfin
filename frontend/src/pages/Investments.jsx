import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, CartesianGrid, Cell,
} from 'recharts';
import {
  Plus, RefreshCw, TrendingUp, TrendingDown, ChevronDown, X, AlertCircle,
} from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { api, investmentsApi, transactionsApi, pricesApi } from '../lib/api.js';
import { fmtSGD, fmtPct, isoDate } from '../lib/formatters.js';

// ── helpers ───────────────────────────────────────────────────────────────────

const CURRENCIES = ['SGD', 'USD', 'GBP', 'EUR', 'HKD', 'JPY', 'AUD'];
const ASSET_TYPES = ['Equity', 'Bond', 'REIT', 'ETF', 'Crypto', 'Cash Equivalent', 'Other'];
const GEO_LABELS = {
  singapore: 'Singapore', us: 'US', uk: 'UK / Ireland', australia: 'Australia',
  japan: 'Japan', hongkong: 'Hong Kong', malaysia: 'Malaysia', crypto: 'Crypto', other: 'Global / Other',
};

const FX = { USD: 1.34, GBP: 1.69, EUR: 1.45, HKD: 0.17, JPY: 0.0089, AUD: 0.87, SGD: 1 };
function toSGD(amount, ccy = 'SGD') { return amount * (FX[ccy] || 1); }

function daysBetween(a, b = new Date()) {
  return Math.round((new Date(b) - new Date(a)) / 86_400_000);
}

function computeHolding(h) {
  const txns = h.transactions || [];
  const buys  = txns.filter(t => t.txn_type === 'buy');
  const sells = txns.filter(t => t.txn_type === 'sell');
  const buyUnits  = buys.reduce((s, t) => s + (t.units || 0), 0);
  const sellUnits = sells.reduce((s, t) => s + (t.units || 0), 0);
  const units = txns.length > 0 ? Math.max(buyUnits - sellUnits, 0) : (h.units || 0);
  const buyCost = buys.reduce((s, t) => s + (t.units || 0) * (t.price || 0), 0);
  const avg_cost = buyUnits > 0 ? buyCost / buyUnits : (h.avg_cost || 0);
  const price = h.current_price || avg_cost;
  const costBasis = toSGD(units * avg_cost, h.currency);
  const value     = toSGD(units * price,    h.currency);
  const pnl       = value - costBasis;
  const pnlPct    = costBasis ? (pnl / costBasis) * 100 : 0;
  return { ...h, units, avg_cost, current_price: price, costBasis, value, pnl, pnlPct };
}

// ── Position Timeline ─────────────────────────────────────────────────────────

function PositionTimeline({ transactions }) {
  const buys = (transactions || []).filter(t => t.txn_type === 'buy').sort(
    (a, b) => new Date(a.txn_date) - new Date(b.txn_date)
  );
  if (buys.length === 0) return null;

  const first = buys[0].txn_date;
  const last  = buys[buys.length - 1].txn_date;
  const daysOld   = daysBetween(first);
  const daysSince = daysBetween(last);
  const lots = buys.length;

  const dotPct = buys.length > 1
    ? Math.round((daysBetween(first, last) / Math.max(daysOld, 1)) * 100)
    : 100;

  return (
    <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="text-xs font-semibold" style={{ color: '#a8a29e' }}>
          {lots} lot{lots !== 1 ? 's' : ''} over {daysOld}d
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1"
          style={{ background: 'rgba(212,160,82,0.12)', border: '1px solid rgba(212,160,82,0.25)', color: '#d4a052' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d4a052' }} />
          Last added {daysSince}d ago
        </span>
      </div>
      <div className="relative h-12">
        <div className="absolute left-3 right-3 top-1/2 h-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.08)', marginTop: -1 }} />
        <div className="absolute left-3 top-8 text-[11px]" style={{ color: '#57534e' }}>{first}</div>
        <div className="absolute right-3 top-7 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#57534e' }}>Today</div>
        <div className="absolute w-6 h-6 rounded-full -translate-y-1/2 -translate-x-1/2 z-10 top-1/2"
          style={{ left: `calc(${Math.min(dotPct, 98)}% - 0px)`, background: '#d4a052', border: '2px solid rgba(0,0,0,0.35)' }} />
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[11px]" style={{ color: '#57534e' }}>Older</span>
        {[60, 75, 100, 130, 165, 212].map((l, i) => (
          <div key={i} className="w-3.5 h-1.5 rounded-sm" style={{ background: `rgb(${l}, ${Math.round(l * 0.7)}, ${Math.round(l * 0.45)})` }} />
        ))}
        <span className="text-[11px]" style={{ color: '#57534e' }}>Recent</span>
      </div>
    </div>
  );
}

// ── Transaction Table ─────────────────────────────────────────────────────────

const EMPTY_TXN = { txn_type: 'buy', txn_date: isoDate(), units: '', price: '', currency: 'USD', fees: '', platform: 'IBKR' };

function TransactionRow({ txn, onDelete }) {
  const isSell = txn.txn_type === 'sell';
  const age = txn.txn_date ? daysBetween(txn.txn_date) : null;
  const total = (txn.units || 0) * (txn.price || 0);

  return (
    <tr className="border-t group transition-colors" style={{ borderColor: 'rgba(255,255,255,0.04)', background: isSell ? 'rgba(158,90,90,0.04)' : 'transparent' }}>
      <td className="py-2 pr-4">
        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums" style={{ color: '#7a7068' }}>{txn.txn_date}</span>
          {isSell && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
              style={{ background: 'rgba(158,90,90,0.18)', color: '#e07070', border: '1px solid rgba(158,90,90,0.25)' }}>
              SELL
            </span>
          )}
        </div>
      </td>
      <td className="py-2 pr-4 text-sm tabular-nums" style={{ color: isSell ? '#e07070' : '#c4bdb4' }}>
        {isSell ? '−' : ''}{txn.units}
      </td>
      <td className="py-2 pr-4 text-sm tabular-nums" style={{ color: '#c4bdb4' }}>
        {txn.currency} {Number(txn.price || 0).toFixed(2)}
      </td>
      <td className="py-2 pr-4 text-sm" style={{ color: '#7a7068' }}>{txn.currency}</td>
      <td className="py-2 pr-4 text-sm tabular-nums" style={{ color: txn.fees ? '#c4bdb4' : '#4a4540' }}>
        {txn.fees ? `${txn.currency} ${txn.fees}` : '—'}
      </td>
      <td className="py-2 pr-4 text-sm" style={{ color: '#7a7068' }}>{txn.platform || '—'}</td>
      <td className="py-2 pr-4 text-sm tabular-nums" style={{ color: '#c4bdb4' }}>
        {txn.currency} {Number(total).toLocaleString('en-SG', { maximumFractionDigits: 0 })}
      </td>
      <td className="py-2 pr-4">
        {age != null && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: 'rgba(212,160,82,0.1)', color: '#d4a052', border: '1px solid rgba(212,160,82,0.22)' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d4a052' }} />
            {age}d
          </span>
        )}
      </td>
      <td className="py-2">
        <button onClick={() => onDelete(txn.id)}
          className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: '#3a3530' }}
          onMouseEnter={e => e.target.style.color = '#9e5a5a'}
          onMouseLeave={e => e.target.style.color = '#3a3530'}>
          ✕
        </button>
      </td>
    </tr>
  );
}

function AddTransactionRow({ holdingId, holdingCurrency, onSaved }) {
  const [form, setForm]     = useState({ ...EMPTY_TXN, currency: holdingCurrency || 'USD' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.units || !form.price || !form.txn_date) { setError('Date, units and price required.'); return; }
    setSaving(true);
    setError('');
    try {
      await transactionsApi.create(holdingId, {
        txn_type: form.txn_type,
        txn_date: form.txn_date,
        units:    parseFloat(form.units),
        price:    parseFloat(form.price),
        currency: form.currency,
        fees:     parseFloat(form.fees) || 0,
        platform: form.platform,
      });
      setForm({ ...EMPTY_TXN, currency: holdingCurrency || 'USD' });
      setError('');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setForm({ ...EMPTY_TXN, currency: holdingCurrency || 'USD' });
    setError('');
  }

  const inputCls = 'bg-white/[0.06] rounded px-2 py-1 text-xs text-[#e8e3db] outline-none w-full transition-colors focus:outline-none';
  const inputStyle = { border: '1px solid rgba(212,160,82,0.25)', fontFamily: 'inherit' };

  return (
    <>
      <tr className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'var(--bg-card, #1c1917)' }}>
        <td className="pt-3 pb-2 pr-2" colSpan={9}>
          {error && (
            <div className="flex items-center gap-1.5 text-[11px] text-red-400 mb-2">
              <AlertCircle size={11} />{error}
            </div>
          )}
          <div className="flex rounded-lg p-[3px] w-32 mb-0" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {['buy', 'sell'].map(t => (
              <button key={t} onClick={() => set('txn_type', t)}
                className="flex-1 py-1 rounded-md text-xs font-medium transition-all capitalize"
                style={form.txn_type === t ? {
                  background: t === 'buy' ? 'rgba(90,158,111,0.18)' : 'rgba(158,90,90,0.18)',
                  color: t === 'buy' ? '#5a9e6f' : '#e07070',
                  border: `1px solid ${t === 'buy' ? 'rgba(90,158,111,0.3)' : 'rgba(158,90,90,0.3)'}`,
                } : { color: '#4a4540', background: 'transparent', border: '1px solid transparent' }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </td>
      </tr>
      <tr style={{ background: 'var(--bg-card, #1c1917)' }}>
        <td className="pb-2 pr-2">
          <input type="date" value={form.txn_date} onChange={e => set('txn_date', e.target.value)}
            className={inputCls} style={{ ...inputStyle, width: '130px' }} />
        </td>
        <td className="pb-2 pr-2">
          <input type="number" placeholder="Units" step="any" value={form.units}
            onChange={e => set('units', e.target.value)} className={inputCls} style={{ ...inputStyle, width: '70px' }} />
        </td>
        <td className="pb-2 pr-2">
          <input type="number" placeholder="Price" step="any" value={form.price}
            onChange={e => set('price', e.target.value)} className={inputCls} style={{ ...inputStyle, width: '90px' }} />
        </td>
        <td className="pb-2 pr-2">
          <select value={form.currency} onChange={e => set('currency', e.target.value)}
            className={inputCls} style={{ ...inputStyle, width: '70px' }}>
            {CURRENCIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </td>
        <td className="pb-2 pr-2">
          <input type="number" placeholder="Fee" min="0" step="any" value={form.fees}
            onChange={e => set('fees', e.target.value)} className={inputCls} style={{ ...inputStyle, width: '70px' }} />
        </td>
        <td className="pb-2 pr-2">
          <input type="text" placeholder="Platform" value={form.platform}
            onChange={e => set('platform', e.target.value)} className={inputCls} style={{ ...inputStyle, width: '90px' }} />
        </td>
        <td className="pb-2 pr-2" colSpan={2} />
        <td className="pb-2">
          <div className="flex items-center gap-2">
            <button onClick={submit} disabled={saving}
              className="text-xs font-medium transition-colors disabled:opacity-50"
              style={{ color: '#5a9e6f' }}>✓</button>
            <button onClick={cancel} className="text-xs transition-colors" style={{ color: '#4a4540' }}
              onMouseEnter={e => e.target.style.color = '#7a7068'}
              onMouseLeave={e => e.target.style.color = '#4a4540'}>✕</button>
          </div>
        </td>
      </tr>
    </>
  );
}

function TransactionSection({ holding, onRefreshHolding }) {
  const txns = useMemo(() =>
    [...(holding.transactions || [])].sort((a, b) => new Date(b.txn_date) - new Date(a.txn_date)),
    [holding.transactions]
  );

  const buys  = txns.filter(t => t.txn_type === 'buy');
  const sells = txns.filter(t => t.txn_type === 'sell');
  const totalBuyUnits  = buys.reduce((s, t)  => s + (t.units  || 0), 0);
  const totalSellUnits = sells.reduce((s, t) => s + (t.units  || 0), 0);
  const totalUnits     = Math.max(totalBuyUnits - totalSellUnits, holding.units || 0);
  const buyCost = buys.reduce((s, t) => s + (t.units || 0) * (t.price || 0), 0);
  const avgCost = totalBuyUnits > 0 ? buyCost / totalBuyUnits : (holding.avg_cost || 0);
  const totalCost = toSGD(totalUnits * avgCost, holding.currency);
  const topPlatform = buys.length > 0 ? buys[0].platform || '—' : '—';

  async function deleteTxn(txnId) {
    if (!window.confirm('Delete this transaction?')) return;
    await transactionsApi.delete(holding.id, txnId);
    onRefreshHolding();
  }

  const thStyle = { color: '#8a7d6b', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, paddingBottom: '8px', paddingRight: '16px', textAlign: 'left' };

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ minWidth: '600px' }}>
        <thead>
          <tr>
            {['Date', 'Units', 'Price', 'Currency', 'Fee', 'Platform', 'Total Cost', 'Age', ''].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {txns.map(txn => (
            <TransactionRow key={txn.id} txn={txn} onDelete={deleteTxn} />
          ))}
          <AddTransactionRow
            holdingId={holding.id}
            holdingCurrency={holding.currency || 'USD'}
            onSaved={onRefreshHolding}
          />
          {(txns.length > 0 || totalUnits > 0) && (
            <tr className="border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <td className="pt-2.5 pr-4 text-xs" style={{ color: '#7a7068' }}>Avg / Total</td>
              <td className="pt-2.5 pr-4 text-sm tabular-nums font-semibold" style={{ color: '#d4a052' }}>{totalUnits}</td>
              <td className="pt-2.5 pr-4 text-sm tabular-nums" style={{ color: '#d4a052' }}>
                {holding.currency} {avgCost.toFixed(2)}
              </td>
              <td className="pt-2.5 pr-4 text-sm" style={{ color: '#d4a052' }}>{holding.currency}</td>
              <td className="pt-2.5 pr-4 text-sm" style={{ color: '#4a4540' }}>—</td>
              <td className="pt-2.5 pr-4 text-sm" style={{ color: '#d4a052' }}>{topPlatform}</td>
              <td className="pt-2.5 text-sm tabular-nums" style={{ color: '#d4a052' }}>
                {holding.currency} {Number(totalUnits * avgCost).toLocaleString('en-SG', { maximumFractionDigits: 0 })}
              </td>
              <td colSpan={2} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Expanded Row Panel ────────────────────────────────────────────────────────

function ExpandedPanel({ holding, onRefreshHolding }) {
  const geo   = GEO_LABELS[holding.geography] || holding.geography || '—';
  const cat   = holding.category   || '—';
  const itype = holding.investment_type || holding.asset_type || '—';

  const labelStyle = { fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7068', marginRight: '12px' };
  const tagStyle   = { fontSize: '12px', color: '#c4bdb4', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '2px 10px' };

  return (
    <div>
      {/* Position Timeline */}
      <PositionTimeline transactions={holding.transactions} />

      {/* Geography + Label */}
      <div className="flex items-center flex-wrap gap-y-3 mb-5">
        <div className="flex items-center">
          <span style={labelStyle}>Geography</span>
          <span style={tagStyle}>{geo}</span>
        </div>
        <div className="flex items-center ml-6">
          <span style={labelStyle}>Label</span>
          <span style={{ ...tagStyle, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: '#d4a052' }}>{cat}</span>
            {itype !== '—' && <><span style={{ color: '#4a4540' }}>·</span><span style={{ color: '#7a7068' }}>{itype}</span></>}
          </span>
        </div>
      </div>

      {/* Transaction History */}
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#7a7068' }}>
        Transaction History
      </p>
      <TransactionSection holding={holding} onRefreshHolding={onRefreshHolding} />
    </div>
  );
}

// ── Add/Edit Holding Modal ────────────────────────────────────────────────────

const EMPTY_FORM = {
  ticker: '', name: '', asset_type: 'Equity', category: 'Growth',
  investment_type: 'Index', currency: 'USD', platform: 'IBKR',
  units: '', avg_cost: '', current_price: '', notes: '',
};

function HoldingModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.ticker) { setError('Ticker is required.'); return; }
    setLoading(true);
    setError('');
    try {
      await onSave({
        ...form,
        units:         parseFloat(form.units)         || 0,
        avg_cost:      parseFloat(form.avg_cost)      || 0,
        current_price: parseFloat(form.current_price) || 0,
      });
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
          <h2 className="text-[#e8ddd0] font-medium text-sm">{initial?.id ? 'Edit Holding' : 'Add Holding'}</h2>
          <button onClick={onClose} className="text-[#57534e] hover:text-[#a8a29e]"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1">Ticker *</label>
              <input value={form.ticker} onChange={e => set('ticker', e.target.value.toUpperCase())}
                placeholder="VWRA.L" className="input" />
            </div>
            <div>
              <label className="section-label block mb-1">Currency</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input">
                {CURRENCIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="section-label block mb-1">Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="Vanguard FTSE All-World UCITS ETF" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1">Asset Type</label>
              <select value={form.asset_type} onChange={e => set('asset_type', e.target.value)} className="input">
                {ASSET_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="section-label block mb-1">Platform</label>
              <input value={form.platform} onChange={e => set('platform', e.target.value)}
                placeholder="IBKR" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1">Units (manual)</label>
              <input type="number" step="any" value={form.units} onChange={e => set('units', e.target.value)}
                placeholder="0" className="input" />
            </div>
            <div>
              <label className="section-label block mb-1">Avg Cost / Unit</label>
              <input type="number" step="any" value={form.avg_cost} onChange={e => set('avg_cost', e.target.value)}
                placeholder="0.00" className="input" />
            </div>
          </div>
          <div>
            <label className="section-label block mb-1">Current Price</label>
            <input type="number" step="any" value={form.current_price} onChange={e => set('current_price', e.target.value)}
              placeholder="0.00" className="input" />
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

// ── Main Page ─────────────────────────────────────────────────────────────────

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c1917] border border-[#292524] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-[#78716c] mb-1">{label}</p>
      <p className="text-[#e8ddd0] tabular-nums">{fmtSGD(payload[0].value)}</p>
    </div>
  );
}

const BAR_COLORS = ['#059669', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];

export default function Investments() {
  const { data: rawInvestments, loading, refetch } = useApi('/holdings');
  const [expandedId, setExpandedId] = useState(null);
  const [modal, setModal]           = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const investments = useMemo(() => (rawInvestments || []).map(computeHolding), [rawInvestments]);

  const sorted = useMemo(() =>
    [...investments].sort((a, b) => (b.value || 0) - (a.value || 0)),
    [investments]
  );

  const totals = useMemo(() => {
    const cost  = sorted.reduce((s, h) => s + (h.costBasis || 0), 0);
    const value = sorted.reduce((s, h) => s + (h.value || 0), 0);
    return { cost, value, gain: value - cost, pct: cost ? ((value - cost) / cost) * 100 : 0 };
  }, [sorted]);

  const chartData = useMemo(() => {
    const byType = {};
    sorted.forEach(h => {
      const k = h.asset_type || 'Other';
      byType[k] = (byType[k] || 0) + (h.value || 0);
    });
    return Object.entries(byType).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [sorted]);

  function toggleRow(id) {
    setExpandedId(prev => prev === id ? null : id);
  }

  async function handleSave(payload) {
    if (payload.id) {
      await investmentsApi.update(payload.id, payload);
    } else {
      await investmentsApi.create(payload);
    }
    await refetch();
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm('Delete this holding?')) return;
    await investmentsApi.delete(id);
    if (expandedId === id) setExpandedId(null);
    await refetch();
  }

  async function refreshPrices() {
    setRefreshing(true);
    try {
      await pricesApi.refresh();
      await refetch();
    } catch (err) {
      alert('Price refresh failed: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  }

  const thCls = 'section-label text-left pb-3 pr-4 last:pr-0 font-semibold';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="page-title">Investments</h1>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={refreshPrices} disabled={refreshing}
            className="btn-secondary flex items-center gap-1.5">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Fetching…' : 'Refresh prices'}
          </button>
          <button onClick={() => setModal('add')} className="btn-primary flex items-center gap-1.5">
            <Plus size={13} />Add holding
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Market Value',    value: fmtSGD(totals.value, true), color: 'text-[#e8ddd0]' },
          { label: 'Cost Basis',      value: fmtSGD(totals.cost,  true), color: 'text-[#78716c]' },
          { label: 'Unrealised P&L',  value: `${totals.gain >= 0 ? '+' : ''}${fmtSGD(totals.gain, true)}`,
            color: totals.gain >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Total Return',    value: fmtPct(totals.pct),
            color: totals.pct  >= 0 ? 'text-emerald-400' : 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card">
            <p className="section-label mb-1">{label}</p>
            <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Asset type chart */}
      {chartData.length > 0 && (
        <div className="card">
          <p className="section-label mb-4">By Asset Type</p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#292524" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#78716c', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Holdings table */}
      <div className="card overflow-hidden">
        <p className="section-label mb-4">Holdings <span className="ml-1 text-[#44403c]">({sorted.length})</span></p>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div className="text-center py-10">
            <p className="text-[#57534e] text-sm mb-3">No holdings yet.</p>
            <button onClick={() => setModal('add')} className="btn-primary flex items-center gap-1.5 mx-auto">
              <Plus size={13} />Add your first holding
            </button>
          </div>
        )}

        {!loading && sorted.length > 0 && (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm" style={{ minWidth: '700px' }}>
              <thead>
                <tr className="border-b border-[#292524]">
                  <th className={`${thCls} pl-5`} style={{ width: '28px' }} />
                  <th className={`${thCls} pl-2`}>Ticker</th>
                  <th className={thCls}>Name</th>
                  <th className={`${thCls} text-right`}>Units</th>
                  <th className={`${thCls} text-right`}>Avg Cost</th>
                  <th className={`${thCls} text-right`}>Price</th>
                  <th className={`${thCls} text-right`}>Value (SGD)</th>
                  <th className={`${thCls} text-right`}>P&L</th>
                  <th className={`${thCls} pr-5`} />
                </tr>
              </thead>
              <tbody>
                {sorted.map(inv => {
                  const isOpen = expandedId === inv.id;
                  const Icon = inv.pnl >= 0 ? TrendingUp : TrendingDown;
                  return (
                    <React.Fragment key={inv.id}>
                      <tr
                        onClick={() => toggleRow(inv.id)}
                        className="border-b transition-colors cursor-pointer select-none"
                        style={{ borderColor: 'rgba(255,255,255,0.05)', background: isOpen ? 'rgba(212,160,82,0.04)' : 'transparent' }}
                        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* Expand chevron */}
                        <td className="py-3.5 pl-5 pr-2">
                          <ChevronDown size={14} className="transition-transform duration-200 text-[#44403c]"
                            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: isOpen ? '#d4a052' : undefined }} />
                        </td>
                        <td className="py-3.5 pr-4 pl-2">
                          <span className="font-semibold text-[#e8ddd0]">{inv.ticker}</span>
                          {inv.currency !== 'SGD' && (
                            <span className="ml-1.5 text-[10px] text-[#44403c]">{inv.currency}</span>
                          )}
                        </td>
                        <td className="py-3.5 pr-4 text-[#78716c] max-w-[180px] truncate">{inv.name || '—'}</td>
                        <td className="py-3.5 pr-4 text-right tabular-nums text-[#a8a29e]">{inv.units}</td>
                        <td className="py-3.5 pr-4 text-right tabular-nums text-[#78716c]">
                          {inv.currency} {Number(inv.avg_cost || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 pr-4 text-right tabular-nums text-[#a8a29e]">
                          {inv.currency} {Number(inv.current_price || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 pr-4 text-right tabular-nums font-medium text-[#e8ddd0]">
                          {fmtSGD(inv.value)}
                        </td>
                        <td className="py-3.5 pr-4 text-right">
                          <div className={`flex items-center justify-end gap-1 ${inv.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            <Icon size={12} />
                            <span className="tabular-nums text-xs">{fmtPct(inv.pnlPct)}</span>
                          </div>
                        </td>
                        <td className="py-3.5 pr-5">
                          <button
                            onClick={e => handleDelete(inv.id, e)}
                            className="text-[10px] text-[#3a3530] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            style={{ opacity: isOpen ? 0.5 : undefined }}>
                            ✕
                          </button>
                        </td>
                      </tr>

                      {/* Expanded panel */}
                      {isOpen && (
                        <tr style={{ background: 'rgba(212,160,82,0.02)' }}>
                          <td colSpan={9} className="px-8 py-5" style={{ borderBottom: '1px solid rgba(212,160,82,0.12)' }}>
                            <ExpandedPanel holding={inv} onRefreshHolding={refetch} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#292524]">
                  <td colSpan={6} className="pt-3 pl-5 text-[#57534e] text-xs">
                    {sorted.length} holding{sorted.length !== 1 ? 's' : ''}
                  </td>
                  <td className="pt-3 pr-4 text-right tabular-nums font-semibold text-[#e8ddd0]">
                    {fmtSGD(totals.value)}
                  </td>
                  <td className={`pt-3 pr-4 text-right tabular-nums text-xs font-medium ${totals.gain >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {totals.gain >= 0 ? '+' : ''}{fmtSGD(totals.gain)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {(modal === 'add' || (modal && typeof modal === 'object')) && (
        <HoldingModal
          initial={modal === 'add' ? {} : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
