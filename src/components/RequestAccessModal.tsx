import React, { useState, useEffect } from 'react';
import { X, Lock, ShieldCheck, Mail, CheckCircle2, AlertCircle, FileText, ExternalLink } from 'lucide-react';
import { Button } from './ui/Button';
import { useAuth } from '../contexts/AuthContext';

export interface RequestAccessTarget {
  documentName: string;
  productName?: string;
  productSlug?: string;
  documentType?: string;
  recipientEmail?: string;
}

export interface RequestAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  target?: RequestAccessTarget | null;
}

export const RELEVANT_JOB_TITLES = [
  'Chief Information Security Officer (CISO)',
  'Data Protection Officer (DPO) / Privacy Officer',
  'Chief Technology Officer (CTO) / VP Engineering',
  'Chief Information Officer (CIO) / IT Director',
  'Information Security Manager / Security Lead',
  'Security Architect / Analyst',
  'Compliance Officer / Regulatory Affairs Manager',
  'General Counsel / Legal Counsel',
  'Internal Auditor / Compliance Auditor',
  'External Auditor / Third-Party Assessor',
  'Vendor Risk Manager / Third-Party Risk Assessor',
  'Procurement Director / Vendor Management Lead',
  'Chief Financial Officer (CFO) / Finance Director',
  'Managing Director / CEO / Executive',
  'Accounting & Payroll Manager / Controller',
  'IT Operations Manager / System Administrator',
  'Other (specify)'
] as const;

export const RELEVANT_PURPOSES = [
  'Annual Vendor Due Diligence & Security Review',
  'GDPR & Privacy Compliance Assessment',
  'Pre-contractual Procurement & Vendor Evaluation',
  'ISO 27001 / SOC 2 / ISAE 3402 Audit Verification',
  'Enterprise Customer Security Questionnaire',
  'Regulatory Authority & Statutory Compliance Inquiry',
  'Incident Response & Business Continuity Verification',
  'Subprocessor & Cross-Border Data Transfer Review',
  'Legal, Insurance & Contractual Risk Review',
  'Other (specify)'
] as const;

export const RELATIONSHIP_OPTIONS = [
  'Current Customer / Client',
  'Prospective Customer / Evaluation',
  'Certified Accounting Partner / Bureau',
  'System Integration / Reseller Partner',
  'External Auditor / Compliance Assessor',
  'Vendor / Technology Supplier',
  'Other'
] as const;

