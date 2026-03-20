import { useState, useEffect } from 'react';
import {
  User,
  Crown,
  CreditCard,
  Ticket,
  Gift,
  Users,
  Copy,
  Check,
  Share2,
  FileText,
  HardDrive,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { getReferralStats } from '../api/auth';
import type { ReferralStats } from '../api/auth';
import { formatBytes } from '../api/files';
import { Layout, Breadcrumb } from '../components/Layout';

type Tab = 'payments' | 'coupons' | 'redeem' | 'referral';

export default function UserCenter() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('payments');
  const [redeemCode, setRedeemCode] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);

  const [avatarUrl] = useState<string | null>(() => {
    try {
      return user?.avatar_url || localStorage.getItem('bytebox_avatar');
    } catch {
      return null;
    }
  });

  const planLabel =
    user?.plan === 'premium' ? 'Premium' : user?.plan === 'pro' ? 'Pro' : 'Free';
  const planColor =
    user?.plan === 'premium'
      ? 'bg-gradient-to-r from-amber-500 to-orange-500'
      : user?.plan === 'pro'
      ? 'bg-blue-500'
      : 'bg-slate-400';

  useEffect(() => {
    if (activeTab === 'referral' && !referralStats) {
      setReferralLoading(true);
      getReferralStats()
        .then(setReferralStats)
        .catch(() => {
          // If API not available, show defaults
          setReferralStats({
            referral_code: user?.id?.slice(0, 8).toUpperCase() ?? 'BYTEBOX',
            total_referrals: 0,
            storage_earned: 0,
          });
        })
        .finally(() => setReferralLoading(false));
    }
  }, [activeTab, referralStats, user?.id]);

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'payments', label: 'Payment Records', icon: CreditCard },
    { key: 'coupons', label: 'Coupons', icon: Ticket },
    { key: 'redeem', label: 'Redeem Code', icon: Gift },
    { key: 'referral', label: 'Refer & Earn', icon: Users },
  ];

  const referralCode = referralStats?.referral_code ?? '';
  const referralLink = referralCode
    ? `${window.location.origin}/register?ref=${referralCode}`
    : '';

  return (
    <Layout>
      <div className="p-6 max-w-5xl dark:bg-[#0B0F19] min-h-full">
        <div className="mb-6">
          <Breadcrumb crumbs={[{ label: 'Personal Center' }]} />
        </div>

        {/* Header section */}
        <div className="bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/[0.05] rounded-2xl overflow-hidden mb-6">
          <div className="p-6 flex items-center gap-5">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-16 h-16 rounded-full object-cover shrink-0 shadow-md"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-md">
                {user?.display_name?.[0]?.toUpperCase() ?? 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                  {user?.display_name}
                </h1>
                <span
                  className={`px-2 py-0.5 text-xs font-bold text-white rounded-full ${planColor}`}
                >
                  {planLabel}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {user?.email}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {formatBytes(user?.storage_used ?? 0)} / {formatBytes(user?.storage_limit ?? 1073741824)} used
              </p>
            </div>
            {(!user?.plan || user.plan === 'free') && (
              <button
                onClick={() => (window.location.href = '/settings')}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-500/20 shrink-0"
              >
                <Crown size={14} className="inline mr-1.5 -mt-0.5" />
                Purchase Premium
              </button>
            )}
          </div>
        </div>

        {/* Tab layout */}
        <div className="flex gap-6">
          {/* Tab sidebar */}
          <div className="w-52 shrink-0">
            <div className="bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/[0.05] rounded-2xl overflow-hidden">
              <nav className="py-2">
                {tabs.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === key
                        ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-r-2 border-blue-500'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-w-0">
            <div className="bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/[0.05] rounded-2xl overflow-hidden">
              {/* Payment Records */}
              {activeTab === 'payments' && (
                <div>
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.05] flex items-center gap-2">
                    <CreditCard size={16} className="text-slate-500 dark:text-slate-400" />
                    <h2 className="font-semibold text-slate-800 dark:text-slate-200">
                      Payment Records
                    </h2>
                  </div>
                  <div className="p-6">
                    {/* Table header */}
                    <div className="grid grid-cols-4 gap-4 px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-white/[0.05]">
                      <span>Date</span>
                      <span>Amount</span>
                      <span>Plan</span>
                      <span>Status</span>
                    </div>
                    {/* Empty state */}
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                      <FileText size={40} className="mb-3 opacity-50" />
                      <p className="text-sm font-medium">No payment records</p>
                      <p className="text-xs mt-1">
                        Your payment history will appear here
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Coupons */}
              {activeTab === 'coupons' && (
                <div>
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.05] flex items-center gap-2">
                    <Ticket size={16} className="text-slate-500 dark:text-slate-400" />
                    <h2 className="font-semibold text-slate-800 dark:text-slate-200">
                      Coupons
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                      <Ticket size={40} className="mb-3 opacity-50" />
                      <p className="text-sm font-medium">No coupons available</p>
                      <p className="text-xs mt-1">
                        Check back later for special offers
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Redeem Code */}
              {activeTab === 'redeem' && (
                <div>
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.05] flex items-center gap-2">
                    <Gift size={16} className="text-slate-500 dark:text-slate-400" />
                    <h2 className="font-semibold text-slate-800 dark:text-slate-200">
                      Redeem Code
                    </h2>
                  </div>
                  <div className="p-6">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                      Enter a redemption code to unlock premium features, extra storage, or special rewards.
                    </p>
                    <div className="flex gap-3 max-w-md">
                      <input
                        type="text"
                        value={redeemCode}
                        onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                        placeholder="Enter your code"
                        className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-[#1E293B] text-slate-800 dark:text-slate-200 font-mono tracking-wider"
                      />
                      <button
                        onClick={() => alert('Code redeemed! (Feature coming soon)')}
                        disabled={!redeemCode.trim()}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        Redeem
                      </button>
                    </div>
                    <div className="mt-6 p-4 bg-slate-50 dark:bg-[#1E293B] rounded-xl">
                      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        How it works
                      </h3>
                      <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
                        <li>1. Get a redemption code from promotions, giveaways, or referrals</li>
                        <li>2. Enter the code above and click Redeem</li>
                        <li>3. Your reward will be applied to your account instantly</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Refer & Earn */}
              {activeTab === 'referral' && (
                <div>
                  <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.05] flex items-center gap-2">
                    <Users size={16} className="text-slate-500 dark:text-slate-400" />
                    <h2 className="font-semibold text-slate-800 dark:text-slate-200">
                      Refer & Earn
                    </h2>
                  </div>
                  <div className="p-6">
                    {referralLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <Users size={16} className="text-blue-500" />
                              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Total Referrals
                              </span>
                            </div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                              {referralStats?.total_referrals ?? 0}
                            </p>
                          </div>
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-1">
                              <HardDrive size={16} className="text-green-500" />
                              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                Storage Earned
                              </span>
                            </div>
                            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                              {formatBytes(referralStats?.storage_earned ?? 0)}
                            </p>
                          </div>
                        </div>

                        {/* Referral code */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            Your Referral Code
                          </label>
                          <div className="flex gap-2">
                            <div className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-[#1E293B] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm font-mono tracking-wider text-slate-800 dark:text-slate-200">
                              {referralCode}
                            </div>
                            <button
                              onClick={() => copyToClipboard(referralCode, 'code')}
                              className="px-4 py-2.5 bg-slate-100 dark:bg-[#1E293B] hover:bg-slate-200 dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm transition-colors"
                            >
                              {copied === 'code' ? (
                                <Check size={16} className="text-green-500" />
                              ) : (
                                <Copy size={16} className="text-slate-500" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Referral link */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            Referral Link
                          </label>
                          <div className="flex gap-2">
                            <div className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-[#1E293B] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-600 dark:text-slate-400 truncate">
                              {referralLink}
                            </div>
                            <button
                              onClick={() => copyToClipboard(referralLink, 'link')}
                              className="px-4 py-2.5 bg-slate-100 dark:bg-[#1E293B] hover:bg-slate-200 dark:hover:bg-white/[0.1] border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm transition-colors"
                            >
                              {copied === 'link' ? (
                                <Check size={16} className="text-green-500" />
                              ) : (
                                <Copy size={16} className="text-slate-500" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Share button */}
                        <button
                          onClick={() => {
                            if (navigator.share) {
                              navigator.share({
                                title: 'Join ByteBox',
                                text: 'Sign up for ByteBox using my referral link and we both get extra storage!',
                                url: referralLink,
                              });
                            } else {
                              copyToClipboard(referralLink, 'share');
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-500/20"
                        >
                          <Share2 size={16} />
                          {copied === 'share' ? 'Link copied!' : 'Share with friends'}
                        </button>

                        {/* Info */}
                        <div className="p-4 bg-slate-50 dark:bg-[#1E293B] rounded-xl">
                          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            How referrals work
                          </h3>
                          <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1.5">
                            <li>1. Share your referral code or link with friends</li>
                            <li>2. They sign up using your code</li>
                            <li>3. You both earn 500 MB of extra storage</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
