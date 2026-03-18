import { Link } from 'react-router-dom';
import { HardDrive, ArrowLeft } from 'lucide-react';

export default function Terms() {
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Terms of Service</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Last updated: March 18, 2026
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-8 space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Acceptance of Terms
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              By accessing or using ByteBox ("the Service"), you agree to be bound by these Terms of Service. If you do
              not agree to these terms, you may not use the Service. We reserve the right to update these terms at any
              time, and continued use of the Service after changes constitutes acceptance of the revised terms. We will
              notify registered users of material changes via email or in-app notification.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Account Registration
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              To use ByteBox, you must create an account with a valid email address and a secure password. You are
              responsible for maintaining the confidentiality of your credentials and for all activities that occur under
              your account. You must be at least 13 years old to create an account. You agree to provide accurate and
              complete registration information and to update it as needed. You must notify us immediately of any
              unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Acceptable Use
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              You agree not to use ByteBox to:
            </p>
            <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1.5 ml-2">
              <li>Upload, store, or share content that is illegal, harmful, or violates the rights of others</li>
              <li>Distribute malware, viruses, or other malicious code</li>
              <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
              <li>Use the Service for bulk storage of data you do not own or have rights to</li>
              <li>Resell or redistribute the Service without written permission</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Circumvent any storage limits, rate limits, or other technical restrictions</li>
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-3">
              We reserve the right to remove content and suspend accounts that violate these guidelines.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Storage and File Limits
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Free accounts are provided with a limited amount of storage space. Premium plans offer additional storage
              and features. We reserve the right to modify storage limits with reasonable notice. Files moved to trash
              are automatically and permanently deleted after 30 days. You are responsible for maintaining backups of
              important data. While we strive for high availability and data durability, we do not guarantee against data
              loss and recommend keeping copies of critical files.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Intellectual Property
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              You retain all ownership rights to the files and content you upload to ByteBox. By uploading content, you
              grant us a limited license to store, process, and serve your files solely for the purpose of providing the
              Service. The ByteBox name, logo, and all related branding are the property of ByteBox and may not be used
              without written permission. The Service's software, design, and documentation are protected by intellectual
              property laws.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Termination
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              You may delete your account at any time through the Settings page. We may suspend or terminate your
              account if you violate these terms, engage in abusive behavior, or if required by law. Upon termination,
              your files will be scheduled for deletion within 30 days. We may retain certain data as required by law or
              for legitimate business purposes. We will make reasonable efforts to notify you before terminating your
              account, except in cases of serious violations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Limitation of Liability
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              ByteBox is provided "as is" without warranties of any kind, express or implied. To the fullest extent
              permitted by law, ByteBox and its operators shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages, including but not limited to loss of data, loss of profits, or
              business interruption. Our total liability for any claims arising from or related to the Service shall not
              exceed the amount you paid us in the twelve months preceding the claim. This limitation applies regardless
              of the theory of liability.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Contact Information
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              If you have questions about these Terms of Service, please contact us at:
            </p>
            <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
              <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">ByteBox Legal Team</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Email: legal@byteboxapp.com</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Website: byteboxapp.com</p>
            </div>
          </section>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/privacy"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            View Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