export function RequestAccessModal({ isOpen, onClose, target }: RequestAccessModalProps) {
  const { siteSettings, user } = useAuth();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    businessEmail: '',
    company: '',
    jobTitle: '',
    customJobTitle: '',
    relationship: '',
    purpose: '',
    customPurpose: '',
    comments: ''
  });

  const [legal, setLegal] = useState({
    agreeMnda: false,
    agreeWatermark: false,
    agreeAuthorized: false,
    ndaAcceptedAt: null as string | null
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Compute reference NDA link
  const ndaLink = siteSettings?.nda_url?.trim() 
    ? siteSettings.nda_url.trim() 
    : (typeof window !== 'undefined' ? `${window.location.origin}/nda` : '/nda');

  // Initialize or reset form when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        businessEmail: prev.businessEmail || (user?.username?.includes('@') ? user.username : '')
      }));
      setSubmitted(false);
      setValidationError(null);
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleAcceptNda = () => {
    setLegal(prev => ({
      ...prev,
      agreeMnda: true,
      ndaAcceptedAt: new Date().toLocaleString()
    }));
    setValidationError(null);
  };

  const handleToggleOptIn = (checked: boolean) => {
    setLegal(prev => ({
      ...prev,
      agreeMnda: checked,
      ndaAcceptedAt: checked ? (prev.ndaAcceptedAt || new Date().toLocaleString()) : null
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validation checks
    const finalJobTitle = formData.jobTitle === 'Other (specify)'
      ? (formData.customJobTitle.trim() ? `Other: ${formData.customJobTitle.trim()}` : '')
      : formData.jobTitle.trim();

    const finalPurpose = formData.purpose === 'Other (specify)'
      ? (formData.customPurpose.trim() ? `Other: ${formData.customPurpose.trim()}` : '')
      : formData.purpose.trim();

    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.businessEmail.trim() || !formData.company.trim()) {
      setValidationError('Please fill in all required contact details.');
      return;
    }

    if (!formData.jobTitle) {
      setValidationError('Please select your job title from the dropdown list.');
      return;
    }

    if (formData.jobTitle === 'Other (specify)' && !formData.customJobTitle.trim()) {
      setValidationError('Please specify your job title in the provided text field.');
      return;
    }

    if (!formData.relationship) {
      setValidationError('Please select your relationship to Bjorn Lunden.');
      return;
    }

    if (!formData.purpose) {
      setValidationError('Please select the purpose of your request from the dropdown list.');
      return;
    }

    if (formData.purpose === 'Other (specify)' && !formData.customPurpose.trim()) {
      setValidationError('Please specify the purpose of your request in the provided text field.');
      return;
    }

    if (!legal.agreeMnda) {
      setValidationError('You must accept the Non-Disclosure Agreement (NDA) with the required opt-in before requesting a copy.');
      return;
    }

    if (!legal.agreeWatermark || !legal.agreeAuthorized) {
      setValidationError('Please accept the watermark and authorization compliance acknowledgments to proceed.');
      return;
    }

    const documentTitle = target?.documentName || 'Restricted Documentation';
    const productTitle = target?.productName || '';
    const recipient = target?.recipientEmail || siteSettings?.mailto_legal || 'security@bjornlunden.com';

    // Track metric to public endpoint
    try {
      await fetch('/api/public/metrics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'request_document',
          product_slug: target?.productSlug || 'general',
          item_name: documentTitle,
          user_email: formData.businessEmail
        })
      });

      // Record access request in activity log and access_requests registry
      fetch('/api/public/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: documentTitle,
          documentType: target?.documentType || 'compliance',
          productSlug: target?.productSlug || null,
          firstName: formData.firstName,
          lastName: formData.lastName,
          businessEmail: formData.businessEmail,
          company: formData.company,
          jobTitle: finalJobTitle,
          relationship: formData.relationship,
          purpose: finalPurpose,
          comments: formData.comments,
          ndaAccepted: legal.agreeMnda,
          ndaAcceptedAt: legal.ndaAcceptedAt || new Date().toISOString()
        })
      }).catch((e) => console.error('Failed to log access request:', e));
    } catch (err) {
      console.error('Failed to track request metric:', err);
    }

    const acceptanceTimestamp = legal.ndaAcceptedAt || new Date().toLocaleString();

    // Build formatted email body with explicit NDA accepted and applicable text and link
    const subject = `Request Access to Documentation - ${documentTitle}${productTitle ? ` (${productTitle})` : ''}`;
    const body = `Hello Bjorn Lunden Security & Compliance Team,

I am requesting a copy of the following documentation/policy:

Document: ${documentTitle}
${productTitle ? `Product: ${productTitle}\n` : ''}
--- CONTACT DETAILS ---
First name: ${formData.firstName.trim()}
Last name: ${formData.lastName.trim()}
Business email: ${formData.businessEmail.trim()}
Company: ${formData.company.trim()}
Job title: ${finalJobTitle}

--- REQUEST DETAILS ---
Relationship to Bjorn Lunden: ${formData.relationship}
Purpose of request:
${finalPurpose}
${formData.comments.trim() ? `\nComments:\n${formData.comments.trim()}\n` : ''}
--- NON-DISCLOSURE AGREEMENT (NDA) STATUS ---
NDA Status: ACCEPTED AND APPLICABLE
Applicable NDA Document: ${ndaLink}
Accepted by: ${formData.firstName.trim()} ${formData.lastName.trim()} (${formData.businessEmail.trim()})
Company / Organization: ${formData.company.trim()}
Accepted on: ${acceptanceTimestamp}
Opt-in Confirmation: Requester explicitly confirmed the required opt-in and accepted the Non-Disclosure Agreement (NDA) prior to requesting this document/policy.
Applicability Notice: The requester understands that all disclosed documents, audit reports, and policies are strictly confidential under the terms of the accepted NDA.

--- LEGAL & COMPLIANCE ACKNOWLEDGMENTS ---
[X] Non-Disclosure Agreement (NDA): Accepted and applicable
[X] Watermark Notice: Requester acknowledges all documents will be watermarked with personal and company details and may only be used solely for the stated purpose.
[X] Authorization Confirmation: Requester confirms authority to receive confidential information on behalf of their organization.

Submitted via Bjorn Lunden Trust Center on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;

    setSubmitted(true);

    // Launch email client
    setTimeout(() => {
      window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }, 400);

    // Close after short delay for feedback
    setTimeout(() => {
      onClose();
      setSubmitted(false);
    }, 2400);
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-access-title"
      >
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
          
          {/* Modal Header */}
          <div className="flex items-start justify-between p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70 shrink-0">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-100/70 text-blue-700 rounded-xl mt-0.5 shadow-sm">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 id="request-access-title" className="text-lg sm:text-xl font-bold text-slate-900">
                  Request access to documentation
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Complete the questionnaire below. An accepted NDA with required opt-in is required before request submission.
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
            
            {/* Target Document Banner */}
            {target?.documentName && (
              <div className="p-3.5 bg-blue-50/80 border border-blue-100 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm text-blue-900">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-blue-950">{target.documentName}</span>
                    {target.productName && (
                      <span className="text-blue-700 ml-1.5 text-xs font-normal">
                        ({target.productName})
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-blue-200/60 text-blue-800 rounded-md">
                  NDA Required
                </span>
              </div>
            )}

            {validationError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs sm:text-sm text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>{validationError}</div>
              </div>
            )}

            {submitted ? (
              <div className="py-10 text-center space-y-3">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Request Prepared!</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Your NDA acceptance and request details have been confirmed. Launching your email client now to send to the security and compliance team...
                </p>
              </div>
            ) : (
              <form id="restricted-access-form" onSubmit={handleSubmit} className="space-y-6">
                
                {/* SECTION 1: Contact details */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    Contact details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="req-first-name" className="block text-xs font-semibold text-slate-700 mb-1">
                        First name <span className="text-red-500">*</span>
                      </label>
                      <input 
                        id="req-first-name"
                        type="text" 
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Jane"
                      />
                    </div>
                    <div>
                      <label htmlFor="req-last-name" className="block text-xs font-semibold text-slate-700 mb-1">
                        Last name <span className="text-red-500">*</span>
                      </label>
                      <input 
                        id="req-last-name"
                        type="text" 
                        required
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Doe"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="req-business-email" className="block text-xs font-semibold text-slate-700 mb-1">
                        Business email <span className="text-red-500">*</span>
                      </label>
                      <input 
                        id="req-business-email"
                        type="email" 
                        required
                        value={formData.businessEmail}
                        onChange={(e) => setFormData({ ...formData, businessEmail: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="jane.doe@company.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="req-company" className="block text-xs font-semibold text-slate-700 mb-1">
                        Company <span className="text-red-500">*</span>
                      </label>
                      <input 
                        id="req-company"
                        type="text" 
                        required
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Acme Corporation"
                      />
                    </div>
                    <div>
                      <label htmlFor="req-job-title" className="block text-xs font-semibold text-slate-700 mb-1">
                        Job title <span className="text-red-500">*</span>
                      </label>
                      <select 
                        id="req-job-title"
                        required
                        value={formData.jobTitle}
                        onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="" disabled>Select your relevant job title...</option>
                        {RELEVANT_JOB_TITLES.map((title) => (
                          <option key={title} value={title}>{title}</option>
                        ))}
                      </select>
                      {formData.jobTitle === 'Other (specify)' && (
                        <div className="mt-2 animate-in fade-in duration-200">
                          <input 
                            type="text" 
                            required
                            value={formData.customJobTitle}
                            onChange={(e) => setFormData({ ...formData, customJobTitle: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-blue-300 bg-blue-50/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Please specify your job title..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* SECTION 2: Request details */}
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    Request details
                  </h3>
                  <div className="space-y-3.5">
                    <div>
                      <label htmlFor="req-relationship" className="block text-xs font-semibold text-slate-700 mb-1">
                        Relationship to Bjorn Lunden <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="req-relationship"
                        required
                        value={formData.relationship}
                        onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="" disabled>Select relationship to Bjorn Lunden...</option>
                        {RELATIONSHIP_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="req-purpose" className="block text-xs font-semibold text-slate-700 mb-1">
                        Purpose of request <span className="text-red-500">*</span>
                      </label>
                      <select 
                        id="req-purpose"
                        required
                        value={formData.purpose}
                        onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="" disabled>Select purpose of request...</option>
                        {RELEVANT_PURPOSES.map((purpose) => (
                          <option key={purpose} value={purpose}>{purpose}</option>
                        ))}
                      </select>
                      {formData.purpose === 'Other (specify)' && (
                        <div className="mt-2 animate-in fade-in duration-200">
                          <textarea 
                            required
                            rows={2}
                            value={formData.customPurpose}
                            onChange={(e) => setFormData({ ...formData, customPurpose: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-blue-300 bg-blue-50/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                            placeholder="Please specify the business or compliance purpose for requesting this documentation..."
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="req-comments" className="block text-xs font-semibold text-slate-700 mb-1">
                        Comments
                      </label>
                      <textarea 
                        id="req-comments"
                        rows={2}
                        value={formData.comments}
                        onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                        placeholder="Optional additional notes or requirements..."
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 3: Legal & NDA Acceptance */}
                <div className="border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-slate-600" />
                      Legal & NDA Acceptance
                    </h3>
                    <span className="text-[11px] text-red-500 font-medium">Opt-in & acceptance required</span>
                  </div>

                  <div className="space-y-3.5 bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200/90">
                    
                    {/* Interactive NDA Acceptance Card */}
                    <div className="p-4 rounded-xl border bg-white shadow-sm space-y-3 border-blue-200/80">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                            <Lock className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-sm">
                              Non-Disclosure Agreement (NDA)
                            </span>
                            <span className="ml-2 text-[10px] font-semibold uppercase px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                              Required
                            </span>
                          </div>
                        </div>

                        {/* Link that visitors can read */}
                        <div className="flex items-center gap-2 text-xs">
                          <a
                            href={ndaLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1.5 bg-blue-50/80 px-2.5 py-1 rounded-md border border-blue-200 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Full NDA Page <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        Access to copies of documents and policies requires acceptance of our Non-Disclosure Agreement. Click the button below to accept the NDA with the mandatory opt-in.
                      </p>

                      {/* Required Opt-in Checkbox */}
                      <label htmlFor="req-legal-mnda" className="flex items-start gap-3 cursor-pointer select-none pt-1">
                        <input 
                          id="req-legal-mnda"
                          type="checkbox" 
                          required
                          checked={legal.agreeMnda}
                          onChange={(e) => handleToggleOptIn(e.target.checked)}
                          className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 shrink-0"
                        />
                        <span className="text-xs sm:text-sm text-slate-700 leading-snug">
                          I have read, understand, and opt-in to accept the{' '}
                          <a 
                            href={ndaLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="font-semibold text-blue-700 underline hover:text-blue-900 inline-flex items-center gap-0.5"
                          >
                            Non-Disclosure Agreement (NDA) <ExternalLink className="w-3 h-3" />
                          </a>{' '}
                          <span className="text-red-500 font-semibold">*</span>
                        </span>
                      </label>

                      {/* Button to Accept NDA */}
                      <div className="pt-2">
                        {legal.agreeMnda ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-3 text-emerald-900">
                            <div className="flex items-center gap-2 min-w-0">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                              <div className="truncate">
                                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                                  NDA Accepted & Applicable
                                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                    Confirmed
                                  </span>
                                </div>
                                <div className="text-[11px] text-emerald-700 truncate">
                                  {legal.ndaAcceptedAt ? `Accepted on ${legal.ndaAcceptedAt}` : 'Opt-in confirmed and applicable to this request.'}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setLegal(prev => ({ ...prev, agreeMnda: false, ndaAcceptedAt: null }))}
                              className="text-[11px] text-slate-500 hover:text-red-600 underline shrink-0"
                            >
                              Reset
                            </button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            onClick={handleAcceptNda}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 text-xs py-2 shadow-sm font-semibold"
                          >
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            Click to Accept NDA
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Watermark Notice Checkbox */}
                    <label htmlFor="req-legal-watermark" className="flex items-start gap-3 cursor-pointer select-none px-1">
                      <input 
                        id="req-legal-watermark"
                        type="checkbox" 
                        required
                        checked={legal.agreeWatermark}
                        onChange={(e) => setLegal({ ...legal, agreeWatermark: e.target.checked })}
                        className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 shrink-0"
                      />
                      <span className="text-xs sm:text-sm text-slate-700 leading-snug">
                        I understand that all documents and policies will be watermarked with my personal and company details and may only be used for the stated purpose. <span className="text-red-500 font-semibold">*</span>
                      </span>
                    </label>

                    {/* Authority Checkbox */}
                    <label htmlFor="req-legal-authorized" className="flex items-start gap-3 cursor-pointer select-none px-1">
                      <input 
                        id="req-legal-authorized"
                        type="checkbox" 
                        required
                        checked={legal.agreeAuthorized}
                        onChange={(e) => setLegal({ ...legal, agreeAuthorized: e.target.checked })}
                        className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 shrink-0"
                      />
                      <span className="text-xs sm:text-sm text-slate-700 leading-snug">
                        I confirm that I am authorized to receive confidential information on behalf of my organization. <span className="text-red-500 font-semibold">*</span>
                      </span>
                    </label>
                  </div>
                </div>
              </form>
            )}

          </div>

          {/* Modal Footer */}
          {!submitted && (
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-3 shrink-0">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onClose}
                className="text-slate-600"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                form="restricted-access-form"
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-sm font-semibold"
              >
                <Mail className="w-4 h-4" />
                Submit Request
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
