import { useState } from 'react';
import { Shield, ShieldOff, Check, Copy, Eye, EyeOff, X } from 'lucide-react';
import { enable2FA, verify2FA, disable2FA } from '../api/auth';

interface TwoFactorSetupProps {
  isEnabled: boolean;
  onStatusChange: () => void;
}

export function TwoFactorSetup({ isEnabled, onStatusChange }: TwoFactorSetupProps) {
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'success' | 'disable'>('idle');
  const [secret, setSecret] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  async function handleEnable() {
    setLoading(true);
    setError('');
    try {
      const data = await enable2FA();
      setSecret(data.secret);
      setQrUrl(data.qr_url);
      setStep('setup');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to initiate 2FA setup.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (code.length !== 6) {
      setError('Please enter a 6-digit code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await verify2FA(code);
      setBackupCodes(data.backup_codes);
      setStep('success');
      onStatusChange();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid verification code. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (disableCode.length !== 6) {
      setError('Please enter a 6-digit code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await disable2FA(disableCode);
      setStep('idle');
      setDisableCode('');
      onStatusChange();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid code. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleCodeChange(value: string) {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setCode(cleaned);
    if (cleaned.length === 6) {
      // Auto-submit will happen via useEffect or user can click verify
    }
  }

  function handleDisableCodeChange(value: string) {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setDisableCode(cleaned);
  }

  async function copyBackupCodes() {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2000);
    } catch {
      // fallback: select text
    }
  }

  function reset() {
    setStep('idle');
    setSecret('');
    setQrUrl('');
    setCode('');
    setBackupCodes([]);
    setError('');
    setDisableCode('');
    setShowSecret(false);
  }

  // QR code image URL - use Google Charts API or the backend-provided qr_url
  const qrImageUrl = qrUrl
    ? qrUrl.startsWith('http')
      ? qrUrl
      : `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(qrUrl)}`
    : '';

  return (
    <div>
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
          <X size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {step === 'idle' && !isEnabled && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
              <ShieldOff size={20} className="text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Two-factor authentication is off
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add an extra layer of security to your account.
              </p>
            </div>
          </div>
          <button
            onClick={handleEnable}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Enable 2FA'}
          </button>
        </div>
      )}

      {step === 'idle' && isEnabled && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                <Shield size={20} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Two-factor authentication is on
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your account is protected with an authenticator app.
                </p>
              </div>
            </div>
            <button
              onClick={() => setStep('disable')}
              className="px-4 py-2 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium transition-colors"
            >
              Disable 2FA
            </button>
          </div>
        </div>
      )}

      {step === 'disable' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <ShieldOff size={20} className="text-red-500" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Disable two-factor authentication
            </p>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enter your current 2FA code to disable two-factor authentication.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={disableCode}
              onChange={(e) => handleDisableCodeChange(e.target.value)}
              placeholder="000000"
              className="w-40 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              maxLength={6}
              autoFocus
            />
            <button
              onClick={handleDisable}
              disabled={loading || disableCode.length !== 6}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Disabling...' : 'Disable'}
            </button>
            <button
              onClick={reset}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'setup' && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
              Step 1: Scan QR code
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Open your authenticator app (Google Authenticator, Authy, etc.) and scan this QR code.
            </p>
            <div className="flex justify-center mb-4">
              {qrImageUrl ? (
                <img
                  src={qrImageUrl}
                  alt="2FA QR Code"
                  className="w-48 h-48 rounded-xl border border-slate-200 dark:border-slate-600 bg-white p-2"
                />
              ) : (
                <div className="w-48 h-48 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 animate-pulse" />
              )}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              Or enter this secret key manually:
            </p>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 rounded-xl px-4 py-2.5">
              <code className="flex-1 text-sm font-mono text-slate-800 dark:text-slate-200 break-all">
                {showSecret ? secret : '••••••••••••••••'}
              </code>
              <button
                onClick={() => setShowSecret((v) => !v)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                title={showSecret ? 'Hide secret' : 'Show secret'}
              >
                {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(secret)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                title="Copy secret"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
              Step 2: Enter verification code
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Enter the 6-digit code from your authenticator app to verify setup.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="000000"
                className="w-40 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-center font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                maxLength={6}
                autoFocus
              />
              <button
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
              <button
                onClick={reset}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800 text-green-700 dark:text-green-400 rounded-xl text-sm">
            <Check size={16} />
            Two-factor authentication has been enabled successfully.
          </div>

          {backupCodes.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
                Backup codes
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Save these backup codes in a safe place. Each code can only be used once if you lose access to your authenticator app.
              </p>
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 mb-3">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((bc, i) => (
                    <code
                      key={i}
                      className="text-sm font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-600 px-3 py-1.5 rounded-lg text-center"
                    >
                      {bc}
                    </code>
                  ))}
                </div>
              </div>
              <button
                onClick={copyBackupCodes}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                {copiedBackup ? <Check size={16} /> : <Copy size={16} />}
                {copiedBackup ? 'Copied!' : 'Copy backup codes'}
              </button>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
