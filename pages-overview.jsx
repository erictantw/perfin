
// ─── Overview Page ────────────────────────────────────────────────────────────

function GlowRing() {
  const canvasRef = React.useRef(null);
  const rafRef = React.useRef(null);
  const angleRef = React.useRef(0);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const r = 18; // border-radius

    function draw() {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2, cy = h / 2;
      const angle = angleRef.current;

      // Perimeter path for clipping
      const path = new Path2D();
      path.moveTo(r, 0);
      path.lineTo(w - r, 0);
      path.arcTo(w, 0, w, r, r);
      path.lineTo(w, h - r);
      path.arcTo(w, h, w - r, h, r);
      path.lineTo(r, h);
      path.arcTo(0, h, 0, h - r, r);
      path.lineTo(0, r);
      path.arcTo(0, 0, r, 0, r);
      path.closePath();

      // Inner path (cutout — 2px inset)
      const inset = 2;
      const ir = Math.max(r - inset, 0);
      const innerPath = new Path2D();
      innerPath.moveTo(inset + ir, inset);
      innerPath.lineTo(w - inset - ir, inset);
      innerPath.arcTo(w - inset, inset, w - inset, inset + ir, ir);
      innerPath.lineTo(w - inset, h - inset - ir);
      innerPath.arcTo(w - inset, h - inset, w - inset - ir, h - inset, ir);
      innerPath.lineTo(inset + ir, h - inset);
      innerPath.arcTo(inset, h - inset, inset, h - inset - ir, ir);
      innerPath.lineTo(inset, inset + ir);
      innerPath.arcTo(inset, inset, inset + ir, inset, ir);
      innerPath.closePath();

      // Draw outer glow bloom first (blurred)
      ctx.save();
      ctx.filter = 'blur(6px)';
      const glowGrad = ctx.createConicalGradient
        ? ctx.createConicalGradient(angle, cx, cy)
        : null;

      // Fallback: use arc-based approach
      // Compute the spot position on perimeter
      const spotAngle = angle;
      const spotX = cx + Math.cos(spotAngle) * (w * 0.52);
      const spotY = cy + Math.sin(spotAngle) * (h * 0.52);

      // Outer glow
      const radGlow = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, w * 0.35);
      radGlow.addColorStop(0, 'rgba(220,230,225,0.2)');
      radGlow.addColorStop(0.5, 'rgba(200,215,210,0.05)');
      radGlow.addColorStop(1, 'rgba(200,215,210,0)');
      ctx.fillStyle = radGlow;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // Draw border strip with spot light
      ctx.save();
      ctx.clip(path, 'evenodd');
      // Fill entire border strip with dark base
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fill(path);
      // Cut out inner
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fill(innerPath);
      ctx.globalCompositeOperation = 'source-over';

      // Bright spot travelling along border
      const spotRad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, 120);
      spotRad.addColorStop(0, 'rgba(255,255,255,0.95)');
      spotRad.addColorStop(0.2, 'rgba(220,230,225,0.7)');
      spotRad.addColorStop(0.5, 'rgba(180,200,195,0.2)');
      spotRad.addColorStop(1, 'rgba(180,200,195,0)');
      ctx.fillStyle = spotRad;
      ctx.fill(path);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fill(innerPath);
      ctx.restore();

      angleRef.current = (angle + 0.004) % (Math.PI * 2);
      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <div className="net-worth-glow-ring" style={{ position:'absolute', inset:-2, borderRadius:18, pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
      <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', display:'block' }} />
    </div>
  );
}

