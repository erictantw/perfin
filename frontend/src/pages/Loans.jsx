import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Plus, Calculator, Edit2, Trash2, X, AlertCircle } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { loansApi, api } from '../lib/api.js';
import { fmtSGD, fmtNum } from '../lib/formatters.js';
import { calcMonthlyRepayment, calcMortgageSchedule } from '../lib/calculations.js';

const LOAN_TYPES = ['mortgage', 'personal', 'car', 'student', 'other'];

const EMPTY_LOAN = {
  name: '', loanType: 'mortgage', originalAmount: '', outstanding: '',
  interestRate: '', monthlyPayment: '', tenureMonths: '', startDate: '',
  currency: 'SGD', notes: '',
};

const EMPTY_CALC = { principal: '', rate: '', years: '' };

function LoanModal({ initial, onSave, onClose }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm]     = useState({
    ...EMPTY_LOAN,
    ...(isEdit ? {
      name:           initial.name            || '',
      loanType:       initial.loanType || initial.loan_type || 'mortgage',
      originalAmount: String(initial.originalAmount || initial.original_amount || ''),
      outstanding:    String(initial.outstanding     || ''),
      interestRate:   String(initial.interestRate   || initial.interest_rate   || ''),
      monthlyPayment: String(initial.monthlyPayment || initial.monthly_payment || ''),
      tenureMonths:   String(initial.tenureMonths   || initial.tenure_months   || ''),
      startDate:      initial.startDate || initial.start_date || '',
      currency:       initial.currency  || 'SGD',
      notes:          initial.notes     || '',
    } : {}),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-calculate monthly payment when fields change
  const autoMonthly = useMemo(() => {
    const p = parseFloat(form.originalAmount) || parseFloat(form.outstanding) || 0;
    const r = (parseFloat(form.interestRate) || 0) / 100;
    const m = parseInt(form.tenureMonths) || 0;
    if (!p || !m) return 0;
    return calcMonthlyRepayment(p, r, m);
  }, [form.originalAmount, form.outstanding, form.interestRate, form.tenureMonths]);

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.outstanding) {
      setError('Name and outstanding balance are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        originalAmount: parseFloat(form.originalAmount) || 0,
        outstanding:    parseFloat(form.outstanding)    || 0,
        interestRate:   parseFloat(form.interestRate)   || 0,
        monthlyPayment: parseFloat(form.monthlyPayment) || autoMonthly || 0,
        tenureMonths:   parseInt(form.tenureMonths)     || 0,
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
          <h2 className="text-[#e8ddd0] font-medium text-sm">{isEdit ? 'Edit Loan' : 'Add Loan'}</h2>
          <button onClick={onClose} className="text-[#57534e] hover:text-[#a8a29e]"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1">Loan Name *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)}
                placeholder="HDB Mortgage" className="input" />
            </div>
            <div>
              <label className="section-label block mb-1">Type</label>
              <select value={form.loanType} onChange={(e) => set('loanType', e.target.value)} className="input">
                {LOAN_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1">Original Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#57534e] text-sm">S$</span>
                <input type="number" step="any" value={form.originalAmount}
                  onChange={(e) => set('originalAmount', e.target.value)}
                  placeholder="500000" className="input pl-8" />
              </div>
            </div>
            <div>
              <label className="section-label block mb-1">Outstanding *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#57534e] text-sm">S$</span>
                <input type="number" step="any" value={form.outstanding}
                  onChange={(e) => set('outstanding', e.target.value)}
                  placeholder="350000" className="input pl-8" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1">Interest Rate (% p.a.)</label>
              <input type="number" step="any" value={form.interestRate}
                onChange={(e) => set('interestRate', e.target.value)}
                placeholder="3.5" className="input" />
            </div>
            <div>
              <label className="section-label block mb-1">Tenure (months)</label>
              <input type="number" value={form.tenureMonths}
                onChange={(e) => set('tenureMonths', e.target.value)}
                placeholder="300" className="input" />
            </div>
          </div>

          <div>
            <label className="section-label block mb-1">Monthly Payment</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#57534e] text-sm">S$</span>
              <input type="number" step="any" value={form.monthlyPayment}
                onChange={(e) => set('monthlyPayment', e.target.value)}
                placeholder={autoMonthly ? fmtNum(autoMonthly, 2) : '0'}
                className="input pl-8" />
            </div>
            {autoMonthly > 0 && !form.monthlyPayment && (
              <p className="text-xs text-[#57534e] mt-1">Auto-calculated: {fmtSGD(autoMonthly)}/month</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="section-label block mb-1">Start Date</label>
              <input type="date" value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)} className="input" />
            </div>
            <div>
              <label className="section-label block mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="input">
                {['SGD','USD','GBP','EUR','HKD','AUD'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
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
              {loading ? 'Saving…' : isEdit ? 'Save changes' : 'Add loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CalcTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1c1917] border border-[#292524] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-[#78716c] mb-1">Month {label}</p>
      <p className="text-[#e8ddd0] tabular-nums">{fmtSGD(payload[0]?.value)}</p>
    </div>
  );
}

function MortgageCalculatorModal({ onClose }) {
  const [calc, setCalc]       = useState(EMPTY_CALC);
  const [result, setResult]   = useState(null);

  const setC = (k, v) => setCalc((c) => ({ ...c, [k]: v }));

  function runCalc(e) {
    e.preventDefault();
    const principal = parseFloat(calc.principal);
    const rate      = parseFloat(calc.rate) / 100;
    const months    = parseInt(calc.years) * 12;
    if (!principal || !months) return;
    const monthly        = calcMonthlyRepayment(principal, rate, months);
    const schedule       = calcMortgageSchedule(principal, rate, months);
    const totalRepayment = monthly * months;
    const totalInterest  = totalRepayment - principal;
    const chartData      = schedule
      .filter((_, i) => i % 12 === 11 || i === 0)
      .map((row) => ({ month: row.month, balance: row.balance }));
    const firstYear = schedule.slice(0, 12);
    setResult({ monthly, totalInterest, totalRepayment, chartData, firstYear });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#e8ddd0] font-medium text-sm">Mortgage Calculator</h2>
          <button onClick={onClose} className="text-[#57534e] hover:text-[#a8a29e]"><X size={16} /></button>
        </div>

        <form onSubmit={runCalc} className="space-y-3 mb-5">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="section-label block mb-1">Principal (SGD) *</label>
              <input required type="number" step="any" value={calc.principal}
                onChange={(e) => setC('principal', e.target.value)}
                placeholder="500000" className="input" />
            </div>
            <div>
              <label className="section-label block mb-1">Annual Rate (%) *</label>
              <input required type="number" step="any" value={calc.rate}
                onChange={(e) => setC('rate', e.target.value)}
                placeholder="3.5" className="input" />
            </div>
            <div>
              <label className="section-label block mb-1">Tenure (years) *</label>
              <input required type="number" min="1" max="50" value={calc.years}
                onChange={(e) => setC('years', e.target.value)}
                placeholder="25" className="input" />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full py-2.5 justify-center">
            Calculate
          </button>
        </form>

        {result && (
          <div className="space-y-5 border-t border-[#292524] pt-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Monthly Payment', value: fmtSGD(result.monthly),         color: 'text-emerald-400' },
                { label: 'Total Interest',  value: fmtSGD(result.totalInterest),    color: 'text-red-400' },
                { label: 'Total Repayment', value: fmtSGD(result.totalRepayment),   color: 'text-[#e8ddd0]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#0c0a09] rounded-xl border border-[#292524] p-3 text-center">
                  <p className="text-xs text-[#57534e] mb-1">{label}</p>
                  <p className={`text-base font-bold tabular-nums ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="section-label mb-3">Balance Over Time</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.chartData}>
                    <CartesianGrid stroke="#292524" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#78716c', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `Mo ${v}`} />
                    <YAxis hide />
                    <Tooltip content={<CalcTooltip />} cursor={{ stroke: '#44403c' }} />
                    <Line type="monotone" dataKey="balance" stroke="#059669" strokeWidth={2} dot={false}
                      activeDot={{ r: 4, fill: '#059669', stroke: '#1c1917', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <p className="section-label mb-3">First-Year Amortisation</p>
              <div className="overflow-x-auto rounded-xl border border-[#292524]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#57534e] border-b border-[#292524] bg-[#0c0a09]">
                      {['Month','Payment','Principal','Interest','Balance'].map((h) => (
                        <th key={h} className={`px-3 py-2 ${h === 'Month' ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#292524]/50">
                    {result.firstYear.map((row) => (
                      <tr key={row.month} className="hover:bg-white/2 transition-colors">
                        <td className="px-3 py-2 text-[#78716c]">{row.month}</td>
                        <td className="px-3 py-2 text-right text-[#a8a29e] tabular-nums">{fmtSGD(row.payment)}</td>
                        <td className="px-3 py-2 text-right text-emerald-400 tabular-nums">{fmtSGD(row.principal)}</td>
                        <td className="px-3 py-2 text-right text-red-400 tabular-nums">{fmtSGD(row.interest)}</td>
                        <td className="px-3 py-2 text-right text-[#e8ddd0] tabular-nums">{fmtSGD(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Loans() {
  const { data: loans, loading, refetch } = useApi('/loans');
  const [modal, setModal]       = useState(null); // null | 'add' | loan object
  const [showCalc, setShowCalc] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const sorted = useMemo(() => {
    if (!loans) return [];
    return [...loans].sort((a, b) => (b.outstanding || 0) - (a.outstanding || 0));
  }, [loans]);

  const totalOutstanding = useMemo(() =>
    sorted.reduce((s, l) => s + (l.outstanding || 0), 0), [sorted]);
  const totalMonthly = useMemo(() =>
    sorted.reduce((s, l) => s + (l.monthlyPayment || l.monthly_payment || 0), 0), [sorted]);

  async function handleSave(payload) {
    if (payload.id) {
      await loansApi.update(payload.id, payload);
    } else {
      await loansApi.create(payload);
    }
    await refetch();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this loan?')) return;
    setDeleting(id);
    try {
      await loansApi.delete(id);
      await refetch();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="page-title">Loans</h1>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowCalc(true)} className="btn-secondary flex items-center gap-1.5">
            <Calculator size={13} />Calculator
          </button>
          <button onClick={() => setModal('add')} className="btn-primary flex items-center gap-1.5">
            <Plus size={13} />Add loan
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="section-label mb-1">Total Outstanding</p>
          <p className="text-xl font-semibold tabular-nums text-red-400">{fmtSGD(totalOutstanding)}</p>
          <p className="text-xs text-[#57534e] mt-0.5">{sorted.length} active loan{sorted.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card">
          <p className="section-label mb-1">Monthly Repayments</p>
          <p className="text-xl font-semibold tabular-nums text-amber-400">{fmtSGD(totalMonthly)}</p>
          <p className="text-xs text-[#57534e] mt-0.5">Total committed/month</p>
        </div>
      </div>

      {/* Loan list */}
      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="w-5 h-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-[#57534e] text-sm mb-3">No loans recorded yet.</p>
          <button onClick={() => setModal('add')} className="btn-primary flex items-center gap-1.5 mx-auto">
            <Plus size={13} />Add your first loan
          </button>
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div className="space-y-3">
          {sorted.map((loan) => {
            const original = loan.originalAmount || loan.original_amount || 0;
            const outstanding = loan.outstanding || 0;
            const pctRepaid = original > 0 ? ((original - outstanding) / original) * 100 : 0;
            const interestRate = loan.interestRate ?? loan.interest_rate ?? 0;
            const monthlyPayment = loan.monthlyPayment || loan.monthly_payment || 0;
            const loanType = loan.loanType || loan.loan_type || 'loan';

            return (
              <div key={loan.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-[#e8ddd0]">{loan.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#292524] text-[#78716c] capitalize">
                        {loanType}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#78716c]">
                      <span>
                        Outstanding: <span className="text-[#a8a29e] font-medium">{fmtSGD(outstanding)}</span>
                      </span>
                      {interestRate > 0 && (
                        <span>Rate: <span className="text-[#a8a29e] font-medium">{interestRate}%</span></span>
                      )}
                      {monthlyPayment > 0 && (
                        <span>Monthly: <span className="text-[#a8a29e] font-medium">{fmtSGD(monthlyPayment)}</span></span>
                      )}
                    </div>

                    {original > 0 && (
                      <>
                        <div className="mt-2 h-1.5 bg-[#292524] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-600 transition-all"
                            style={{ width: `${Math.min(100, pctRepaid)}%` }}
                          />
                        </div>
                        <p className="text-xs text-[#57534e] mt-1">
                          {fmtNum(pctRepaid, 1)}% repaid ({fmtSGD(original - outstanding)} / {fmtSGD(original)})
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setModal(loan)}
                      className="p-1.5 rounded-lg text-[#57534e] hover:text-[#a8a29e] hover:bg-white/5 transition-colors">
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(loan.id)}
                      disabled={deleting === loan.id}
                      className="p-1.5 rounded-lg text-[#57534e] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(modal === 'add' || (modal && typeof modal === 'object')) && (
        <LoanModal
          initial={modal === 'add' ? {} : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {showCalc && <MortgageCalculatorModal onClose={() => setShowCalc(false)} />}
    </div>
  );
}
