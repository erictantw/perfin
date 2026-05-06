
// ─── History Page ─────────────────────────────────────────────────────────────
function HistoryPage() {
  const [tick, setTick] = React.useState(0);
  const refresh = () => setTick(t => t + 1);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [taking, setTaking] = React.useState(false);

  const FX_USD = 1.34;
  const snapshots = db.get('snapshots', []);
  const holdings = db.get('holdings', []);
  const cashAccounts = db.get('cash', []);
  const cpfData = db.get('cpf', { oa:0,sa:0,ma:0,ra:0,srs:0 });
  const loans = db.get('loans', []);

  const chartData = buildNetWorthHistory(snapshots);

  // Heatmap from holdings creation dates
  const transactions = holdings.map(h => ({ date: isoDate(), amount: h.units * h.avg_cost }));
  const heatmap = buildActivityHeatmap(transactions);
  const weeks = [];
  for (let i = 0; i < heatmap.length; i += 7) weeks.push(heatmap.slice(i, i+7));

  function heatColor(amount) {
    if (!amount) return '#292524';
    if (amount < 5000)  return '#064e3b';
    if (amount < 20000) return '#065f46';
    if (amount < 50000) return '#059669';
    return '#10b981';
  }

  function takeSnapshot() {
    setTaking(true);
    const totalCash = cashAccounts.reduce((s,a) => s + (a.currency==='USD' ? a.balance*FX_USD : a.balance), 0);
    const totalInv  = holdings.reduce((s,h) => {
      const price = h.latest_price || h.avg_cost;
      const val = h.units * price;
      return s + (h.currency==='USD' ? val*FX_USD : val);
    }, 0);
    const totalCPF  = (cpfData.oa||0)+(cpfData.sa||0)+(cpfData.ma||0)+(cpfData.ra||0)+(cpfData.srs||0);
    const totalLoans = loans.reduce((s,l) => s+(l.outstanding_balance||0), 0);
    const netWorth  = totalCash + totalInv + totalCPF - totalLoans;

    const list = db.get('snapshots', []);
    list.push({
      id: db.nextId('snapshots'),
      snapshot_date: isoDate(),
      net_worth: Math.round(netWorth),
      cash: Math.round(totalCash),
      investments: Math.round(totalInv),
      cpf: Math.round(totalCPF),
      loans: Math.round(totalLoans),
    });
    db.set('snapshots', list);
    setShowConfirm(false);
    setTaking(false);
    refresh();
  }

  function deleteSnapshot(id) {
    if (!confirm('Delete this snapshot?')) return;
    db.set('snapshots', db.get('snapshots',[]).filter(s => s.id !== id));
    refresh();
  }

  // Chart
  const chartRef = React.useRef(null);
  const chartInst = React.useRef(null);
  React.useEffect(() => {
    if (!chartRef.current || !window.Chart || chartData.length < 2) return;
    if (chartInst.current) chartInst.current.destroy();
    chartInst.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: chartData.map(d => d.date?.slice(0,7)),
        datasets: [
          { label: 'Net Worth', data: chartData.map(d => d.netWorth), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#10b981' },
          { label: 'Investments', data: chartData.map(d => d.investments), borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.05)', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
          { label: 'Cash', data: chartData.map(d => d.cash), borderColor: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.05)', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#78716c', font: { size: 11 }, boxWidth: 12 } },
          tooltip: { backgroundColor: '#1c1917', borderColor: '#44403c', borderWidth: 1, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtSGD(ctx.parsed.y)}` } }
        },
        scales: {
          x: { ticks: { color: '#78716c', font: { size: 10 } }, grid: { color: '#292524' } },
          y: { ticks: { color: '#78716c', font: { size: 10 }, callback: v => `$${(v/1000).toFixed(0)}k` }, grid: { color: '#1c1917' } }
        }
      }
    });
    return () => chartInst.current?.destroy();
  }, [tick]);

  return (
    <div className="space-y-6">
      <PageHeader right={
        <button onClick={() => setShowConfirm(true)} className="btn-primary flex items-center gap-1.5">
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Take snapshot
        </button>
      } />

      {/* Net Worth Chart */}
      <div className="card">
        <h2 className="text-sm font-semibold text-stone-100 mb-4">Net Worth Over Time</h2>
        {chartData.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="text-stone-600 mb-2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <p className="text-sm text-stone-400">Take at least 2 snapshots to see a trend.</p>
          </div>
        ) : (
          <div style={{ height: 260 }}><canvas ref={chartRef}></canvas></div>
        )}
      </div>

      {/* Activity Heatmap */}
      <div className="card">
        <h2 className="text-sm font-semibold text-stone-100 mb-4">Investment Activity (Last 52 weeks)</h2>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1 flex-shrink-0">
              {week.map((day, di) => (
                <div key={di} title={`${day.date}: ${fmtSGD(day.amount)}`}
                  className="w-3 h-3 rounded-sm transition-colors" style={{ background: heatColor(day.amount) }} />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-stone-500">Less</span>
          {['#292524','#064e3b','#065f46','#059669','#10b981'].map((c,i) => (
            <div key={i} className="w-3 h-3 rounded-sm" style={{ background: c }} />
          ))}
          <span className="text-xs text-stone-500">More</span>
        </div>
      </div>

      {/* Snapshots table */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-800"><h2 className="text-sm font-semibold text-stone-100">Snapshots</h2></div>
        {snapshots.length === 0 ? (
          <EmptyState icon={() => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
            title="No snapshots yet" description="Take a snapshot to record your net worth for historical tracking." action="Take snapshot" onAction={() => setShowConfirm(true)} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone-500 uppercase border-b border-stone-800 bg-stone-900/50">
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-right px-4 py-3">Net Worth</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Cash</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Investments</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">CPF</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Loans</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {[...snapshots].sort((a,b) => new Date(b.snapshot_date)-new Date(a.snapshot_date)).map(s => (
                  <tr key={s.id} className="hover:bg-stone-800/30 transition-colors">
                    <td className="px-5 py-3 text-stone-300 tabular-nums">{s.snapshot_date}</td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${s.net_worth >= 0 ? 'text-stone-50' : 'text-red-400'}`}>{fmtSGD(s.net_worth)}</td>
                    <td className="px-4 py-3 text-right text-stone-400 tabular-nums hidden sm:table-cell">{fmtSGD(s.cash||0)}</td>
                    <td className="px-4 py-3 text-right text-stone-400 tabular-nums hidden sm:table-cell">{fmtSGD(s.investments||0)}</td>
                    <td className="px-4 py-3 text-right text-stone-400 tabular-nums hidden sm:table-cell">{fmtSGD(s.cpf||0)}</td>
                    <td className="px-4 py-3 text-right text-red-400 tabular-nums hidden sm:table-cell">{fmtSGD(s.loans||0)}</td>
                    <td className="px-4 py-3"><button onClick={() => deleteSnapshot(s.id)} className="text-xs text-stone-600 hover:text-red-400 transition-colors">Del</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title="Take Snapshot" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-stone-300">This will record your current net worth, cash, investments, CPF, and loans as a new snapshot.</p>
          <div className="flex gap-3">
            <button onClick={() => setShowConfirm(false)} className="flex-1 py-2 rounded-lg border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 transition-colors">Cancel</button>
            <button onClick={takeSnapshot} disabled={taking} className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
              {taking ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

Object.assign(window, { HistoryPage });
