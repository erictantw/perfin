import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
      {Icon && <div className="p-3 rounded-2xl bg-stone-800 text-stone-500 mb-3"><Icon size={24} /></div>}
      <p className="text-sm font-semibold text-stone-300 mb-1">{title}</p>
      <p className="text-xs text-stone-500 mb-4">{description}</p>
      {action && (
        <button onClick={onAction} className="btn-primary text-xs px-4 py-2">{action}</button>
      )}
    </div>
  );
}
