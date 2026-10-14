import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Lock, 
  UserCheck, 
  Settings, 
  AlertTriangle, 
  RefreshCw, 
  Download, 
  Search, 
  Filter, 
  Clock, 
  Globe, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  ShieldAlert, 
  X, 
  Copy, 
  Check, 
  Eye, 
  User, 
  Building2, 
  Calendar,
  Layers,
  Upload,
  Stamp,
  FileCheck,
  Mail
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';

export type ActivityLogEntry = {
  id: number;
  type: 'document_update' | 'access_request' | 'user_login' | 'settings_update';
  action: string;
  title: string;
  actor: string | null;
  target_type: string | null;
  target_name: string | null;
  details: any;
  ip_address: string | null;
  status: 'success' | 'failed' | 'pending' | 'warning';
  created_at: string;
};

type ActivityStats = {
  total: number;
  document_updates: number;
  access_requests: number;
  user_logins: number;
};

export function ActivityLog() {
  const { getAuthHeaders } = useAuth();
  
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [stats, setStats] = useState<ActivityStats>({
    total: 0,
    document_updates: 0,
    access_requests: 0,
    user_logins: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<'all' | 'document_update' | 'access_request' | 'user_login'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | '24h' | '7d' | '30d'>('all');

  // Selected entry for modal view
  const [selectedEntry, setSelectedEntry] = useState<ActivityLogEntry | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);
  const [uploadingPdfId, setUploadingPdfId] = useState<number | null>(null);
  const [watermarkToast, setWatermarkToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchLogs = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/activity-logs?limit=150', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to load activity logs');
      }

      const data = await res.json();
      setLogs(data.logs || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      console.error('Error fetching logs:', err);
      setError(err.message || 'Error connecting to activity audit service');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs locally based on current criteria
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Type filter
      if (activeTab !== 'all' && log.type !== activeTab) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && log.status !== statusFilter) {
        return false;
      }

      // Time filter
      if (timeFilter !== 'all') {
        const logDate = new Date(log.created_at).getTime();
        const now = Date.now();
        const diffMs = now - logDate;
        if (timeFilter === '24h' && diffMs > 24 * 60 * 60 * 1000) return false;
        if (timeFilter === '7d' && diffMs > 7 * 24 * 60 * 60 * 1000) return false;
        if (timeFilter === '30d' && diffMs > 30 * 24 * 60 * 60 * 1000) return false;
      }

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesTitle = log.title?.toLowerCase().includes(q);
        const matchesActor = log.actor?.toLowerCase().includes(q);
        const matchesTarget = log.target_name?.toLowerCase().includes(q);
        const matchesIp = log.ip_address?.toLowerCase().includes(q);
        const matchesDetails = typeof log.details === 'object' 
          ? JSON.stringify(log.details).toLowerCase().includes(q)
          : String(log.details || '').toLowerCase().includes(q);

        if (!matchesTitle && !matchesActor && !matchesTarget && !matchesIp && !matchesDetails) {
          return false;
        }
      }

      return true;
    });
  }, [logs, activeTab, statusFilter, timeFilter, searchQuery]);

  // Handle Export
  const handleExport = (format: 'csv' | 'json') => {
    window.open(`/api/admin/activity-logs/export?format=${format}`, '_blank');
  };

  // Update Access Request Status
  const handleUpdateStatus = async (requestId: number, newStatus: string) => {
    setUpdatingStatusId(requestId);
    try {
      const res = await fetch(`/api/admin/access-requests/${requestId}/status`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        await fetchLogs(true);
        if (selectedEntry && selectedEntry.details?.requestId === requestId) {
          setSelectedEntry({
            ...selectedEntry,
            status: newStatus === 'rejected' ? 'failed' : 'success',
            details: {
              ...selectedEntry.details,
              status: newStatus
            }
          });
        }
      }
    } catch (e) {
      console.error('Failed to update status', e);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Upload and watermark PDF for an access request
  const handleUploadAndWatermark = async (requestId: number, file: File) => {
    setUploadingPdfId(requestId);
    setWatermarkToast(null);

    const formData = new FormData();
    formData.append('document', file);

    try {
      const res = await fetch(`/api/admin/access-requests/${requestId}/upload-and-watermark`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to upload and watermark PDF');
      }

      const data = await res.json();
      setWatermarkToast({ message: 'Watermarked PDF generated and linked to request successfully!', type: 'success' });
      setTimeout(() => setWatermarkToast(null), 4000);

      await fetchLogs(true);
      if (selectedEntry && selectedEntry.details?.requestId === requestId) {
        setSelectedEntry({
          ...selectedEntry,
          status: 'success',
          details: {
            ...selectedEntry.details,
            document_file_url: data.document_file_url,
            watermarked_file_url: data.watermarked_file_url,
            status: 'approved'
          }
        });
      }
    } catch (err: any) {
      console.error('Error uploading/watermarking:', err);
      setWatermarkToast({ message: err.message || 'Error creating watermarked PDF', type: 'error' });
      setTimeout(() => setWatermarkToast(null), 4000);
    } finally {
      setUploadingPdfId(null);
    }
  };

  const copyDetailsJson = (details: any) => {
    navigator.clipboard.writeText(JSON.stringify(details, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (e) {
      return dateStr;
    }
  };

  const getRelativeTime = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays}d ago`;
    } catch (e) {
      return '';
    }
  };

  const getTypeBadge = (type: ActivityLogEntry['type']) => {
    switch (type) {
      case 'document_update':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <FileText className="w-3.5 h-3.5 text-blue-600" /> Document Update
          </span>
        );
      case 'access_request':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Lock className="w-3.5 h-3.5 text-purple-600" /> Access Request
          </span>
        );
      case 'user_login':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> User Auth
          </span>
        );
      case 'settings_update':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Settings className="w-3.5 h-3.5 text-slate-500" /> Settings
          </span>
        );
    }
  };

  const getStatusBadge = (status: ActivityLogEntry['status']) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Success
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Failed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" /> Pending
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      {/* Component Header */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-900 text-white rounded-lg shadow-sm">
              <Layers className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Activity & Audit Log
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Comprehensive security audit trail tracking document updates, access requests, and authentication history.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 bg-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </Button>

          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <button
              onClick={() => handleExport('csv')}
              title="Download full audit log as CSV"
              className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-200 flex items-center gap-1 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              title="Download full audit log as JSON"
              className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-1 transition-colors"
            >
              JSON
            </button>
          </div>
        </div>
      </div>

      {/* Watermark Notification Banner */}
      {watermarkToast && (
        <div className={`p-4 border-b text-xs font-medium flex items-center justify-between animate-in fade-in duration-150 ${
          watermarkToast.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {watermarkToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{watermarkToast.message}</span>
          </div>
          <button 
            onClick={() => setWatermarkToast(null)} 
            className="p-1 hover:bg-black/5 rounded transition-colors text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-100 border-b border-slate-200">
        <div className="bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Events</span>
            <span className="p-1 rounded bg-slate-100 text-slate-600">All Time</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
          <p className="text-xs text-slate-400 mt-0.5">Audited compliance events</p>
        </div>

        <div className="bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Document Updates</span>
            <FileText className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.document_updates}</p>
          <p className="text-xs text-slate-400 mt-0.5">Modifications & NDA changes</p>
        </div>

        <div className="bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Access Requests</span>
            <Lock className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-600 mt-1">{stats.access_requests}</p>
          <p className="text-xs text-slate-400 mt-0.5">Customer document requests</p>
        </div>

        <div className="bg-white p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>User Logins</span>
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.user_logins}</p>
          <p className="text-xs text-slate-400 mt-0.5">Admin & moderator sessions</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            All Activity ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('document_update')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'document_update'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Document Updates ({stats.document_updates})
          </button>
          <button
            onClick={() => setActiveTab('access_request')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'access_request'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Access Requests ({stats.access_requests})
          </button>
          <button
            onClick={() => setActiveTab('user_login')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'user_login'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Login History ({stats.user_logins})
          </button>
        </div>

        {/* Search & Extra Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actor, document, IP..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm"
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
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm cursor-pointer"
          >
            <option value="all">Status: All</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-sm cursor-pointer"
          >
            <option value="all">Time: All Time</option>
            <option value="24h">Past 24 Hours</option>
            <option value="7d">Past 7 Days</option>
            <option value="30d">Past 30 Days</option>
          </select>
        </div>
      </div>

      {/* Main Table / Timeline Content */}
      <div className="relative">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">Loading audit activity logs...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 flex flex-col items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            <p className="text-sm font-semibold">{error}</p>
            <Button size="sm" variant="outline" onClick={() => fetchLogs()} className="mt-2 text-xs">
              Try Again
            </Button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">No matching activity logs</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No audit logs matched your current filters. Try changing your search query, status, or date range filter.
            </p>
            {(searchQuery || statusFilter !== 'all' || timeFilter !== 'all' || activeTab !== 'all') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setTimeFilter('all');
                  setActiveTab('all');
                }}
                className="mt-3 text-xs"
              >
                Reset All Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Event & Summary</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Status</th>
                  {activeTab === 'access_request' && (
                    <th className="py-3 px-4 text-center">Watermarked PDF</th>
                  )}
                  <th className="py-3 px-4 text-right">Timestamp</th>
                  <th className="py-3 px-4 text-center">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 max-w-xs sm:max-w-md">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 shrink-0">
                          {entry.type === 'document_update' && (
                            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700 inline-block">
                              <FileText className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {entry.type === 'access_request' && (
                            <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700 inline-block">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )}
                          {entry.type === 'user_login' && (
                            <span className={`p-1.5 rounded-lg inline-block ${
                              entry.status === 'failed' 
                                ? 'bg-rose-100 text-rose-700' 
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {entry.status === 'failed' ? (
                                <AlertTriangle className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                            </span>
                          )}
                          {entry.type === 'settings_update' && (
                            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700 inline-block">
                              <Settings className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                            {entry.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-slate-500 text-[11px]">
                            <span className="uppercase font-mono text-[9px] px-1.5 py-0.2 bg-slate-100 rounded text-slate-600 font-bold">
                              {entry.action.replace(/_/g, ' ')}
                            </span>
                            {entry.target_name && (
                              <span className="truncate max-w-[200px] text-slate-600">
                                Target: <strong className="font-medium text-slate-800">{entry.target_name}</strong>
                              </span>
                            )}
                            {entry.type === 'access_request' && entry.details?.watermarked_file_url && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Stamp className="w-2.5 h-2.5 text-emerald-600" /> Watermark Ready
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {getTypeBadge(entry.type)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate max-w-[140px]">{entry.actor || 'System'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                      {entry.ip_address ? (
                        <span className="inline-flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-400" />
                          {entry.ip_address}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(entry.status)}
                    </td>

                    {activeTab === 'access_request' && (
                      <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {entry.details?.watermarked_file_url ? (
                          <a
                            href={entry.details.watermarked_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors shadow-xs"
                            title="Download watermarked PDF for requester"
                          >
                            <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                            PDF Ready
                          </a>
                        ) : entry.details?.requestId ? (
                          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors cursor-pointer shadow-xs">
                            <Upload className="w-3.5 h-3.5 text-blue-600" />
                            {uploadingPdfId === entry.details.requestId ? 'Stamping...' : 'Upload & Stamp'}
                            <input
                              type="file"
                              accept="application/pdf"
                              disabled={uploadingPdfId === entry.details.requestId}
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleUploadAndWatermark(entry.details.requestId, e.target.files[0]);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>
                    )}

                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <span className="font-medium text-slate-700 block">
                        {getRelativeTime(entry.created_at)}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {formatTimestamp(entry.created_at)}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEntry(entry);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="View Full Audit Payload"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer / Results Count */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
        <span>
          Showing <strong>{filteredLogs.length}</strong> of <strong>{logs.length}</strong> audited events
        </span>
        <span className="text-[11px] text-slate-400">
          SOC 2 CC5.2 / ISO 27001 A.12.4 compliant activity logging
        </span>
      </div>

      {/* Audit Detail Modal */}
      {selectedEntry && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-900 text-white rounded-xl">
                  {selectedEntry.type === 'document_update' && <FileText className="w-5 h-5 text-blue-400" />}
                  {selectedEntry.type === 'access_request' && <Lock className="w-5 h-5 text-purple-400" />}
                  {selectedEntry.type === 'user_login' && <UserCheck className="w-5 h-5 text-emerald-400" />}
                  {selectedEntry.type === 'settings_update' && <Settings className="w-5 h-5 text-slate-400" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Audit Event #{selectedEntry.id}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getTypeBadge(selectedEntry.type)}
                    {getStatusBadge(selectedEntry.status)}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              <div>
                <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-1">
                  Event Title
                </h4>
                <p className="text-base font-semibold text-slate-900 bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                  {selectedEntry.title}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                  <span className="text-xs font-semibold text-slate-500 block">Actor / User</span>
                  <div className="flex items-center gap-1.5 text-slate-900 font-bold mt-1">
                    <User className="w-4 h-4 text-blue-600" />
                    {selectedEntry.actor || 'System'}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                  <span className="text-xs font-semibold text-slate-500 block">IP Address</span>
                  <div className="flex items-center gap-1.5 text-slate-900 font-mono text-xs font-bold mt-1">
                    <Globe className="w-4 h-4 text-slate-500" />
                    {selectedEntry.ip_address || 'Internal / Local'}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                  <span className="text-xs font-semibold text-slate-500 block">Timestamp</span>
                  <div className="flex items-center gap-1.5 text-slate-900 text-xs font-medium mt-1">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    {formatTimestamp(selectedEntry.created_at)}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                  <span className="text-xs font-semibold text-slate-500 block">Target Resource</span>
                  <div className="text-slate-900 text-xs font-medium mt-1 truncate">
                    {selectedEntry.target_name || selectedEntry.target_type || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Special Access Request Details & Workflow Action */}
              {selectedEntry.type === 'access_request' && selectedEntry.details && (
                <div className="bg-purple-50/60 border border-purple-200 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-purple-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-purple-600" /> Access Request Questionnaire Data
                    </h5>
                    <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
                      NDA Status: {selectedEntry.details.nda_accepted ? 'Accepted' : 'Not Opted-in'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Requester:</span>{' '}
                      <strong className="text-slate-900">{selectedEntry.details.requester || selectedEntry.actor}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Company:</span>{' '}
                      <strong className="text-slate-900">{selectedEntry.details.company || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Job Title:</span>{' '}
                      <span className="text-slate-800">{selectedEntry.details.jobTitle || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Relationship:</span>{' '}
                      <span className="text-slate-800">{selectedEntry.details.relationship || '—'}</span>
                    </div>
                  </div>

                  {selectedEntry.details.purpose && (
                    <div className="text-xs bg-white p-2.5 rounded-lg border border-purple-100">
                      <span className="font-semibold text-slate-600 block mb-0.5">Stated Purpose:</span>
                      <p className="text-slate-800 italic">{selectedEntry.details.purpose}</p>
                    </div>
                  )}

                  {/* Actions for Access Request */}
                  {selectedEntry.details.requestId && (
                    <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between gap-2">
                      <span className="text-xs text-purple-800 font-medium">Update Request Status:</span>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingStatusId === selectedEntry.details.requestId}
                          onClick={() => handleUpdateStatus(selectedEntry.details.requestId, 'approved')}
                          className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 bg-white"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve Access
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingStatusId === selectedEntry.details.requestId}
                          onClick={() => handleUpdateStatus(selectedEntry.details.requestId, 'rejected')}
                          className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50 bg-white"
                        >
                          <X className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Special Watermarked Document Delivery & Stamping Card */}
              {selectedEntry.type === 'access_request' && selectedEntry.details?.requestId && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                        <Stamp className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                          Watermarked Document Delivery
                        </h5>
                        <p className="text-[11px] text-slate-500">
                          Automatic PDF watermarking stamped with requester identity &amp; NDA compliance notice
                        </p>
                      </div>
                    </div>
                    {selectedEntry.details?.watermarked_file_url ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Watermark Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3.5 h-3.5 text-amber-600" /> Awaiting PDF
                      </span>
                    )}
                  </div>

                  {/* Watermark Details Preview */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-xs space-y-1.5">
                    <span className="font-semibold text-slate-700 uppercase text-[10px] tracking-wider block">
                      Automated Watermark Stamp Details:
                    </span>
                    <div className="p-2.5 bg-white rounded-md border border-slate-200 font-mono text-[11px] text-slate-700 space-y-1">
                      <p className="text-red-700 font-bold">
                        CONFIDENTIAL - LICENSED TO: {(selectedEntry.details.company || selectedEntry.details.requester || selectedEntry.actor || '').toUpperCase()}
                      </p>
                      <p className="text-slate-600">
                        {selectedEntry.details.requester || selectedEntry.actor} ({selectedEntry.details.email || ''}) • Request #{selectedEntry.details.requestId}
                      </p>
                      <p className="text-[10px] text-slate-400 font-sans">
                        Full running top &amp; bottom security banners across all pages • Traceable back to recipient under signed NDA
                      </p>
                    </div>
                  </div>

                  {/* Watermarked Document Actions */}
                  {selectedEntry.details?.watermarked_file_url ? (
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={selectedEntry.details.watermarked_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                        >
                          <Download className="w-4 h-4" /> Download Watermarked PDF
                        </a>

                        {selectedEntry.details.email && (
                          <a
                            href={`mailto:${encodeURIComponent(selectedEntry.details.email)}?subject=${encodeURIComponent(`[Bjorn Lunden Trust Center] Access Request: ${selectedEntry.details.documentName || selectedEntry.target_name || 'Document'}`)}&body=${encodeURIComponent(
                              `Dear ${selectedEntry.details.requester || 'Requester'},\n\nThank you for requesting access to ${selectedEntry.details.documentName || selectedEntry.target_name || 'the requested documentation'} via the Bjorn Lunden Trust Center.\n\nIn accordance with your signed Non-Disclosure Agreement (NDA), your copy has been electronically watermarked with your contact information (${selectedEntry.details.requester}, ${selectedEntry.details.email}, ${selectedEntry.details.company || ''}).\n\nPlease find your secure watermarked PDF attached.\n\nBest regards,\nBjorn Lunden Compliance & Security Team`
                            )}`}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Mail className="w-3.5 h-3.5" /> Email Requester
                          </a>
                        )}

                        {selectedEntry.details?.document_file_url && (
                          <a
                            href={selectedEntry.details.document_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-slate-500" /> View Original
                          </a>
                        )}
                      </div>

                      {/* Option to re-upload / replace */}
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer shadow-xs">
                        <Upload className="w-3.5 h-3.5 text-slate-400" />
                        {uploadingPdfId === selectedEntry.details.requestId ? 'Generating...' : 'Upload Different PDF'}
                        <input
                          type="file"
                          accept="application/pdf"
                          disabled={uploadingPdfId === selectedEntry.details.requestId}
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleUploadAndWatermark(selectedEntry.details.requestId, e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-100">
                      <label className="flex flex-col sm:flex-row items-center justify-center gap-3 p-5 border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/40 hover:bg-blue-50/80 rounded-xl cursor-pointer transition-all text-center group">
                        <div className="w-10 h-10 rounded-full bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center text-blue-600 shrink-0 transition-colors">
                          {uploadingPdfId === selectedEntry.details.requestId ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : (
                            <Upload className="w-5 h-5" />
                          )}
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-bold text-blue-900 block">
                            {uploadingPdfId === selectedEntry.details.requestId
                              ? 'Applying Watermark to PDF...'
                              : `Upload Document PDF for '${selectedEntry.details.documentName || selectedEntry.target_name || 'Request'}'`}
                          </span>
                          <span className="text-[11px] text-blue-700/80">
                            Select the source PDF. A customized watermark with {selectedEntry.details.requester}'s contact info will be generated instantly.
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="application/pdf"
                          disabled={uploadingPdfId === selectedEntry.details.requestId}
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleUploadAndWatermark(selectedEntry.details.requestId, e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Raw Details / Payload JSON */}
              {selectedEntry.details && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                      Audit Payload & Parameters
                    </h4>
                    <button
                      onClick={() => copyDetailsJson(selectedEntry.details)}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium"
                    >
                      {copiedJson ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy JSON
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono overflow-x-auto max-h-52 border border-slate-800">
                    {typeof selectedEntry.details === 'object' 
                      ? JSON.stringify(selectedEntry.details, null, 2)
                      : String(selectedEntry.details)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEntry(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
