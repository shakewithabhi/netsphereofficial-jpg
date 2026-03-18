import { useState, useRef, useEffect } from 'react';
import { Shield, X } from 'lucide-react';
import { verify2FALogin } from '../api/auth';
import type { AuthResponse } from '../api/auth';

interface TwoFactorVerifyProps {
  tempToken: string;
  onSuccess: (data: AuthResponse) => void;
  onCancel: () => void;
}

export function TwoFactorVerify({ tempToken, onSuccess, onCancel }: TwoFactorVerifyProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleCodeChange(value: string) {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setCode(cleaned);
    setError('');

    // Auto-submit when 6 digits entered
    if (cleaned.length === 6) {
      submitCode(cleaned);
    }
  }

  async function submitCode(codeValue?: string) {
    const submitVal = codeValue ?? code;
    if (submitVal.length !== 6) {
      setError('Please enter a 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await verify2FALogin(submitVal, tempToken);
      onSuccess(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid verification code. Please try again.';
      setError(msg);
      setCode('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitCode();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">
              Two-Factor Authentication
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
            Enter the 6-digit code from your authenticator app to sign in.
          </p>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Verification code
              </label>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="000000"
                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-600 rounded-xl text-lg text-center font-mono tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                maxLength={6}
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 text-center">
            You can also use a backup code if you lost your authenticator.
          </p>
        </div>
      </div>
    </div>
  );
}
