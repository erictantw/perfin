
// ─── CPF Page ─────────────────────────────────────────────────────────────────

function CollapsibleCard({ title, badge, children, defaultOpen = true, style: extraStyle = {} }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const cardStyle = {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16, overflow: 'hidden', ...extraStyle
  };
  const headerStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1rem 1.25rem', borderBottom: open ? '1px solid rgba(255,255,255,0.05)' : 'none',
    cursor: 'pointer', userSelect: 'none'
  };
  return (
    <div style={cardStyle}>
      <div style={headerStyle} onClick={() => setOpen((o) => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p style={{ fontFamily: "'Lora',Georgia,serif", fontWeight: 400, fontSize: '0.95rem', color: '#c4bdb4' }}>{title}</p>
          {badge && <span style={{ fontSize: '0.68rem', color: '#7a7068', fontFamily: 'Inter,sans-serif', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '2px 8px', borderRadius: 6 }}>{badge}</span>}
        </div>
        <svg width="14" height="14" fill="none" stroke="#6b6057" strokeWidth="2" viewBox="0 0 24 24"
        style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {open && children}
    </div>);

}

// CPF color tokens
const CPF_COLORS = {
  oa: '#5890c0', // blue
  sa: '#d4a052', // amber
  ma: '#3aaa8a', // teal
  ra: '#9b7fd4', // purple
  srs: '#e8844a' // orange
};

// CPF contribution rates by age (employee + employer combined)
function cpfContribRates(age) {
  if (age <= 35) return { total: 0.37, oa: 0.6216, sa: 0.1622, ma: 0.2162 };
  if (age <= 45) return { total: 0.37, oa: 0.5676, sa: 0.1892, ma: 0.2432 };
  if (age <= 50) return { total: 0.37, oa: 0.5135, sa: 0.2162, ma: 0.2703 };
  if (age <= 55) return { total: 0.37, oa: 0.4054, sa: 0.3243, ma: 0.2703 };
  if (age <= 60) return { total: 0.26, oa: 0.3846, sa: 0.2692, ma: 0.3462 };
  if (age <= 65) return { total: 0.165, oa: 0.2424, sa: 0.2121, ma: 0.5455 };
  return { total: 0.125, oa: 0.08, sa: 0, ma: 0.92 };
}

const SALARY_CAP = 8000; // CPF OW ceiling (2026)

function calcMonthlyContribs(salary, age) {
  const capped = Math.min(salary, SALARY_CAP);
  const rates = cpfContribRates(age);
  const total = capped * rates.total;
  return {
    total: Math.round(total),
    oa: Math.round(total * rates.oa),
    sa: Math.round(total * rates.sa),
    ma: Math.round(total * rates.ma)
  };
}

// Projected balances year by year including monthly contributions
function projectCpfFull(oa, sa, ma, salary, currentAge, projAge = 55, annualTopUp = 0) {
  const years = projAge - currentAge;
  const result = [{ age: currentAge, oa, sa, ma, total: oa + sa + ma }];
  let curOA = oa,curSA = sa,curMA = ma;
  for (let y = 1; y <= years; y++) {
    const age = currentAge + y;
    const c = calcMonthlyContribs(salary, age - 1);
    curOA += c.oa * 12;
    curSA += c.sa * 12 + annualTopUp;
    curMA += c.ma * 12;
    curOA = curOA * (1 + CPF_RATES.OA);
    curSA = curSA * (1 + CPF_RATES.SA);
    curMA = curMA * (1 + CPF_RATES.MA);
    result.push({ age, oa: Math.round(curOA), sa: Math.round(curSA), ma: Math.round(curMA), total: Math.round(curOA + curSA + curMA) });
  }
  return result;
}

// CPF LIFE monthly payout estimate (rough)
function estimateCpfLife(saAt55) {
  const basic = saAt55 * 0.0064;
  const standard = saAt55 * 0.0082;
  const escalating = saAt55 * 0.0066;
  return {
    basic: [Math.round(basic * 0.98), Math.round(basic * 1.01)],
    standard: [Math.round(standard * 0.98), Math.round(standard * 1.02)],
    escalating: [Math.round(escalating * 0.98), Math.round(escalating * 1.02)]
  };
}

// ── Chart tooltip component (matches Overview popup style) ────────────────────
function CPFChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1f1c19', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12, padding: '0.85rem 1rem', minWidth: 180,
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
      fontFamily: 'Inter,sans-serif'
    }}>
      <p style={{ fontSize: '0.7rem', color: '#7a7068', marginBottom: 8 }}>Age {label}</p>
      {payload.map((p) =>
      <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 2, background: p.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem', color: '#a09282' }}>{p.name}</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: p.color, fontWeight: 500 }}>{fmtSGD(p.value)}</span>
        </div>
      )}
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', color: '#7a7068' }}>Total</span>
        <span style={{ fontSize: '0.75rem', color: '#e8e3db', fontWeight: 500 }}>{fmtSGD(payload.reduce((s, p) => s + p.value, 0))}</span>
      </div>
    </div>);

}

