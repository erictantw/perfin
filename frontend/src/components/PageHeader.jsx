import React from 'react';
import { greet, todayLong } from '../lib/formatters.js';
import { useAuth } from '../App.jsx';

export default function PageHeader({ right } = {}) {
  const { profile } = useAuth();
  const name = profile?.display_name || 'there';
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
      <div>
        <h1 style={{ fontFamily:"'Lora',Georgia,serif", fontWeight:400, fontSize:'clamp(1.35rem,3vw,1.85rem)', color:'#f0ebe4', letterSpacing:'-0.02em', lineHeight:1.15, margin:0 }}>
          {greet()}, {name}
        </h1>
        <p style={{ fontSize:'0.72rem', color:'#6b6057', marginTop:4, fontFamily:'Inter,sans-serif' }}>{todayLong()}</p>
      </div>
      {right && <div style={{ flexShrink:0, paddingTop:4 }}>{right}</div>}
    </div>
  );
}
