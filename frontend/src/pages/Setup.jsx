import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../App.jsx';
import { authApi } from '../lib/api.js';

function PasswordStrength({ password }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Contains a number',      ok: /\d/.test(password) },
    { label: 'Contains a letter',      ok: /[a-zA-Z]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const colors = ['bg-red-500', 'bg-amber-500', 'bg-amber-400', 'bg-emerald-500'];
  const labels = ['', 'Weak', 'Fair', 'Strong'];

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score] : 'bg-[#292524]'}`}
          />
        ))}
      </div>
      <p className={`text-xs ${score === 3 ? 'text-emerald-400' : score === 2 ? 'text-amber-400' : 'text-red-400'}`}>
        {labels[score]}
      </p>
      <ul className="space-y-1">
        {checks.map((c) => (
          <li key={c.label} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-emerald-400' : 'text-[#57534e]'}`}>
            <CheckCircle2 size={11} className={c.ok ? 'text-emerald-400' : 'text-[#57534e]'} />
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Setup() {
  const { login, token } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1 = password, 2 = profile
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Already logged in — redirect
  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [token, navigate]);

  // Check if already set up
  useEffect(() => {
    authApi.isSetup().then((setup) => {
      if (setup) navigate('/login', { replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (step === 1) {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
      if (password !== confirm) { setError('Passwords do not match.'); return; }
      setStep(2);
      return;
    }

    // Step 2 — create account
    setLoading(true);
    try {
      const body = { password };
      if (name.trim()) body.name = name.trim();
      if (age && !isNaN(age)) body.age = Number(age);

      const data = await authApi.setup(body);
      login(data.token, data.profile ?? { name: name.trim() || null });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a1714] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-900/40">
            <TrendingUp size={22} className="text-white" strokeWidth={2} />
          </div>
          <h1 className="page-title text-center">Welcome to Wealthfolio</h1>
          <p className="text-[#78716c] text-sm mt-1">Set up your private finance dashboard</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          {[1, 2].map((s) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 text-xs font-medium ${step >= s ? 'text-emerald-400' : 'text-[#57534e]'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold
                  ${step > s ? 'bg-emerald-600 text-white' : step === s ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/50' : 'bg-[#292524] text-[#57534e]'}`}>
                  {step > s ? '✓' : s}
                </div>
                <span>{s === 1 ? 'Password' : 'Profile'}</span>
              </div>
              {s < 2 && <div className={`flex-1 h-px ${step > s ? 'bg-emerald-600/50' : 'bg-[#292524]'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? (
              <>
                <div>
                  <label className="section-label block mb-1.5">Create password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Choose a strong password"
                      className="input pr-10"
                      autoFocus
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#57534e] hover:text-[#a8a29e] transition-colors"
                    >
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                </div>

                <div>
                  <label className="section-label block mb-1.5">Confirm password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter your password"
                      className="input pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#57534e] hover:text-[#a8a29e] transition-colors"
                    >
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <p className="text-xs text-red-400 mt-1">Passwords do not match.</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="section-label block mb-1.5">Your name <span className="normal-case text-[#57534e]">(optional)</span></label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex"
                    className="input"
                    autoFocus
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="section-label block mb-1.5">Your age <span className="normal-case text-[#57534e]">(optional)</span></label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 32"
                    className="input"
                    min={18}
                    max={100}
                  />
                  <p className="text-xs text-[#57534e] mt-1">Used for CPF projection calculations.</p>
                </div>
              </>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertCircle size={13} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-secondary flex-1"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={loading || (step === 1 && (!password || password !== confirm))}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed py-2.5"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Creating account…</span>
                  </>
                ) : step === 1 ? (
                  'Continue'
                ) : (
                  'Create account'
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-[#57534e] text-xs mt-6">
          All data is stored privately — only you can access it.
        </p>
      </div>
    </div>
  );
}
