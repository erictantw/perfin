
// ─── Dividends Page ───────────────────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const emptyDiv = { ticker:'', ex_date:'', payment_date:'', amount:'', currency:'SGD', notes:'' };

function DividendsPage() {
  const [tick, setTick] = React.useState(0);
  const refresh = () => setTick(t => t + 1);
  const [showModal, setShowModal] = React.useState(false);
  const [form, setForm] = React.useState(emptyDiv);
  const setF = f => e => setForm(p => ({...p, [f]: e.target.value}));

  const dividends = db.get('dividends', []);
  const holdings = db.get('holdings', []);

  const runRate = calcRunRate(dividends);
  const monthlyAvg = runRate / 12;
  const chartData = buildDividendMonthlyData(dividends);

  const calendarYear = new Date().getFullYear();
  const calendar = MONTHS_SHORT.map((m, i) => ({
    month: m,
    items: dividends.filter(d => { const dt = new Date(d.ex_date); return dt.getFullYear() === calendarYear && dt.getMonth() === i; })
  }));

  function handleSave(e) {
    e.preventDefault();
    const list = db.get('dividends', []);
    list.push({ id: db.nextId('dividends'), ...form, amount: parseFloat(form.amount) });
    db.set('dividends', list);
    setShowModal(false);
    setForm(emptyDiv);
    refresh();
  }
  function handleDelete(id) {
    if (!confirm('Delete this dividend record?')) return;
    db.set('dividends', db.get('dividends',[]).filter(d => d.id !== id));
    refresh();
  }

  // Chart
  const chartRef = React.useRef(null);
  const chartInst = React.useRef(null);
  React.useEffect(() => {
    if (!chartRef.current || !window.Chart) return;
    if (chartInst.current) chartInst.current.destroy();
    chartInst.current = new Chart(chartRef.current, {
      type: 'bar',
      data: {
        labels: chartData.map(d => d.label),
        datasets: [{
          data: chartData.map(d => d.total),
          backgroundColor: chartData.map(d => d.total > 0 ? 'rgba(16,185,129,0.7)' : 'rgba(41,37,36,0.8)'),
          borderColor: chartData.map(d => d.total > 0 ? '#10b981' : '#292524'),
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1c1917', borderColor: '#44403c', borderWidth: 1, callbacks: { label: ctx => ` ${fmtSGD(ctx.parsed.y)}` } }
        },
        scales: {
          x: { ticks: { color: '#78716c', font: { size: 10 }, maxRotation: 0 }, grid: { display: false } },
          y: { ticks: { color: '#78716c', font: { size: 10 }, callback: v => `$${v}` }, grid: { color: '#292524' } }
        }
      }
    });
    return () => chartInst.current?.destroy();
  }, [tick]);

  return (
    <div className="space-y-6">
      <PageHeader right={
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5">
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add dividend
        </button>
      } />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="Passive Income (TTM)" value={fmtSGD(runRate)} icon={() => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>} />
        <StatCard title="Monthly Average" value={fmtSGD(monthlyAvg)} />
        <StatCard title="Total Records" value={String(dividends.length)} />
      </div>

      {/* Monthly chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-stone-100">Monthly Income (TTM)</h2>
        </div>
        <div style={{ height: 200 }}>
          <canvas ref={chartRef}></canvas>
        </div>
      </div>

      {/* Calendar */}
      <div className="card">
        <h2 className="text-sm font-semibold text-stone-100 mb-4">Dividend Calendar {calendarYear}</h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {calendar.map(({ month, items }) => (
            <div key={month} className={`rounded-xl p-3 border transition-colors ${items.length > 0 ? 'bg-emerald-500/8 border-emerald-500/30' : 'bg-stone-800/40 border-stone-800'}`}>
              <p className="text-xs font-semibold text-stone-400 mb-1">{month}</p>
              {items.length === 0 ? <p className="text-xs text-stone-700">—</p> : (
                <div className="space-y-0.5">
                  {items.slice(0,3).map((d,i) => <p key={i} className="text-xs text-emerald-400 font-medium truncate">{d.ticker || 'Div'}</p>)}
                  {items.length > 3 && <p className="text-xs text-stone-500">+{items.length-3}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* History table */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-800"><h2 className="text-sm font-semibold text-stone-100">Dividend History</h2></div>
        {dividends.length === 0 ? (
          <EmptyState icon={() => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/></svg>}
            title="No dividends recorded" description="Log dividends received to track passive income." action="Add dividend" onAction={() => setShowModal(true)} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone-500 uppercase border-b border-stone-800 bg-stone-900/50">
                  <th className="text-left px-5 py-3">Ticker</th>
                  <th className="text-left px-4 py-3">Ex-date</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Notes</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {[...dividends].sort((a,b) => new Date(b.ex_date) - new Date(a.ex_date)).map(d => (
                  <tr key={d.id} className="hover:bg-stone-800/30 transition-colors">
                    <td className="px-5 py-3 font-semibold text-stone-100">{d.ticker || '—'}</td>
                    <td className="px-4 py-3 text-stone-400 tabular-nums">{d.ex_date}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-400 tabular-nums">{d.currency} {fmtNum(d.amount, 2)}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs hidden sm:table-cell">{d.notes || '—'}</td>
                    <td className="px-4 py-3"><button onClick={() => handleDelete(d.id)} className="text-xs text-stone-600 hover:text-red-400 transition-colors">Del</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Dividend" size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ticker"><Input value={form.ticker} onChange={setF('ticker')} placeholder="e.g. A17U" className="uppercase" /></Field>
            <Field label="Ex-date *"><Input required type="date" value={form.ex_date} onChange={setF('ex_date')} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount *"><Input required type="number" step="any" min="0" value={form.amount} onChange={setF('amount')} placeholder="0.00" /></Field>
            <Field label="Currency"><Select value={form.currency} onChange={setF('currency')}>{['SGD','USD','GBP','EUR','HKD','AUD'].map(c => <option key={c}>{c}</option>)}</Select></Field>
          </div>
          <Field label="Notes"><Input value={form.notes} onChange={setF('notes')} placeholder="Optional notes" /></Field>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">Add</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

Object.assign(window, { DividendsPage });
