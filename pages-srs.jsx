// ─── SRS Page Component ───────────────────────────────────────────────────────
// Loaded after pages-cpf.jsx; references fmtSGD, todayLong, db, Modal, Field, Input from lib.js / components.jsx

const SRS_COLOR = '#d4a052';
const SRS_YEAR = new Date().getFullYear();

// ── Projection math ───────────────────────────────────────────────────────────
function projectSRS(currentBalance, annualContrib, returnRate, withdrawAge, currentAge) {
  const years = Math.max(withdrawAge - currentAge, 1);
  const r = returnRate / 100;
  const points = [];
  let bal = currentBalance;
  for (let y = 0; y <= years; y++) {
    points.push({ age: currentAge + y, value: Math.round(bal) });
    bal = (bal + annualContrib) * (1 + r);
  }
  return points;
}

// ── SVG line chart ────────────────────────────────────────────────────────────
function SRSChart({ points, conservativePoints, optimisticPoints, withdrawAge }) {
  const W = 320,H = 130,PAD_LEFT = 36;
  const allVals = [...points, ...conservativePoints, ...optimisticPoints].map((p) => p.value);
  const maxVal = Math.max(...allVals, 1);
  const n = points.length;

  function toX(i) {return PAD_LEFT + i / (n - 1) * (W - PAD_LEFT);}
  function toY(v) {return H - v / maxVal * H;}
  function makePath(pts) {
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ');
  }
  function makeArea(pts) {
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ');
    return `${line} L${toX(n - 1).toFixed(1)},${H} L${toX(0).toFixed(1)},${H} Z`;
  }

  // Gridlines
  const gridVals = [maxVal * 0.33, maxVal * 0.67, maxVal];
  function fmtK(v) {
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
    return `$${v}`;
  }

  const endVal = points[points.length - 1]?.value || 0;
  const endX = toX(n - 1);
  const endY = toY(endVal);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 14}`} style={{ display: 'block', overflow: 'visible' }}>
      {/* Grid lines */}
      {gridVals.map((v, i) =>
      <g key={i}>
          <line x1={PAD_LEFT} y1={toY(v)} x2={W} y2={toY(v)} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <text x={PAD_LEFT - 3} y={toY(v) + 3} fontSize="8" fill="#6b6057" textAnchor="end">{fmtK(v)}</text>
        </g>
      )}

      {/* Area fill */}
      <path d={makeArea(points)} fill="rgba(212,160,82,0.07)" />

      {/* Conservative line */}
      <path d={makePath(conservativePoints)} fill="none" stroke="rgba(212,160,82,0.3)" strokeWidth="1.5" strokeDasharray="4,3" />

      {/* Optimistic line */}
      <path d={makePath(optimisticPoints)} fill="none" stroke="rgba(212,160,82,0.3)" strokeWidth="1.5" strokeDasharray="4,3" />

      {/* Base line */}
      <path d={makePath(points)} fill="none" stroke={SRS_COLOR} strokeWidth="2" />

      {/* Now label */}
      <line x1={toX(0)} y1={0} x2={toX(0)} y2={H} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <text x={toX(0) + 3} y={H + 11} fontSize="9" fill="#6b6057">Now</text>

      {/* Withdraw age marker */}
      <line x1={endX} y1={0} x2={endX} y2={H} stroke="rgba(212,160,82,0.35)" strokeWidth="1" strokeDasharray="3,3" />
      <text x={endX} y={10} fontSize="9" fill={SRS_COLOR} fontWeight="600" textAnchor="end">Age {withdrawAge}</text>
      <text x={endX} y={endY - 6} fontSize="10" fill={SRS_COLOR} fontWeight="700" textAnchor="end">{fmtK(endVal)}</text>
    </svg>);

}

// ── Main SRS Tab ──────────────────────────────────────────────────────────────
function SRSTab({ tab, setTab }) {
  // Persist all SRS data in db
  const initialData = db.get('srs_data', {
    operator: 'DBS',
    cash: '',
    asOfDate: '',
    taxResidency: 'SC_PR', // 'SC_PR' | 'Foreigner'
    contributions: {}, // { '2026': 0, ... }
    hasSetup: false
  });

  const [data, setData] = React.useState(initialData);
  const [returnRate, setReturnRate] = React.useState(6);
  const [withdrawAge, setWithdrawAge] = React.useState(63);
  const [showSetup, setShowSetup] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [extraYears, setExtraYears] = React.useState([]);

  // Derive from CPF settings for current age
  const cpfSettings = db.get('cpf_settings', { age: 29 });
  const currentAge = parseInt(cpfSettings.age) || 29;

  const cap = 15300;
  const cashBal = parseFloat(data.cash) || 0;
  const thisYearContrib = parseFloat(data.contributions?.[SRS_YEAR]) || 0;
  const capPct = Math.min(thisYearContrib / cap * 100, 100);

  // Investments from db (tagged "Retirement - SRS") — placeholder $0 for now
  const investments = 0;
  const totalSRS = cashBal + investments;

  // Annual contributions: average of past years or this year
  const contribYears = Object.values(data.contributions || {}).map(Number).filter(Boolean);
  const avgAnnualContrib = contribYears.length ? contribYears.reduce((a, b) => a + b, 0) / contribYears.length : cap;

  const basePoints = projectSRS(totalSRS, avgAnnualContrib, returnRate, withdrawAge, currentAge);
  const conservativePoints = projectSRS(totalSRS, avgAnnualContrib, Math.max(returnRate - 2, 1), withdrawAge, currentAge);
  const optimisticPoints = projectSRS(totalSRS, avgAnnualContrib, returnRate + 2, withdrawAge, currentAge);

  function saveData(updates) {
    const next = { ...data, ...updates };
    setData(next);
    db.set('srs_data', next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function updateContrib(year, val) {
    const next = { ...data, contributions: { ...data.contributions, [year]: val } };
    setData(next);
    db.set('srs_data', next);
  }

  const cardS = {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16, padding: '1.25rem'
  };
  const labelS = {
    fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
    color: '#7a7068', fontFamily: 'Inter,sans-serif', display: 'block', marginBottom: 5
  };
  const inputS = {
    width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#e8ddd0',
    fontFamily: 'Inter,sans-serif', outline: 'none'
  };

  const TabToggle = () =>
  <div style={{ display: 'inline-flex', padding: 4, borderRadius: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', alignSelf: 'flex-start' }}>
      {['cpf', 'srs'].map((t) =>
    <button key={t} onClick={() => setTab(t)} style={{
      padding: '0.4rem 1.25rem', borderRadius: 9, border: 'none', cursor: 'pointer',
      fontFamily: 'Inter,sans-serif', fontSize: '0.78rem', fontWeight: 500, transition: 'all 0.18s',
      background: tab === t ? 'rgba(255,255,255,0.08)' : 'transparent',
      color: tab === t ? '#e8ddd0' : '#6b6057'
    }}>{t.toUpperCase()}</button>
    )}
    </div>;


  const userName = window.__userName || 'Alex';

  // ── Empty / intro state ───────────────────────────────────────────────────
  if (!data.hasSetup && !showSetup) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 style={{ fontFamily: "'Lora',Georgia,serif", fontWeight: 400, fontSize: 'clamp(1.35rem,3vw,1.85rem)', color: '#f0ebe4', letterSpacing: '-0.02em' }}>{greet()}, {userName}</h1>
          <p style={{ fontSize: '0.72rem', color: '#6b6057', marginTop: 4, fontFamily: 'Inter,sans-serif' }}>{todayLong()}</p>
        </div>
        <TabToggle />

        {/* Intro card */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '3rem 1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(212,160,82,0.1)', border: '1px solid rgba(212,160,82,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>🏛️</div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#e8ddd0', marginBottom: 8, fontFamily: 'Inter,sans-serif' }}>Track your SRS account</h3>
          <p style={{ fontSize: '0.8rem', color: '#7a7068', maxWidth: 380, lineHeight: 1.7, marginBottom: 20, fontFamily: 'Inter,sans-serif' }}>
            The Supplementary Retirement Scheme lets you contribute up to <strong style={{ color: '#c4bdb4' }}>$15,300/year</strong> (SC/PR) and deduct it from your taxable income — a powerful tax-deferral vehicle alongside CPF.
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['Up to $15,300 tax relief/yr', 'DBS · OCBC · UOB', '50% taxable on withdrawal', 'Invest in SGX, ETFs, bonds'].map((pill) =>
            <span key={pill} style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.72rem', color: '#a09282', fontFamily: 'Inter,sans-serif' }}>{pill}</span>
            )}
          </div>
          <button onClick={() => setShowSetup(true)} style={{
            padding: '0.6rem 1.75rem', borderRadius: 9, border: 'none',
            background: 'linear-gradient(135deg, #d4a052, #a07840)',
            color: '#1a1714', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif'
          }}>Set up SRS →</button>
        </div>
      </div>);

  }

  // ── Full SRS view ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: "'Lora',Georgia,serif", fontWeight: 400, fontSize: 'clamp(1.35rem,3vw,1.85rem)', color: '#f0ebe4', letterSpacing: '-0.02em' }}>{greet()}, {userName}</h1>
        <p style={{ fontSize: '0.72rem', color: '#6b6057', marginTop: 4, fontFamily: 'Inter,sans-serif' }}>{todayLong()}</p>
      </div>
      <TabToggle />

      {/* Two-col layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }} className="srs-two-col">
        <style>{`@media(min-width:1024px){.srs-two-col{grid-template-columns:1fr 1fr!important}}`}</style>

        {/* ── LEFT: Account Details ── */}
        <div className="flex flex-col gap-4">

          {/* Total SRS Value hero */}
          <div style={{ background: 'linear-gradient(135deg, rgba(212,160,82,0.1) 0%, rgba(212,160,82,0.04) 100%)', border: '1px solid rgba(212,160,82,0.18)', borderRadius: 16, padding: '1.25rem' }}>
            <p style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#8a7d6b', fontFamily: 'Inter,sans-serif' }}>Total SRS Value</p>
            <p style={{ fontFamily: "'Lora',Georgia,serif", fontSize: 'clamp(1.8rem,4vw,2.4rem)', fontWeight: 400, letterSpacing: '-0.03em', color: '#e8e3db', margin: '6px 0 4px', lineHeight: 1 }}>
              {fmtSGD(totalSRS)}
            </p>
            <p style={{ fontSize: '0.72rem', color: '#6b6057', fontFamily: 'Inter,sans-serif' }}>
              Cash + investments across {data.operator} SRS account
            </p>
            <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b6057', fontFamily: 'Inter,sans-serif', marginBottom: 3 }}>Cash</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8ddd0', fontFamily: 'Inter,sans-serif' }}>{fmtSGD(cashBal)}</p>
                <p style={{ fontSize: '0.7rem', color: '#5a5248', fontFamily: 'Inter,sans-serif', marginTop: 1 }}>Uninvested</p>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
              <div style={{ flex: 1, paddingLeft: 16 }}>
                <p style={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b6057', fontFamily: 'Inter,sans-serif', marginBottom: 3 }}>Investments</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8ddd0', fontFamily: 'Inter,sans-serif' }}>{fmtSGD(investments)}</p>
                <p style={{ fontSize: '0.7rem', color: '#5a5248', fontFamily: 'Inter,sans-serif', marginTop: 1 }}>Tag holdings "Retirement - SRS"</p>
              </div>
            </div>
          </div>

          {/* Account Details card */}
          <div style={cardS}>
            <p style={{ ...labelS, marginBottom: 14 }}>Account Details</p>

            {/* Operator */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelS}>Operator</label>
              <select value={data.operator} onChange={(e) => saveData({ operator: e.target.value })}
              style={{ ...inputS, cursor: 'pointer', appearance: 'none' }}>
                <option>DBS</option>
                <option>OCBC</option>
                <option>UOB</option>
              </select>
            </div>

            {/* Cash Balance */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelS}>Cash Balance (uninvested)</label>
              <div style={{ display: 'flex', alignItems: 'stretch', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
                <span style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#6b6057', borderRight: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', fontFamily: 'Inter,sans-serif' }}>SGD</span>
                <input type="number" min="0" step="100" placeholder="0.00" value={data.cash}
                onChange={(e) => setData((d) => ({ ...d, cash: e.target.value }))}
                onBlur={(e) => saveData({ cash: e.target.value })}
                style={{ flex: 1, background: 'transparent', border: 'none', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#e8ddd0', outline: 'none', fontFamily: 'Inter,sans-serif' }} />
              </div>
              <p style={{ fontSize: '0.65rem', color: '#5a5248', fontFamily: 'Inter,sans-serif', marginTop: 3 }}>Funds sitting in your SRS account, not yet invested</p>
            </div>

            {/* As of Date */}
            <div style={{ marginBottom: 0 }}>
              <label style={labelS}>As of Date</label>
              <input type="date" value={data.asOfDate}
              onChange={(e) => saveData({ asOfDate: e.target.value })}
              style={{ ...inputS, appearance: 'none', colorScheme: 'dark' }} />
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />

            {/* Annual Contributions */}
            <div data-comment-anchor="7d6ffafe35-div-297-13">
              <p style={labelS}>Annual Contributions</p>
              {/* Current year row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: '0.75rem', color: '#7a7068', fontFamily: 'Inter,sans-serif', width: 36, flexShrink: 0 }}>{SRS_YEAR}</span>
                <span style={{ fontSize: '0.65rem', color: '#5a5248', fontFamily: 'Inter,sans-serif', width: 50, flexShrink: 0 }}>31 Dec</span>
                <div style={{ display: 'flex', alignItems: 'stretch', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, overflow: 'hidden', flex: 1 }}>
                  <span style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem', color: '#5a5248', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', fontFamily: 'Inter,sans-serif' }}>SGD</span>
                  <input type="number" min="0" step="100" placeholder="0"
                    value={data.contributions?.[SRS_YEAR] || ''}
                    onChange={(e) => updateContrib(SRS_YEAR, e.target.value)}
                    style={{ flex: 1, background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', fontSize: '0.78rem', color: '#e8ddd0', outline: 'none', fontFamily: 'Inter,sans-serif' }} />
                </div>
              </div>
              {/* Extra years added by user */}
              {extraYears.map((year) => (
                <div key={year} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: '0.75rem', color: '#7a7068', fontFamily: 'Inter,sans-serif', width: 36, flexShrink: 0 }}>{year}</span>
                  <span style={{ fontSize: '0.65rem', color: '#5a5248', fontFamily: 'Inter,sans-serif', width: 50, flexShrink: 0 }}>31 Dec</span>
                  <div style={{ display: 'flex', alignItems: 'stretch', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, overflow: 'hidden', flex: 1 }}>
                    <span style={{ padding: '0.35rem 0.6rem', fontSize: '0.72rem', color: '#5a5248', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', fontFamily: 'Inter,sans-serif' }}>SGD</span>
                    <input type="number" min="0" step="100" placeholder="0"
                      value={data.contributions?.[year] || ''}
                      onChange={(e) => updateContrib(year, e.target.value)}
                      style={{ flex: 1, background: 'transparent', border: 'none', padding: '0.35rem 0.6rem', fontSize: '0.78rem', color: '#e8ddd0', outline: 'none', fontFamily: 'Inter,sans-serif' }} />
                  </div>
                  <button onClick={() => setExtraYears(ey => ey.filter(y => y !== year))} style={{ background: 'none', border: 'none', color: '#5a5248', cursor: 'pointer', fontSize: '0.75rem', padding: '0 4px', flexShrink: 0 }}>×</button>
                </div>
              ))}
              {/* Add year button */}
              <button onClick={() => {
                const nextYear = extraYears.length > 0 ? Math.min(...extraYears) - 1 : SRS_YEAR - 1;
                setExtraYears(ey => [...ey, nextYear]);
              }} style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                color: '#5a5248', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'Inter,sans-serif',
                padding: '4px 0', marginBottom: 12
              }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', lineHeight: 1 }}>+</span>
                Add year
              </button>
              {/* Save button */}
              <button onClick={() => saveData({})} style={{
                width: '100%', padding: '0.5rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'rgba(212,160,82,0.12)', border: '1px solid rgba(212,160,82,0.2)',
                color: SRS_COLOR, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter,sans-serif'
              }}>Save contributions</button>
            </div>
          </div>

          {saved &&
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.6rem 0.9rem', borderRadius: 10, background: 'rgba(212,160,82,0.1)', border: '1px solid rgba(212,160,82,0.2)' }}>
              <svg width="13" height="13" fill="none" stroke={SRS_COLOR} strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
              <span style={{ fontSize: '0.72rem', color: SRS_COLOR, fontFamily: 'Inter,sans-serif' }}>SRS data saved</span>
            </div>
          }
        </div>

        {/* ── RIGHT: Projections ── */}
        <div className="flex flex-col gap-4">

          {/* Contributions bar */}
          <div style={{ ...cardS, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7a7068', fontFamily: 'Inter,sans-serif' }}>{SRS_YEAR} Contributions</span>
              <span style={{ fontSize: '0.7rem', color: '#5a5248', fontFamily: 'Inter,sans-serif' }}>SC/PR cap · {fmtSGD(cap)}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: `${capPct}%`, borderRadius: 3, background: 'linear-gradient(90deg, #d4a052, #a07840)', transition: 'width 0.4s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e8ddd0', fontFamily: 'Inter,sans-serif' }}>
                {thisYearContrib > 0 ? fmtSGD(thisYearContrib) + ' contributed' : '$0 contributed'}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#5a5248', fontFamily: 'Inter,sans-serif' }}>
                {thisYearContrib > 0 ? `${fmtSGD(cap - thisYearContrib)} remaining` : 'No contribution recorded yet'}
              </span>
            </div>
          </div>

          {/* Growth Projection */}
          <div style={{ ...cardS, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7a7068', fontFamily: 'Inter,sans-serif', paddingTop: 2 }}>SRS Growth Projection</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                {/* Return slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.7rem', color: '#6b6057', fontFamily: 'Inter,sans-serif' }}>Return</span>
                  <input type="range" min="2" max="10" step="0.5" value={returnRate}
                  onChange={(e) => setReturnRate(parseFloat(e.target.value))}
                  style={{ width: 76, accentColor: SRS_COLOR, cursor: 'pointer' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: SRS_COLOR, minWidth: 34, fontFamily: 'Inter,sans-serif' }}>{returnRate.toFixed(1)}%</span>
                </div>
                {/* Withdraw age slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.7rem', color: '#6b6057', fontFamily: 'Inter,sans-serif' }}>Withdraw at</span>
                  <input type="range" min="62" max="75" step="1" value={withdrawAge}
                  onChange={(e) => setWithdrawAge(parseInt(e.target.value))}
                  style={{ width: 76, accentColor: SRS_COLOR, cursor: 'pointer' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: SRS_COLOR, minWidth: 24, fontFamily: 'Inter,sans-serif' }}>{withdrawAge}</span>
                </div>
              </div>
            </div>

            <SRSChart
              points={basePoints}
              conservativePoints={conservativePoints}
              optimisticPoints={optimisticPoints}
              withdrawAge={withdrawAge} />
            

            {/* Legend */}
            <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
              {[
              { label: `Base (${returnRate.toFixed(1)}%)`, color: SRS_COLOR, solid: true },
              { label: `Conservative (${Math.max(returnRate - 2, 1).toFixed(1)}%)`, color: 'rgba(212,160,82,0.45)', solid: false },
              { label: `Optimistic (${(returnRate + 2).toFixed(1)}%)`, color: 'rgba(212,160,82,0.45)', solid: false }].
              map(({ label, color, solid }) =>
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: '#6b6057', fontFamily: 'Inter,sans-serif' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  {label}
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 12, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '0.7rem', color: '#5a5248', flexShrink: 0, marginTop: 1 }}>ⓘ</span>
              <p style={{ fontSize: '0.7rem', color: '#5a5248', lineHeight: 1.5, margin: 0, fontFamily: 'Inter,sans-serif' }}>
                Projections are arithmetic estimates only. Not financial advice. Speak to a licensed MAS financial adviser for personalised retirement planning.
              </p>
            </div>
          </div>

          {/* Tax Benefit Summary */}
          <div style={cardS}>
            <p style={{ ...labelS, marginBottom: 12 }}>Tax Benefit Summary</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
              { label: 'This year relief', value: thisYearContrib > 0 ? fmtSGD(thisYearContrib) : '—', color: SRS_COLOR },
              { label: 'Annual cap', value: fmtSGD(cap), color: '#c4bdb4' },
              { label: 'Withdrawal tax', value: '50% of amount', color: '#c4bdb4' },
              { label: 'Earliest withdrawal', value: 'Age 62', color: '#c4bdb4' }].
              map(({ label, value, color }) =>
              <div key={label} style={{ padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.02)' }}>
                  <p style={{ fontSize: '0.62rem', color: '#5a5248', fontFamily: 'Inter,sans-serif', marginBottom: 4 }}>{label}</p>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color, fontFamily: 'Inter,sans-serif' }}>{value}</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>);

}

Object.assign(window, { SRSTab });