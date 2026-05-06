import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { useAuth } from '../App.jsx';
import { useApi } from '../hooks/useApi.js';
import { fmtSGD, fmtPct, greet, todayLong } from '../lib/formatters.js';
import { calcNetWorth, buildNetWorthHistory } from '../lib/calculations.js';

function StatCard({ label, value, sub, positive, negative }) {
  const color = positive ? 'text-emerald-400' : negative ? 'text-red-400' : 'text-[#78716c]';
  return (
    <div className="card flex flex-col gap-1">
      <p className="section-label">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-[#57534e]">{sub}</p>}
    </div>
  );
}

function AllocationBar({ items }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return null;
  return (
    <div className="flex rounded-full overflow-hidden h-2 gap-px">
      {items.map((item) => (
        <div
          key={item.label}
          style={{ width: `${(item.value / total) * 100}%`, backgroundColor: item.color }}
          title={`${item.label}: ${fmtSGD(item.value)}`}
        />
      ))}
    </div>
  );
}

const ALLOCATION_COLORS = {
  Cash:        '#d97706',
  Investments: '#059669',
  CPF:         '#3b82f6',
  SRS:         '#8b5cf6',
  Property:    '#f59e0b',
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c1917] border border-[#292524] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-[#78716c] mb-1">{label}</p>
      <p className="text-[#e8ddd0] font-semibold tabular-nums">{fmtSGD(payload[0].value)}</p>
    </div>
  );
}

