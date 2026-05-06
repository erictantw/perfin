
// ─── Investments Page ─────────────────────────────────────────────────────────
const PLATFORMS  = ['FSMOne','Syfe','StashAway','Tiger Brokers','IBKR','DBS Vickers','Moomoo','Other'];
const ASSET_TYPES = ['ETF','Stock','REIT','Bond','Fund','Crypto','Other'];
const CURRENCIES = ['USD','SGD','GBP','EUR','HKD','AUD'];
const emptyHolding = { ticker:'', name:'', units:'', avg_cost:'', currency:'USD', asset_type:'ETF', platform:'IBKR', exchange:'' };

function InvestmentsPage() {
  const FX_USD = 1.34;
  const [tick, setTick] = React.useState(0);
  const refresh = () => setTick(t => t + 1);
  const [showModal, setShowModal] = React.useState(false);
  const [editItem, setEditItem] = React.useState(null);
  const [form, setForm] = React.useState(emptyHolding);
  const [saving, setSaving] = React.useState(false);
  const setF = f => e => setForm(p => ({...p, [f]: e.target.value}));

  const holdings = db.get('holdings', []);

  const enriched = holdings.map(h => {
    const price = h.latest_price || h.avg_cost;
    const fxRate = h.currency === 'USD' ? FX_USD : 1;
    const value = h.units * price * fxRate;
    const costBasis = h.units * h.avg_cost * fxRate;
    const pnl = value - costBasis;
    const pnlPct = costBasis ? pnl / costBasis * 100 : 0;
    return { ...h, value, costBasis, pnl, pnlPct };
  });

  const totalValue  = enriched.reduce((s, h) => s + h.value, 0);
  const totalCost   = enriched.reduce((s, h) => s + h.costBasis, 0);
  const totalPnl    = totalValue - totalCost;
  const totalPnlPct = totalCost ? totalPnl / totalCost * 100 : 0;

  function openAdd() { setEditItem(null); setForm(emptyHolding); setShowModal(true); }
  function openEdit(h) {
    setEditItem(h);
    setForm({ ticker: h.ticker, name: h.name||'', units: h.units, avg_cost: h.avg_cost, currency: h.currency||'USD', asset_type: h.asset_type||'ETF', platform: h.platform||'IBKR', exchange: h.exchange||'' });
    setShowModal(true);
  }
  function handleSave(e) {
    e.preventDefault();
    const list = db.get('holdings', []);
    const payload = { ...form, units: parseFloat(form.units), avg_cost: parseFloat(form.avg_cost) };
    if (editItem) {
      db.set('holdings', list.map(h => h.id === editItem.id ? { ...h, ...payload } : h));
    } else {
      list.push({ id: db.nextId('holdings'), ...payload });
      db.set('holdings', list);
    }
    setShowModal(false);
    refresh();
  }
  function handleDelete(id) {
    if (!confirm('Remove this holding?')) return;
    db.set('holdings', db.get('holdings',[]).filter(h => h.id !== id));
    refresh();
  }

  const byType = ASSET_TYPES.filter(t => enriched.some(h => h.asset_type === t));

  return (
    <div className="space-y-6">
      <PageHeader right={
        <button onClick={openAdd} className="btn-primary flex items-center gap-1.5">
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add holding
        </button>
      } />

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="Portfolio Value" value={fmtSGD(totalValue)} icon={() => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>} />
        <StatCard title="Cost Basis" value={fmtSGD(totalCost)} />
        <StatCard title="Total P&L" value={`${totalPnl >= 0 ? '+' : ''}${fmtSGD(totalPnl)}`} subValue={`${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}%`}
          className={totalPnl >= 0 ? 'border-emerald-900/40' : 'border-red-900/40'} />
      </div>

      {/* Holdings table */}
      <div className="card overflow-hidden !p-0">
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-100">Holdings</h2>
          <span className="text-xs text-stone-500">{holdings.length} position{holdings.length !== 1 ? 's' : ''}</span>
        </div>
        {enriched.length === 0 ? (
          <EmptyState icon={() => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>}
            title="No holdings yet" description="Add your first investment to track your portfolio." action="Add holding" onAction={openAdd} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone-500 uppercase border-b border-stone-800 bg-stone-900/50">
                  <th className="text-left px-5 py-3">Ticker</th>
                  <th className="text-right px-4 py-3">Units</th>
                  <th className="text-right px-4 py-3">Avg Cost</th>
                  <th className="text-right px-4 py-3">Value (SGD)</th>
                  <th className="text-right px-4 py-3">P&L</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Platform</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {enriched.map(h => (
                  <tr key={h.id} className="hover:bg-stone-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-stone-100">{h.ticker}</p>
                      <p className="text-xs text-stone-500">{h.asset_type}{h.exchange ? ` · ${h.exchange}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-stone-300 tabular-nums">{fmtNum(h.units, 4)}</td>
                    <td className="px-4 py-3 text-right text-stone-300 tabular-nums">{h.currency} {fmtNum(h.avg_cost, 2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-100 tabular-nums">{fmtSGD(h.value)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <p className={`font-medium ${h.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{h.pnl >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%</p>
                      <p className={`text-xs ${h.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{h.pnl >= 0 ? '+' : ''}{fmtSGD(h.pnl)}</p>
                    </td>
                    <td className="px-4 py-3 text-stone-400 text-xs hidden sm:table-cell">{h.platform}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEdit(h)} className="text-xs text-stone-500 hover:text-stone-200 transition-colors">Edit</button>
                        <button onClick={() => handleDelete(h.id)} className="text-xs text-stone-500 hover:text-red-400 transition-colors">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attribution */}
      {enriched.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-stone-100 mb-4">Portfolio Weights</h2>
          <div className="space-y-3">
            {[...enriched].sort((a,b) => b.value - a.value).map(h => {
              const w = totalValue ? h.value / totalValue * 100 : 0;
              return (
                <div key={h.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-stone-200">{h.ticker}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-stone-400">{w.toFixed(1)}%</span>
                      <span className={`font-medium ${h.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{h.pnl >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${h.pnl >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(w, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Holding' : 'Add Holding'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ticker *"><Input required value={form.ticker} onChange={setF('ticker')} placeholder="e.g. VWRA" className="uppercase" /></Field>
            <Field label="Name"><Input value={form.name} onChange={setF('name')} placeholder="e.g. Vanguard All-World" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Units *"><Input required type="number" step="any" min="0" value={form.units} onChange={setF('units')} placeholder="0" /></Field>
            <Field label="Avg Cost *"><Input required type="number" step="any" min="0" value={form.avg_cost} onChange={setF('avg_cost')} placeholder="0.00" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Currency"><Select value={form.currency} onChange={setF('currency')}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Type"><Select value={form.asset_type} onChange={setF('asset_type')}>{ASSET_TYPES.map(t => <option key={t}>{t}</option>)}</Select></Field>
            <Field label="Exchange"><Input value={form.exchange} onChange={setF('exchange')} placeholder="e.g. LSE" /></Field>
          </div>
          <Field label="Platform"><Select value={form.platform} onChange={setF('platform')}>{PLATFORMS.map(p => <option key={p}>{p}</option>)}</Select></Field>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">{editItem ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

Object.assign(window, { InvestmentsPage });