function NetWorthNumber({ netWorth, totalCash, totalInv, totalCPF, totalLoans, FX_USD }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div style={{ position:'relative', display:'inline-block' }}
      onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}>
      <p style={{
        fontFamily:"'Lora',Georgia,serif",
        fontSize:'clamp(2rem,5vw,3rem)', fontWeight:400,
        letterSpacing:'-0.03em', lineHeight:1,
        color: netWorth >= 0 ? '#e8e3db' : '#fca5a5',
        cursor:'default',
        textShadow: netWorth >= 0
          ? '0 0 40px rgba(74,158,122,0.3), 0 0 80px rgba(74,158,122,0.12)'
          : '0 0 40px rgba(248,113,113,0.3), 0 0 80px rgba(248,113,113,0.12)',
      }}>
        {netWorth < 0 ? '–' : ''}{fmtSGD(Math.abs(netWorth))}
      </p>
      {hovered && (
        <div style={{
          position:'absolute', top:'calc(100% + 10px)', left:0, zIndex:100,
          background:'#1f1c19', border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:12, padding:'1rem', minWidth:240,
          boxShadow:'0 25px 50px -12px rgba(0,0,0,0.6)',
          pointerEvents:'none',
        }}>
          {[
            { label:'Cash',       value:totalCash,  color:'#4a9e7a', sign:'+' },
            { label:'Investments',value:totalInv,   color:'#d4a052', sign:'+' },
            { label:'CPF · SRS',  value:totalCPF,   color:'#7a6eb8', sign:'+' },
            { label:'Loans',      value:totalLoans, color:'#c4564a', sign:'−' },
          ].map(({ label, value, color, sign }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:32, marginBottom:6 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0, display:'inline-block' }} />
                <span style={{ fontSize:'0.8rem', color:'#a09282', fontFamily:'Inter,sans-serif' }}>{label}</span>
              </div>
              <span style={{ fontSize:'0.8rem', color, fontFamily:'Inter,sans-serif', fontWeight:500 }}>{sign} {fmtSGD(value)}</span>
            </div>
          ))}
          <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:'0.8rem', color:'#7a7068', fontFamily:'Inter,sans-serif' }}>Net Worth</span>
            <span style={{ fontSize:'0.8rem', color: netWorth >= 0 ? '#e8e3db' : '#fca5a5', fontFamily:'Inter,sans-serif', fontWeight:500 }}>{fmtSGD(netWorth)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Exact color tokens from capture
const OV_COLORS = {
  cash:        { dot: '#4a9e7a', bar: '#4a9e7a' },
  investments: { dot: '#d4a052', bar: '#d4a052' },
  cpf:         { dot: '#7a6eb8', bar: '#7a6eb8' },
  loans:       { dot: '#f87171', bar: '#f87171' },
};

function AssetTile({ label, value, subtitle, colorKey, pct, targetPct, gap, isLoan, onClick }) {
  const col = OV_COLORS[colorKey] || OV_COLORS.cash;
  const gapPositive = gap >= 0;

  return (
    <div onClick={onClick} style={{
      background: isLoan ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.04)',
      border: isLoan ? '1px solid rgba(248,113,113,0.2)' : '1px solid rgba(255,255,255,0.09)',
      borderRadius: 12,
      padding: '1.1rem 1.25rem',
      display: 'flex', flexDirection: 'column',
      cursor: 'pointer',
      transition: 'transform 0.18s cubic-bezier(0.4,0,0.2,1), box-shadow 0.18s',
      boxShadow: 'rgba(255,255,255,0.06) 0px 1px 0px 0px inset',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'rgba(255,255,255,0.08) 0px 1px 0px 0px inset, 0 6px 20px rgba(0,0,0,0.3)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'rgba(255,255,255,0.06) 0px 1px 0px 0px inset'; }}
    className="group"
    >
      {/* Header row: dot + label + arrow */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ width:6, height:6, borderRadius:'50%', background: col.dot, display:'inline-block', flexShrink:0 }} />
          <p style={{ fontSize:'0.65rem', letterSpacing:'0.1em', textTransform:'uppercase', color:'#8a7d6b', fontFamily:'Inter,sans-serif' }}>{label}</p>
        </div>
        <span style={{ color: isLoan ? '#f87171' : '#6b6057', fontSize:'0.75rem', opacity:0.3, transition:'opacity 0.15s' }}
          className="group-hover:opacity-100">→</span>
      </div>

      {/* Value */}
      <p style={{ fontFamily:"'Lora',Georgia,serif", fontSize:'clamp(1.25rem,2vw,1.6rem)', color: isLoan ? '#fca5a5' : '#e8e3db', letterSpacing:'-0.02em', marginBottom:'0.2rem', lineHeight:1.1 }}>
        {isLoan && value > 0 ? '− ' : ''}{fmtSGD(value)}
      </p>

      {/* Subtitle */}
      <p style={{ fontSize:'0.72rem', color:'#7a7068', fontFamily:'Inter,sans-serif', lineHeight:1.4, flex:1 }}>{subtitle}</p>

      {/* Bottom bar (not for loans) */}
      {!isLoan && pct !== undefined && (
        <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize:'0.7rem', color:'#7a7068', fontFamily:'Inter,sans-serif' }}>{pct.toFixed(1)}% of assets</span>
            <span style={{ fontSize:'0.7rem', fontFamily:'Inter,sans-serif', color: gapPositive ? '#6dbf9b' : '#f87171' }}>
              {gap > 0 ? '+' : ''}{gap.toFixed(1)}% vs target
            </span>
          </div>
          <div style={{ position:'relative', height:4, borderRadius:9999, background:'rgba(255,255,255,0.06)', overflow:'visible' }}>
            <div style={{ height:'100%', borderRadius:9999, background: col.bar, opacity:0.7, width:`${Math.min(pct,100)}%`, transition:'width 0.7s ease' }} />
            {/* Target marker */}
            <div style={{ position:'absolute', top:'50%', width:2, height:12, borderRadius:2, background:'rgba(255,255,255,0.35)', left:`${Math.min(targetPct,100)}%`, transform:'translateX(-50%) translateY(-50%)' }} />
          </div>
        </div>
      )}

      {/* Loans bottom: monthly */}
      {isLoan && (
        <div style={{ marginTop:'0.75rem', paddingTop:'0.75rem', borderTop:'1px solid rgba(248,113,113,0.15)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:'0.7rem', color:'#8a7d6b', fontFamily:'Inter,sans-serif' }}>Monthly</span>
          <span style={{ fontSize:'0.7rem', color:'#e8ddd0', fontFamily:'Inter,sans-serif' }}>{subtitle}</span>
        </div>
      )}
    </div>
  );
}

function AllocationPlanCard({ gaps, catColors, onNavigate }) {
  const ACCENT = '#d4a052';
  return (
    <div onClick={() => onNavigate('plan')}
      style={{
        background: 'rgba(212,160,82,0.08)',
        border: '1px solid rgba(212,160,82,0.16)',
        borderRadius: 12,
        padding: '1.1rem 1.25rem',
        cursor: 'pointer',
        transition: 'transform 0.18s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: 'rgba(255,255,255,0.04) 0px 1px 0px 0px inset',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
      className="group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div style={{ width:28, height:28, borderRadius:8, background:'rgba(212,160,82,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="15" height="15" fill="none" stroke={ACCENT} strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          </div>
          <div>
            <p style={{ fontSize:'0.8rem', fontWeight:600, color:'#e8ddd0', fontFamily:'Inter,sans-serif', lineHeight:1.2 }}>Allocation Plan</p>
            <p style={{ fontSize:'0.68rem', color:'#8a7d6b', fontFamily:'Inter,sans-serif' }}>Your targets vs. where you stand today</p>
          </div>
        </div>
        <span style={{ color:'#8a7d6b', fontSize:'0.85rem', opacity:0.3, transition:'all 0.15s' }} className="group-hover:opacity-100 group-hover:text-amber-400">→</span>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-2.5">
        {gaps.map(({ key, actualPct, targetPct, gap }) => {
          const col = key === 'Cash' ? OV_COLORS.cash : key === 'Investments' ? OV_COLORS.investments : key === 'CPF' ? OV_COLORS.cpf : OV_COLORS.cash;
          return (
            <div key={key} className="flex items-center gap-2">
              <span style={{ fontSize:'0.68rem', color:'#7a7068', fontFamily:'Inter,sans-serif', width:80, flexShrink:0 }}>{key}</span>
              <div style={{ flex:1, height:6, borderRadius:9999, background:'rgba(255,255,255,0.06)', position:'relative', overflow:'visible' }}>
                <div style={{ height:'100%', borderRadius:9999, background: col.bar, opacity:0.6, width:`${Math.min(actualPct,100)}%`, transition:'width 0.7s ease' }} />
                <div style={{ position:'absolute', top:'50%', width:2, height:10, borderRadius:2, background:'rgba(255,255,255,0.4)', left:`${Math.min(targetPct,100)}%`, transform:'translateX(-50%) translateY(-50%)' }} />
              </div>
              <span style={{ fontSize:'0.68rem', color:'#7a7068', fontFamily:'Inter,sans-serif', width:30, textAlign:'right', flexShrink:0 }}>{actualPct.toFixed(0)}%</span>
              <span style={{ fontSize:'0.68rem', fontFamily:'Inter,sans-serif', width:36, textAlign:'right', flexShrink:0, color: gap >= 0 ? '#6dbf9b' : '#f87171' }}>
                {gap > 0 ? '+' : ''}{gap.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize:'0.62rem', color:'#4a4540', fontFamily:'Inter,sans-serif', marginTop:'0.75rem', paddingTop:'0.6rem', borderTop:'1px solid rgba(212,160,82,0.12)' }}>
        Targets are set by you. Not financial advice.
      </p>
    </div>
  );
}

function OverviewPage() {
  const [tick, setTick] = React.useState(0);
  const refresh = () => setTick(t => t + 1);
  const [showCashModal, setShowCashModal] = React.useState(false);
  const [cashForm, setCashForm] = React.useState({ account_name:'', balance:'', currency:'SGD', category:'Savings' });

  const FX_USD = 1.34;
  const profile = db.get('profile', { name:'Alex', allocation_targets:null });
  const cashAccounts = db.get('cash', []);
  const holdings = db.get('holdings', []);
  const cpf = db.get('cpf', { oa:0, sa:0, ma:0, ra:0, srs:0 });
  const loans = db.get('loans', []);

  const totalCash = cashAccounts.reduce((s,a) => s + (a.currency==='USD' ? a.balance*FX_USD : a.balance), 0);
  const totalInv  = holdings.reduce((s,h) => {
    const price = h.latest_price||h.avg_cost;
    return s + h.units * price * (h.currency==='USD' ? FX_USD : 1);
  }, 0);
  const totalCPF   = (cpf.oa||0)+(cpf.sa||0)+(cpf.ma||0)+(cpf.ra||0)+(cpf.srs||0);
  const totalLoans = loans.reduce((s,l) => s+(l.outstanding_balance||0), 0);
  const netWorth   = totalCash + totalInv + totalCPF - totalLoans;

  const targets = profile.allocation_targets ? JSON.parse(profile.allocation_targets) : { Cash:15, Investments:50, CPF:30, Properties:5 };
  const actual  = { Cash:totalCash, Investments:totalInv, CPF:totalCPF, Properties:0 };
  const gaps    = calcAllocationGaps(actual, targets);

  const totalAssets = totalCash + totalInv + totalCPF;
  const cashPct = totalAssets ? totalCash/totalAssets*100 : 0;
  const invPct  = totalAssets ? totalInv /totalAssets*100 : 0;
  const cpfPct  = totalAssets ? totalCPF /totalAssets*100 : 0;

  const cashGap = gaps.find(g=>g.key==='Cash');
  const invGap  = gaps.find(g=>g.key==='Investments');
  const cpfGap  = gaps.find(g=>g.key==='CPF');

  // Onboarding check
  const hasCash = cashAccounts.length > 0;
  const hasCPF  = totalCPF > 0;
  const hasInv  = holdings.length > 0;
  const completedSteps = [hasCPF, hasCash, hasInv].filter(Boolean).length;
  const allSetUp = hasCPF && hasCash && hasInv && !!profile.allocation_targets;
  const [showOnboarding, setShowOnboarding] = React.useState(() => {
    const stored = localStorage.getItem('wf_show_onboarding');
    if (stored === null) return true; // first visit — auto-show
    return JSON.parse(stored);
  });

  // Monthly loans payment
  const totalMonthlyLoan = loans.reduce((s,l) => s+(l.monthly_payment||calcMonthlyRepayment(l.principal,l.annual_rate,l.tenure_months)), 0);

  function navigate(id) { if (window.__navigateTo) window.__navigateTo(id); }

  function saveCash(e) {
    e.preventDefault();
    const list = db.get('cash',[]);
    list.push({ id:db.nextId('cash'), ...cashForm, balance:parseFloat(cashForm.balance) });
    db.set('cash', list);
    setShowCashModal(false);
    setCashForm({ account_name:'', balance:'', currency:'SGD', category:'Savings' });
    refresh();
  }

  function deleteCash(id) {
    db.set('cash', db.get('cash',[]).filter(a=>a.id!==id));
    refresh();
  }

  // ── Onboarding view ──────────────────────────────────────────────────────────
  const onboardSteps = [
    { num:'01', title:'Add your CPF balances',       time:'1 min',  desc:'OA, SA, MA and RA — the foundation of your Singapore retirement.', done:hasCPF, action:'Add CPF →', onClick:()=>navigate('cpf') },
    { num:'02', title:'Add your cash accounts',      time:'2 min',  desc:'Savings, Emergency, Checking — know exactly where your liquid money sits.', done:hasCash, action:'Add Cash →', onClick:()=>setShowCashModal(true) },
    { num:'03', title:'Add your first investment',   time:'2 min',  desc:'Stocks, ETFs, REITs — track everything in one dashboard.', done:hasInv, action:'Add investment →', onClick:()=>navigate('investments') },
    { num:'04', title:'Set your allocation targets', time:'30 sec', desc:'See how your portfolio compares to your ideal allocation.', done:!!profile.allocation_targets, action:'Set targets →', onClick:()=>navigate('plan') },
  ];

  if (showOnboarding) {
    return (
      <div style={{ maxWidth:640 }}>
        <div className="mb-8">
          <p className="section-label mb-3">Welcome to Wealthfolio</p>
          <h1 style={{ fontFamily:"'Lora',Georgia,serif", fontWeight:400, fontSize:'clamp(1.7rem,4vw,2.2rem)', lineHeight:1.2, color:'#f0ebe4', letterSpacing:'-0.02em' }}>
            Let's set up your<br />financial picture.
          </h1>
          <p style={{ fontSize:'0.875rem', color:'#78716c', marginTop:'0.75rem', lineHeight:1.6, fontFamily:'Inter,sans-serif' }}>
            Complete these steps to see your full net worth in one place. Takes about 5 minutes.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {onboardSteps.map((step) => (
            <button key={step.num} onClick={step.onClick} style={{
              textAlign:'left', width:'100%',
              background: step.done ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
              border: step.done ? '1px solid rgba(16,185,129,0.18)' : '1px solid rgba(255,255,255,0.07)',
              borderRadius:14, padding:'1.1rem 1.35rem', cursor:'pointer', transition:'transform 0.15s',
            }}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
            onMouseLeave={e=>e.currentTarget.style.transform=''}
            >
              <div className="flex items-start gap-4">
                <div style={{ flexShrink:0, marginTop:2 }}>
                  {step.done ? (
                    <div style={{ width:26, height:26, borderRadius:'50%', background:'rgba(16,185,129,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="13" height="13" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  ) : (
                    <span style={{ fontFamily:"'Lora',Georgia,serif", fontStyle:'italic', fontSize:'1rem', color:'#6b6057', lineHeight:1 }}>{step.num}</span>
                  )}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <p style={{ fontFamily:"'Lora',Georgia,serif", fontWeight:500, fontSize:'0.95rem', color: step.done ? '#78716c' : '#f0ebe4', textDecoration: step.done ? 'line-through' : 'none' }}>{step.title}</p>
                    <span style={{ fontSize:'0.68rem', color:'#57534e', flexShrink:0, fontFamily:'Inter,sans-serif' }}>{step.time}</span>
                  </div>
                  <p style={{ fontSize:'0.8rem', color:'#6b6057', lineHeight:1.5, fontFamily:'Inter,sans-serif' }}>{step.desc}</p>
                  {!step.done && <p style={{ fontSize:'0.7rem', fontWeight:500, color:'#10b981', marginTop:'0.4rem', fontFamily:'Inter,sans-serif' }}>{step.action}</p>}
                </div>
              </div>
            </button>
          ))}
        </div>

        <p style={{ fontSize:'0.7rem', color:'#4a4540', textAlign:'center', marginTop:'1.5rem', fontFamily:'Inter,sans-serif' }}>
          Your data is stored locally in your browser. Never shared with anyone.
        </p>
        <div style={{ textAlign:'center', marginTop:'0.75rem' }}>
          <button onClick={()=>{ setShowOnboarding(false); db.set('show_onboarding',false); }}
            style={{ fontSize:'0.72rem', color:'#57534e', background:'none', border:'none', cursor:'pointer', textDecoration:'underline', textUnderlineOffset:2, fontFamily:'Inter,sans-serif' }}>
            Skip — view demo data
          </button>
        </div>

        <Modal open={showCashModal} onClose={()=>setShowCashModal(false)} title="Add Cash Account" size="sm">
          <form onSubmit={saveCash} className="space-y-4">
            <Field label="Account name"><Input required value={cashForm.account_name} onChange={e=>setCashForm(f=>({...f,account_name:e.target.value}))} placeholder="e.g. DBS Multiplier" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Balance"><Input type="number" step="0.01" required value={cashForm.balance} onChange={e=>setCashForm(f=>({...f,balance:e.target.value}))} placeholder="0.00" /></Field>
              <Field label="Currency"><Select value={cashForm.currency} onChange={e=>setCashForm(f=>({...f,currency:e.target.value}))}>{['SGD','USD','EUR','GBP','HKD','AUD','JPY'].map(c=><option key={c}>{c}</option>)}</Select></Field>
            </div>
            <Field label="Category"><Select value={cashForm.category} onChange={e=>setCashForm(f=>({...f,category:e.target.value}))}>{['Savings','Checking','Emergency','Investment Cash','Other'].map(c=><option key={c}>{c}</option>)}</Select></Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={()=>setShowCashModal(false)} className="flex-1 py-2 rounded-lg border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 transition-colors">Cancel</button>
              <button type="submit" className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">Save</button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ── Full Dashboard ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <PageHeader right={!allSetUp && (
        <button onClick={()=>{ setShowOnboarding(true); db.set('show_onboarding',true); }}
          style={{ fontSize:'0.7rem', color:'#44403c', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif' }}
          className="hidden sm:block hover:text-stone-400 transition-colors">
          Setup guide
        </button>
      )} />

      {/* Net Worth Hero Card */}
      <div className="net-worth-glow-card" style={{
        background:'#1e1b18', borderRadius:16,
        border:'1px solid rgba(255,255,255,0.06)',
        boxShadow:'rgba(255,255,255,0.07) 0px 1px 0px 0px inset',
        padding:'clamp(1.5rem,3vw,2.5rem)',
        overflow:'visible', position:'relative',
      }}>
        <GlowRing />
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 85% 40%, rgba(74,158,122,0.07) 0%, transparent 60%)', pointerEvents:'none', borderRadius:16 }} />
        <div style={{ position:'relative' }}>
          <p style={{ fontSize:'0.65rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'#8a7d6b', fontFamily:'Inter,sans-serif', marginBottom:8 }}>Total Net Worth</p>

          {/* Net worth number with hover popup */}
          <NetWorthNumber netWorth={netWorth} totalCash={totalCash} totalInv={totalInv} totalCPF={totalCPF} totalLoans={totalLoans} FX_USD={FX_USD} />

          <p style={{ fontSize:'0.68rem', color:'#6b6057', fontFamily:'Inter,sans-serif', marginTop:8 }}>
            1 USD = SGD {FX_USD.toFixed(4)} · Updated {new Date().toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit'})}
          </p>

          {/* Stacked bar */}
          <div style={{ marginTop:20, display:'flex', borderRadius:9999, overflow:'hidden', height:8, gap:1, background:'#292524' }}>
            <div style={{ background:'#4a9e7a', width:cashPct+'%', transition:'width 0.7s ease' }} />
            <div style={{ background:'#d4a052', width:invPct+'%', transition:'width 0.7s ease' }} />
            <div style={{ background:'#7a6eb8', width:cpfPct+'%', transition:'width 0.7s ease' }} />
          </div>

          {/* Legend */}
          <div style={{ marginTop:10, display:'flex', gap:'1.25rem', flexWrap:'wrap' }}>
            {[
              { label:`Cash ${cashPct.toFixed(1)}%`,       color:'#4a9e7a' },
              { label:`Investments ${invPct.toFixed(1)}%`,  color:'#d4a052' },
              { label:`CPF · SRS ${cpfPct.toFixed(1)}%`,   color:'#7a6eb8' },
            ].map(({ label, color }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:color, display:'inline-block', flexShrink:0 }} />
                <span style={{ fontSize:'0.72rem', color:'#7a7068', fontFamily:'Inter,sans-serif' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Asset Tiles — 2-col on mobile, 4-col on lg */}
      <div className="asset-tiles" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
        <style>{`@media(min-width:1024px){.asset-tiles{grid-template-columns:repeat(4,1fr)!important}}`}</style>
        <AssetTile label="Cash" value={totalCash} subtitle={`SGD ${fmtNum(totalCash,0)}`}
          colorKey="cash" pct={cashPct} targetPct={cashGap?.targetPct||15} gap={cashGap?.gap||0}
          onClick={()=>navigate('investments')} />
        <AssetTile label="Investments" value={totalInv} subtitle={`USD ${fmtNum(totalInv/FX_USD,0)}`}
          colorKey="investments" pct={invPct} targetPct={invGap?.targetPct||50} gap={invGap?.gap||0}
          onClick={()=>navigate('investments')} />
        <AssetTile label="CPF · SRS" value={totalCPF}
          subtitle={`OA ${fmtSGD(cpf.oa||0)} · SA ${fmtSGD(cpf.sa||0)} · MA ${fmtSGD(cpf.ma||0)}`}
          colorKey="cpf" pct={cpfPct} targetPct={cpfGap?.targetPct||30} gap={cpfGap?.gap||0}
          onClick={()=>navigate('cpf')} />
        <AssetTile label="Loans & Liabilities" value={totalLoans}
          subtitle={fmtSGD(totalMonthlyLoan)}
          colorKey="loans" isLoan={true}
          onClick={()=>navigate('loans')} />
      </div>

      {/* Allocation Plan card */}
      <AllocationPlanCard gaps={gaps.filter(g=>g.key!=='Properties')} catColors={{}} onNavigate={navigate} />

      {/* Add Cash Modal */}
      <Modal open={showCashModal} onClose={()=>setShowCashModal(false)} title="Add Cash Account" size="sm">
        <form onSubmit={saveCash} className="space-y-4">
          <Field label="Account name"><Input required value={cashForm.account_name} onChange={e=>setCashForm(f=>({...f,account_name:e.target.value}))} placeholder="e.g. DBS Multiplier" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Balance"><Input type="number" step="0.01" required value={cashForm.balance} onChange={e=>setCashForm(f=>({...f,balance:e.target.value}))} placeholder="0.00" /></Field>
            <Field label="Currency"><Select value={cashForm.currency} onChange={e=>setCashForm(f=>({...f,currency:e.target.value}))}>{['SGD','USD','EUR','GBP','HKD','AUD','JPY'].map(c=><option key={c}>{c}</option>)}</Select></Field>
          </div>
          <Field label="Category"><Select value={cashForm.category} onChange={e=>setCashForm(f=>({...f,category:e.target.value}))}>{['Savings','Checking','Emergency','Investment Cash','Other'].map(c=><option key={c}>{c}</option>)}</Select></Field>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={()=>setShowCashModal(false)} className="flex-1 py-2 rounded-lg border border-stone-700 text-stone-300 text-sm hover:bg-stone-800 transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

Object.assign(window, { OverviewPage });