export default function Overview() {
  const { profile } = useAuth();
  const { data: snapshots, loading: snapLoading, refetch: refetchSnaps } = useApi('/snapshots');
  const { data: cpf } = useApi('/cpf');
  const { data: srs } = useApi('/srs');
  const { data: loans } = useApi('/loans');
  const { data: investments } = useApi('/investments');

  const latestSnap = useMemo(() => {
    if (!snapshots?.length) return null;
    const snapDate = (s) => s.snapshot_date ?? s.date;
    return [...snapshots].sort((a, b) => new Date(snapDate(b)) - new Date(snapDate(a)))[0];
  }, [snapshots]);

  const prevSnap = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return null;
    const snapDate = (s) => s.snapshot_date ?? s.date;
    const sorted = [...snapshots].sort((a, b) => new Date(snapDate(b)) - new Date(snapDate(a)));
    return sorted[1];
  }, [snapshots]);

  const netWorth = useMemo(() => {
    if (!latestSnap) return 0;
    return latestSnap.net_worth ?? latestSnap.netWorth ?? calcNetWorth(latestSnap);
  }, [latestSnap]);

  const prevNetWorth = useMemo(() => {
    if (!prevSnap) return null;
    return prevSnap.net_worth ?? prevSnap.netWorth ?? calcNetWorth(prevSnap);
  }, [prevSnap]);

  const change = prevNetWorth != null ? netWorth - prevNetWorth : null;
  const changePct = prevNetWorth ? (change / Math.abs(prevNetWorth)) * 100 : null;

  const historyData = useMemo(() => buildNetWorthHistory(snapshots || []), [snapshots]);

  const allocationItems = useMemo(() => {
    if (!latestSnap) return [];
    return [
      { label: 'Cash',        value: latestSnap.cash        || 0, color: ALLOCATION_COLORS.Cash },
      { label: 'Investments', value: latestSnap.investments  || 0, color: ALLOCATION_COLORS.Investments },
      { label: 'CPF',         value: latestSnap.cpf          || 0, color: ALLOCATION_COLORS.CPF },
      { label: 'SRS',         value: latestSnap.srs          || 0, color: ALLOCATION_COLORS.SRS },
      { label: 'Property',    value: latestSnap.properties   || 0, color: ALLOCATION_COLORS.Property },
    ].filter((i) => i.value > 0);
  }, [latestSnap]);

  const totalLoans = useMemo(() => {
    if (!loans?.length) return 0;
    return loans.reduce((s, l) => s + (l.balance || l.principal || 0), 0);
  }, [loans]);

  const totalInvested = useMemo(() => {
    if (!investments?.length) return 0;
    return investments.reduce((s, i) => s + (i.currentValue || i.marketValue || 0), 0);
  }, [investments]);

  const ChangeIcon = change == null ? Minus : change > 0 ? TrendingUp : TrendingDown;
  const changeColor = change == null ? '' : change > 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{greet()}{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}</h1>
          <p className="text-[#57534e] text-sm mt-0.5">{todayLong()}</p>
        </div>
        <button
          onClick={refetchSnaps}
          disabled={snapLoading}
          className="btn-secondary flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw size={12} className={snapLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Net worth hero */}
      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="section-label mb-1">Net Worth</p>
            <p className="net-worth-num text-[#f0ebe4] tabular-nums" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', lineHeight: 1.1 }}>
              {fmtSGD(netWorth)}
            </p>
            {change != null && (
              <div className={`flex items-center gap-1.5 mt-1.5 text-sm ${changeColor}`}>
                <ChangeIcon size={14} />
                <span className="tabular-nums font-medium">
                  {change >= 0 ? '+' : ''}{fmtSGD(change)} ({changePct != null ? fmtPct(changePct) : '—'})
                </span>
                <span className="text-[#57534e] text-xs">vs prev snapshot</span>
              </div>
            )}
          </div>
        </div>

        {/* Allocation bar */}
        {allocationItems.length > 0 && (
          <div className="space-y-2 mb-4">
            <AllocationBar items={allocationItems} />
            <div className="flex flex-wrap gap-3">
              {allocationItems.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 text-xs text-[#78716c]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sparkline */}
        {historyData.length > 1 && (
          <div className="h-32 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#059669" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#292524" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="netWorth"
                  stroke="#059669"
                  strokeWidth={1.5}
                  fill="url(#nwGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#059669', stroke: '#1c1917', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {historyData.length <= 1 && (
          <div className="text-center py-6 text-[#57534e] text-sm">
            Add more snapshots to see your net worth history chart.
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Investments"
          value={fmtSGD(totalInvested, true)}
          sub="Current market value"
          positive={totalInvested > 0}
        />
        <StatCard
          label="CPF Total"
          value={fmtSGD((cpf?.oa || 0) + (cpf?.sa || 0) + (cpf?.ma || 0), true)}
          sub="OA + SA + MA"
        />
        <StatCard
          label="SRS Balance"
          value={fmtSGD(srs?.balance || 0, true)}
          sub="Supplementary Retirement"
        />
        <StatCard
          label="Total Loans"
          value={fmtSGD(totalLoans, true)}
          sub="Outstanding balance"
          negative={totalLoans > 0}
        />
      </div>

      {/* Breakdown table */}
      {latestSnap && (
        <div className="card">
          <p className="section-label mb-4">Latest Snapshot Breakdown</p>
          <div className="space-y-3">
            {[
              { label: 'Cash & Savings',  value: latestSnap.cash,        positive: true },
              { label: 'Investments',     value: latestSnap.investments,  positive: true },
              { label: 'CPF',             value: latestSnap.cpf,          positive: true },
              { label: 'SRS',             value: latestSnap.srs,          positive: true },
              { label: 'Property',        value: latestSnap.properties,   positive: true },
              { label: 'Loans',           value: -(latestSnap.loans || 0), positive: false },
            ].map(({ label, value, positive }) => (
              value != null && value !== 0 ? (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-[#78716c]">{label}</span>
                  <span className={`tabular-nums font-medium ${value >= 0 ? 'text-[#e8ddd0]' : 'text-red-400'}`}>
                    {fmtSGD(value)}
                  </span>
                </div>
              ) : null
            ))}
            <div className="border-t border-[#292524] pt-3 flex items-center justify-between text-sm font-semibold">
              <span className="text-[#a8a29e]">Net Worth</span>
              <span className="text-emerald-400 tabular-nums">{fmtSGD(netWorth)}</span>
            </div>
          </div>
        </div>
      )}

      {!latestSnap && !snapLoading && (
        <div className="card text-center py-10">
          <p className="text-[#78716c] text-sm mb-3">No snapshots yet.</p>
          <p className="text-[#57534e] text-xs">Head to the History page to record your first net worth snapshot.</p>
        </div>
      )}
    </div>
  );
}
