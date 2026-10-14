import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { 
  Bell, 
  Search, 
  Filter, 
  Plus, 
  Edit2, 
  Trash2, 
  Check, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  PauseCircle, 
  XCircle, 
  Copy, 
  Download, 
  RefreshCw,
  Mail,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

import { fetchPublicProducts, fetchJson } from '../../utils/api';

export interface Subscription {
  id: number;
  email: string;
  type: string;
  product_slug: string;
  status: 'active' | 'paused' | 'cancelled';
  created_at: string;
  product_name?: string;
  product_color?: string;
}

interface Product {
  slug: string;
  name: string;
  color?: string;
  category?: string;
}

interface ControlSubscriptionsManagerProps {
  initialProductSlug?: string | null;
  compact?: boolean;
  onClose?: () => void;
  onSubscriptionsChanged?: () => void;
}

export function ControlSubscriptionsManager({
  initialProductSlug,
  compact = false,
  onClose,
  onSubscriptionsChanged
}: ControlSubscriptionsManagerProps) {
  const { getAuthHeaders } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string>(initialProductSlug || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copied, setCopied] = useState(false);

  // New Subscription Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newProductSlug, setNewProductSlug] = useState(initialProductSlug && initialProductSlug !== 'all' ? initialProductSlug : '');
  const [newStatus, setNewStatus] = useState<'active' | 'paused'>('active');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Subscription State
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editProductSlug, setEditProductSlug] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'paused' | 'cancelled'>('active');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch Products
  useEffect(() => {
    fetchPublicProducts().then(data => {
      if (Array.isArray(data)) {
        setProducts(data);
        if (!newProductSlug && data.length > 0) {
          setNewProductSlug(data[0].slug);
        }
      }
    });
  }, []);

  // Fetch Subscriptions
  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<Subscription[]>('/api/admin/subscriptions?type=controls', {
        headers: {
          ...getAuthHeaders()
        },
        credentials: 'include'
      });
      setSubscriptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not fetch subscriptions:', err);
      showNotification('Could not load subscriptions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  // Sync initialProductSlug if changed from prop
  useEffect(() => {
    if (initialProductSlug && initialProductSlug !== 'all') {
      setSelectedProduct(initialProductSlug);
      setNewProductSlug(initialProductSlug);
    }
  }, [initialProductSlug]);

  // Alter Status (Quick toggle / select)
  const handleAlterStatus = async (id: number, nextStatus: 'active' | 'paused' | 'cancelled') => {
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus })
      });

      if (res.ok) {
        setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, status: nextStatus } : s));
        showNotification(`Subscription status altered to ${nextStatus.toUpperCase()}`);
        onSubscriptionsChanged?.();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification(err.error || 'Failed to alter subscription status', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Network error while altering status', 'error');
    }
  };

  // Start Editing
  const startEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setEditEmail(sub.email);
    setEditProductSlug(sub.product_slug);
    setEditStatus(sub.status);
  };

  // Submit Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;
    if (!editEmail || !editEmail.includes('@')) {
      showNotification('Please enter a valid email address', 'error');
      return;
    }

    setSubmittingEdit(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${editingSub.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({
          email: editEmail.trim().toLowerCase(),
          product_slug: editProductSlug,
          status: editStatus
        })
      });

      if (res.ok) {
        const result = await res.json();
        const updated = result.subscription;
        setSubscriptions(prev => prev.map(s => s.id === editingSub.id ? (updated || { ...s, email: editEmail, product_slug: editProductSlug, status: editStatus }) : s));
        setEditingSub(null);
        showNotification('Subscription updated successfully');
        onSubscriptionsChanged?.();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification(err.error || 'Failed to update subscription', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Network error while saving changes', 'error');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Delete Subscription
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders()
        },
        credentials: 'include'
      });

      if (res.ok) {
        setSubscriptions(prev => prev.filter(s => s.id !== id));
        setDeletingId(null);
        showNotification('Subscription deleted successfully');
        onSubscriptionsChanged?.();
      } else {
        showNotification('Failed to delete subscription', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Network error while deleting subscription', 'error');
    }
  };

  // Add New Subscription
  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      showNotification('Please enter a valid email address', 'error');
      return;
    }
    if (!newProductSlug) {
      showNotification('Please select a product', 'error');
      return;
    }

    setSubmittingAdd(true);
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          product_slug: newProductSlug,
          type: 'controls',
          status: newStatus
        })
      });

      if (res.ok) {
        await fetchSubscriptions();
        setNewEmail('');
        setShowAddForm(false);
        showNotification('New control subscription added!');
        onSubscriptionsChanged?.();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification(err.error || 'Failed to create subscription', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Network error while creating subscription', 'error');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Filtered Subscriptions
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter(sub => {
      // Product Filter
      if (selectedProduct !== 'all' && sub.product_slug !== selectedProduct) {
        return false;
      }
      // Status Filter
      if (selectedStatus !== 'all' && sub.status !== selectedStatus) {
        return false;
      }
      // Search Filter
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchesEmail = sub.email.toLowerCase().includes(term);
        const matchesProduct = (sub.product_name || sub.product_slug).toLowerCase().includes(term);
        if (!matchesEmail && !matchesProduct) return false;
      }
      return true;
    });
  }, [subscriptions, selectedProduct, selectedStatus, search]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = subscriptions.length;
    const active = subscriptions.filter(s => s.status === 'active').length;
    const paused = subscriptions.filter(s => s.status === 'paused').length;
    const cancelled = subscriptions.filter(s => s.status === 'cancelled').length;
    return { total, active, paused, cancelled };
  }, [subscriptions]);

  // Copy Active Emails
  const handleCopyEmails = () => {
    const activeEmails = filteredSubscriptions
      .filter(s => s.status === 'active')
      .map(s => s.email);
    
    if (activeEmails.length === 0) {
      showNotification('No active subscriber emails to copy', 'error');
      return;
    }

    navigator.clipboard.writeText(activeEmails.join(', '));
    setCopied(true);
    showNotification(`Copied ${activeEmails.length} active email address${activeEmails.length === 1 ? '' : 'es'} to clipboard!`);
    setTimeout(() => setCopied(false), 2500);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredSubscriptions.length === 0) {
      showNotification('No subscriptions to export', 'error');
      return;
    }

    const headers = ['ID', 'Email', 'Product Slug', 'Product Name', 'Status', 'Type', 'Subscribed At'];
    const rows = filteredSubscriptions.map(s => {
      const prod = products.find(p => p.slug === s.product_slug);
      return [
        s.id,
        `"${s.email}"`,
        `"${s.product_slug}"`,
        `"${prod?.name || s.product_name || s.product_slug}"`,
        s.status,
        s.type,
        `"${s.created_at}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `control_subscriptions_${selectedProduct}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Exported subscriptions CSV successfully');
  };

  return (
    <div className={`space-y-6 ${compact ? '' : 'p-6 bg-white rounded-2xl border border-slate-200 shadow-sm'}`}>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg z-[110] flex items-center gap-2 shadow-lg border animate-in slide-in-from-top-2 duration-200 ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header & Metric Cards */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Control Subscriptions</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Manage and alter notification subscriptions for security and compliance controls updates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchSubscriptions}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh subscriptions list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyEmails}
              className="flex items-center gap-1.5 text-xs"
              title="Copy active emails to clipboard"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied!' : 'Copy Emails'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-xs"
              title="Export as CSV file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </Button>

            <Button
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Subscriber</span>
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Subscribers</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{stats.total}</div>
          </div>
          <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
            </span>
            <div className="text-xl font-bold text-emerald-800 mt-0.5">{stats.active}</div>
          </div>
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Paused
            </span>
            <div className="text-xl font-bold text-amber-800 mt-0.5">{stats.paused}</div>
          </div>
          <div className="bg-slate-100/70 border border-slate-200/80 rounded-xl p-3">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Inactive / Cancelled
            </span>
            <div className="text-xl font-bold text-slate-700 mt-0.5">{stats.cancelled}</div>
          </div>
        </div>
      </div>

      {/* Add New Subscriber Form */}
      {showAddForm && (
        <form onSubmit={handleAddSubscription} className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              Add Control Subscriber
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subscriber Email</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="compliance-officer@company.com"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Product Assignment</label>
              <select
                value={newProductSlug}
                onChange={e => setNewProductSlug(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {products.map(p => (
                  <option key={p.slug} value={p.slug}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value as 'active' | 'paused')}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="active">Active (Receiving Updates)</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submittingAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
              {submittingAdd ? 'Saving...' : 'Save Subscriber'}
            </Button>
          </div>
        </form>
      )}

      {/* Edit Subscriber Modal / Drawer */}
      {editingSub && (
        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
              <Edit2 className="w-4 h-4 text-amber-700" />
              Alter Subscription #{editingSub.id}
            </h3>
            <button
              type="button"
              onClick={() => setEditingSub(null)}
              className="text-amber-700 hover:text-amber-950"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alter Email Address</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alter Product</label>
                <select
                  value={editProductSlug}
                  onChange={e => setEditProductSlug(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {products.map(p => (
                    <option key={p.slug} value={p.slug}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alter Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="active">Active (Receiving notifications)</option>
                  <option value="paused">Paused (Temporarily disabled)</option>
                  <option value="cancelled">Cancelled (Unsubscribed)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingSub(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submittingEdit} className="bg-amber-700 hover:bg-amber-800 text-white">
                {submittingEdit ? 'Saving...' : 'Apply Alterations'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search subscriber email or product..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Product Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-500 hidden md:inline">Product:</span>
            <select
              value={selectedProduct}
              onChange={e => setSelectedProduct(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Products ({subscriptions.length})</option>
              {products.map(p => {
                const count = subscriptions.filter(s => s.product_slug === p.slug).length;
                return (
                  <option key={p.slug} value={p.slug}>
                    {p.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setSelectedStatus('all')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                selectedStatus === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('active')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                selectedStatus === 'active' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('paused')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                selectedStatus === 'paused' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-amber-700'
              }`}
            >
              Paused
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('cancelled')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                selectedStatus === 'cancelled' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cancelled
            </button>
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
            <tr>
              <th className="py-3 px-4">Subscriber</th>
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-4">Status &amp; Alteration</th>
              <th className="py-3 px-4 hidden md:table-cell">Subscribed Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                  Loading subscriptions...
                </td>
              </tr>
            ) : filteredSubscriptions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500">
                  <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-medium text-slate-700">No subscriptions found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {search || selectedProduct !== 'all' || selectedStatus !== 'all'
                      ? 'Try adjusting your filters or search query.'
                      : 'Add a new subscriber using the button above.'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredSubscriptions.map(sub => {
                const prod = products.find(p => p.slug === sub.product_slug);
                const prodName = prod?.name || sub.product_name || sub.product_slug;
                const prodColor = prod?.color || sub.product_color || '#3b82f6';

                return (
                  <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Subscriber Email */}
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-900 break-all">{sub.email}</span>
                      </div>
                    </td>

                    {/* Product */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: prodColor }} 
                        />
                        <span className="font-medium text-slate-800 text-xs sm:text-sm">
                          {prodName}
                        </span>
                      </div>
                    </td>

                    {/* Status & Fast Alteration Selector */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <select
                          value={sub.status}
                          onChange={e => handleAlterStatus(sub.id, e.target.value as any)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all ${
                            sub.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 focus:ring-emerald-500'
                              : sub.status === 'paused'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 focus:ring-amber-500'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 focus:ring-slate-400'
                          }`}
                          title="Click to alter status"
                        >
                          <option value="active">Active (Receiving)</option>
                          <option value="paused">Paused</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </td>

                    {/* Subscribed Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-500 hidden md:table-cell">
                      {sub.created_at ? new Date(sub.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }) : '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(sub)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          title="Alter email, product, or full details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {deletingId === sub.id ? (
                          <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-md border border-rose-200 animate-in fade-in duration-150">
                            <span className="text-[10px] text-rose-700 font-bold px-1">Delete?</span>
                            <button
                              type="button"
                              onClick={() => handleDelete(sub.id)}
                              className="text-xs bg-rose-600 text-white px-2 py-0.5 rounded font-bold hover:bg-rose-700"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(null)}
                              className="text-xs text-slate-500 hover:text-slate-700 px-1 font-bold"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingId(sub.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Delete subscription"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 pt-2">
        <div>
          Showing <span className="font-bold text-slate-800">{filteredSubscriptions.length}</span> of{' '}
          <span className="font-bold text-slate-800">{subscriptions.length}</span> total subscriptions
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active receives updates
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Paused suspended
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span> Cancelled archived
          </span>
        </div>
      </div>
    </div>
  );
}
