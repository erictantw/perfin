
// ─── Investments Page ─────────────────────────────────────────────────────────

const INV_FX = { USD:1.34, SGD:1, GBP:1.70, EUR:1.46, HKD:0.17, AUD:0.88 };
const INV_PLATFORMS = ['FSMOne','Syfe','StashAway','Tiger Brokers','IBKR','DBS Vickers','Moomoo','Other'];
const INV_CURRENCIES = ['USD','SGD','GBP','EUR','HKD','AUD'];
const INV_ASSET_TYPES = ['ETF','Stock','REIT','Bond','Fund','Crypto','Other'];
const INV_CATEGORIES = ['Growth','Income','Legacy','Retirement'];
const INV_TYPES = ['Active','Dividends','Education','Fixed','Index','SRS','Speculative'];
const INV_GEOS = ['Global','US','SG','UK','EU','Asia','EM','Other'];
const CAT_COLORS = { Growth:'#d4a052', Income:'#4a9e7a', Legacy:'#7a6eb8', Retirement:'#5b8fba' };
const GEO_COLORS = { Global:'#d4a052', US:'#4a9e7a', SG:'#7a6eb8', UK:'#5b8fba', EU:'#c4564a', Asia:'#8b9e6a', EM:'#6a9e7a', Other:'#5a6a7a' };

function invToSGD(amount, ccy) { return amount * (INV_FX[ccy] || 1); }

function computeHolding(h) {
  const txns = h.transactions || [];
  let units, avg_cost;
  if (txns.length === 0) {
    units = parseFloat(h.units) || 0;
    avg_cost = parseFloat(h.avg_cost) || 0;
  } else {
    const buys = txns.filter(t => t.type === 'buy');
    const sells = txns.filter(t => t.type === 'sell');
    const buyUnits = buys.reduce((s, t) => s + (parseFloat(t.units) || 0), 0);
    const sellUnits = sells.reduce((s, t) => s + (parseFloat(t.units) || 0), 0);
    units = Math.max(buyUnits - sellUnits, 0);
    const buyCost = buys.reduce((s, t) => s + (parseFloat(t.units) || 0) * (parseFloat(t.price) || 0), 0);
    avg_cost = buyUnits > 0 ? buyCost / buyUnits : 0;
  }
  const latest_price = parseFloat(h.latest_price) || avg_cost;
  const costBasis = invToSGD(units * avg_cost, h.currency || 'SGD');
  const value = invToSGD(units * latest_price, h.currency || 'SGD');
  const pnl = value - costBasis;
  const pnlPct = costBasis ? pnl / costBasis * 100 : 0;
  return { ...h, units, avg_cost, latest_price, costBasis, value, pnl, pnlPct };
}

function InvSortTh({ label, col, current, dir, onSort, left, className }) {
  const active = current === col;
  return (
    <th onClick={() => onSort(col)}
      className={`px-3 py-2.5 cursor-pointer select-none hover:text-stone-200 transition-colors text-xs uppercase tracking-wide ${active ? 'text-stone-200' : 'text-stone-500'} ${left ? 'text-left' : 'text-right'} ${className || ''}`}>
      <span className={`flex items-center gap-1 ${left ? '' : 'justify-end'}`}>
        {label}
        <svg width="8" height="8" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: active ? 1 : 0.35 }}>
          <path d="M5 1v12M2 4l3-3 3 3M2 10l3 3 3-3"/>
        </svg>
      </span>
    </th>
  );
}

function LatestPriceInput({ holding, onSave }) {
  const [price, setPrice] = React.useState(holding.latest_price ? String(holding.latest_price) : '');
  const [saved, setSaved] = React.useState(false);
  function save() {
    const list = db.get('holdings', []);
    db.set('holdings', list.map(h => h.id === holding.id ? { ...h, latest_price: parseFloat(price) || null } : h));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSave();
  }
  return (
    <div className="flex items-center gap-2">
      <input type="number" step="any" min="0" value={price}
        onChange={e => setPrice(e.target.value)}
        placeholder={holding.currency + ' ' + fmtNum(holding.avg_cost, 2)}
        className="text-xs bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 w-32 focus:outline-none" />
      <button onClick={save} className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
        {saved ? '✓ Saved' : 'Update'}
      </button>
    </div>
  );
}