function CPFPage() {
  const [tab, setTab] = React.useState('cpf'); // 'cpf' | 'srs'
  const [tick, setTick] = React.useState(0);
  const refresh = () => setTick((t) => t + 1);
  const [showModal, setShowModal] = React.useState(false);
  const [showSettingsModal, setShowSettingsModal] = React.useState(false);
  const [showAutoUpdateConfirm, setShowAutoUpdateConfirm] = React.useState(false);
  const [autoUpdateChecked, setAutoUpdateChecked] = React.useState(false);

  // CPF data
  const cpfData = db.get('cpf', { oa: 0, sa: 0, ma: 0, ra: 0, srs: 0 });
  const [form, setForm] = React.useState({ oa: cpfData.oa || '', sa: cpfData.sa || '', ma: cpfData.ma || '', ra: cpfData.ra || '', srs: cpfData.srs || '' });

  // Settings
  const settings = db.get('cpf_settings', { salary: 7500, age: 29, retirementYear: 2051 });
  const [settingsForm, setSettingsForm] = React.useState({
    ...settings,
    oa: cpfData.oa || 0,
    sa: cpfData.sa || 0,
    ma: cpfData.ma || 0,
    ra: cpfData.ra || 0,
    showRA: (cpfData.ra || 0) > 0,
    autoUpdate: settings.autoUpdate || false,
    housingCPF: settings.housingCPF || '',
    loanTenure: settings.loanTenure || '',
    annualTopUp: settings.annualTopUp || '',
    dob: settings.dob || ''
  });

  const { oa = 0, sa = 0, ma = 0, ra = 0, srs = 0 } = cpfData;
  const total = oa + sa + ma + ra;
  const oaPct = total ? oa / total * 100 : 0;
  const saPct = total ? sa / total * 100 : 0;
  const maPct = total ? ma / total * 100 : 0;

  // Scenario sliders
  const [projAge, setProjAge] = React.useState(55);
  const [topUp, setTopUp] = React.useState(0);

  // Use live settingsForm values so Monthly Contributions syncs with drawer inputs
  const currentAge = settingsForm.dob ?
  Math.max(18, new Date().getFullYear() - new Date(settingsForm.dob).getFullYear()) :
  parseInt(settingsForm.age) || settings.age || 29;
  const salary = parseFloat(settingsForm.salary) || settings.salary || 7500;

  // Project growth
  const projection = projectCpfFull(oa, sa, ma, salary, currentAge, Math.max(projAge, currentAge + 1), topUp);
  const at55 = projection.find((p) => p.age === 55) || projection[projection.length - 1];
  const saAt55 = at55?.sa || 0;
  const oaAt55 = at55?.oa || 0;
  const totalAt55 = saAt55 + oaAt55;

  // FRS targets
  const frs2026 = 213000;
  const brs = Math.round(frs2026 * 0.5);
  const frs = frs2026;
  const ers = Math.round(frs2026 * 1.5);

  // Monthly contributions
  const contribs = calcMonthlyContribs(salary, currentAge);

  // CPF LIFE estimates
  const life = estimateCpfLife(saAt55);

  // FRS tracking: when will SA hit FRS?
  const frsHitAge = (() => {
    for (const p of projection) {
      if (p.sa >= frs) return p.age;
    }
    return null;
  })();

  function handleSave(e) {
    e.preventDefault();
    db.set('cpf', { oa: parseFloat(form.oa) || 0, sa: parseFloat(form.sa) || 0, ma: parseFloat(form.ma) || 0, ra: parseFloat(form.ra) || 0, srs: parseFloat(form.srs) || 0 });
    setShowModal(false);
    refresh();
  }

  function handleSettingsSave(e) {
    if (e && e.preventDefault) e.preventDefault();
    // Save CPF balances too
    db.set('cpf', {
      oa: parseFloat(settingsForm.oa ?? form.oa) || 0,
      sa: parseFloat(settingsForm.sa ?? form.sa) || 0,
      ma: parseFloat(settingsForm.ma ?? form.ma) || 0,
      ra: parseFloat(settingsForm.ra ?? form.ra) || 0,
      srs: parseFloat(form.srs) || 0
    });
    db.set('cpf_settings', {
      salary: parseFloat(settingsForm.salary) || 7500,
      age: settingsForm.dob ?
      new Date().getFullYear() - new Date(settingsForm.dob).getFullYear() :
      parseInt(settingsForm.age) || 29,
      retirementYear: parseInt(settingsForm.retirementYear) || 2051,
      dob: settingsForm.dob || '',
      autoUpdate: settingsForm.autoUpdate || false,
      housingCPF: parseFloat(settingsForm.housingCPF) || 0,
      loanTenure: parseInt(settingsForm.loanTenure) || 0,
      annualTopUp: parseFloat(settingsForm.annualTopUp) || 0
    });
    if (settingsForm.annualTopUp) setTopUp(parseFloat(settingsForm.annualTopUp) || 0);
    setShowSettingsModal(false);
    refresh();
  }

  // Chart
  const chartRef = React.useRef(null);
  const chartInst = React.useRef(null);
  React.useEffect(() => {
    if (!chartRef.current || !window.Chart) return;
    if (chartInst.current) chartInst.current.destroy();
    const canvas = chartRef.current;
    const labels = projection.map((p) => p.age);
    const frsLine = projection.map(() => frs);

    chartInst.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
        {
          label: 'SA', data: projection.map((p) => p.sa),
          borderColor: CPF_COLORS.sa, backgroundColor: 'rgba(212,160,82,0.1)',
          fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2
        },
        {
          label: 'OA', data: projection.map((p) => p.oa),
          borderColor: CPF_COLORS.oa, backgroundColor: 'rgba(88,144,192,0.08)',
          fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2
        },
        {
          label: 'MA', data: projection.map((p) => p.ma),
          borderColor: CPF_COLORS.ma, backgroundColor: 'rgba(58,170,138,0.06)',
          fill: true, tension: 0.4, pointRadius: 0, borderWidth: 1.5
        },
        {
          label: 'FRS Target', data: frsLine,
          borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'transparent',
          borderDash: [4, 4], tension: 0, pointRadius: 0, borderWidth: 1.5
        }]

      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: (ctx) => {
              const tooltipEl = document.getElementById('cpf-chart-tooltip');
              if (!tooltipEl) return;
              const { tooltip } = ctx;
              if (tooltip.opacity === 0) {tooltipEl.style.opacity = '0';return;}
              tooltipEl.style.opacity = '1';
              // Position follows mouse cursor via mousemove listener below
              // Build content
              const label = tooltip.title?.[0] || '';
              const items = tooltip.body?.map((b, i) => {
                const ds = ctx.chart.data.datasets[tooltip.dataPoints[i]?.datasetIndex];
                return { name: ds?.label, value: tooltip.dataPoints[i]?.parsed.y, color: ds?.borderColor };
              }).filter((i) => i.name !== 'FRS Target') || [];
              const total = items.reduce((s, i) => s + (i.value || 0), 0);
              tooltipEl.innerHTML = `
                <div style="font-size:0.7rem;color:#7a7068;margin-bottom:8px">Age ${label}</div>
                ${items.map((i) => `
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:4px">
                    <div style="display:flex;align-items:center;gap:6px">
                      <span style="width:6px;height:6px;border-radius:2px;background:${i.color};display:inline-block;flex-shrink:0"></span>
                      <span style="font-size:0.75rem;color:#a09282">${i.name}</span>
                    </div>
                    <span style="font-size:0.75rem;color:${i.color};font-weight:500">${fmtSGD(i.value)}</span>
                  </div>
                `).join('')}
                <div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between">
                  <span style="font-size:0.75rem;color:#7a7068">Total</span>
                  <span style="font-size:0.75rem;color:#e8e3db;font-weight:500">${fmtSGD(total)}</span>
                </div>
              `;
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#5a5248', font: { size: 10 }, maxTicksLimit: 10 },
            grid: { color: 'rgba(255,255,255,0.04)' }
          },
          y: {
            ticks: { color: '#5a5248', font: { size: 10 }, callback: (v) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}k` },
            grid: { color: 'rgba(255,255,255,0.04)' }
          }
        }
      }
    });
    // Follow cursor for tooltip
    const onMouseMove = (e) => {
      const tooltipEl = document.getElementById('cpf-chart-tooltip');
      if (!tooltipEl) return;
      const offset = 16;
      let x = e.clientX + offset;
      let y = e.clientY - 40;
      // Keep tooltip in viewport
      const tw = tooltipEl.offsetWidth || 200;
      if (x + tw > window.innerWidth - 8) x = e.clientX - tw - offset;
      tooltipEl.style.left = x + 'px';
      tooltipEl.style.top = y + 'px';
    };
    canvas.addEventListener('mousemove', onMouseMove);
    return () => {
      chartInst.current?.destroy();
      canvas.removeEventListener('mousemove', onMouseMove);
    };
  }, [tick, projAge, topUp]);

  const cardStyle = {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16, overflow: 'hidden'
  };
  const cardHeaderStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)'
  };
  const cardHeadingStyle = {
    fontFamily: "'Lora',Georgia,serif", fontWeight: 400, fontSize: '0.95rem', color: '#c4bdb4'
  };

  // ── SRS tab ──────────────────────────────────────────────────────────────────
  if (tab === 'srs') {
    return <SRSTab tab={tab} setTab={setTab} />;
  }

  // ── CPF tab ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 style={{ fontFamily: "'Lora',Georgia,serif", fontWeight: 400, fontSize: 'clamp(1.35rem,3vw,1.85rem)', color: '#f0ebe4', letterSpacing: '-0.02em' }}>{greet()}, {window.__userName || 'Alex'}</h1>
          <p style={{ fontSize: '0.72rem', color: '#6b6057', marginTop: 4, fontFamily: 'Inter,sans-serif' }}>{todayLong()}</p>
        </div>
      </div>

      {/* Toggle */}
      <div style={{ display: 'inline-flex', padding: 4, borderRadius: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)', alignSelf: 'flex-start' }}>
        {['cpf', 'srs'].map((t) =>
        <button key={t} onClick={() => setTab(t)} style={{
          padding: '0.4rem 1.25rem', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif',
          fontSize: '0.78rem', fontWeight: 500, transition: 'all 0.18s',
          background: tab === t ? 'rgba(255,255,255,0.08)' : 'transparent',
          color: tab === t ? '#e8ddd0' : '#6b6057'
        }}>{t.toUpperCase()}</button>
        )}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }} className="lg-two-col">
        <style>{`@media(min-width:1024px){.lg-two-col{grid-template-columns:1fr 1fr!important}}`}</style>

        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-4" data-comment-anchor="f33db7bb6d-div-383-9">

          {/* Hero card */}
          <div style={{
            ...cardStyle,
            background: 'linear-gradient(135deg, rgba(88,144,192,0.08) 0%, rgba(30,27,24,0.95) 100%)',
            border: '1px solid rgba(88,144,192,0.15)',
            padding: '1.4rem 1.5rem',
            overflow: 'visible'
          }}>
            <p style={{ fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7a7068', fontFamily: 'Inter,sans-serif', marginBottom: 8 }} data-comment-anchor="b0fba99982-p-419-13">
              Total CPF
            </p>
            <p style={{ fontFamily: "'Lora',Georgia,serif", fontSize: 'clamp(2rem,5vw,2.8rem)', fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 1, color: '#e8e3db',
              textShadow: '0 0 40px rgba(88,144,192,0.2)' }}>
              {fmtSGD(total)}
            </p>

            {/* Stacked bar */}
            <div style={{ display: 'flex', height: 6, borderRadius: 9999, overflow: 'hidden', gap: 2, marginTop: 16, marginBottom: 10 }}>
              <div style={{ width: `${oaPct}%`, background: CPF_COLORS.oa, borderRadius: 3, transition: 'width 0.7s' }} />
              <div style={{ width: `${saPct}%`, background: CPF_COLORS.sa, borderRadius: 3, transition: 'width 0.7s' }} />
              <div style={{ width: `${maPct}%`, background: CPF_COLORS.ma, borderRadius: 3, transition: 'width 0.7s' }} />
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
              { key: 'OA', pct: oaPct, color: CPF_COLORS.oa },
              { key: 'SA', pct: saPct, color: CPF_COLORS.sa },
              { key: 'MA', pct: maPct, color: CPF_COLORS.ma }].
              map(({ key, pct, color }) =>
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.68rem', color: '#7a7068', fontFamily: 'Inter,sans-serif' }}>
                    {key} <span style={{ color: '#c4bdb4', fontWeight: 500 }}>{pct.toFixed(1)}%</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Account rows */}
          <div style={{ ...cardStyle, overflow: 'hidden' }}>
            {[
            { key: 'oa', label: 'Ordinary Account', rate: '2.5%', color: CPF_COLORS.oa, value: oa, pct: oaPct },
            { key: 'sa', label: 'Special Account', rate: '4.0%', color: CPF_COLORS.sa, value: sa, pct: saPct },
            { key: 'ma', label: 'MediSave Account', rate: '4.0%', color: CPF_COLORS.ma, value: ma, pct: maPct },
            ...(ra > 0 ? [{ key: 'ra', label: 'Retirement Account', rate: '4.0%', color: CPF_COLORS.ra, value: ra, pct: total ? ra / total * 100 : 0 }] : [])].
            map(({ key, label, rate, color, value, pct }, i, arr) =>
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '0.85rem 1.25rem',
              borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
            }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.78rem', color: '#c4bdb4', fontFamily: 'Inter,sans-serif' }}>{label}</span>
                  <span style={{
                  fontSize: '0.65rem', fontWeight: 600, marginLeft: 8, padding: '1px 6px', borderRadius: 4,
                  background: 'rgba(16,185,129,0.1)', color: '#10b981', fontFamily: 'Inter,sans-serif'
                }}>{rate}</span>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e8e3db', fontFamily: 'Inter,sans-serif', tabularNums: true }}>{fmtSGD(value)}</div>
                  <div style={{ fontSize: '0.68rem', color: '#5a5248', fontFamily: 'Inter,sans-serif' }}>{pct.toFixed(1)}%</div>
                </div>
              </div>
            )}
          </div>

          {/* Monthly CPF Contributions */}
          <CollapsibleCard title="Monthly CPF Contributions" badge={`Age ${currentAge}`} style={{ overflow: 'visible' }} data-comment-anchor="a4985938f6-div-589-11">
            <div style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
                <div style={{ padding: '0.75rem', borderRadius: 10, background: `rgba(212,160,82,0.08)`, border: `1px solid rgba(212,160,82,0.2)` }}>
                  <p style={{ fontSize: '0.65rem', color: '#7a7068', fontFamily: 'Inter,sans-serif', marginBottom: 4 }}>Total (Emp + Employer)</p>
                  <p style={{ fontSize: '1.1rem', color: CPF_COLORS.sa, fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{fmtSGD(contribs.total)}</p>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ fontSize: '0.65rem', color: '#7a7068', fontFamily: 'Inter,sans-serif', marginBottom: 4 }}>To Ordinary Account</p>
                  <p style={{ fontSize: '1.1rem', color: '#c4bdb4', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{fmtSGD(contribs.oa)}</p>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ fontSize: '0.65rem', color: '#7a7068', fontFamily: 'Inter,sans-serif', marginBottom: 4 }}>To Special Account</p>
                  <p style={{ fontSize: '1.1rem', color: '#c4bdb4', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{fmtSGD(contribs.sa)}</p>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ fontSize: '0.65rem', color: '#7a7068', fontFamily: 'Inter,sans-serif', marginBottom: 4 }}>To MediSave</p>
                  <p style={{ fontSize: '1.1rem', color: '#c4bdb4', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{fmtSGD(contribs.ma)}</p>
                </div>
              </div>
              <p style={{ fontSize: '0.7rem', color: '#5a5248', fontFamily: 'Inter,sans-serif', lineHeight: 1.5 }}>
                Based on S${Math.min(salary, SALARY_CAP).toLocaleString()} monthly salary ceiling. Combined employee and employer contributions.
              </p>
            </div>
          </CollapsibleCard>

          {/* Settings card */}
          <div style={{ ...cardStyle, padding: '1rem 1.25rem' }}>

            <p style={{ fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b6057', fontFamily: 'Inter,sans-serif', marginBottom: 10, fontWeight: 600 }}>Settings</p>
            {[
            { label: 'Monthly salary', value: `S$${(settings.salary || 7500).toLocaleString()}` },
            { label: 'Current age', value: `${settings.age || 29}` },
            { label: 'Retirement year', value: `${settings.retirementYear || 2051}` }].
            map(({ label, value }, i) =>
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '0.78rem', color: '#7a7068', fontFamily: 'Inter,sans-serif' }}>{label}</span>
                <span style={{ fontSize: '0.78rem', color: '#c4bdb4', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{value}</span>
              </div>
            )}
          </div>

          {/* Edit settings button */}
          <button onClick={() => setShowSettingsModal(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '0.75rem', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            color: '#7a7068', fontSize: '0.78rem', fontFamily: 'Inter,sans-serif'
          }}
          onMouseEnter={(e) => {e.currentTarget.style.background = 'rgba(255,255,255,0.05)';e.currentTarget.style.color = '#c4bdb4';}}
          onMouseLeave={(e) => {e.currentTarget.style.background = 'rgba(255,255,255,0.02)';e.currentTarget.style.color = '#7a7068';}}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Edit settings
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
          </button>

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-col gap-4">

          {/* CPF Balance Growth chart */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <p style={cardHeadingStyle}>CPF Balance Growth</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.68rem', color: '#7a7068', fontFamily: 'Inter,sans-serif', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: '2px 8px', borderRadius: 6 }}>
                  Age {currentAge}
                </span>
              </div>
            </div>
            <div style={{ padding: '1rem 1.25rem 0.5rem' }}>
              {/* Chart */}
              <div style={{ position: 'relative', height: 220 }}>
                <canvas ref={chartRef} />
                {/* Tooltip portal */}
                <div id="cpf-chart-tooltip" style={{
                  position: 'fixed', zIndex: 100, pointerEvents: 'none', opacity: 0, transition: 'opacity 0.15s',
                  background: '#1f1c19', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                  padding: '0.85rem 1rem', minWidth: 180, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
                  fontFamily: 'Inter,sans-serif'
                }} />
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginTop: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {[
                { label: 'SA · 4% p.a.', color: CPF_COLORS.sa },
                { label: 'OA · 2.5% p.a.', color: CPF_COLORS.oa },
                { label: 'MA · 4% p.a.', color: CPF_COLORS.ma }].
                map(({ label, color }) =>
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
                    <span style={{ fontSize: '0.7rem', color: '#7a7068', fontFamily: 'Inter,sans-serif' }}>{label}</span>
                  </div>
                )}
              </div>

              {/* Projection stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                <div style={{ padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ fontSize: '0.65rem', color: '#7a7068', fontFamily: 'Inter,sans-serif', marginBottom: 6 }}>SA + OA at 55</p>
                  <p style={{ fontSize: '0.875rem', color: '#e8e3db', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{fmtSGD(totalAt55)}</p>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: 10, background: 'rgba(58,170,138,0.08)', border: '1px solid rgba(58,170,138,0.15)' }}>
                  <p style={{ fontSize: '0.65rem', color: '#7a7068', fontFamily: 'Inter,sans-serif', marginBottom: 6 }}>vs FRS ({fmtSGD(frs)})</p>
                  <p style={{ fontSize: '0.875rem', color: '#3aaa8a', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>
                    {totalAt55 >= frs ? '+' : ''}{fmtSGD(totalAt55 - frs)}
                  </p>
                </div>
                <div style={{ padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <p style={{ fontSize: '0.65rem', color: '#7a7068', fontFamily: 'Inter,sans-serif', marginBottom: 4 }}>Est. CPF LIFE</p>
                  <p style={{ fontSize: '0.875rem', color: '#e8e3db', fontFamily: 'Inter,sans-serif', fontWeight: 500, lineHeight: 1.2 }}>
                    ${life.standard[0].toLocaleString()}–${life.standard[1].toLocaleString()}
                  </p>
                  <p style={{ fontSize: '0.6rem', color: '#5a5248', fontFamily: 'Inter,sans-serif' }}>/month from 65</p>
                </div>
              </div>

              {/* FRS tracking */}
              {frsHitAge &&
              <p style={{ fontSize: '0.75rem', color: '#3aaa8a', fontFamily: 'Inter,sans-serif', marginBottom: 12 }}>
                  On track to hit FRS at age {frsHitAge} · adjust sliders to see how top-ups help
                </p>
              }

              {/* Scenario sliders */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p style={{ fontSize: '0.62rem', letterSpacing: '0.09em', textTransform: 'uppercase', color: '#6b6057', fontFamily: 'Inter,sans-serif' }}>Scenario Explorer</p>
                  {topUp > 0 && <span style={{ fontSize: '0.65rem', color: '#3aaa8a', fontFamily: 'Inter,sans-serif' }}>+{fmtSGD(topUp)}/yr top-up applied</span>}
                </div>
                {/* Project to age slider */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.72rem', color: '#7a7068', fontFamily: 'Inter,sans-serif' }}>Project to age</span>
                    <span style={{ fontSize: '0.72rem', color: '#c4bdb4', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{projAge}</span>
                  </div>
                  <input type="range" min={currentAge + 1} max={70} value={projAge} onChange={(e) => setProjAge(+e.target.value)}
                  style={{ width: '100%', accentColor: CPF_COLORS.sa }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: '0.62rem', color: '#5a5248', fontFamily: 'Inter,sans-serif' }}>Age {currentAge + 1}</span>
                    <span style={{ fontSize: '0.62rem', color: '#5a5248', fontFamily: 'Inter,sans-serif' }}>Age 70</span>
                  </div>
                </div>
                {/* Annual SA Top-up slider */}
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.72rem', color: '#7a7068', fontFamily: 'Inter,sans-serif' }}>Annual SA top-up</span>
                    <span style={{ fontSize: '0.72rem', color: topUp > 0 ? CPF_COLORS.sa : '#c4bdb4', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>
                      {topUp === 0 ? 'None' : fmtSGD(topUp)}
                    </span>
                  </div>
                  <input type="range" min={0} max={15300} step={300} value={topUp} onChange={(e) => setTopUp(+e.target.value)}
                  style={{ width: '100%', accentColor: CPF_COLORS.sa }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: '0.62rem', color: '#5a5248', fontFamily: 'Inter,sans-serif' }}>None</span>
                    <span style={{ fontSize: '0.62rem', color: '#5a5248', fontFamily: 'Inter,sans-serif' }}>S$15,300 (cap)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Retirement Milestone Tracker */}
          <CollapsibleCard title="Retirement Milestone Tracker">
            <div style={{ padding: '1rem 1.25rem' }}>
              <div className="flex flex-col gap-4">
                {[
                { label: 'Basic Retirement Sum (BRS)', target: brs, color: '#7a7068' },
                { label: 'Full Retirement Sum (FRS)', target: frs, color: CPF_COLORS.sa },
                { label: 'Enhanced Retirement Sum (ERS)', target: ers, color: '#9b7fd4' }].
                map(({ label, target, color }) => {
                  const pct = Math.min(sa / target * 100, 100);
                  return (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.75rem', color: '#c4bdb4', fontFamily: 'Inter,sans-serif' }}>{label}</span>
                        <span style={{ fontSize: '0.75rem', color, fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{pct.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 9999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 9999, background: color, opacity: 0.8, width: `${pct}%`, transition: 'width 0.7s' }} />
                      </div>
                      <p style={{ fontSize: '0.68rem', color: '#5a5248', fontFamily: 'Inter,sans-serif', marginTop: 4 }}>
                        {fmtSGD(sa)} of {fmtSGD(target)}
                      </p>
                    </div>);
                })}
              </div>
            </div>
          </CollapsibleCard>

          {/* CPF LIFE Estimate */}
          <CollapsibleCard title="CPF LIFE Estimate" badge="At age 65">
            <div style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                {[
                { label: 'Basic', range: life.basic, highlight: false },
                { label: 'Standard', range: life.standard, highlight: true, sub: '(Default Plan)' },
                { label: 'Escalating', range: life.escalating, highlight: false, sub: '+2%/yr' }].
                map(({ label, range, highlight, sub }) =>
                <div key={label} style={{
                  padding: '0.75rem', borderRadius: 10, textAlign: 'center',
                  background: highlight ? 'rgba(212,160,82,0.08)' : 'rgba(255,255,255,0.03)',
                  border: highlight ? '1px solid rgba(212,160,82,0.2)' : 'none',
                  display: 'flex', flexDirection: 'column', minHeight: 100
                }}>
                    {/* Top: label + sub */}
                    <div>
                      <p style={{ fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: highlight ? CPF_COLORS.sa : '#7a7068', fontFamily: 'Inter,sans-serif', marginBottom: 3 }}>{label}</p>
                      <p style={{ fontSize: '0.6rem', color: 'rgba(212,160,82,0.7)', fontFamily: 'Inter,sans-serif', minHeight: '1rem', lineHeight: '1rem' }}>{sub || ''}</p>
                    </div>
                    {/* Bottom: amount + /month — pushed to bottom */}
                    <div style={{ marginTop: 'auto', paddingTop: 6 }}>
                      <p style={{ fontSize: '0.95rem', color: '#e8e3db', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>${range[0].toLocaleString()}–${range[1].toLocaleString()}</p>
                      <p style={{ fontSize: '0.65rem', color: '#5a5248', fontFamily: 'Inter,sans-serif', marginTop: 2 }}>/month</p>
                    </div>
                  </div>
                )}
              </div>
              <p style={{ fontSize: '0.68rem', color: '#5a5248', fontFamily: 'Inter,sans-serif', lineHeight: 1.5 }}>
                Estimated from your projected SA at 55. Reflects CPF Board 2026 Standard Plan rates.
              </p>
            </div>
          </CollapsibleCard>

        </div>
      </div>

      {/* Update balances modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Update CPF Balances">
        <form onSubmit={handleSave} className="space-y-3">
          {[
          { key: 'oa', label: 'Ordinary Account (OA)' },
          { key: 'sa', label: 'Special Account (SA)' },
          { key: 'ma', label: 'MediSave Account (MA)' },
          { key: 'ra', label: 'Retirement Account (RA)' },
          { key: 'srs', label: 'SRS Balance' }].
          map(({ key, label }) =>
          <Field key={key} label={label}>
              <Input type="number" step="0.01" min="0" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder="0.00" />
            </Field>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">Save</button>
          </div>
        </form>
      </Modal>

      {/* Settings Drawer */}
      {showSettingsModal &&
      <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          {/* Backdrop */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={() => setShowSettingsModal(false)} />
          {/* Drawer */}
          <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: 'min(520px, 100vw)',
          background: '#1f1c19',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.4)',
          animation: 'slideInRight 0.22s cubic-bezier(0.4,0,0.2,1)'
        }}>
            <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }`}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
              <h2 style={{ fontFamily: "'Lora',Georgia,serif", fontWeight: 400, fontSize: '0.95rem', color: '#e8ddd0' }}>CPF Settings</h2>
              <button onClick={() => setShowSettingsModal(false)} style={{
              width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#7a7068', cursor: 'pointer'
            }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* CPF Balances section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontFamily: "'Lora',Georgia,serif", fontWeight: 400, fontSize: '0.875rem', color: '#c4bdb4' }}>CPF Balances</h3>
                  <span style={{ fontSize: '0.65rem', color: '#5a5248', fontFamily: 'Inter,sans-serif' }}>
                    Last saved {new Date().toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                { key: 'oa', label: 'Ordinary Account (OA)', color: CPF_COLORS.oa, rate: '2.5%' },
                { key: 'sa', label: 'Special Account (SA)', color: CPF_COLORS.sa, rate: '4%' },
                { key: 'ma', label: 'MediSave Account (MA)', color: CPF_COLORS.ma, rate: '4%' }].
                map(({ key, label, color, rate }) =>
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7d6b', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 2, background: color, display: 'inline-block' }} />
                        {label.split(' ')[0]} <span style={{ color: '#5a5248' }}>· {rate} p.a.</span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#7a7068', fontSize: '0.8rem', pointerEvents: 'none' }}>$</span>
                        <input type="number" step="0.01" min="0"
                    value={settingsForm[key] ?? form[key]}
                    onChange={(e) => {setSettingsForm((f) => ({ ...f, [key]: e.target.value }));setForm((f) => ({ ...f, [key]: e.target.value }));}}
                    placeholder="0"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.45rem 0.6rem 0.45rem 1.5rem', color: '#e8ddd0', fontSize: '0.875rem', fontFamily: 'Inter,sans-serif', outline: 'none' }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(88,144,192,0.5)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                    
                      </div>
                    </div>
                )}

                  {/* RA toggle / field */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {!settingsForm.showRA ?
                  <button onClick={() => setSettingsForm((f) => ({ ...f, showRA: true }))} style={{
                    display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                    color: '#4a4540', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'Inter,sans-serif',
                    paddingTop: 20
                  }}>
                        <span style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#6b6057' }}>+</span>
                        I have an RA (age 55+)
                      </button> :

                  <>
                        <label style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7d6b', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 2, background: CPF_COLORS.ra, display: 'inline-block' }} />
                            Retirement Account (RA)
                          </span>
                          <button onClick={() => setSettingsForm((f) => ({ ...f, showRA: false, ra: 0 }))} style={{ fontSize: '0.62rem', color: '#4a4540', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}>Remove</button>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#7a7068', fontSize: '0.8rem', pointerEvents: 'none' }}>$</span>
                          <input type="number" step="0.01" min="0"
                      value={settingsForm.ra ?? ''}
                      onChange={(e) => {setSettingsForm((f) => ({ ...f, ra: e.target.value }));setForm((f) => ({ ...f, ra: e.target.value }));}}
                      placeholder="0"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.45rem 0.6rem 0.45rem 1.5rem', color: '#e8ddd0', fontSize: '0.875rem', fontFamily: 'Inter,sans-serif', outline: 'none' }} />
                      
                        </div>
                        <p style={{ fontSize: '0.62rem', color: '#4a4540', fontFamily: 'Inter,sans-serif' }}>Created automatically at age 55.</p>
                      </>
                  }
                  </div>
                </div>

                {/* Total bar */}
                {(() => {
                const t = ['oa', 'sa', 'ma'].reduce((s, k) => s + (parseFloat(settingsForm[k]) || 0), 0);
                const ra_ = parseFloat(settingsForm.ra) || 0;
                const grand = t + ra_;
                return grand > 0 ?
                <div style={{ marginTop: 12, padding: '0.6rem 0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.68rem', color: '#7a7068', fontFamily: 'Inter,sans-serif' }}>Total CPF</span>
                        <span style={{ fontSize: '0.875rem', fontFamily: "'Lora',Georgia,serif", color: '#e8e3db' }}>{fmtSGD(grand)}</span>
                      </div>
                      <div style={{ display: 'flex', height: 3, borderRadius: 9999, overflow: 'hidden', gap: 1 }}>
                        {[
                    { k: 'oa', c: CPF_COLORS.oa }, { k: 'sa', c: CPF_COLORS.sa },
                    { k: 'ma', c: CPF_COLORS.ma }, { k: 'ra', c: CPF_COLORS.ra }].
                    map(({ k, c }) => {
                      const v = parseFloat(settingsForm[k]) || 0;
                      return grand > 0 && v > 0 ? <div key={k} style={{ background: c, width: `${v / grand * 100}%`, borderRadius: 3, transition: 'width 0.3s' }} /> : null;
                    })}
                      </div>
                    </div> :
                null;
              })()}

                <p style={{ fontSize: '0.7rem', color: '#6b6057', fontFamily: 'Inter,sans-serif', marginTop: 10, lineHeight: 1.5 }}>
                  Balances shown are for planning reference only. For your actual figures, refer to the CPF website.
                </p>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5a5248', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap' }}>Contributions & Settings</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
              </div>

              {/* Date of Birth / Salary / Retirement Year */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7d6b', fontFamily: 'Inter,sans-serif', display: 'block', marginBottom: 6 }}>Date of Birth</label>
                  <input type="date"
                value={settingsForm.dob || ''}
                onChange={(e) => setSettingsForm((f) => ({ ...f, dob: e.target.value, age: e.target.value ? new Date().getFullYear() - new Date(e.target.value).getFullYear() : f.age }))}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.45rem 0.6rem', color: '#e8ddd0', fontSize: '0.78rem', fontFamily: 'Inter,sans-serif', outline: 'none' }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(88,144,192,0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                
                  {settingsForm.dob && <p style={{ fontSize: '0.65rem', color: '#6b6057', fontFamily: 'Inter,sans-serif', marginTop: 4 }}>
                    Turns 55 in {new Date(settingsForm.dob).getFullYear() + 55}
                  </p>}
                </div>
                <div>
                  <label style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7d6b', fontFamily: 'Inter,sans-serif', display: 'block', marginBottom: 6 }}>Monthly Salary (SGD)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#7a7068', fontSize: '0.8rem', pointerEvents: 'none' }}>$</span>
                    <input type="number" step="100" min="0"
                  value={settingsForm.salary}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, salary: e.target.value }))}
                  placeholder="7500"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.45rem 0.6rem 0.45rem 1.5rem', color: '#e8ddd0', fontSize: '0.875rem', fontFamily: 'Inter,sans-serif', outline: 'none' }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(88,144,192,0.5)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                  
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7d6b', fontFamily: 'Inter,sans-serif', display: 'block', marginBottom: 6 }}>Retirement Year</label>
                  <input type="number" min="2025" max="2080"
                value={settingsForm.retirementYear}
                onChange={(e) => setSettingsForm((f) => ({ ...f, retirementYear: e.target.value }))}
                placeholder="2051"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.45rem 0.6rem', color: '#e8ddd0', fontSize: '0.875rem', fontFamily: 'Inter,sans-serif', outline: 'none' }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(88,144,192,0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                
                </div>
              </div>

              {/* Auto-update toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0.85rem 1rem', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: '0.78rem', color: '#c4bdb4', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>Auto-update balances</span>
                    <span style={{ fontSize: '0.68rem', color: '#6b6057', fontFamily: 'Inter,sans-serif' }}>Estimates monthly CPF contributions from your salary and age.</span>
                  </div>
                  <button onClick={() => {
                  if (!settingsForm.autoUpdate) {
                    setShowAutoUpdateConfirm(true);
                  } else {
                    setSettingsForm((f) => ({ ...f, autoUpdate: false }));
                  }
                }} style={{
                  flexShrink: 0, width: 44, height: 24, borderRadius: 9999, cursor: 'pointer', transition: 'background 0.2s',
                  background: settingsForm.autoUpdate ? 'rgba(212,160,82,0.35)' : 'rgba(255,255,255,0.08)',
                  border: settingsForm.autoUpdate ? '1px solid rgba(212,160,82,0.5)' : '1px solid rgba(255,255,255,0.12)',
                  position: 'relative'
                }}>
                    <span style={{
                    position: 'absolute', top: 2, left: settingsForm.autoUpdate ? 'calc(100% - 20px)' : 2,
                    width: 18, height: 18, borderRadius: '50%', background: settingsForm.autoUpdate ? '#d4a052' : '#5a5248',
                    transition: 'left 0.2s, background 0.2s'
                  }} />
                  </button>
                </div>
                {settingsForm.autoUpdate &&
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="11" height="11" fill="none" stroke="#6dbf9b" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                    <span style={{ fontSize: '0.65rem', color: '#6dbf9b', fontFamily: 'Inter,sans-serif' }}>Auto-updated through {new Date().toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })}</span>
                  </div>
              }
              </div>

              {/* Housing CPF deduction */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                    <label style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7d6b', fontFamily: 'Inter,sans-serif' }}>Monthly Housing CPF (OA)</label>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#7a7068', fontSize: '0.8rem', pointerEvents: 'none' }}>$</span>
                    <input type="number" step="10" min="0"
                  value={settingsForm.housingCPF || ''}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, housingCPF: e.target.value }))}
                  placeholder="0"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.45rem 0.6rem 0.45rem 1.5rem', color: '#e8ddd0', fontSize: '0.875rem', fontFamily: 'Inter,sans-serif', outline: 'none' }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(88,144,192,0.5)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                  
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7d6b', fontFamily: 'Inter,sans-serif', display: 'block', marginBottom: 6 }}>Remaining Loan Tenure (Yrs)</label>
                  <input type="number" min="0" max="30"
                value={settingsForm.loanTenure || ''}
                onChange={(e) => setSettingsForm((f) => ({ ...f, loanTenure: e.target.value }))}
                placeholder="25"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.45rem 0.6rem', color: '#e8ddd0', fontSize: '0.875rem', fontFamily: 'Inter,sans-serif', outline: 'none' }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(88,144,192,0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                
                  <p style={{ fontSize: '0.65rem', color: '#6b6057', fontFamily: 'Inter,sans-serif', marginTop: 4 }}>Deductions stop automatically once tenure reaches zero.</p>
                </div>
              </div>

              {/* Annual SA Top-Up */}
              <div>
                <label style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7d6b', fontFamily: 'Inter,sans-serif', display: 'block', marginBottom: 6 }}>Annual Voluntary SA Top-Up (SGD)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#7a7068', fontSize: '0.8rem', pointerEvents: 'none' }}>$</span>
                  <input type="number" step="100" min="0" max="15300"
                value={settingsForm.annualTopUp || topUp || ''}
                onChange={(e) => {setSettingsForm((f) => ({ ...f, annualTopUp: e.target.value }));setTopUp(parseFloat(e.target.value) || 0);}}
                placeholder="0"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.45rem 0.6rem 0.45rem 1.5rem', color: '#e8ddd0', fontSize: '0.875rem', fontFamily: 'Inter,sans-serif', outline: 'none' }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(212,160,82,0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                
                </div>
                <p style={{ fontSize: '0.68rem', color: '#8a7d6b', fontFamily: 'Inter,sans-serif', marginTop: 5, lineHeight: 1.5 }}>
                  Up to S$8,000/year qualifies for income tax relief. Feeds your FRS projection.
                </p>
              </div>

              {/* Advanced settings */}
              <details style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 14 }}>
                <summary style={{ fontSize: '0.72rem', color: '#5a5248', fontFamily: 'Inter,sans-serif', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#8a7d6b'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#5a5248'}>
                  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ transition: 'transform 0.15s', flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
                  Advanced settings
                </summary>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 16 }}>
                  <p style={{ fontSize: '0.7rem', color: '#8a7d6b', fontFamily: 'Inter,sans-serif', lineHeight: 1.5 }}>Update the FRS base when CPF Board announces new figures, typically each January.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7d6b', fontFamily: 'Inter,sans-serif', display: 'block', marginBottom: 6 }}>FRS Base Year</label>
                      <input type="number" min="2020" max="2040"
                    value={settingsForm.frsYear || new Date().getFullYear()}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, frsYear: e.target.value }))}
                    placeholder={String(new Date().getFullYear())}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.45rem 0.6rem', color: '#e8ddd0', fontSize: '0.875rem', fontFamily: 'Inter,sans-serif', outline: 'none' }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(88,144,192,0.5)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                    
                      <p style={{ fontSize: '0.62rem', color: '#6b6057', fontFamily: 'Inter,sans-serif', marginTop: 4 }}>Individuals turning 55 in this year</p>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8a7d6b', fontFamily: 'Inter,sans-serif', display: 'block', marginBottom: 6 }}>FRS Amount (SGD)</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#7a7068', fontSize: '0.8rem', pointerEvents: 'none' }}>$</span>
                        <input type="number" step="100" min="0"
                      value={settingsForm.frsAmount || 213000}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, frsAmount: e.target.value }))}
                      placeholder="213000"
                      style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.45rem 0.6rem 0.45rem 1.5rem', color: '#e8ddd0', fontSize: '0.875rem', fontFamily: 'Inter,sans-serif', outline: 'none' }}
                      onFocus={(e) => e.target.style.borderColor = 'rgba(212,160,82,0.5)'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
                      
                      </div>
                    </div>
                  </div>
                </div>
              </details>

            </div>

            {/* Auto-update confirmation popup */}
            {showAutoUpdateConfirm &&
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                <div style={{
              width: '100%', maxWidth: 384, borderRadius: 16, padding: '1.5rem',
              background: 'rgb(42,37,32)', border: '1px solid rgba(212,160,82,0.2)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    <h3 style={{ fontFamily: "'Lora',Georgia,serif", fontWeight: 400, fontSize: '0.95rem', color: '#c4bdb4' }}>Enable Auto-Update?</h3>
                    <p style={{ fontSize: '0.72rem', color: '#7a7068', fontFamily: 'Inter,sans-serif', lineHeight: 1.6 }}>
                      Wealthfolio will estimate monthly CPF contributions based on your salary and age, and add them to your balances automatically. Figures are for planning reference only — refer to the CPF website for actual balances.
                    </p>
                  </div>
                  {/* Checkbox */}
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
                    <div style={{ position: 'relative', marginTop: 2, flexShrink: 0 }}>
                      <input type="checkbox" checked={autoUpdateChecked} onChange={(e) => setAutoUpdateChecked(e.target.checked)}
                  style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer', width: '100%', height: '100%', margin: 0 }} />
                      <div style={{
                    width: 18, height: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: autoUpdateChecked ? 'rgba(212,160,82,0.2)' : 'rgba(255,255,255,0.04)',
                    border: autoUpdateChecked ? '1px solid rgba(212,160,82,0.5)' : '1px solid rgba(255,255,255,0.12)',
                    transition: 'all 0.15s'
                  }}>
                        {autoUpdateChecked && <svg width="10" height="10" fill="none" stroke="#d4a052" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#a09890', fontFamily: 'Inter,sans-serif', lineHeight: 1.5 }}>
                      I have verified my CPF balances against the CPF website and they are up to date.
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => {setShowAutoUpdateConfirm(false);setAutoUpdateChecked(false);}} style={{
                  flex: 1, padding: '0.6rem', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#7a7068', fontSize: '0.8rem', fontFamily: 'Inter,sans-serif'
                }}>Not yet</button>
                    <button onClick={() => {
                  if (!autoUpdateChecked) return;
                  setSettingsForm((f) => ({ ...f, autoUpdate: true }));
                  setShowAutoUpdateConfirm(false);
                  setAutoUpdateChecked(false);
                }} style={{
                  flex: 1, padding: '0.6rem', borderRadius: 8, cursor: 'pointer',
                  background: autoUpdateChecked ? 'rgba(212,160,82,0.15)' : 'rgba(255,255,255,0.03)',
                  border: autoUpdateChecked ? '1px solid rgba(212,160,82,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  color: autoUpdateChecked ? '#d4a052' : '#4a4540',
                  fontSize: '0.8rem', fontWeight: 500, fontFamily: 'Inter,sans-serif',
                  transition: 'all 0.15s'
                }}>Got it, enable</button>
                  </div>
                </div>
              </div>
          }

            {/* Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
              <button onClick={handleSettingsSave} style={{
              width: '100%', padding: '0.65rem', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
              color: '#10b981', fontSize: '0.875rem', fontWeight: 500, fontFamily: 'Inter,sans-serif'
            }}
            onMouseEnter={(e) => {e.currentTarget.style.background = 'rgba(16,185,129,0.2)';}}
            onMouseLeave={(e) => {e.currentTarget.style.background = 'rgba(16,185,129,0.12)';}}>
                Done
              </button>
            </div>
          </div>
        </div>
      }
    </div>);

}

Object.assign(window, { CPFPage });