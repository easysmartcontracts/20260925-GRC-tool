import React, { useState } from 'react';
import { 
  X, 
  FileSignature, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  UserCheck, 
  Mail, 
  Shield, 
  Send,
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { Button } from './ui/Button';
import { useAuth } from '../contexts/AuthContext';

export interface RequestSignedCopyTarget {
  documentName: string;
  productName?: string;
  productSlug?: string;
  documentType?: string;
  recipientEmail?: string;
}

export interface RequestSignedCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  target?: RequestSignedCopyTarget | null;
}

const SIGNING_ROLES = [
  'Managing Director / CEO',
  'Chief Financial Officer (CFO)',
  'Chief Operating Officer (COO)',
  'General Counsel / Head of Legal',
  'Legal Counsel / Corporate Secretary',
  'Data Protection Officer (DPO)',
  'Chief Information Security Officer (CISO)',
  'Procurement Director / Vendor Manager',
  'Partner / Owner',
  'Other Authorized Signatory'
] as const;

const JURISDICTIONS = [
  { value: 'se', label: 'Sweden (Sverige)' },
  { value: 'nl', label: 'Netherlands (Nederland)' },
  { value: 'dk', label: 'Denmark (Danmark)' },
  { value: 'no', label: 'Norway (Norge)' },
  { value: 'fi', label: 'Finland (Suomi)' },
  { value: 'de', label: 'Germany (Deutschland)' },
  { value: 'eu', label: 'Other European Union Member State' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'other', label: 'Other International Jurisdiction' }
];

