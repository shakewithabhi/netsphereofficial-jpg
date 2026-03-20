import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Share2,
  Monitor,
  Play,
  CloudUpload,
  Zap,
  HardDrive,
  Check,
} from 'lucide-react';
import { HeaderAd } from '../components/AdBanner';

const features = [
  {
    icon: ShieldCheck,
    title: 'Secure Storage',
    description:
      'Your files are encrypted and stored securely. Only you control who gets access.',
  },
  {
    icon: Share2,
    title: 'File Sharing',
    description:
      'Share files and folders with anyone using secure links. Set passwords and expiry dates.',
  },
  {
    icon: Monitor,
    title: 'Cross-Platform',
    description:
      'Access your files from any device — web, Android, or desktop. Always in sync.',
  },
  {
    icon: Play,
    title: 'Video Streaming',
    description:
      'Stream your videos directly from the cloud without downloading. Adaptive quality playback.',
  },
  {
    icon: CloudUpload,
    title: 'Auto Backup',
    description:
      'Automatically back up your important files. Never worry about losing data again.',
  },
  {
    icon: Zap,
    title: 'No Speed Limits',
    description:
      'Upload and download at full speed with no throttling. Your bandwidth, fully utilized.',
  },
];

const plans = [
  {
    name: 'Free',
    storage: '5 GB',
    price: '0',
    features: [
      '5 GB secure storage',
      'File sharing with links',
      'Video streaming',
      'Cross-platform access',
      'Community support',
    ],
    cta: 'Get Started Free',
    href: '/register',
    highlighted: false,
  },
  {
    name: 'Pro',
    storage: '1 TB',
    price: '99',
    features: [
      '1 TB secure storage',
      'Priority file sharing',
      'HD video streaming',
      'Auto backup',
      'No speed limits',
      'Email support',
    ],
    cta: 'Upgrade to Pro',
    href: '/register',
    highlighted: true,
  },
  {
    name: 'Premium',
    storage: '2 TB',
    price: '199',
    features: [
      '2 TB secure storage',
      'Advanced sharing controls',
      '4K video streaming',
      'Auto backup with versioning',
      'No speed limits',
      'Priority support',
      'Early access to features',
    ],
    cta: 'Go Premium',
    href: '/register',
    highlighted: false,
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 dark:border-white/[0.05] bg-white/80 dark:bg-[#0B0F19]/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-blue-600 dark:text-blue-400">
            <HardDrive className="h-6 w-6" />
            ByteBox
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-[#0a0e1a] dark:via-[#0f1629] dark:to-[#0a0e1a]" />
        <div className="relative mx-auto max-w-4xl px-6 py-28 text-center sm:py-36">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl leading-tight">
            Your files, everywhere.{' '}
            <span className="text-blue-600 dark:text-blue-400">
              Secure cloud storage
            </span>{' '}
            for everyone.
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Store, share, and stream your files from any device. Fast uploads,
            encrypted storage, and seamless access — all in one place.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <Link
              to="/register"
              className="rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-slate-300 dark:border-white/[0.05] px-6 py-3 text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#111118] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold sm:text-4xl">
            Everything you need in cloud storage
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            ByteBox is built for speed, security, and simplicity. Here is what
            makes it different.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-slate-200 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0F172A] p-6 transition-all hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg"
            >
              <div className="mb-4 inline-flex rounded-lg bg-blue-100 dark:bg-blue-900/40 p-3 text-blue-600 dark:text-blue-400">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Ad Banner */}
      <div className="mx-auto max-w-7xl px-6">
        <HeaderAd />
      </div>

      {/* Pricing */}
      <section className="bg-slate-50 dark:bg-[#0F172A]/50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Start free and upgrade as you grow. No hidden fees, no surprises.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-8 flex flex-col ${
                  plan.highlighted
                    ? 'border-blue-500 dark:border-blue-400 bg-white dark:bg-[#0F172A] shadow-xl shadow-blue-600/10 ring-1 ring-blue-500 dark:ring-blue-400'
                    : 'border-slate-200 dark:border-white/[0.05] bg-white dark:bg-[#0F172A]'
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {plan.storage} storage
                  </p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold">
                    {plan.price === '0' ? 'Free' : `₹${plan.price}`}
                  </span>
                  {plan.price !== '0' && (
                    <span className="text-slate-500 dark:text-slate-400 text-sm">
                      /month
                    </span>
                  )}
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
                    >
                      <Check className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.href}
                  className={`block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${
                    plan.highlighted
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border border-slate-300 dark:border-white/[0.05] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#111118]'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-white/[0.05] bg-white dark:bg-[#0B0F19]">
        <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            ByteBox
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <Link
              to="/privacy"
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              Terms of Service
            </Link>
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            &copy; {new Date().getFullYear()} ByteBox. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
