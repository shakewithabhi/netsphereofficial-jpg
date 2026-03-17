import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { User, Check, X, HardDrive } from 'lucide-react';
import { useAuth } from '../store/auth';
import { formatBytes } from '../api/files';
import client from '../api/client';
import { Layout, Breadcrumb } from '../components/Layout';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDisplayName(user?.display_name ?? '');
    setEmail(user?.email ?? '');
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

  const storageUsed = user?.storage_used ?? 0;
  const storageLimit = user?.storage_limit ?? 1073741824;
  const storagePercent = Math.min(100, Math.round((storageUsed / storageLimit) * 100));

  return (
    <Layout>
      <div className="p-6 max-w-2xl">
        <div className="mb-6">
          <Breadcrumb crumbs={[{ label: 'Settings' }]} />
        </div>

        <div className="space-y-6">
          {/* Profile section */}
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <User size={16} className="text-slate-500" />
              <h2 className="font-semibold text-slate-800">Profile</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0">
                  {user?.display_name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{user?.display_name}</p>
                  <p className="text-sm text-slate-500">{user?.email}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Member since{' '}
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString('en-US', {
                          month: 'long',
                          year: 'numeric',
                        })
                      : '—'}
                  </p>
                </div>
              </div>

              {success && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-100 text-green-700 rounded-xl text-sm">
                  <Check size={16} />
                  {success}
                </div>
              )}

              {error && (
                <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
                  <X size={16} />
                  {error}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

          {/* Storage section */}
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <HardDrive size={16} className="text-slate-500" />
              <h2 className="font-semibold text-slate-800">Storage</h2>
            </div>
            <div className="p-6">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-2xl font-bold text-slate-800">
                    {formatBytes(storageUsed)}
                  </p>
                  <p className="text-sm text-slate-500">
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

              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${
                    storagePercent > 90 ? 'bg-red-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${storagePercent}%` }}
                />
              </div>

              {storagePercent > 80 && (
                <p className="mt-3 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  You're running low on storage. Consider deleting files to free up space.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
