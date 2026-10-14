import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Printer, ArrowLeft, Calendar, CheckCircle2, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function PrivacyNotice() {
  const { siteSettings } = useAuth();

  const handlePrint = () => {
    window.print();
  };

  const defaultContent = `
    <h2>Privacy Notice</h2>
    <p>This Privacy Notice explains how <strong>Bjorn Lunden AB</strong> and its group affiliates ("Bjorn Lunden", "we", "us", or "our") collect, process, retain, and protect personal data collected through our Trust Center, platform services, and compliance interactions.</p>
    
    <h3>1. Data Controller</h3>
    <p>Bjorn Lunden AB is the data controller for the processing of personal data described in this notice, unless explicitly agreed otherwise in a separate Data Protection Agreement (DPA).</p>
    <p>Contact: <a href="mailto:privacy@bjornlunden.com">privacy@bjornlunden.com</a></p>
    
    <h3>2. Information We Collect</h3>
    <p>When you interact with our Trust Center, we may collect the following categories of personal information:</p>
    <ul>
      <li><strong>Contact Information:</strong> Full name, corporate email address, organization name, job title, and phone number when requesting access to restricted documentation or submitting inquiries.</li>
      <li><strong>Security & Access Logs:</strong> Timestamp, IP address, user agent, requested document IDs, and watermark tracking metadata to ensure document confidentiality.</li>
      <li><strong>Communication Records:</strong> Records of correspondence, non-disclosure agreements accepted, and compliance status updates.</li>
    </ul>

    <h3>3. Purpose and Legal Basis for Processing</h3>
    <p>We process your personal information under the following legal bases pursuant to Article 6 of the General Data Protection Regulation (GDPR):</p>
    <ul>
      <li><strong>Contractual Necessity:</strong> Processing required to fulfill access requests, execute non-disclosure agreements, and provide security reports.</li>
      <li><strong>Legitimate Interest:</strong> Protecting our intellectual property, verifying authorization of document recipients, preventing unauthorized disclosure, and maintaining system integrity.</li>
      <li><strong>Legal Obligation:</strong> Complying with regulatory requirements, audit procedures, and legal disclosure requests.</li>
    </ul>

    <h3>4. Document Watermarking & Confidentiality</h3>
    <p>To preserve the confidentiality of proprietary security assessments, SOC 2 reports, and architectural reviews, downloaded documents are dynamically watermarked with your name, company, and email address.</p>

    <h3>5. Data Sharing and International Transfers</h3>
    <p>We do not sell, rent, or trade your personal data. We only share personal data with trusted sub-processors necessary to operate this Trust Center (such as cloud infrastructure and email delivery providers), all of which are bound by strict data processing agreements ensuring compliance with GDPR standards.</p>

    <h3>6. Retention Periods</h3>
    <p>Access request records and NDA acceptance logs are retained for audit and legal compliance purposes for the duration of the confidentiality obligations plus statutory limitation periods.</p>

    <h3>7. Your Rights under GDPR</h3>
    <p>Under the General Data Protection Regulation, you have the right to:</p>
    <ul>
      <li>Request access to your personal data.</li>
      <li>Request correction of inaccurate or incomplete personal data.</li>
      <li>Request deletion of your data when no longer necessary for legal or contractual purposes.</li>
      <li>Object to or restrict certain processing activities.</li>
      <li>Lodge a complaint with a supervisory authority (Integritetsskyddsmyndigheten - IMY in Sweden).</li>
    </ul>

    <h3>8. Contact Us</h3>
    <p>For questions or requests concerning your privacy rights, please contact our Data Protection Officer at <a href="mailto:privacy@bjornlunden.com">privacy@bjornlunden.com</a>.</p>
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
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                  Active Notice
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
                <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                  • GDPR & Data Protection Compliant
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Privacy Notice
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                Information on how Bjorn Lunden collects, handles, stores, and protects personal data across our trust platform and security services.
              </p>
            </div>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl flex items-start gap-3 text-xs sm:text-sm text-blue-900 mb-8 print:hidden">
          <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-semibold text-blue-950">Commitment to Data Privacy:</strong> We maintain strict technical and organizational safeguards in accordance with the EU General Data Protection Regulation (GDPR) to ensure all personal and corporate information remains protected.
          </div>
        </div>

        {/* Legal Text Body */}
        <article 
          className="prose prose-slate max-w-none text-slate-800 prose-headings:font-bold prose-headings:text-slate-900 prose-p:leading-relaxed prose-li:text-slate-700"
          dangerouslySetInnerHTML={{ __html: siteSettings.privacy_notice || defaultContent }}
        />

        {/* Document Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>Bjorn Lunden Trust Center Official Privacy Policy</span>
          </div>
          <div>
            Questions? Contact <a href={`mailto:${siteSettings.mailto_legal || 'privacy@bjornlunden.com'}`} className="text-blue-600 font-medium hover:underline">{siteSettings.mailto_legal || 'privacy@bjornlunden.com'}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
