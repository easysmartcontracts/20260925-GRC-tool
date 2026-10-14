import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Printer, ExternalLink, ArrowLeft, Calendar, FileText, CheckCircle2, Lock, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';

export function Nda() {
  const { siteSettings } = useAuth();
  const [showPrintHelper, setShowPrintHelper] = useState(false);

  const handlePrint = () => {
    const printUrl = '/api/public/nda-whitepaper?print=true';
    if (window.self !== window.top) {
      setShowPrintHelper(true);
    } else {
      window.open(printUrl, '_blank');
    }
  };

  const defaultContent = `
    <h2>Non-Disclosure Agreement (NDA)</h2>
    <p>This Non-Disclosure Agreement ("Agreement") governs the disclosure of confidential, proprietary, security, and compliance documentation by <strong>Bjorn Lunden AB</strong> and its affiliates ("Disclosing Party") to the requesting organization and its representatives ("Receiving Party").</p>
    
    <h3>1. Purpose</h3>
    <p>The Receiving Party has requested access to confidential documentation, including but not limited to third-party audit reports (such as ISAE 3402, SOC 2, ISO 27001), penetration testing summaries, data protection impact assessments (DPIAs), architectural specifications, and internal security policies via the Bjorn Lunden Trust Center ("Purpose").</p>
    
    <h3>2. Confidential Information</h3>
    <p>Confidential Information includes all non-public technical, operational, organizational, and compliance information disclosed through the Trust Center, whether in tangible, electronic, or visual form. All copies of policies, risk assessments, and audit reports are strictly Confidential Information.</p>
    
    <h3>3. Obligations of Receiving Party</h3>
    <p>The Receiving Party agrees to:</p>
    <ul>
      <li>Protect and preserve the confidentiality of the Confidential Information using at least reasonable care and no less than the care used for its own confidential information.</li>
      <li>Use Confidential Information solely for evaluating Bjorn Lunden's security, privacy, and compliance posture for the stated Purpose.</li>
      <li>Restrict access strictly to employees, contractors, and advisors who strictly require access for the Purpose and are bound by confidentiality obligations at least as restrictive as this Agreement.</li>
      <li>Not disclose, publish, reverse-engineer, distribute, or make available any Confidential Information to third parties without prior written consent from Bjorn Lunden.</li>
    </ul>
    
    <h3>4. Watermarking & Traceability</h3>
    <p>The Receiving Party acknowledges that requested documents and policies are electronically watermarked with recipient identifiers (e.g. name, email, company, and timestamp). Tampering with or altering watermarks is strictly prohibited.</p>
    
    <h3>5. Duration</h3>
    <p>Confidentiality obligations under this Agreement shall remain in effect for a period of three (3) years from the date of disclosure, or perpetually for information constituting trade secrets under applicable law.</p>
    
    <h3>6. Governing Law</h3>
    <p>This Agreement is governed by and construed in accordance with the laws of Sweden. Any disputes arising in connection with this Agreement shall be settled by the competent courts of Sweden.</p>
  `;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Navigation / Breadcrumb */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link 
          to="/" 
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Trust Center
        </Link>

        <div className="flex items-center gap-2">
          {siteSettings.nda_url && (
            <a
              href={siteSettings.nda_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              External Document <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm w-fit group"
            title="Print overview or save as a PDF"
          >
            <Printer className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Print Helper Modal */}
      {showPrintHelper && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-500" />
                Print / Save PDF
              </h3>
              <button 
                onClick={() => setShowPrintHelper(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Because this live preview runs inside a secure, sandboxed browser iframe, standard browser print menus are blocked by your browser's security policies.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-xs text-blue-800 space-y-1.5 font-medium leading-relaxed">
                <p className="font-bold flex items-center gap-1 text-blue-900">💡 What will happen next:</p>
                <p>1. We will open the official NDA in a clean, isolated browser tab.</p>
                <p>2. A styled PDF print-preview will instantly trigger automatically.</p>
                <p>3. You can choose to print hardcopy or click <strong>Save as PDF</strong>.</p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 text-xs">
              <button 
                onClick={() => setShowPrintHelper(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <a 
                href="/api/public/nda-whitepaper?print=true"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  setShowPrintHelper(false);
                  window.open('/api/public/nda-whitepaper?print=true', '_blank');
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                Open in New Tab & Print
              </a>
            </div>
          </div>
        </div>
      )}

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
                  Active Agreement
                </span>
                <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  Version {siteSettings.nda_version || '1.1.0'}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Effective: {siteSettings.nda_effective_date ? new Date(siteSettings.nda_effective_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Jan 1, 2025'}
                </span>
                <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">
                  • Applicable to Document & Policy Requests
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Non-Disclosure Agreement (NDA)
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                Official terms and confidentiality conditions required to inspect, request, and receive restricted security documentation, policies, and audit reports from Bjorn Lunden.
              </p>
            </div>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-3 text-xs sm:text-sm text-amber-900 mb-8 print:hidden">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-semibold text-amber-950">Mandatory Acceptance Notice:</strong> Prior to receiving restricted compliance reports, DPIAs, pentest summaries, or security policies, visitors must opt-in and accept this Agreement. Each request email records explicit acceptance of these terms.
          </div>
        </div>

        {/* Legal Text Body */}
        <article 
          className="prose prose-slate max-w-none text-slate-800 prose-headings:font-bold prose-headings:text-slate-900 prose-p:leading-relaxed prose-li:text-slate-700"
          dangerouslySetInnerHTML={{ __html: siteSettings.nda_notice || defaultContent }}
        />

        {/* Document Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>Bjorn Lunden Trust Center Official Legal Publication</span>
          </div>
          <div>
            Questions? Contact <a href={`mailto:${siteSettings.mailto_legal || 'security@bjornlunden.com'}`} className="text-blue-600 font-medium hover:underline">{siteSettings.mailto_legal || 'security@bjornlunden.com'}</a>
          </div>
        </div>
      </div>
    </div>
  );
}
