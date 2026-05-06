import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts';
import { Save, Info } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { srsApi } from '../lib/api.js';
import { fmtSGD, fmtPct } from '../lib/formatters.js';

const SRS_ANNUAL_LIMIT = 15300;       // SGD for Singapore Citizens / PRs
const SRS_ANNUAL_LIMIT_FOREIGNER = 35700;
const SRS_RELIEF_MULTIPLIER = 0.5;    // Tax relief factor on withdrawals after 62

function ProjectionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-[#1c1917] border border-[#292524] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-[#78716c] mb-1">{label}</p>
      <p className="text-[#e8ddd0] tabular-nums font-medium">{fmtSGD(val)}</p>
    </div>
  );
}

function projectSRS(balance, annualContrib, growthRate, years) {
  const data = [];
  let val = balance;
  for (let y = 0; y <= years; y++) {
    data.push({ year: new Date().getFullYear() + y, value: Math.round(val) });
    val = (val + annualContrib) * (1 + growthRate);
  }
  return data;
}

export default function SRS() {
  const { data: srs, loading, refetch } = useApi('/srs');

  const [form, setForm] = useState({
    balance: '', annualContrib: String(SRS_ANNUAL_LIMIT), growthRate: '6',
    age: '', isCitizen: 'true',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  React.useEffect(() => {
    if (srs) {
      setForm({
        balance:      srs.balance      ?? '',
        annualContrib: srs.annualContrib ?? String(SRS_ANNUAL_LIMIT),
        growthRate:   srs.growthRate    ?? '6',
        age:          srs.age          ?? '',
        isCitizen:    srs.isCitizen != null ? String(srs.isCitizen) : 'true',
      });
    }
  }, [srs]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const balance      = parseFloat(form.balance)       || 0;
  const annualContrib = parseFloat(form.annualContrib) || 0;
  const growthRate   = parseFloat(form.growthRate)     / 100 || 0.06;
  const age          = parseInt(form.age)              || null;
  const isCitizen    = form.isCitizen === 'true';
  const annualLimit  = isCitizen ? SRS_ANNUAL_LIMIT : SRS_ANNUAL_LIMIT_FOREIGNER;
  const yearsToRetirement = age ? Math.max(0, 62 - age) : 20;

  const projection = useMemo(
    () => projectSRS(balance, annualContrib, growthRate, Math.min(yearsToRetirement + 10, 40)),
    [balance, annualContrib, growthRate, yearsToRetirement],
  );

  const retirementValue = useMemo(() => {
    if (!age || age >= 62) return balance;
    const idx = yearsToRetirement;
    return projection[idx]?.value || 0;
  }, [age, balance, yearsToRetirement, projection]);

  const taxReliefValue = useMemo(() => {
    return annualContrib * 0.22; // ~22% marginal tax rate estimate
  }, [annualContrib]);

  const contribPct = annualLimit > 0 ? Math.min((annualContrib / annualLimit) * 100, 100) : 0;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await srsApi.update({
        balance:       parseFloat(form.balance)       || 0,
        annualContrib: parseFloat(form.annualContrib) || 0,
        growthRate:    parseFloat(form.growthRate)     || 6,
        age:           parseInt(form.age)              || null,
        isCitizen:     form.isCitizen === 'true',
        updatedAt:     new Date().toISOString(),
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
      <h1 className="page-title">SRS Account</h1>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="card lg:col-span-1 self-start">
          <p className="section-label mb-4">Account Details</p>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="section-label block mb-1">Current Balance</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#57534e] text-sm">S$</span>
                <input
                  type="number" step="0.01"
                  value={form.balance} onChange={(e) => set('balance', e.target.value)}
                  placeholder="0" className="input pl-8"
                />
              </div>
            </div>

            <div>
              <label className="section-label block mb-1">Annual Contribution</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#57534e] text-sm">S$</span>
                <input
                  type="number" step="100"
                  value={form.annualContrib} onChange={(e) => set('annualContrib', e.target.value)}
                  placeholder={String(SRS_ANNUAL_LIMIT)} className="input pl-8"
                />
              </div>
              <div className="mt-1.5 space-y-1">
                <div className="h-1.5 bg-[#292524] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{ width: `${contribPct}%` }}
                  />
                </div>
                <p className="text-xs text-[#57534e]">
                  {contribPct.toFixed(0)}% of annual limit ({fmtSGD(annualLimit)})
                </p>
              </div>
            </div>

            <div>
              <label className="section-label block mb-1">Expected Annual Return (%)</label>
              <input
                type="number" step="0.1"
                value={form.growthRate} onChange={(e) => set('growthRate', e.target.value)}
                placeholder="6" className="input"
              />
            </div>

            <div>
              <label className="section-label block mb-1">Current Age</label>
              <input
                type="number"
                value={form.age} onChange={(e) => set('age', e.target.value)}
                placeholder="e.g. 35" className="input" min={18} max={80}
              />
            </div>

            <div>
              <label className="section-label block mb-1">Residency</label>
              <select value={form.isCitizen} onChange={(e) => set('isCitizen', e.target.value)} className="input">
                <option value="true">Singapore Citizen / PR</option>
                <option value="false">Foreigner</option>
              </select>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
              <Save size={13} />
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
            </button>
          </form>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Key metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <p className="section-label mb-1">Current Balance</p>
              <p className="text-xl font-semibold tabular-nums text-[#e8ddd0]">{fmtSGD(balance)}</p>
            </div>
            <div className="card">
              <p className="section-label mb-1">Projected at 62</p>
              <p className="text-xl font-semibold tabular-nums text-purple-400">{fmtSGD(retirementValue)}</p>
              {age && age < 62 && (
                <p className="text-xs text-[#57534e] mt-0.5">{yearsToRetirement} years away</p>
              )}
            </div>
            <div className="card">
              <p className="section-label mb-1">Est. Annual Tax Relief</p>
              <p className="text-xl font-semibold tabular-nums text-amber-400">{fmtSGD(taxReliefValue)}</p>
              <p className="text-xs text-[#57534e] mt-0.5">~22% marginal rate estimate</p>
            </div>
            <div className="card">
              <p className="section-label mb-1">Contribution Headroom</p>
              <p className="text-xl font-semibold tabular-nums text-emerald-400">
                {fmtSGD(Math.max(0, annualLimit - annualContrib))}
              </p>
              <p className="text-xs text-[#57534e] mt-0.5">Remaining this year</p>
            </div>
          </div>

          {/* Projection chart */}
          {balance > 0 || annualContrib > 0 ? (
            <div className="card">
              <p className="section-label mb-4">Growth Projection</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projection} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#292524" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: '#78716c', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval={4}
                    />
                    <YAxis hide />
                    <Tooltip content={<ProjectionTooltip />} />
                    {age && age < 62 && (
                      <ReferenceLine
                        x={new Date().getFullYear() + yearsToRetirement}
                        stroke="#d97706"
                        strokeDasharray="4 4"
                        label={{ value: 'Age 62', fill: '#d97706', fontSize: 10, position: 'top' }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#8b5cf6', stroke: '#1c1917', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <Info size={11} className="text-[#57534e] shrink-0" />
                <p className="text-xs text-[#57534e]">
                  Assumes {form.growthRate}% p.a. return and {fmtSGD(annualContrib)}/year contribution.
                </p>
              </div>
            </div>
          ) : null}

          {/* Info card */}
          <div className="card border-purple-500/20 bg-purple-500/5">
            <p className="section-label mb-3">SRS Quick Facts</p>
            <ul className="space-y-2 text-xs text-[#78716c]">
              <li className="flex gap-2"><span className="text-purple-400 shrink-0">•</span>
                Contributions are <strong className="text-[#a8a29e]">tax-deductible</strong> in the year made.
              </li>
              <li className="flex gap-2"><span className="text-purple-400 shrink-0">•</span>
                Withdrawals from age 62 are <strong className="text-[#a8a29e]">50% taxable</strong>.
              </li>
              <li className="flex gap-2"><span className="text-purple-400 shrink-0">•</span>
                Annual limit: <strong className="text-[#a8a29e]">{fmtSGD(SRS_ANNUAL_LIMIT)}</strong> (citizens/PRs),{' '}
                <strong className="text-[#a8a29e]">{fmtSGD(SRS_ANNUAL_LIMIT_FOREIGNER)}</strong> (foreigners).
              </li>
              <li className="flex gap-2"><span className="text-purple-400 shrink-0">•</span>
                Can invest in SGX-listed stocks, ETFs, REITs, unit trusts.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
