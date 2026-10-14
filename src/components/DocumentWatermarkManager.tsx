import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Stamp, 
  FileCheck, 
  CheckCircle2, 
  Clock, 
  Download, 
  ExternalLink, 
  Mail, 
  Search, 
  Filter, 
  RefreshCw, 
  AlertTriangle, 
  User, 
  Building2, 
  Briefcase, 
  ShieldCheck, 
  Eye, 
  X, 
  Check, 
  Layers, 
  Lock,
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';

export interface DocumentRequestItem {
  id: number;
  document_name: string;
  document_type?: string;
  product_slug?: string | null;
  requester_name: string;
  business_email: string;
  company: string;
  job_title?: string | null;
  relationship?: string | null;
  purpose?: string | null;
  comments?: string | null;
  nda_accepted: number | boolean;
  nda_accepted_at?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  ip_address?: string | null;
  created_at: string;
  document_file_url?: string | null;
  watermarked_file_url?: string | null;
}

export function DocumentWatermarkManager() {
  const { getAuthHeaders } = useAuth();

  const [requests, setRequests] = useState<DocumentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected request for the fulfillment workbench
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [markAsFulfilled, setMarkAsFulfilled] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Search & Filter state for requests list
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_watermark' | 'watermarked' | 'pending' | 'fulfilled'>('all');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workbenchRef = useRef<HTMLDivElement | null>(null);

  const fetchRequests = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/access-requests', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to load document requests');
      }

      const data: DocumentRequestItem[] = await res.json();
      setRequests(data || []);

      // If no request is selected, auto-select the first pending one, or first overall
      if (!selectedRequestId && data && data.length > 0) {
        const firstPending = data.find(r => !r.watermarked_file_url || r.status === 'pending');
        setSelectedRequestId(firstPending ? firstPending.id : data[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching document requests:', err);
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const selectedRequest = useMemo(() => {
    return requests.find(r => r.id === selectedRequestId) || null;
  }, [requests, selectedRequestId]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        r.document_name.toLowerCase().includes(q) ||
        r.requester_name.toLowerCase().includes(q) ||
        r.business_email.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        (r.job_title && r.job_title.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === 'needs_watermark') {
        return !r.watermarked_file_url;
      }
      if (statusFilter === 'watermarked') {
        return !!r.watermarked_file_url;
      }
      if (statusFilter === 'pending') {
        return r.status === 'pending';
      }
      if (statusFilter === 'fulfilled') {
        return r.status === 'fulfilled' || (r.status === 'approved' && !!r.watermarked_file_url);
      }

      return true;
    });
  }, [requests, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = requests.length;
    const watermarkedCount = requests.filter(r => !!r.watermarked_file_url).length;
    const pendingCount = requests.filter(r => !r.watermarked_file_url).length;
    return { total, watermarkedCount, pendingCount };
  }, [requests]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setSelectedFile(file);
      } else {
        setToast({ message: 'Only PDF documents can be watermarked. Please upload a .pdf file.', type: 'error' });
        setTimeout(() => setToast(null), 4000);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        setSelectedFile(file);
      } else {
        setToast({ message: 'Only PDF documents can be watermarked. Please upload a .pdf file.', type: 'error' });
        setTimeout(() => setToast(null), 4000);
      }
    }
  };

  const handleUploadAndWatermark = async () => {
    if (!selectedRequestId) {
      setToast({ message: 'Please select a document request first.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    if (!selectedFile) {
      setToast({ message: 'Please choose or drag a PDF document to upload.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setProcessing(true);
    setToast(null);

    const formData = new FormData();
    formData.append('document', selectedFile);
    if (markAsFulfilled) {
      formData.append('status', 'fulfilled');
    }

    try {
      const res = await fetch(`/api/admin/access-requests/${selectedRequestId}/upload-and-watermark`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate watermarked document');
      }

      const data = await res.json();
      
      // Update local state
      setRequests(prev => prev.map(item => {
        if (item.id === selectedRequestId) {
          return {
            ...item,
            document_file_url: data.document_file_url,
            watermarked_file_url: data.watermarked_file_url,
            status: data.status || (markAsFulfilled ? 'fulfilled' : item.status)
          };
        }
        return item;
      }));

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      setToast({ 
        message: `Watermark successfully created for ${selectedRequest?.requester_name}! The PDF is ready to download or send.`, 
        type: 'success' 
      });
      setTimeout(() => setToast(null), 5000);
    } catch (err: any) {
      console.error('Error generating watermark:', err);
      setToast({ message: err.message || 'Error uploading and watermarking document', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: 'pending' | 'approved' | 'rejected' | 'fulfilled') => {
    try {
      const res = await fetch(`/api/admin/access-requests/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ status })
      });

      if (!res.ok) {
        throw new Error('Failed to update request status');
      }

      setRequests(prev => prev.map(item => item.id === id ? { ...item, status } : item));
      setToast({ message: `Request status updated to ${status.toUpperCase()}`, type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || 'Failed to update status', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const selectRequestForWatermark = (id: number) => {
    setSelectedRequestId(id);
    setSelectedFile(null);
    if (workbenchRef.current) {
      workbenchRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Generate email mailto link
  const getEmailLink = (req: DocumentRequestItem) => {
    const subject = `[Bjorn Lunden Trust Center] Access Request: ${req.document_name}`;
    const body = `Dear ${req.requester_name},

Thank you for your document access request for the "${req.document_name}" through the Bjorn Lunden Trust Center.

In accordance with your accepted Non-Disclosure Agreement (NDA), your copy has been electronically watermarked with your authorized contact details:
• Name: ${req.requester_name}
• Business Email: ${req.business_email}
• Company: ${req.company}
• Request Reference: #${req.id}

Please find your secure watermarked PDF attached to this email. This document is strictly confidential and licensed solely for your internal evaluation under the terms of our NDA.

If you have any further questions or require additional audit materials, please contact the Bjorn Lunden Security & Compliance Team.

Best regards,
Bjorn Lunden Security & Compliance Team
Trust Center Operations`;

    return `mailto:${encodeURIComponent(req.business_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between shadow-sm animate-in fade-in duration-150 ${
          toast.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
            : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button 
            onClick={() => setToast(null)} 
            className="p-1 hover:bg-black/5 rounded-lg transition-colors text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Fulfillment Workbench Card */}
      <div ref={workbenchRef} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-6">
        {/* Card Header */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl text-blue-300">
              <Stamp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Document Watermarking &amp; Delivery Hub
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  Automated Security Stamping
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                Upload a document (Policy, SoA, Audit Report) and associate it with a specific document request to automatically generate a personalized watermarked PDF containing the requester's name, email, and company under their signed NDA.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchRequests(true)}
              disabled={refreshing || loading}
              className="text-white border-white/20 hover:bg-white/10 hover:text-white bg-transparent"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-50/70 border-b border-slate-200 text-xs">
          <div className="p-3.5 px-6 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Total Document Requests:</span>
            <span className="font-bold text-slate-900 text-sm">{stats.total}</span>
          </div>
          <div className="p-3.5 px-6 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Watermarked Copies Ready:</span>
            <span className="font-bold text-emerald-600 text-sm flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {stats.watermarkedCount}
            </span>
          </div>
          <div className="p-3.5 px-6 flex items-center justify-between">
            <span className="text-slate-500 font-medium">Awaiting PDF Fulfillment:</span>
            <span className="font-bold text-amber-600 text-sm flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {stats.pendingCount}
            </span>
          </div>
        </div>

        {/* Workbench Body */}
        <div className="p-6 space-y-6">
          {/* STEP 1: Select or Associate Request */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                Associate with Document Request
              </label>
              {selectedRequest && (
                <span className="text-xs text-slate-500">
                  Request Ref: <strong className="font-mono text-slate-800">#{selectedRequest.id}</strong>
                </span>
              )}
            </div>

            {loading ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-sm">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                Loading document requests...
              </div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm">
                <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="font-medium text-slate-800">No document requests found</p>
                <p className="text-xs text-slate-400 mt-0.5">When visitors request policies or SoA on the Trust Center, they will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <select
                    value={selectedRequestId || ''}
                    onChange={(e) => setSelectedRequestId(Number(e.target.value))}
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-xs appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Select a document request to fulfill...</option>
                    {requests.map(req => (
                      <option key={req.id} value={req.id}>
                        #{req.id}: {req.document_name} — {req.requester_name} ({req.company}) {req.watermarked_file_url ? '✓ Watermarked' : '⏳ Needs PDF'}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                    <ArrowRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>

                {/* Selected Request Detail Card */}
                {selectedRequest && (
                  <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 p-4.5 rounded-xl border border-slate-200/90 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full inline-block mb-1">
                          Document Requested
                        </span>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          {selectedRequest.document_name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedRequest.watermarked_file_url ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <FileCheck className="w-3.5 h-3.5 text-emerald-600" /> Watermark Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> Needs PDF Watermark
                          </span>
                        )}

                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          selectedRequest.status === 'fulfilled' 
                            ? 'bg-purple-100 text-purple-800'
                            : selectedRequest.status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : selectedRequest.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-800'
                        }`}>
                          Status: {selectedRequest.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Requester Contact Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                        <span className="text-slate-400 font-medium block text-[11px]">Requester Full Name</span>
                        <p className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5 truncate">
                          <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          {selectedRequest.requester_name}
                        </p>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                        <span className="text-slate-400 font-medium block text-[11px]">Business Email</span>
                        <p className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5 truncate font-mono text-[11px]">
                          <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          {selectedRequest.business_email}
                        </p>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                        <span className="text-slate-400 font-medium block text-[11px]">Company / Organization</span>
                        <p className="font-bold text-slate-900 flex items-center gap-1.5 mt-0.5 truncate">
                          <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          {selectedRequest.company}
                        </p>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/70">
                        <span className="text-slate-400 font-medium block text-[11px]">Job Title &amp; Role</span>
                        <p className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5 truncate">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {selectedRequest.job_title || 'Not specified'}
                        </p>
                      </div>
                    </div>

                    {/* Stated Purpose & NDA Status */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200/70 text-xs">
                      <div className="flex-1">
                        <span className="font-semibold text-slate-500 block text-[11px] mb-0.5">Stated Evaluation Purpose:</span>
                        <p className="text-slate-800 italic">{selectedRequest.purpose || 'General compliance and vendor risk review.'}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-100 pt-2 sm:pt-0 sm:pl-3">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <div>
                          <span className="font-bold text-emerald-900 block text-[11px]">
                            NDA {selectedRequest.nda_accepted ? 'Accepted' : 'Pending'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {selectedRequest.nda_accepted_at ? formatTimestamp(selectedRequest.nda_accepted_at) : 'Legally binding'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: Upload Document & Generate Watermark */}
          {selectedRequest && (
            <div className="pt-2 border-t border-slate-200/80 space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                Upload Document PDF to Auto-Watermark
              </label>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Upload Dropzone (7 Cols) */}
                <div className="lg:col-span-7 space-y-3">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      isDragging 
                        ? 'border-blue-500 bg-blue-50/80 scale-[1.01]' 
                        : selectedFile 
                        ? 'border-emerald-300 bg-emerald-50/40' 
                        : 'border-slate-300 hover:border-slate-400 bg-slate-50/60 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-blue-100 text-blue-600">
                      {selectedFile ? (
                        <FileCheck className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <Upload className="w-6 h-6 text-blue-600" />
                      )}
                    </div>

                    {selectedFile ? (
                      <div>
                        <p className="font-bold text-sm text-slate-900">{selectedFile.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {(selectedFile.size / 1024).toFixed(1)} KB • PDF Document Ready
                        </p>
                        <span className="inline-block mt-2 text-xs font-semibold text-blue-600 hover:underline">
                          Click or drag to choose another file
                        </span>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-sm text-slate-800">
                          Drop the document PDF here, or <span className="text-blue-600 underline">browse</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          Upload the policy or report PDF for <strong className="text-slate-700">{selectedRequest.document_name}</strong>. The system will inject personalized watermarks automatically.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-2 font-mono">Accepts .pdf files up to 10MB</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={markAsFulfilled}
                        onChange={(e) => setMarkAsFulfilled(e.target.checked)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer"
                      />
                      <span>Automatically update request status to <strong>Fulfilled</strong></span>
                    </label>

                    <Button
                      variant="primary"
                      size="md"
                      disabled={!selectedFile || processing}
                      onClick={handleUploadAndWatermark}
                      className="w-full sm:w-auto shadow-sm"
                    >
                      {processing ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin text-white" />
                          Watermarking Document...
                        </>
                      ) : (
                        <>
                          <Stamp className="w-4 h-4 mr-2 text-blue-300" />
                          Generate Watermarked PDF
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Live Watermark Specification Preview (5 Cols) */}
                <div className="lg:col-span-5 bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      Live Watermark Stamp Preview
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">pdf-lib 45° Vector</span>
                  </div>

                  {/* Stamp mockup visual */}
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] space-y-2 relative overflow-hidden">
                    <div className="text-[10px] text-slate-400 border-b border-slate-800/80 pb-1 font-mono flex items-center justify-between">
                      <span>Header Banner:</span>
                      <span className="text-emerald-400">Active</span>
                    </div>
                    <p className="font-mono text-[10px] text-slate-300 truncate">
                      AUTHORIZED COPY: {selectedRequest.requester_name} | {selectedRequest.business_email} | {selectedRequest.company} | Ref #{selectedRequest.id}
                    </p>

                    <div className="my-2 py-3 px-2 bg-slate-900/80 rounded border border-red-900/40 text-center relative">
                      <div className="font-bold text-rose-400 uppercase tracking-wide text-xs">
                        CONFIDENTIAL - LICENSED TO: {(selectedRequest.company || selectedRequest.requester_name).toUpperCase()}
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5">
                        {selectedRequest.requester_name} ({selectedRequest.business_email}) • Request #{selectedRequest.id}
                      </div>
                      <span className="absolute right-1 bottom-1 text-[8px] text-slate-500 uppercase tracking-widest font-mono">
                        Center Diagonal (45°)
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-1 font-mono flex items-center justify-between">
                      <span>Footer Notice:</span>
                      <span className="text-slate-400">Protected under NDA</span>
                    </div>
                    <p className="font-mono text-[9px] text-slate-400 truncate">
                      Bjorn Lunden Trust Center • Distribution strictly prohibited.
                    </p>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Every page of the output PDF receives an unremovable vector stamp tying the document to <strong className="text-slate-200">{selectedRequest.requester_name}</strong> at <strong className="text-slate-200">{selectedRequest.company}</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Download & Distribution Hub */}
          {selectedRequest && selectedRequest.watermarked_file_url && (
            <div className="pt-2 border-t border-slate-200/80 space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                Download &amp; Send Watermarked PDF
              </label>

              <div className="p-4.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-950 text-sm flex items-center gap-1.5">
                      Watermarked Copy Generated &amp; Ready
                    </h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Personalized for <strong>{selectedRequest.requester_name}</strong> ({selectedRequest.company}).
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <a
                    href={selectedRequest.watermarked_file_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download Watermarked PDF
                  </a>

                  <a
                    href={getEmailLink(selectedRequest)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Mail className="w-4 h-4" /> Email to Requester
                  </a>

                  {selectedRequest.document_file_url && (
                    <a
                      href={selectedRequest.document_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" /> View Original
                    </a>
                  )}

                  {selectedRequest.status !== 'fulfilled' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateStatus(selectedRequest.id, 'fulfilled')}
                      className="text-xs bg-white text-purple-700 border-purple-200 hover:bg-purple-50"
                    >
                      Mark as Fulfilled
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Requests Directory & Audit Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              Document Access Requests Registry
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and select all incoming requests for policies, SoA, and audit certifications.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requester, company, document..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs cursor-pointer"
            >
              <option value="all">Filter: All ({requests.length})</option>
              <option value="needs_watermark">Needs Watermark ({stats.pendingCount})</option>
              <option value="watermarked">Watermarked ({stats.watermarkedCount})</option>
              <option value="pending">Status: Pending</option>
              <option value="fulfilled">Status: Fulfilled</option>
            </select>
          </div>
        </div>

        {/* Registry Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Ref &amp; Document</th>
                <th className="py-3 px-4">Requester Details</th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">NDA Status</th>
                <th className="py-3 px-4">Watermarked Copy</th>
                <th className="py-3 px-4">Request Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No requests match your current search or filter.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const isSelected = req.id === selectedRequestId;
                  return (
                    <tr
                      key={req.id}
                      className={`hover:bg-blue-50/40 transition-colors ${
                        isSelected ? 'bg-blue-50/60 font-medium' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                            #{req.id}
                          </span>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate max-w-[180px]">
                              {req.document_name}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {formatTimestamp(req.created_at)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{req.requester_name}</span>
                        <span className="text-[11px] text-slate-500 font-mono block truncate max-w-[160px]">
                          {req.business_email}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block truncate max-w-[140px]">
                          {req.company}
                        </span>
                        {req.job_title && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                            {req.job_title}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" /> NDA Signed
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {req.watermarked_file_url ? (
                          <a
                            href={req.watermarked_file_url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                            title="Download watermarked PDF"
                          >
                            <FileCheck className="w-3.5 h-3.5 text-emerald-600" /> PDF Ready (Download)
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" /> Needs PDF
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          req.status === 'fulfilled'
                            ? 'bg-purple-100 text-purple-800'
                            : req.status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : req.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {req.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant={isSelected ? 'primary' : 'outline'}
                            onClick={() => selectRequestForWatermark(req.id)}
                            className="text-xs"
                          >
                            {isSelected ? 'Active in Workbench' : 'Select & Watermark'}
                          </Button>

                          {req.watermarked_file_url && (
                            <a
                              href={getEmailLink(req)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 bg-white"
                              title="Send watermarked PDF to requester via email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
