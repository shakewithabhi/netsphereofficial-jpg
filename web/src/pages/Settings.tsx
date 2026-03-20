import { useState, useEffect, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { User, Check, X, HardDrive, FileText, Shield, Camera, Lock, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { formatBytes } from '../api/files';
import client from '../api/client';
import { uploadAvatar, changePassword } from '../api/auth';
import { Layout, Breadcrumb } from '../components/Layout';
import { RewardedAdButton } from '../components/RewardedAd';
import { TwoFactorSetup } from '../components/TwoFactorSetup';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Avatar state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    setDisplayName(user?.display_name ?? '');
    setEmail(user?.email ?? '');
    // Load avatar: prefer user profile, fallback to localStorage
    const storedAvatar = localStorage.getItem('bytebox_avatar');
    setAvatarUrl(user?.avatar_url ?? storedAvatar ?? null);
  }, [user]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      await client.put('/auth/profile', {
        display_name: displayName,
        email,
      });
      await refreshUser();
      setSuccess('Profile updated successfully.');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to update profile.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB.');
      return;
    }

    setAvatarUploading(true);
    setError('');
    setSuccess('');

    try {
      // Try uploading via API
      const result = await uploadAvatar(file);
      setAvatarUrl(result.avatar_url);
      await refreshUser();
      setSuccess('Profile photo updated.');
    } catch {
      // Fallback: store as base64 in localStorage
      try {
        const base64 = await fileToBase64(file);
        localStorage.setItem('bytebox_avatar', base64);
        setAvatarUrl(base64);
        setSuccess('Profile photo updated locally.');
      } catch {
        setError('Failed to update profile photo.');
      }
    } finally {
      setAvatarUploading(false);
      // Reset file input so re-selecting the same file triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    // Validation
    if (!currentPassword) {
      setPasswordError('Current password is required.');
      setPasswordSaving(false);
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      setPasswordSaving(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      setPasswordSaving(false);
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password.');
      setPasswordSaving(false);
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to change password.';
      setPasswordError(msg);
    } finally {
      setPasswordSaving(false);
    }
  }

  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  useEffect(() => {
    // Check 2FA status from user profile or a dedicated endpoint
    async function check2FAStatus() {
      try {
        const res = await client.get('/auth/2fa/status');
        setTwoFAEnabled(res.data.data?.enabled ?? false);
      } catch {
        // If endpoint doesn't exist yet, default to false
      }
    }
    check2FAStatus();
  }, []);

  const storageUsed = user?.storage_used ?? 0;
  const storageLimit = user?.storage_limit ?? 1073741824;
  const storagePercent = Math.min(100, Math.round((storageUsed / storageLimit) * 100));

  const inputClass =
    'w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200';

  return (
    <Layout>
      <div className="p-6 max-w-2xl dark:bg-slate-900 min-h-full">
        <div className="mb-6">
          <Breadcrumb crumbs={[{ label: 'Settings' }]} />
        </div>

        <div className="space-y-6">
          {/* Profile section */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <User size={16} className="text-slate-500 dark:text-slate-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Profile</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                {/* Clickable avatar with camera overlay */}
                <div className="relative shrink-0">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="group relative w-16 h-16 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
                    title="Change profile photo"
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                        {user?.display_name?.[0]?.toUpperCase() ?? 'U'}
                      </div>
                    )}
                    {/* Camera overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Camera
                        size={20}
                        className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                    {/* Loading spinner */}
                    {avatarUploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </button>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{user?.display_name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Member since{' '}
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                        })
                      : '---'}
                  </p>
                </div>
              </div>

              {success && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800 text-green-700 dark:text-green-400 rounded-xl text-sm">
                  <Check size={16} />
                  {success}
                </div>
              )}

              {error && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
                  <X size={16} />
                  {error}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Change Password section */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <Lock size={16} className="text-slate-500 dark:text-slate-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Change Password</h2>
            </div>
            <div className="p-6">
              {passwordSuccess && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-800 text-green-700 dark:text-green-400 rounded-xl text-sm">
                  <Check size={16} />
                  {passwordSuccess}
                </div>
              )}

              {passwordError && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
                  <X size={16} />
                  {passwordError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Current password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={inputClass + ' pr-10'}
                      placeholder="Enter current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputClass + ' pr-10'}
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass + ' pr-10'}
                      placeholder="Re-enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {passwordSaving ? 'Changing...' : 'Change password'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Storage section */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <HardDrive size={16} className="text-slate-500 dark:text-slate-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Storage</h2>
            </div>
            <div className="p-6">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                    {formatBytes(storageUsed)}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    of {formatBytes(storageLimit)} used
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    storagePercent > 90 ? 'text-red-600' : 'text-blue-600'
                  }`}
                >
                  {storagePercent}%
                </span>
              </div>

              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${
                    storagePercent > 90 ? 'bg-red-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${storagePercent}%` }}
                />
              </div>

              {storagePercent > 80 && (
                <p className="mt-3 text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 rounded-lg">
                  You're running low on storage. Consider deleting files to free up space.
                </p>
              )}

              {/* Rewarded ad for free-tier users */}
              {(!user?.plan || user.plan === 'free') && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    Need more space? Watch a short ad to earn extra storage.
                  </p>
                  <RewardedAdButton />
                </div>
              )}
            </div>
          </div>

          {/* Two-Factor Authentication section */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <Shield size={16} className="text-slate-500 dark:text-slate-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Two-Factor Authentication</h2>
            </div>
            <div className="p-6">
              <TwoFactorSetup
                isEnabled={twoFAEnabled}
                onStatusChange={async () => {
                  try {
                    const res = await client.get('/auth/2fa/status');
                    setTwoFAEnabled(res.data.data?.enabled ?? false);
                  } catch {
                    setTwoFAEnabled((v) => !v);
                  }
                }}
              />
            </div>
          </div>

          {/* Legal section */}
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <FileText size={16} className="text-slate-500 dark:text-slate-400" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Legal</h2>
            </div>
            <div className="p-6 space-y-3">
              <Link
                to="/privacy"
                className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors group"
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Privacy Policy</span>
                <span className="text-xs text-slate-400 group-hover:text-blue-600 transition-colors">View</span>
              </Link>
              <Link
                to="/terms"
                className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors group"
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Terms of Service</span>
                <span className="text-xs text-slate-400 group-hover:text-blue-600 transition-colors">View</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