export function RequestSignedCopyModal({ isOpen, onClose, target }: RequestSignedCopyModalProps) {
  const { siteSettings, user } = useAuth();

  const [formData, setFormData] = useState({
    // Company legal entity
    companyLegalName: '',
    registrationNumber: '',
    registeredAddress: '',
    country: 'se',
    
    // Signatory
    signatoryName: '',
    signatoryEmail: '',
    signatoryRole: 'Managing Director / CEO',
    customSignatoryRole: '',
    
    // Requester (if different)
    isRequesterSignatory: true,
    requesterName: '',
    requesterEmail: '',
    requesterRole: '',

    // Preferences & Notes
    signingMethod: 'docusign' as 'docusign' | 'pdf',
    specialNotes: '',
    
    // Acknowledgment
    confirmedAuthority: false
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) return null;

  const docTitle = target?.documentName || 'Data Processing Agreement (DPA)';
  const prodTitle = target?.productName || '';
  const recipient = target?.recipientEmail || siteSettings?.mailto_legal || 'security@bjornlunden.com';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Form validation
    if (!formData.companyLegalName.trim()) {
      setValidationError('Please enter your company legal entity name.');
      return;
    }
    if (!formData.registrationNumber.trim()) {
      setValidationError('Please enter your company registration or VAT/tax number.');
      return;
    }
    if (!formData.registeredAddress.trim()) {
      setValidationError('Please provide the registered legal address of your organization.');
      return;
    }
    if (!formData.signatoryName.trim()) {
      setValidationError('Please enter the full name of the authorized corporate signatory.');
      return;
    }
    if (!formData.signatoryEmail.trim() || !formData.signatoryEmail.includes('@')) {
      setValidationError('Please provide a valid business email address for the signatory.');
      return;
    }
    if (!formData.isRequesterSignatory) {
      if (!formData.requesterName.trim() || !formData.requesterEmail.trim()) {
        setValidationError('Please provide your name and email as the requester.');
        return;
      }
    }
    if (!formData.confirmedAuthority) {
      setValidationError('Please confirm that you are authorized to request this agreement on behalf of your company.');
      return;
    }

    setSubmitting(true);

    const finalSignatoryRole = formData.signatoryRole === 'Other Authorized Signatory' && formData.customSignatoryRole.trim()
      ? formData.customSignatoryRole.trim()
      : formData.signatoryRole;

    const signingMethodLabel = formData.signingMethod === 'docusign' 
      ? 'Digital Signature (DocuSign / Scrive e-Sign)'
      : 'Countersigned PDF via Email';

    const selectedCountryLabel = JURISDICTIONS.find(j => j.value === formData.country)?.label || formData.country;

    // Track metric
    try {
      await fetch('/api/public/metrics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'request_signed_copy',
          product_slug: target?.productSlug || 'general',
          item_name: docTitle,
          user_email: formData.isRequesterSignatory ? formData.signatoryEmail : formData.requesterEmail
        })
      });
    } catch (err) {
      console.warn('Failed to track signed copy metric:', err);
    }

    // Record signed copy request in access_requests registry
    try {
      const notesAndMetadata = [
        `Company Registration/VAT: ${formData.registrationNumber.trim()}`,
        `Registered Address: ${formData.registeredAddress.trim()}`,
        `Jurisdiction: ${selectedCountryLabel}`,
        `Signing Method: ${signingMethodLabel}`,
        `Authorized Signatory: ${formData.signatoryName.trim()} (${formData.signatoryEmail.trim()}) - ${finalSignatoryRole}`,
        !formData.isRequesterSignatory ? `Requested By: ${formData.requesterName.trim()} (${formData.requesterEmail.trim()})` : 'Requester is Signatory',
        formData.specialNotes.trim() ? `Schedule/Appendix Notes: ${formData.specialNotes.trim()}` : ''
      ].filter(Boolean).join('\n');

      await fetch('/api/public/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: `Signed Copy Request: ${docTitle}`,
          documentType: 'signed_dpa',
          productSlug: target?.productSlug || null,
          firstName: formData.signatoryName.split(' ')[0] || formData.signatoryName,
          lastName: formData.signatoryName.split(' ').slice(1).join(' ') || '(Signatory)',
          businessEmail: formData.signatoryEmail.trim().toLowerCase(),
          company: formData.companyLegalName.trim(),
          jobTitle: finalSignatoryRole,
          relationship: 'Current Customer / Legal Contracting',
          purpose: `Execution of ${docTitle} via ${signingMethodLabel}`,
          comments: notesAndMetadata,
          ndaAccepted: true,
          ndaAcceptedAt: new Date().toISOString()
        })
      });
    } catch (err) {
      console.warn('Failed to record signed copy request:', err);
    }

    // Build structured email body
    const emailSubject = `Request for Signed Copy: ${docTitle}${prodTitle ? ` (${prodTitle})` : ''}`;
    const emailBody = `Hello Bjorn Lunden Legal & Compliance Team,

A formal request for an executed / countersigned copy of the following legal agreement has been submitted via the Bjorn Lunden Trust Center:

--- DOCUMENT REQUESTED ---
Document: ${docTitle}
${prodTitle ? `Product / Scope: ${prodTitle}\n` : ''}Date of Request: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

--- CONTRACTING ENTITY DETAILS ---
Company Legal Name: ${formData.companyLegalName.trim()}
Registration / Org / VAT No: ${formData.registrationNumber.trim()}
Registered Legal Address: ${formData.registeredAddress.trim()}
Jurisdiction / Country: ${selectedCountryLabel}

--- AUTHORIZED SIGNATORY ---
Signatory Full Name: ${formData.signatoryName.trim()}
Signatory Business Email: ${formData.signatoryEmail.trim()}
Signatory Title / Role: ${finalSignatoryRole}

--- REQUESTER INFORMATION ---
${formData.isRequesterSignatory ? 'Requester: The authorized signatory is submitting this request directly.' : `Submitted on behalf by:\nName: ${formData.requesterName.trim()}\nEmail: ${formData.requesterEmail.trim()}\nRole: ${formData.requesterRole.trim() || 'Representative'}`}

--- SIGNING & EXECUTION PREFERENCES ---
Preferred Execution Method: ${signingMethodLabel}
${formData.specialNotes.trim() ? `\nAdditional Schedule / Contact Notes:\n${formData.specialNotes.trim()}\n` : ''}
--- AUTHORIZATION CONFIRMATION ---
[X] The submitter has confirmed corporate authority to request and execute this agreement on behalf of ${formData.companyLegalName.trim()}.

Submitted via Bjorn Lunden Trust Center (Legal Documents Portal).`;

    setSubmitted(true);
    setSubmitting(false);

    // Launch email client
    setTimeout(() => {
      window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    }, 400);
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setValidationError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signed-copy-modal-title"
      >
        {/* Header */}
        <div className="bg-linear-to-r from-slate-900 via-slate-800 to-indigo-950 px-6 py-5 text-white flex items-start justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h2 id="signed-copy-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
                Request Signed Copy
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Request an executed, countersigned copy of this agreement for your company records
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Document Info Bar */}
        <div className="bg-blue-50/80 px-6 py-3 border-b border-blue-100 flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-blue-900 font-medium">
            <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Document: <strong className="text-slate-900">{docTitle}</strong></span>
          </div>
          {prodTitle && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white text-blue-800 border border-blue-200 shadow-2xs">
              {prodTitle}
            </span>
          )}
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {submitted ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-xl font-bold text-slate-900">Request Submitted Successfully</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  We have received your countersignature request for <strong className="text-slate-800">{docTitle}</strong>.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left max-w-md mx-auto text-xs space-y-2">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  Contracting Entity Summary
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Legal Company:</span>
                  <span className="font-medium text-slate-800">{formData.companyLegalName}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Signatory:</span>
                  <span className="font-medium text-slate-800">{formData.signatoryName}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Signatory Email:</span>
                  <span className="font-medium text-slate-800">{formData.signatoryEmail}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Execution Method:</span>
                  <span className="font-medium text-slate-800">
                    {formData.signingMethod === 'docusign' ? 'DocuSign / Scrive e-Sign' : 'Signed PDF via Email'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                Our Legal &amp; Compliance team will review your organization details and dispatch the countersigned document to the designated signatory.
              </p>

              <div className="pt-2">
                <Button onClick={handleResetAndClose} className="px-6 py-2">
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {validationError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Section 1: Company Legal Entity Information */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  1. Contracting Entity Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Legal Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.companyLegalName}
                      onChange={e => setFormData({ ...formData, companyLegalName: e.target.value })}
                      placeholder="e.g. Acme Corporation AB / Acme B.V."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Registration / Org / VAT Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.registrationNumber}
                      onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })}
                      placeholder="e.g. 556123-4567 or NL123456789B01"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jurisdiction / Country <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.country}
                      onChange={e => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
                    >
                      {JURISDICTIONS.map(j => (
                        <option key={j.value} value={j.value}>{j.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Registered Legal Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.registeredAddress}
                      onChange={e => setFormData({ ...formData, registeredAddress: e.target.value })}
                      placeholder="Street, City, Postal Code, Country"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Authorized Signatory Details */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    2. Authorized Signatory Details
                  </h3>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isRequesterSignatory}
                      onChange={e => setFormData({ ...formData, isRequesterSignatory: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>I am the signatory</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Signatory Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.signatoryName}
                      onChange={e => setFormData({ ...formData, signatoryName: e.target.value })}
                      placeholder="Full Name of Representative"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Signatory Business Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.signatoryEmail}
                      onChange={e => setFormData({ ...formData, signatoryEmail: e.target.value })}
                      placeholder="signatory@company.com"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Electronic signature invite will be dispatched here.</p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Signatory Capacity / Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.signatoryRole}
                      onChange={e => setFormData({ ...formData, signatoryRole: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white mb-2"
                    >
                      {SIGNING_ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    {formData.signatoryRole === 'Other Authorized Signatory' && (
                      <input
                        type="text"
                        required
                        value={formData.customSignatoryRole}
                        onChange={e => setFormData({ ...formData, customSignatoryRole: e.target.value })}
                        placeholder="Specify official signatory job title..."
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
                      />
                    )}
                  </div>
                </div>

                {/* Submitting on behalf (Requester section) */}
                {!formData.isRequesterSignatory && (
                  <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="text-xs font-semibold text-slate-700">Requester Contact (Submitting on behalf):</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Your Full Name</label>
                        <input
                          type="text"
                          required
                          value={formData.requesterName}
                          onChange={e => setFormData({ ...formData, requesterName: e.target.value })}
                          placeholder="Your Name"
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">Your Business Email</label>
                        <input
                          type="email"
                          required
                          value={formData.requesterEmail}
                          onChange={e => setFormData({ ...formData, requesterEmail: e.target.value })}
                          placeholder="your.email@company.com"
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Execution Preferences */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  3. Signing &amp; Delivery Preference
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                    formData.signingMethod === 'docusign' 
                      ? 'border-blue-600 bg-blue-50/60 shadow-2xs' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="signingMethod"
                      value="docusign"
                      checked={formData.signingMethod === 'docusign'}
                      onChange={() => setFormData({ ...formData, signingMethod: 'docusign' })}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">Electronic Signature (DocuSign)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Quick digital signature dispatched directly to signatory email.</div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                    formData.signingMethod === 'pdf' 
                      ? 'border-blue-600 bg-blue-50/60 shadow-2xs' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}>
                    <input
                      type="radio"
                      name="signingMethod"
                      value="pdf"
                      checked={formData.signingMethod === 'pdf'}
                      onChange={() => setFormData({ ...formData, signingMethod: 'pdf' })}
                      className="mt-0.5 text-blue-600"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">Signed PDF Copy</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Countersigned PDF document issued by Bjorn Lunden legal entity.</div>
                    </div>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Specific Schedule Notes / DPO Contact <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={formData.specialNotes}
                    onChange={e => setFormData({ ...formData, specialNotes: e.target.value })}
                    placeholder="e.g. Specific Security contact email to include in DPA Annex, or corporate reference number..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 bg-white"
                  />
                </div>
              </div>

              {/* Section 4: Authority Declaration */}
              <div className="border-t border-slate-100 pt-4">
                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="checkbox"
                    required
                    checked={formData.confirmedAuthority}
                    onChange={e => setFormData({ ...formData, confirmedAuthority: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <span className="leading-relaxed">
                    I confirm that I am authorized to request and bind this legal agreement on behalf of{' '}
                    <strong>{formData.companyLegalName || 'the contracting entity'}</strong>, and that the signatory details provided are accurate for contractual execution.
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleResetAndClose}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Submitting...' : 'Submit Signed Copy Request'}</span>
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