function HoldingModal({ open, onClose, holding, onSave }) {
  const empty = { ticker:'', name:'', currency:'USD', asset_type:'ETF', platform:'IBKR', exchange:'', category:'Growth', investment_type:'Index', geography:'Global', latest_price:'' };
  const [form, setForm] = React.useState(empty);
  const setF = f => e => setForm(p => ({...p, [f]: e.target.value}));

  React.useEffect(() => {
    if (open) setForm(holding ? { ticker:holding.ticker||'', name:holding.name||'', currency:holding.currency||'USD', asset_type:holding.asset_type||'ETF', platform:holding.platform||'IBKR', exchange:holding.exchange||'', category:holding.category||'Growth', investment_type:holding.investment_type||'Index', geography:holding.geography||'Global', latest_price:holding.latest_price||'' } : empty);
  }, [open]);

  function submit(e) { e.preventDefault(); onSave(form); onClose(); }
  return (
    <Modal open={open} onClose={onClose} title={holding ? 'Edit Holding' : 'Add Holding'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ticker *"><Input required value={form.ticker} onChange={setF('ticker')} placeholder="e.g. VWRA" className="uppercase" /></Field>
          <Field label="Name"><Input value={form.name} onChange={setF('name')} placeholder="e.g. Vanguard All-World" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Currency"><Select value={form.currency} onChange={setF('currency')}>{INV_CURRENCIES.map(c => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Asset type"><Select value={form.asset_type} onChange={setF('asset_type')}>{INV_ASSET_TYPES.map(t => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Exchange"><Input value={form.exchange} onChange={setF('exchange')} placeholder="e.g. LSE" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Category"><Select value={form.category} onChange={setF('category')}>{INV_CATEGORIES.map(c => <option key={c}>{c}</option>)}</Select></Field>
          <Field label="Type"><Select value={form.investment_type} onChange={setF('investment_type')}>{INV_TYPES.map(t => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Geography"><Select value={form.geography} onChange={setF('geography')}>{INV_GEOS.map(g => <option key={g}>{g}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Platform"><Select value={form.platform} onChange={setF('platform')}>{INV_PLATFORMS.map(p => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Latest price (manual)"><Input type="number" step="any" min="0" value={form.latest_price} onChange={setF('latest_price')} placeholder="Leave blank → avg cost" /></Field>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 transition-colors">Cancel</button>
          <button type="submit" className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">{holding ? 'Update' : 'Add'}</button>
        </div>
      </form>
    </Modal>
  );
}

function TransactionModal({ open, onClose, holding, editTxn, onSave }) {
  const emptyTxn = { date: new Date().toISOString().slice(0,10), type:'buy', units:'', price:'', fee:'', platform:'IBKR' };
  const [form, setForm] = React.useState(emptyTxn);
  const setF = f => e => setForm(p => ({...p, [f]: e.target.value}));

  React.useEffect(() => {
    if (open) setForm(editTxn ? {...editTxn} : { ...emptyTxn, platform: (holding && holding.platform) || 'IBKR' });
  }, [open]);

  function submit(e) {
    e.preventDefault();
    onSave({ ...form, units: parseFloat(form.units), price: parseFloat(form.price), fee: parseFloat(form.fee) || 0 });
    onClose();
  }

  const totalCost = (parseFloat(form.units) || 0) * (parseFloat(form.price) || 0) + (parseFloat(form.fee) || 0);
  return (
    <Modal open={open} onClose={onClose} title={editTxn ? 'Edit Transaction' : ('Add Transaction' + (holding ? ' — ' + holding.ticker : ''))} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date *"><Input required type="date" value={form.date} onChange={setF('date')} /></Field>
          <Field label="Type">
            <Select value={form.type} onChange={setF('type')}>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Units *"><Input required type="number" step="any" min="0" value={form.units} onChange={setF('units')} placeholder="0" /></Field>
          <Field label={'Price (' + ((holding && holding.currency) || 'USD') + ') *'}><Input required type="number" step="any" min="0" value={form.price} onChange={setF('price')} placeholder="0.00" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fee"><Input type="number" step="any" min="0" value={form.fee} onChange={setF('fee')} placeholder="0.00" /></Field>
          <Field label="Platform"><Select value={form.platform} onChange={setF('platform')}>{INV_PLATFORMS.map(p => <option key={p}>{p}</option>)}</Select></Field>
        </div>
        {totalCost > 0 && (
          <div className="bg-stone-800/60 rounded-lg px-3 py-2 text-xs text-stone-400">
            Total: <span className="text-stone-200 font-medium">{(holding && holding.currency) || 'USD'} {fmtNum(totalCost, 2)}</span>
            {holding && holding.currency !== 'SGD' && <span className="text-stone-500"> · SGD {fmtNum(invToSGD(totalCost, holding.currency), 2)}</span>}
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 transition-colors">Cancel</button>
          <button type="submit" className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">Save</button>
        </div>
      </form>
    </Modal>
  );
}

function InvestmentsPage() {
  const [tick, setTick] = React.useState(0);
  const refresh = () => setTick(t => t + 1);

  const [filterCat, setFilterCat] = React.useState('All');
  const [filterType, setFilterType] = React.useState('All');
  const [filterGeo, setFilterGeo] = React.useState('All');
  const [search, setSearch] = React.useState('');
  const [sortCol, setSortCol] = React.useState('value');
  const [sortDir, setSortDir] = React.useState(-1);
  const [expanded, setExpanded] = React.useState(new Set());
  const [collapsed, setCollapsed] = React.useState(new Set());
  const [allocTab, setAllocTab] = React.useState('category');

  const [showHoldingModal, setShowHoldingModal] = React.useState(false);
  const [editHolding, setEditHolding] = React.useState(null);
  const [showTxnModal, setShowTxnModal] = React.useState(false);
  const [txnHolding, setTxnHolding] = React.useState(null);
  const [editTxn, setEditTxn] = React.useState(null);

  const rawHoldings = db.get('holdings', []);
  const enriched = rawHoldings.map(computeHolding);

  const totalValue = enriched.reduce((s, h) => s + h.value, 0);
  const totalCost  = enriched.reduce((s, h) => s + h.costBasis, 0);
  const totalPnl   = totalValue - totalCost;
  const totalPnlPct = totalCost ? totalPnl / totalCost * 100 : 0;

  const filtered = enriched
    .filter(h => filterCat === 'All' || h.category === filterCat)
    .filter(h => filterType === 'All' || h.investment_type === filterType)
    .filter(h => filterGeo === 'All' || h.geography === filterGeo)
    .filter(h => !search || h.ticker.toLowerCase().includes(search.toLowerCase()) || (h.name || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortCol === 'ticker') return sortDir * a.ticker.localeCompare(b.ticker);
      return sortDir * ((b[sortCol] || 0) - (a[sortCol] || 0));
    });

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => -d); else { setSortCol(col); setSortDir(-1); }
  }
  function toggleExpand(id) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSection(key) {
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  function saveHolding(form) {
    const list = db.get('holdings', []);
    if (editHolding) {
      db.set('holdings', list.map(h => h.id === editHolding.id ? { ...h, ...form } : h));
    } else {
      list.push({ id: db.nextId('holdings'), ...form, transactions: [] });
      db.set('holdings', list);
    }
    refresh();
  }

  function deleteHolding(id) {
    if (!confirm('Remove this holding and all transactions?')) return;
    db.set('holdings', db.get('holdings', []).filter(h => h.id !== id));
    setExpanded(prev => { const n = new Set(prev); n.delete(id); return n; });
    refresh();
  }

  function saveTxn(form) {
    const list = db.get('holdings', []);
    const idx = list.findIndex(h => h.id === txnHolding.id);
    if (idx === -1) return;
    const txns = [...(list[idx].transactions || [])];
    if (editTxn) {
      const ti = txns.findIndex(t => t.id === editTxn.id);
      if (ti >= 0) txns[ti] = { ...editTxn, ...form };
    } else {
      txns.push({ id: Date.now(), ...form });
    }
    txns.sort((a, b) => a.date > b.date ? 1 : -1);
    list[idx] = { ...list[idx], transactions: txns };
    db.set('holdings', list);
    refresh();
  }

  function deleteTxn(holdingId, txnId) {
    if (!confirm('Remove this transaction?')) return;
    const list = db.get('holdings', []);
    const idx = list.findIndex(h => h.id === holdingId);
    if (idx === -1) return;
    list[idx] = { ...list[idx], transactions: (list[idx].transactions || []).filter(t => t.id !== txnId) };
    db.set('holdings', list);
    refresh();
  }

  function openAddHolding() { setEditHolding(null); setShowHoldingModal(true); }
  function openEditHolding(h) { setEditHolding(h); setShowHoldingModal(true); }
  function openAddTxn(h) { setTxnHolding(h); setEditTxn(null); setShowTxnModal(true); }
  function openEditTxn(h, t) { setTxnHolding(h); setEditTxn(t); setShowTxnModal(true); }

  const allocData = (() => {
    const groups = {};
    enriched.forEach(h => {
      const key = allocTab === 'category' ? (h.category || 'Other')
        : allocTab === 'type' ? (h.investment_type || 'Other')
        : (h.geography || 'Other');
      groups[key] = (groups[key] || 0) + h.value;
    });
    return Object.entries(groups)
      .map(([label, value]) => ({ label, value, pct: totalValue ? value / totalValue * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  })();

  const maxAbsPnl = enriched.length ? Math.max(...enriched.map(h => Math.abs(h.pnl)), 1) : 1;
  const topContribs = [...enriched].filter(h => h.pnl > 0).sort((a, b) => b.pnl - a.pnl).slice(0, 5);
  const topDetractors = [...enriched].filter(h => h.pnl < 0).sort((a, b) => a.pnl - b.pnl).slice(0, 5);

  return (
    <div className="space-y-4">
      <PageHeader right={
        <button onClick={openAddHolding} className="btn-primary flex items-center gap-1.5">
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add holding
        </button>
      } />

      {/* Hero */}
      <div style={{ background:'#1e1b18', borderRadius:16, border:'1px solid rgba(255,255,255,0.06)', boxShadow:'rgba(255,255,255,0.06) 0px 1px 0px 0px inset', padding:'clamp(1.25rem,2.5vw,2rem)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p style={{ fontSize:'0.62rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'#8a7d6b', fontFamily:'Inter,sans-serif', marginBottom:8 }}>Portfolio Value</p>
            <p style={{ fontFamily:"'Lora',Georgia,serif", fontSize:'clamp(1.4rem,2.5vw,2rem)', fontWeight:400, color:'#e8e3db', letterSpacing:'-0.02em', lineHeight:1 }}>{fmtSGD(totalValue)}</p>
            <p style={{ fontSize:'0.7rem', color:'#57534e', fontFamily:'Inter,sans-serif', marginTop:4 }}>{enriched.length} position{enriched.length !== 1 ? 's' : ''}</p>
          </div>
          <div>
            <p style={{ fontSize:'0.62rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'#8a7d6b', fontFamily:'Inter,sans-serif', marginBottom:8 }}>Unrealised P&amp;L</p>
            <p style={{ fontFamily:"'Lora',Georgia,serif", fontSize:'clamp(1.4rem,2.5vw,2rem)', fontWeight:400, letterSpacing:'-0.02em', lineHeight:1, color: totalPnl >= 0 ? '#34d399' : '#f87171' }}>
              {totalPnl >= 0 ? '+' : ''}{fmtSGD(totalPnl)}
            </p>
            <p style={{ fontSize:'0.7rem', marginTop:4, fontFamily:'Inter,sans-serif', color: totalPnlPct >= 0 ? '#059669' : '#dc2626' }}>
              {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}% on cost
            </p>
          </div>
          <div>
            <p style={{ fontSize:'0.62rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'#8a7d6b', fontFamily:'Inter,sans-serif', marginBottom:8 }}>Cost Basis</p>
            <p style={{ fontFamily:"'Lora',Georgia,serif", fontSize:'clamp(1.4rem,2.5vw,2rem)', fontWeight:400, color:'#e8e3db', letterSpacing:'-0.02em', lineHeight:1 }}>{fmtSGD(totalCost)}</p>
            <p style={{ fontSize:'0.7rem', color:'#57534e', fontFamily:'Inter,sans-serif', marginTop:4 }}>SGD equivalent</p>
          </div>
        </div>
      </div>

      {/* Holdings */}
      <div className="card !p-0 overflow-hidden">
        <button onClick={() => toggleSection('holdings')} className="w-full px-5 py-4 border-b border-stone-800 flex items-center justify-between hover:bg-stone-800/30 transition-colors">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-stone-100">Holdings</h2>
            {filtered.length !== enriched.length
              ? <span className="text-xs text-stone-500">{filtered.length}/{enriched.length}</span>
              : <span className="text-xs text-stone-500">{enriched.length} position{enriched.length !== 1 ? 's' : ''}</span>}
          </div>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            style={{ transform: collapsed.has('holdings') ? 'rotate(-90deg)' : '', transition:'transform 0.2s', flexShrink:0, color:'#6b6057' }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {!collapsed.has('holdings') && (
          <>
            {enriched.length === 0 ? (
              <EmptyState
                icon={() => <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/></svg>}
                title="No holdings yet" description="Add your first investment to track your portfolio." action="Add holding" onAction={openAddHolding} />
            ) : (
              <>
                {/* Filters */}
                <div className="px-4 py-3 border-b border-stone-800/60 flex flex-wrap gap-2 items-center">
                  <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                    className="text-xs bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-300 focus:outline-none cursor-pointer">
                    <option value="All">All categories</option>
                    {INV_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)}
                    className="text-xs bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-300 focus:outline-none cursor-pointer">
                    <option value="All">All types</option>
                    {INV_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <select value={filterGeo} onChange={e => setFilterGeo(e.target.value)}
                    className="text-xs bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-300 focus:outline-none cursor-pointer">
                    <option value="All">All geographies</option>
                    {INV_GEOS.map(g => <option key={g}>{g}</option>)}
                  </select>
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search ticker or name…"
                    className="text-xs bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-stone-300 focus:outline-none placeholder-stone-600 flex-1 sm:flex-none sm:min-w-[150px]" />
                  {(filterCat !== 'All' || filterType !== 'All' || filterGeo !== 'All' || search) && (
                    <button onClick={() => { setFilterCat('All'); setFilterType('All'); setFilterGeo('All'); setSearch(''); }}
                      className="text-xs text-stone-500 hover:text-stone-300 transition-colors">Clear</button>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-stone-900/50 border-b border-stone-800">
                        <th className="pl-5 pr-2 py-2.5 w-8 text-left"></th>
                        <InvSortTh label="Counter" col="ticker" current={sortCol} dir={sortDir} onSort={toggleSort} left />
                        <InvSortTh label="Units" col="units" current={sortCol} dir={sortDir} onSort={toggleSort} />
                        <th className="text-right px-3 py-2.5 text-xs text-stone-500 uppercase tracking-wide hidden sm:table-cell">Ccy</th>
                        <InvSortTh label="Avg Price" col="avg_cost" current={sortCol} dir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                        <InvSortTh label="Latest" col="latest_price" current={sortCol} dir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                        <InvSortTh label="Value (SGD)" col="value" current={sortCol} dir={sortDir} onSort={toggleSort} />
                        <InvSortTh label="P&L" col="pnl" current={sortCol} dir={sortDir} onSort={toggleSort} />
                        <th className="text-right px-3 py-2.5 text-xs text-stone-500 uppercase tracking-wide hidden lg:table-cell">Platform</th>
                        <th className="pr-5 py-2.5 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/50">
                      {filtered.map(h => {
                        const isExpanded = expanded.has(h.id);
                        const txns = h.transactions || [];
                        const catColor = CAT_COLORS[h.category] || '#6b7280';
                        return (
                          <React.Fragment key={h.id}>
                            <tr className="hover:bg-stone-800/20 transition-colors group">
                              <td className="pl-5 pr-2 py-3 w-8">
                                <button onClick={() => toggleExpand(h.id)} className="text-stone-600 hover:text-stone-300 transition-colors">
                                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                                    style={{ transform: isExpanded ? 'rotate(90deg)' : '', transition:'transform 0.2s' }}>
                                    <path d="M9 18l6-6-6-6"/>
                                  </svg>
                                </button>
                              </td>
                              <td className="px-3 py-3 text-left">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                                    style={{ background: catColor + '22', color: catColor }}>
                                    {h.ticker.slice(0,2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-stone-100 text-sm">{h.ticker}</p>
                                    {h.name && <p className="text-stone-500 text-xs truncate max-w-[120px]">{h.name}</p>}
                                    {h.category && (
                                      <span className="text-xs px-1.5 rounded mt-0.5 inline-block" style={{ background: catColor + '18', color: catColor, fontSize:'0.6rem' }}>{h.category}</span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right text-stone-300 tabular-nums text-sm">{fmtNum(h.units, h.units % 1 === 0 ? 0 : 3)}</td>
                              <td className="px-3 py-3 text-right text-stone-500 text-xs hidden sm:table-cell">{h.currency}</td>
                              <td className="px-3 py-3 text-right text-stone-400 tabular-nums text-sm hidden md:table-cell">{fmtNum(h.avg_cost, 2)}</td>
                              <td className="px-3 py-3 text-right text-stone-300 tabular-nums text-sm hidden md:table-cell">{fmtNum(h.latest_price, 2)}</td>
                              <td className="px-3 py-3 text-right font-semibold text-stone-100 tabular-nums text-sm">{fmtSGD(h.value)}</td>
                              <td className="px-3 py-3 text-right tabular-nums">
                                <p className={`font-medium text-sm ${h.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{h.pnl >= 0 ? '+' : ''}{h.pnlPct.toFixed(1)}%</p>
                                <p className={`text-xs ${h.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{h.pnl >= 0 ? '+' : ''}{fmtSGD(h.pnl)}</p>
                              </td>
                              <td className="px-3 py-3 text-right text-stone-500 text-xs hidden lg:table-cell">{h.platform}</td>
                              <td className="pr-5 py-3">
                                <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openEditHolding(h)} className="text-xs text-stone-500 hover:text-stone-200 transition-colors">Edit</button>
                                  <button onClick={() => deleteHolding(h.id)} className="text-xs text-stone-500 hover:text-red-400 transition-colors">Del</button>
                                </div>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr>
                                <td colSpan={10} className="bg-stone-900/50 border-b border-stone-800/50">
                                  <div className="px-5 py-4 space-y-4">
                                    {/* Tags */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {h.geography && <span className="text-xs px-2 py-0.5 rounded-full border border-stone-700 text-stone-400">{h.geography}</span>}
                                      {h.asset_type && <span className="text-xs px-2 py-0.5 rounded-full border border-stone-700 text-stone-400">{h.asset_type}</span>}
                                      {h.investment_type && <span className="text-xs px-2 py-0.5 rounded-full border border-stone-700 text-stone-400">{h.investment_type}</span>}
                                      {h.exchange && <span className="text-xs px-2 py-0.5 rounded-full border border-stone-700 text-stone-400">{h.exchange}</span>}
                                      <button onClick={() => openEditHolding(h)} className="text-xs text-stone-600 hover:text-stone-400 transition-colors ml-1">✎ Edit labels</button>
                                    </div>

                                    {/* Transactions */}
                                    <div>
                                      <div className="flex items-center justify-between mb-2.5">
                                        <p className="text-xs font-medium text-stone-400">Transaction History</p>
                                        <button onClick={() => openAddTxn(h)} className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-1">
                                          <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                          Add transaction
                                        </button>
                                      </div>
                                      {txns.length === 0 ? (
                                        <div className="rounded-lg border border-stone-800 px-4 py-3 text-xs text-stone-600 italic">
                                          No transactions recorded — this holding uses the legacy model (units + avg cost). Add a transaction to upgrade.
                                        </div>
                                      ) : (
                                        <div className="rounded-lg border border-stone-800 overflow-hidden">
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="bg-stone-800/60 text-stone-500">
                                                <th className="text-left px-3 py-2">Date</th>
                                                <th className="text-center px-2 py-2">Type</th>
                                                <th className="text-right px-3 py-2">Units</th>
                                                <th className="text-right px-3 py-2">Price</th>
                                                <th className="text-right px-3 py-2 hidden sm:table-cell">Fee</th>
                                                <th className="text-right px-3 py-2">Total</th>
                                                <th className="text-right px-3 py-2 hidden sm:table-cell">Platform</th>
                                                <th className="px-2 py-2 w-12"></th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-800/50">
                                              {txns.map(t => {
                                                const tot = (parseFloat(t.units) || 0) * (parseFloat(t.price) || 0) + (parseFloat(t.fee) || 0);
                                                return (
                                                  <tr key={t.id} className="text-stone-300 hover:bg-stone-800/20">
                                                    <td className="px-3 py-1.5 text-stone-400">{t.date}</td>
                                                    <td className="px-2 py-1.5 text-center">
                                                      <span className={`px-1.5 py-0.5 rounded font-medium ${t.type === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {t.type}
                                                      </span>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right tabular-nums">{t.type === 'sell' ? '−' : ''}{fmtNum(parseFloat(t.units) || 0, 3)}</td>
                                                    <td className="px-3 py-1.5 text-right tabular-nums">{h.currency} {fmtNum(parseFloat(t.price) || 0, 2)}</td>
                                                    <td className="px-3 py-1.5 text-right tabular-nums text-stone-500 hidden sm:table-cell">{fmtNum(parseFloat(t.fee) || 0, 2)}</td>
                                                    <td className="px-3 py-1.5 text-right tabular-nums">{h.currency} {fmtNum(tot, 2)}</td>
                                                    <td className="px-3 py-1.5 text-right text-stone-500 hidden sm:table-cell">{t.platform}</td>
                                                    <td className="px-2 py-1.5">
                                                      <div className="flex items-center gap-1.5 justify-end">
                                                        <button onClick={() => openEditTxn(h, t)} className="text-stone-600 hover:text-stone-300 transition-colors">✎</button>
                                                        <button onClick={() => deleteTxn(h.id, t.id)} className="text-stone-600 hover:text-red-400 transition-colors">✕</button>
                                                      </div>
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>

                                    {/* Latest price update */}
                                    <div className="flex items-center gap-3">
                                      <p className="text-xs text-stone-500">Latest price:</p>
                                      <LatestPriceInput holding={h} onSave={refresh} />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-stone-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-stone-500">{filtered.length} position{filtered.length !== 1 ? 's' : ''}</span>
                    <button onClick={() => { if (confirm('Clear all holdings? This cannot be undone.')) { db.set('holdings', []); refresh(); } }}
                      className="text-stone-600 hover:text-red-400 transition-colors">Clear all</button>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-stone-500">P&amp;L: <span className={totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{totalPnl >= 0 ? '+' : ''}{fmtSGD(totalPnl)}</span></span>
                    <span className="text-stone-300 font-medium">{fmtSGD(totalValue)}</span>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Performance Attribution */}
      {enriched.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <button onClick={() => toggleSection('attribution')} className="w-full px-5 py-4 border-b border-stone-800 flex items-center justify-between hover:bg-stone-800/30 transition-colors">
            <h2 className="text-sm font-semibold text-stone-100">Performance Attribution</h2>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              style={{ transform: collapsed.has('attribution') ? 'rotate(-90deg)' : '', transition:'transform 0.2s', color:'#6b6057' }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {!collapsed.has('attribution') && (
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-medium text-stone-400 mb-3">Top Contributors</p>
                  <div className="space-y-2.5">
                    {topContribs.map(h => (
                      <div key={h.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-stone-200">{h.ticker}</span>
                          <span className="text-emerald-400 tabular-nums">+{fmtSGD(h.pnl)}</span>
                        </div>
                        <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: (maxAbsPnl ? h.pnl / maxAbsPnl * 100 : 0) + '%' }} />
                        </div>
                      </div>
                    ))}
                    {topContribs.length === 0 && <p className="text-xs text-stone-600 italic">No gains recorded yet.</p>}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-stone-400 mb-3">Top Detractors</p>
                  <div className="space-y-2.5">
                    {topDetractors.map(h => (
                      <div key={h.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-stone-200">{h.ticker}</span>
                          <span className="text-red-400 tabular-nums">{fmtSGD(h.pnl)}</span>
                        </div>
                        <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500/70 rounded-full" style={{ width: (maxAbsPnl ? Math.abs(h.pnl) / maxAbsPnl * 100 : 0) + '%' }} />
                        </div>
                      </div>
                    ))}
                    {topDetractors.length === 0 && <p className="text-xs text-stone-600 italic">No losing positions.</p>}
                  </div>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-stone-800 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-stone-500 mb-1">Unrealised Gain</p>
                  <p className={`text-sm font-semibold tabular-nums ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totalPnl >= 0 ? '+' : ''}{fmtSGD(totalPnl)}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500 mb-1">On Cost</p>
                  <p className={`text-sm font-semibold tabular-nums ${totalPnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500 mb-1">Positions</p>
                  <p className="text-sm font-semibold text-stone-200">{enriched.length}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Portfolio Allocation */}
      {enriched.length > 0 && (
        <div className="card !p-0 overflow-hidden">
          <button onClick={() => toggleSection('allocation')} className="w-full px-5 py-4 border-b border-stone-800 flex items-center justify-between hover:bg-stone-800/30 transition-colors">
            <h2 className="text-sm font-semibold text-stone-100">Portfolio Allocation</h2>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              style={{ transform: collapsed.has('allocation') ? 'rotate(-90deg)' : '', transition:'transform 0.2s', color:'#6b6057' }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {!collapsed.has('allocation') && (
            <div className="p-5">
              <div className="flex gap-1 mb-5 bg-stone-800/50 rounded-lg p-1 w-fit">
                {['category','type','geography'].map(tab => (
                  <button key={tab} onClick={() => setAllocTab(tab)}
                    className={`text-xs px-3 py-1.5 rounded-md transition-colors capitalize ${allocTab === tab ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {allocData.map(({ label, value, pct }) => {
                  const color = allocTab === 'category' ? (CAT_COLORS[label] || '#6b7280')
                    : allocTab === 'geography' ? (GEO_COLORS[label] || '#6b7280')
                    : '#7a6eb8';
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="font-medium text-stone-200">{label}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-stone-500 tabular-nums">{fmtSGD(value)}</span>
                          <span className="font-semibold tabular-nums" style={{ color }}>{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: Math.min(pct, 100) + '%', background: color, opacity: 0.75 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <HoldingModal open={showHoldingModal} onClose={() => setShowHoldingModal(false)} holding={editHolding} onSave={saveHolding} />
      <TransactionModal open={showTxnModal} onClose={() => setShowTxnModal(false)} holding={txnHolding} editTxn={editTxn} onSave={saveTxn} />
    </div>
  );
}

Object.assign(window, { InvestmentsPage });
