import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Printer, ArrowLeft, Calendar, CheckCircle2, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function CookieStatement() {
  const { siteSettings } = useAuth();

  const handlePrint = () => {
    window.print();
  };

  const defaultContent = `
    <h2>Cookie Statement</h2>
    <p>This Cookie Statement explains how <strong>Björn Lunden AB</strong> ("we", "us", or "our") uses cookies and similar storage technologies on our Trust Center platform.</p>
    
    <h3>1. What Are Cookies?</h3>
    <p>Cookies are small text files stored on your computer or mobile device when you visit a website. They allow the platform to recognize your device, remember preferences, and ensure secure communication.</p>
    
    <h3>2. How We Use Cookies</h3>
    <p>Our Trust Center is designed with privacy-first principles. We use cookies strictly to ensure platform security, maintain authenticated sessions, and save your viewing preferences.</p>

    <h3>3. Categories of Cookies Used</h3>
    
    <h4>A. Strictly Necessary & Security Cookies</h4>
    <p>These cookies are essential for the website to function securely and cannot be disabled in our systems.</p>
    <ul>
      <li><strong>Session Authentication Token:</strong> Maintains secure login state and protects authorized access to security documentation.</li>
      <li><strong>CSRF Protection Token:</strong> Prevents Cross-Site Request Forgery attacks, safeguarding request submissions.</li>
      <li><strong>Access Token:</strong> Validates user role permissions (e.g. administrator, viewer, or moderator).</li>
    </ul>

    <h4>B. Functional & Preference Cookies</h4>
    <p>These cookies allow the Trust Center to remember choices you make to provide a more tailored experience.</p>
    <ul>
      <li><strong>Country / Region Selection:</strong> Remembers your selected country filter so relevant products and local compliance data are displayed.</li>
      <li><strong>Sidebar & View Preferences:</strong> Stores display states (such as collapsed sections) to maintain continuity during your visit.</li>
    </ul>

    <h4>C. Marketing & Tracking Cookies</h4>
    <p><strong>We do not use third-party marketing, advertising, or behavioral tracking cookies on this Trust Center.</strong> No personal data is shared with social media platforms, data brokers, or advertising networks.</p>

    <h3>4. Managing Your Cookie Preferences</h3>
    <p>Because the cookies used on this Trust Center are strictly necessary for core platform security and functionality, they cannot be opted out of without degrading essential features. However, you can manage or delete cookies at any time through your browser settings:</p>
    <ul>
      <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
      <li><a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
      <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer">Apple Safari</a></li>
      <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
    </ul>

    <h3>5. Updates to this Statement</h3>
    <p>We may update this Cookie Statement periodically to reflect changes in technical standards or legal obligations. The date at the top indicates when it was last revised.</p>

    <h3>6. Contact</h3>
    <p>If you have any questions about our use of cookies, please contact us at <a href="mailto:security@bjornlunden.com">security@bjornlunden.com</a>.</p>
  `;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link 
          to="/" 
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Trust Center
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm w-fit group"
            title="Print or save as PDF"
          >
            <Printer className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-blue-50 text-blue-700 rounded-xl mt-1 shrink-0 border border-blue-100">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                  Active Statement
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
                <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                  • Strictly Essential & Privacy-First
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Cookie Statement
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                Detailed information regarding the essential security cookies and preferences utilized across the Björn Lunden Trust Center.
              </p>
            </div>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs sm:text-sm text-emerald-900 mb-8 print:hidden">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-semibold text-emerald-950">Zero Advertising Trackers:</strong> This Trust Center does not track your browsing activity across other websites and does not use third-party advertising or marketing cookies.
          </div>
        </div>

        {/* Legal Text Body */}
        <article 
          className="prose prose-slate max-w-none text-slate-800 prose-headings:font-bold prose-headings:text-slate-900 prose-p:leading-relaxed prose-li:text-slate-700"
          dangerouslySetInnerHTML={{ __html: siteSettings.cookie_notice || defaultContent }}
        />

        {/* Document Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>Björn Lunden Trust Center Official Cookie Policy</span>
          </div>
          <div>
            Questions? Contact <a href={`mailto:${siteSettings.mailto_legal || 'security@bjornlunden.com'}`} className="text-blue-600 font-medium hover:underline">{siteSettings.mailto_legal || 'security@bjornlunden.com'}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
