import React from 'react';

export function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

export function Input(props) {
  return <input {...props} className={`input ${props.className || ''}`} />;
}

export function Select({ children, ...props }) {
  return <select {...props} className={`input ${props.className || ''}`}>{children}</select>;
}
