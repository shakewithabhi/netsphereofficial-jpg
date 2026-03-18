import { Link } from 'react-router-dom';
import { HardDrive, ArrowLeft } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-6"
          >
            <ArrowLeft size={16} />
            Back to ByteBox
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <HardDrive size={20} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Privacy Policy</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Last updated: March 18, 2026
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-8 space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Information We Collect
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              When you use ByteBox, we collect information that you provide directly, including:
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1.5 ml-2">
              <li>Account information (name, email address, password)</li>
              <li>Files and content you upload to our service</li>
              <li>Usage data such as login times, features used, and storage consumption</li>
              <li>Device information including browser type, operating system, and IP address</li>
              <li>Communication data when you contact our support team</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              How We Use Your Information
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1.5 ml-2">
              <li>Provide, maintain, and improve our cloud storage services</li>
              <li>Process and manage your account and file storage</li>
              <li>Send you service-related notifications and updates</li>
              <li>Detect, prevent, and address security issues and abuse</li>
              <li>Analyze usage patterns to improve our platform</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Data Storage and Security
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Your files are stored securely using industry-standard encryption both in transit (TLS/SSL) and at rest
              (AES-256). We implement appropriate technical and organizational measures to protect your personal data
              against unauthorized access, alteration, disclosure, or destruction. Access to your files is restricted to
              authorized personnel only, and all access is logged and monitored. We regularly review and update our
              security practices to ensure your data remains protected.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Cookies and Tracking
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              ByteBox uses essential cookies to maintain your session and remember your preferences (such as theme
              settings). We may also use analytics cookies to understand how our service is used. You can control cookie
              settings through your browser preferences. Disabling essential cookies may affect your ability to use
              certain features of our service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Third-Party Services
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              We may use third-party services that collect, monitor, and analyze data to improve our service. These may include:
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1.5 ml-2">
              <li>Analytics providers to help us understand usage patterns</li>
              <li>Advertising partners for free-tier users to support the service</li>
              <li>Cloud infrastructure providers for file storage and processing</li>
              <li>Payment processors for premium subscriptions</li>
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-3">
              These third parties have their own privacy policies governing their use of your information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Your Rights (GDPR/CCPA)
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              Depending on your location, you may have the following rights regarding your personal data:
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1.5 ml-2">
              <li><strong>Right to Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Right to Rectification:</strong> Request correction of inaccurate personal data</li>
              <li><strong>Right to Erasure:</strong> Request deletion of your personal data</li>
              <li><strong>Right to Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong>Right to Object:</strong> Object to processing of your personal data</li>
              <li><strong>Right to Restrict Processing:</strong> Request restriction of processing your data</li>
              <li><strong>Right to Opt-Out:</strong> Opt out of the sale of your personal information (CCPA)</li>
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-3">
              To exercise any of these rights, please contact us using the information provided below.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Data Retention
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              We retain your account data for as long as your account is active. Files moved to trash are automatically
              deleted after 30 days. When you delete your account, we will remove your personal data and files within 30
              days, except where retention is required by law. Backup copies may persist for up to 90 days after
              deletion. Anonymous, aggregated data may be retained indefinitely for analytics purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Contact Information
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us at:
            </p>
            <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
              <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">ByteBox Privacy Team</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Email: privacy@byteboxapp.com</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Website: byteboxapp.com</p>
            </div>
          </section>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/terms"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            View Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
