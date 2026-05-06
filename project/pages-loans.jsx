
// ─── Loans Page ───────────────────────────────────────────────────────────────
const LOAN_TYPES = ['HDB','Private Mortgage','Car','Personal','Education','Business','Other'];
const emptyLoan = { loan_name:'', loan_type:'HDB', principal:'', outstanding_balance:'', annual_rate:'', tenure_months:'', monthly_payment:'', start_date:'' };

function LoansPage() {
  const [tick, setTick] = React.useState(0);
  const refresh = () => setTick(t => t + 1);
  const [showModal, setShowModal] = React.useState(false);
  const [editItem, setEditItem] = React.useState(null);
  const [form, setForm] = React.useState(emptyLoan);
  const [showCalc, setShowCalc] = React.useState(false);
  const [calc, setCalc] = React.useState({ principal:'', rate:'', years:'' });
  const [schedule, setSchedule] = React.useState([]);
  const [calcRan, setCalcRan] = React.useState(false);
  const setF = f => e => setForm(p => ({...p, [f]: e.target.value}));
  const setC = f => e => setCalc(p => ({...p, [f]: e.target.value}));

  const loans = db.get('loans', []);
  const totalOutstanding = loans.reduce((s,l) => s + (l.outstanding_balance||0), 0);
  const totalMonthly = loans.reduce((s,l) => s + (l.monthly_payment || calcMonthlyRepayment(l.principal, l.annual_rate, l.tenure_months)), 0);

  function openAdd() { setEditItem(null); setForm(emptyLoan); setShowModal(true); }
  function openEdit(l) {
    setEditItem(l);
    setForm({ loan_name: l.loan_name, loan_type: l.loan_type||'HDB', principal: l.principal, outstanding_balance: l.outstanding_balance, annual_rate: l.annual_rate, tenure_months: l.tenure_months, monthly_payment: l.monthly_payment||'', start_date: l.start_date||'' });
    setShowModal(true);
  }
  function handleSave(e) {
    e.preventDefault();
    const list = db.get('loans',[]);
    const payload = { ...form, principal: parseFloat(form.principal), outstanding_balance: parseFloat(form.outstanding_balance), annual_rate: parseFloat(form.annual_rate)||0, tenure_months: parseInt(form.tenure_months), monthly_payment: form.monthly_payment ? parseFloat(form.monthly_payment) : null };
    if (editItem) db.set('loans', list.map(l => l.id === editItem.id ? {...l,...payload} : l));
    else { list.push({ id: db.nextId('loans'), ...payload }); db.set('loans', list); }
    setShowModal(false); refresh();
  }
  function handleDelete(id) {
    if (!confirm('Remove this loan?')) return;
    db.set('loans', db.get('loans',[]).filter(l => l.id !== id)); refresh();
  }
  function runCalc() {
    const p = parseFloat(calc.principal), r = parseFloat(calc.rate)/100, m = parseInt(calc.years)*12;
    if (!p || isNaN(r) || !m) return;
    setSchedule(calcMortgageSchedule(p, r, m)); setCalcRan(true);
  }
  const calcMonthly = (() => {
    const p = parseFloat(calc.principal), r = parseFloat(calc.rate)/100, m = parseInt(calc.years)*12;
    return (!p||isNaN(r)||!m) ? 0 : calcMonthlyRepayment(p, r, m);
  })();
  const totalInterest = schedule.reduce((s,r) => s + r.interest, 0);

  // Chart ref
  const chartRef = React.useRef(null);
  const chartInst = React.useRef(null);
  React.useEffect(() => {
    if (!calcRan || !chartRef.current || !window.Chart) return;
    if (chartInst.current) chartInst.current.destroy();
    const chartData = schedule.filter((_,i) => i % 12 === 11 || i === schedule.length-1).map(s => ({ year: Math.ceil(s.month/12), balance: s.balance }));
    chartInst.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: chartData.map(d => `Yr ${d.year}`),
        datasets: [{ label: 'Balance', data: chartData.map(d => d.balance), borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.08)', fill: true, tension: 0.4, pointRadius: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1c1917', borderColor: '#44403c', borderWidth: 1, callbacks: { label: ctx => ` Balance: ${fmtSGD(ctx.parsed.y)}` } } },
        scales: {
          x: { ticks: { color: '#78716c', font: { size: 10 } }, grid: { color: '#292524' } },
          y: { ticks: { color: '#78716c', font: { size: 10 }, callback: v => `$${(v/1000).toFixed(0)}k` }, grid: { color: '#1c1917' } }
        }
      }
    });
  }, [calcRan, schedule]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 style={{fontFamily:"'Lora',Georgia,serif",fontWeight:400,fontSize:'1.5rem',color:'#f0ebe4',letterSpacing:'-0.01em'}}>Loans</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCalc(true)} className="btn-secondary flex items-center gap-1.5">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="12" y2="14"/></svg>
            Calculator
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-1.5">
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add loan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard title="Total Outstanding" value={fmtSGD(totalOutstanding)} className="border-red-900/30" icon={() => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} />
        <StatCard title="Monthly Repayments" value={fmtSGD(totalMonthly)} />
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-800"><h2 className="text-sm font-semibold text-stone-100">Active Loans</h2></div>
        {loans.length === 0 ? (
          <EmptyState icon={() => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/></svg>}
            title="No loans recorded" description="Add your mortgages, car loans, or other liabilities." action="Add loan" onAction={openAdd} />
        ) : (
          <div className="divide-y divide-stone-800">
            {loans.map(l => {
              const monthly = l.monthly_payment || calcMonthlyRepayment(l.principal, l.annual_rate, l.tenure_months);
              const paidOff = l.outstanding_balance / l.principal * 100;
              return (
                <div key={l.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-stone-100 text-sm">{l.loan_name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">{l.loan_type}</span>
                      </div>
                      <p className="text-xs text-stone-500">
                        {l.annual_rate ? `${(l.annual_rate*100).toFixed(2)}% p.a.` : ''}{l.tenure_months ? ` · ${l.tenure_months}mo` : ''}{l.start_date ? ` · since ${l.start_date.slice(0,7)}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-red-400 text-sm">{fmtSGD(l.outstanding_balance)}</p>
                      <p className="text-xs text-stone-500">{fmtSGD(monthly)}/mo</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button onClick={() => openEdit(l)} className="text-xs text-stone-500 hover:text-stone-200 transition-colors">Edit</button>
                      <button onClick={() => handleDelete(l.id)} className="text-xs text-stone-500 hover:text-red-400 transition-colors">Del</button>
                    </div>
                  </div>
                  {/* Pay-down progress */}
                  <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${Math.min(paidOff, 100)}%` }} />
                  </div>
                  <p className="text-xs text-stone-600 mt-1">{(100-paidOff).toFixed(1)}% paid off</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Loan' : 'Add Loan'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loan name *"><Input required value={form.loan_name} onChange={setF('loan_name')} placeholder="e.g. HDB Flat" /></Field>
            <Field label="Type"><Select value={form.loan_type} onChange={setF('loan_type')}>{LOAN_TYPES.map(t => <option key={t}>{t}</option>)}</Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Original principal *"><Input required type="number" step="any" min="0" value={form.principal} onChange={setF('principal')} placeholder="0.00" /></Field>
            <Field label="Outstanding balance *"><Input required type="number" step="any" min="0" value={form.outstanding_balance} onChange={setF('outstanding_balance')} placeholder="0.00" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Annual rate (%)"><Input type="number" step="any" min="0" value={form.annual_rate} onChange={setF('annual_rate')} placeholder="2.6" /></Field>
            <Field label="Tenure (months)"><Input type="number" step="1" min="1" value={form.tenure_months} onChange={setF('tenure_months')} placeholder="300" /></Field>
            <Field label="Monthly payment"><Input type="number" step="any" min="0" value={form.monthly_payment} onChange={setF('monthly_payment')} placeholder="Auto" /></Field>
          </div>
          <Field label="Start date"><Input type="date" value={form.start_date} onChange={setF('start_date')} /></Field>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">{editItem ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>

      {/* Calculator Modal */}
      <Modal open={showCalc} onClose={() => setShowCalc(false)} title="Mortgage Calculator" size="lg">
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Loan amount (SGD)"><Input type="number" step="any" min="0" value={calc.principal} onChange={setC('principal')} placeholder="500000" /></Field>
            <Field label="Annual rate (%)"><Input type="number" step="any" min="0" value={calc.rate} onChange={setC('rate')} placeholder="2.6" /></Field>
            <Field label="Period (years)"><Input type="number" step="1" min="1" max="35" value={calc.years} onChange={setC('years')} placeholder="25" /></Field>
          </div>
          <button onClick={runCalc} className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">Calculate</button>
          {calcRan && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-stone-800 rounded-xl p-4 text-center">
                  <p className="text-xs text-stone-400 mb-1">Monthly</p>
                  <p className="text-lg font-bold text-stone-50">{fmtSGD(calcMonthly)}</p>
                </div>
                <div className="bg-stone-800 rounded-xl p-4 text-center">
                  <p className="text-xs text-stone-400 mb-1">Total interest</p>
                  <p className="text-lg font-bold text-red-400">{fmtSGD(totalInterest)}</p>
                </div>
                <div className="bg-stone-800 rounded-xl p-4 text-center">
                  <p className="text-xs text-stone-400 mb-1">Total repayment</p>
                  <p className="text-lg font-bold text-stone-50">{fmtSGD((parseFloat(calc.principal)||0) + totalInterest)}</p>
                </div>
              </div>
              <div style={{ height: 180 }}><canvas ref={chartRef}></canvas></div>
              <div>
                <p className="text-xs font-medium text-stone-400 mb-2">First year amortisation</p>
                <div className="overflow-x-auto rounded-lg border border-stone-800">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-stone-800 text-stone-400"><th className="text-right px-3 py-2">Month</th><th className="text-right px-3 py-2">Payment</th><th className="text-right px-3 py-2">Principal</th><th className="text-right px-3 py-2">Interest</th><th className="text-right px-3 py-2">Balance</th></tr></thead>
                    <tbody className="divide-y divide-stone-800">
                      {schedule.slice(0,12).map(r => (
                        <tr key={r.month} className="text-stone-300">
                          <td className="text-right px-3 py-1.5">{r.month}</td>
                          <td className="text-right px-3 py-1.5">{fmtSGD(r.payment)}</td>
                          <td className="text-right px-3 py-1.5 text-emerald-400">{fmtSGD(r.principal)}</td>
                          <td className="text-right px-3 py-1.5 text-red-400">{fmtSGD(r.interest)}</td>
                          <td className="text-right px-3 py-1.5">{fmtSGD(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

Object.assign(window, { LoansPage });
