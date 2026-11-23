import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Radio,
  ShieldCheck,
  User,
  Waves,
} from 'lucide-react';
import {
  isSupabaseConfigured,
  signInOperator,
  signUpOperator,
} from '../lib/supabase';
import type { OperatorUser } from '../types/flood';

interface LoginPageProps {
  onAuthenticated: (user: OperatorUser) => void;
}

export function LoginPage({ onAuthenticated }: LoginPageProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const res = await signInOperator(username, password);
        if (res.error || !res.user) {
          setErrorMsg(res.error ?? 'Authentication failed. Verify your credentials and try again.');
        } else {
          onAuthenticated(res.user);
        }
      } else {
        const res = await signUpOperator(username, email, password);
        if (res.error) {
          setErrorMsg(res.error);
        } else if (res.message) {
          setInfoMsg(res.message);
          setMode('signin');
        } else if (res.user) {
          onAuthenticated(res.user);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  function fillDemoCredentials() {
    setMode('signin');
    setUsername('operator.manila');
    setPassword('manila-lrt2');
    setErrorMsg(null);
  }

  return (
    <main className="min-h-screen bg-[#F4F6F8] grid grid-cols-1 lg:grid-cols-12">
      {/* Left Operational Brand Surface (LRT-2 Purple) */}
      <section className="lg:col-span-5 bg-[#4C1D95] text-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between gap-10">
        <div>
          <div className="inline-flex items-center gap-2 bg-white text-[#4C1D95] px-3 py-1.5 rounded-md font-display font-bold text-sm tracking-tight">
            <Waves className="w-4 h-4" strokeWidth={2.2} />
            AGOS-LRT2
          </div>

          <h1 className="mt-8 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-white">
            Manila Flood Monitoring Console
          </h1>
          <p className="mt-4 text-sm sm:text-base text-[#F3E8FF] leading-relaxed max-w-md">
            Ultrasonic water-level telemetry, tri-state flood alerts, and
            hydrological simulation along the Metro Manila LRT Line 2 corridor.
          </p>
        </div>

        <div className="space-y-3 border-t border-white/20 pt-6 text-xs sm:text-sm text-[#F5F3FF]">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4ADE80]" />
              GREEN · Normal Clearance
            </span>
            <span className="font-mono-num text-[#E9D5FF]">&gt; 50 cm</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FB923C]" />
              ORANGE · Pre-Flood Warning
            </span>
            <span className="font-mono-num text-[#E9D5FF]">26–50 cm</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F87171]" />
              RED · Critical Flood Alert
            </span>
            <span className="font-mono-num text-[#E9D5FF]">&le; 25 cm</span>
          </div>
        </div>
      </section>

      {/* Right Authenticator Surface (Flat, Unnested) */}
      <section className="lg:col-span-7 bg-white flex items-center justify-center p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#0F172A]">
                {mode === 'signin' ? 'Operator Sign In' : 'Register Operator'}
              </h2>
              <p className="text-sm text-[#475569] mt-1">
                Sign in with Supabase to monitor Manila LRT-2 stations.
              </p>
            </div>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${
                isSupabaseConfigured
                  ? 'bg-[#DCFCE7] text-[#15803D]'
                  : 'bg-[#F3E8FF] text-[#5B21B6]'
              }`}
            >
              {isSupabaseConfigured ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Supabase Live
                </>
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5" />
                  Preview Auth
                </>
              )}
            </span>
          </div>

          {!isSupabaseConfigured && (
            <div className="mt-6 py-3 border-y border-[#E2E8F0] text-xs text-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="leading-relaxed">
                Supabase keys are not set in{' '}
                <code className="font-mono-num font-semibold text-[#4C1D95]">.env</code>.
                Preview auth is active for UI testing.
              </p>
              <button
                type="button"
                onClick={fillDemoCredentials}
                className="shrink-0 px-3 py-1.5 rounded-md bg-[#F3E8FF] text-[#4C1D95] font-semibold hover:bg-[#E9D5FF] transition-colors cursor-pointer"
              >
                Fill Demo Login
              </button>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="mt-5 py-2.5 px-3 rounded-md bg-[#FEE2E2] text-xs text-[#991B1B] font-medium flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div
              role="status"
              className="mt-5 py-2.5 px-3 rounded-md bg-[#DCFCE7] text-xs text-[#166534] font-medium flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{infoMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="auth-username"
                className="block text-xs font-semibold text-[#334155] mb-1.5"
              >
                {mode === 'signin' ? 'Username or Email' : 'Operator Username'}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#475569] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="operator.manila"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-[#94A3B8] rounded-lg text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#6B21A8] focus:border-[#6B21A8]"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold text-[#334155] mb-1.5"
                >
                  Operator Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@manila-drrmo.ph"
                  className="w-full px-3 py-2.5 text-sm bg-white border border-[#94A3B8] rounded-lg text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#6B21A8] focus:border-[#6B21A8]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-[#334155] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#475569] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-white border border-[#94A3B8] rounded-lg text-[#0F172A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#6B21A8] focus:border-[#6B21A8]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#475569] hover:text-[#0F172A] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-[#6B21A8] text-white font-semibold text-sm hover:bg-[#581C87] active:bg-[#4C1D95] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {loading
                ? 'Authenticating...'
                : mode === 'signin'
                  ? 'Sign In to Dashboard'
                  : 'Create Operator Account'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#475569]">
            <span>
              {mode === 'signin' ? 'Need an operator account?' : 'Already registered?'}
            </span>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className="font-semibold text-[#6B21A8] hover:underline cursor-pointer"
            >
              {mode === 'signin' ? 'Create Account' : 'Back to Sign In'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
