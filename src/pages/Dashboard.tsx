import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ShieldCheck, FileText, Lock, ExternalLink, Edit2, Check, X, Plus, Trash2, AlertCircle, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { useAuth } from '../contexts/AuthContext';
import { useRequestAccess } from '../contexts/RequestAccessContext';
import { useCountry } from '../hooks/useCountry';
import { COUNTRIES } from '../constants';
import { setLastSelectedProduct } from '../utils/productSelection';
import { fetchPublicProducts, fetchJson } from '../utils/api';

type Product = {
  slug: string;
  name: string;
  category: string;
  color: string;
  status_url: string;
  countries?: string[];
};

type Document = {
  id: number | string;
  name: string;
  slug: string;
  product_name?: string;
  type: string;
  category: string;
  requires_nda?: boolean | number;
  soa_available?: boolean;
  url?: string;
  description?: string;
  products: string[];
  source?: string;
};

export function Dashboard() {
  const { user, getAuthHeaders, siteSettings } = useAuth();
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);
  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allCertifications, setAllCertifications] = useState<any[]>([]);
  const [displayCertifications, setDisplayCertifications] = useState<any[]>([]);
  const [settings, setSettings] = useState({
    welcome_message: 'Insights into security, compliance, and policies.',
    important_notification: '',
    notification_global: true,
    notification_countries: [] as string[],
    pinned_documents: {} as Record<string, string[]>,
    show_status_page_link: true
  });
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState(settings);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState({ slug: '', name: '', category: '', status_url: '', color: '#1F79C3', countries: [] as string[] });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const country = useCountry();
  const [editingRegion, setEditingRegion] = useState('all');
  const [editingDocProduct, setEditingDocProduct] = useState('all');
  const { openRequestAccess } = useRequestAccess();

  const canEdit = user?.role === 'admin' || user?.role === 'moderator';

  const trackMetric = async (event_type: string, product_slug: string, item_name?: string) => {
    try {
      await fetch('/api/public/metrics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type, product_slug, item_name, user_email: user?.username || user?.email })
      });
    } catch (err) {
      console.error('Failed to track metric', err);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCountry = country === 'all' || !p.countries || p.countries.length === 0 || p.countries.includes(country);
    return matchesCountry;
  });

  const fetchSettings = () => {
    fetchJson('/api/public/dashboard-settings')
      .then(data => {
        if (!data) return;
        const globalVal = data.notification_global !== undefined 
          ? (data.notification_global === true || data.notification_global === 'true' || data.notification_global === 1)
          : true;
        let pDocs = data.pinned_documents || {};
        if (Array.isArray(pDocs)) pDocs = { all: pDocs };
        
        let pControls = data.pinned_controls || {};
        if (Array.isArray(pControls)) pControls = { all: pControls };

        const s = {
          welcome_message: data.welcome_message || 'Insights into security, compliance, and policies.',
          important_notification: data.important_notification || '',
          notification_global: globalVal,
          notification_countries: Array.isArray(data.notification_countries) 
            ? data.notification_countries 
            : (typeof data.notification_countries === 'string' ? JSON.parse(data.notification_countries) : []),
          pinned_documents: pDocs,
          pinned_controls: pControls,
          show_status_page_link: data.show_status_page_link === undefined ? true : (data.show_status_page_link === true || data.show_status_page_link === 'true')
        };
        setSettings(s);
        setSettingsForm(s);
      })
      .catch(err => console.warn('Could not fetch settings:', err));
  };

  const fetchDocuments = () => {
    fetchJson<any[]>('/api/public/dashboard-documents')
      .then(data => {
        if (Array.isArray(data)) setAllDocs(data);
      })
      .catch(err => console.warn('Could not fetch dashboard documents:', err));
  };

  const fetchProducts = () => {
    fetchPublicProducts().then(data => {
      if (Array.isArray(data)) setProducts(data);
    });
  };

  const fetchCertifications = () => {
    fetchJson<any[]>('/api/public/all-certifications')
      .then(data => {
        if (Array.isArray(data)) setAllCertifications(data);
      })
      .catch(err => console.warn('Could not fetch certifications:', err));
  };

  useEffect(() => {
    fetchSettings();
    fetchProducts();
    fetchCertifications();
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (allDocs.length > 0) {
      const filteredDocs = allDocs.filter(d => {
        if (!d.products || d.products.length === 0) {
          return true;
        }
        return d.products.some(slug => {
          const p = products.find(prod => prod.slug === slug);
          const matchesCountry = country === 'all' || !p?.countries || p.countries.length === 0 || p.countries.includes(country);
          return matchesCountry;
        });
      });

      const regionDocs = settings.pinned_documents?.[country];
      const pinnedDocsForRegion = (Array.isArray(regionDocs) && regionDocs.length > 0)
        ? regionDocs
        : (settings.pinned_documents?.['all'] || []);

      if (pinnedDocsForRegion.length > 0) {
        const pinned = pinnedDocsForRegion
          .map(slug => filteredDocs.find(d => d.slug === slug) || allDocs.find(d => d.slug === slug))
          .filter(Boolean) as Document[];
        setRecentDocs(pinned.length > 0 ? pinned : filteredDocs.slice(0, 4));
      } else {
        setRecentDocs(filteredDocs.slice(0, 4));
      }
    } else {
      setRecentDocs([]);
    }
  }, [allDocs, settings.pinned_documents, country, products]);

  useEffect(() => {
    if (allCertifications.length > 0) {
      const filtered = allCertifications.filter(c => {
        const p = products.find(prod => prod.slug === c.product_slug);
        const matchesCountry = country === 'all' || !p?.countries || p.countries.length === 0 || p.countries.includes(country);
        return matchesCountry;
      });
      setDisplayCertifications(filtered.slice(0, 4));
    } else {
      setDisplayCertifications([]);
    }
  }, [allCertifications, country, products]);

  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/admin/dashboard-settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(settingsForm)
      });
      
      if (res.ok) {
        setSettings(settingsForm);
        setIsEditingSettings(false);
        setToast({ message: 'Dashboard settings updated successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json().catch(() => ({ error: 'Failed to update settings' }));
        setToast({ message: data.error || 'Failed to update settings', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err: any) {
      console.error('Failed to update settings', err);
      setToast({ message: 'Error: ' + err.message, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleEditClick = (product: Product) => {
    setEditForm({
      slug: product.slug,
      name: product.name,
      category: product.category,
      status_url: product.status_url,
      color: product.color,
      countries: product.countries || []
    });
    setEditingProduct(product);
    setIsAdding(false);
  };

  const handleAddClick = () => {
    setEditForm({ slug: '', name: '', category: '', status_url: '', color: '#1F79C3', countries: [] });
    setEditingProduct(null);
    setIsAdding(true);
  };

  const handleSave = async () => {
    try {
      if (!editForm.slug) {
        setToast({ message: 'Slug is required', type: 'error' });
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const isNew = isAdding;
      const url = isNew ? '/api/admin/products' : `/api/admin/products/${encodeURIComponent(editForm.slug)}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({
          slug: editForm.slug,
          name: editForm.name,
          category: editForm.category,
          url: editForm.status_url,
          color: editForm.color,
          countries: editForm.countries
        })
      });
      
      if (res.ok) {
        fetchProducts();
        setEditingProduct(null);
        setIsAdding(false);
        setToast({ 
          message: isNew ? 'Product added successfully!' : 'Product updated successfully!', 
          type: 'success' 
        });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json().catch(() => ({ error: 'Invalid server response' }));
        setToast({ message: data.error || 'Failed to save product', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err: any) {
      console.error('Failed to save product', err);
      setToast({ message: 'Error: ' + err.message, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDelete = async (slug: string) => {
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        fetchProducts();
        setToast({ message: 'Product deleted successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json().catch(() => ({ error: 'Delete failed' }));
        setToast({ message: data.error || 'Failed to delete product', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error('Failed to delete product', err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded z-[100] flex items-center gap-2 shadow-md border animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      <ConfirmationModal 
        isOpen={!!deleteConfirm}
        title="Delete Product"
        message={`Are you sure you want to delete "${products.find(p => p.slug === deleteConfirm)?.name}"? This action cannot be undone.`}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
        confirmText="Delete"
        variant="danger"
      />

      {(editingProduct || isAdding) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">{isAdding ? 'Add New Product' : 'Edit Product Details'}</h3>
              <button onClick={() => { setEditingProduct(null); setIsAdding(false); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {isAdding && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slug (Unique ID)</label>
                  <input 
                    type="text" 
                    value={editForm.slug}
                    onChange={e => setEditForm({...editForm, slug: e.target.value})}
                    placeholder="e.g. my-product"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input 
                  type="text" 
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Topic / Category</label>
                <input 
                  type="text" 
                  value={editForm.category}
                  onChange={e => setEditForm({...editForm, category: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Status Page URL</label>
                  <span className="text-xs text-slate-400">Optional</span>
                </div>
                <input 
                  type="url" 
                  value={editForm.status_url}
                  onChange={e => setEditForm({...editForm, status_url: e.target.value})}
                  placeholder="https://status.yourproduct.com"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty if this product does not have an external status page. Only products with a filled-in URL will display a "Status Page" link on the dashboard overview.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Color (Hex)</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={editForm.color}
                    onChange={e => setEditForm({...editForm, color: e.target.value})}
                    className="h-9 w-9 p-1 border border-slate-300 rounded-md"
                  />
                  <input 
                    type="text" 
                    value={editForm.color}
                    onChange={e => setEditForm({...editForm, color: e.target.value})}
                    className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Applicable Countries</label>
                <div className="flex flex-wrap gap-2">
                  {COUNTRIES.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        const newCountries = editForm.countries.includes(c.code)
                          ? editForm.countries.filter(code => code !== c.code)
                          : [...editForm.countries, c.code];
                        setEditForm({...editForm, countries: newCountries});
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${
                        editForm.countries.includes(c.code)
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {c.flag} {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button 
                onClick={() => { setEditingProduct(null); setIsAdding(false); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Trust Center Dashboard</h1>
          <p className="text-slate-700 mt-1 font-medium">{settings.welcome_message}</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSettingsForm(settings); setIsEditingSettings(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium whitespace-nowrap"
            >
              <Edit2 className="w-4 h-4" />
              Edit Dashboard
            </button>
          </div>
        )}
      </div>

      {isEditingSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">Edit Dashboard Settings</h3>
              <button onClick={() => setIsEditingSettings(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Welcome Message</label>
                <textarea 
                  value={settingsForm.welcome_message}
                  onChange={e => setSettingsForm({...settingsForm, welcome_message: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Important Notification</label>
                <textarea 
                  value={settingsForm.important_notification || ''}
                  onChange={e => setSettingsForm({...settingsForm, important_notification: e.target.value})}
                  placeholder="Enter a notification message to display prominently..."
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              {settingsForm.important_notification && settingsForm.important_notification.trim() !== '' && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-750">Regional Targeting</span>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settingsForm.notification_global}
                        onChange={e => setSettingsForm({
                          ...settingsForm,
                          notification_global: e.target.checked,
                          notification_countries: e.target.checked ? [] : settingsForm.notification_countries
                        })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      Global (All regions)
                    </label>
                  </div>
                  
                  {!settingsForm.notification_global && (
                    <div className="pt-2.5 border-t border-slate-200">
                      <p className="text-xs text-slate-500 mb-2 font-medium">Select countries to display this notification:</p>
                      <div className="flex flex-wrap gap-2">
                        {COUNTRIES.map(c => {
                          const isChecked = settingsForm.notification_countries?.includes(c.code);
                          return (
                            <label
                              key={c.code}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-medium transition-all select-none ${
                                isChecked
                                  ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  const list = settingsForm.notification_countries || [];
                                  const updated = e.target.checked
                                    ? [...list, c.code]
                                    : list.filter(code => code !== c.code);
                                  setSettingsForm({
                                    ...settingsForm,
                                    notification_countries: updated
                                  });
                                }}
                                className="sr-only"
                              />
                              <span>{c.flag}</span>
                              <span>{c.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <input 
                    type="checkbox"
                    id="dashboard_show_status_page_link"
                    checked={settingsForm.show_status_page_link ?? true}
                    onChange={e => setSettingsForm({ ...settingsForm, show_status_page_link: e.target.checked })}
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="dashboard_show_status_page_link" className="block text-sm font-semibold text-slate-800 cursor-pointer">
                      Show Status Page links on product cards
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      When enabled, only products with an active Status Page URL will display a link on the dashboard. Products without a status page link remain clean with no broken link.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="flex flex-wrap gap-4 mb-4 justify-between items-end">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Editing Dashboard for Region</label>
                    <select
                      value={editingRegion}
                      onChange={(e) => setEditingRegion(e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded text-sm min-w-[200px]"
                    >
                      <option value="all">Global (Default)</option>
                      {COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Filter Applicable Products</label>
                    <select
                      value={editingDocProduct}
                      onChange={(e) => setEditingDocProduct(e.target.value)}
                      className="px-3 py-1.5 border border-slate-300 rounded text-sm min-w-[200px]"
                    >
                      <option value="all">All Products</option>
                      {products.map(p => (
                        <option key={p.slug} value={p.slug}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Pinned Documents for {editingRegion === 'all' ? 'Global' : COUNTRIES.find(c => c.code === editingRegion)?.name}
                      </label>
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {(settingsForm.pinned_documents?.[editingRegion] || []).length} pinned
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      Select documents from across the system (Certifications, Reports, Policies, Legal, DPAs) to feature on the Dashboard Overview for all visitors, including users who are not logged in.
                    </p>
                    <div className="border border-slate-200 rounded-md max-h-60 overflow-y-auto p-2 space-y-1">
                      {allDocs.filter(doc => editingDocProduct === 'all' || doc.products?.includes(editingDocProduct)).map(doc => {
                        const prodLabel = doc.product_name || (doc.products || []).map(s => products.find(p => p.slug === s)?.name || s).filter(Boolean).join(', ');
                        const isChecked = (settingsForm.pinned_documents?.[editingRegion] || []).includes(doc.slug);
                        return (
                          <label key={doc.slug} className={`flex items-center justify-between gap-2 p-2 rounded cursor-pointer transition-colors ${isChecked ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-slate-50'}`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={(e) => {
                                  const list = settingsForm.pinned_documents?.[editingRegion] || [];
                                  const newPinned = e.target.checked 
                                    ? [...list, doc.slug]
                                    : list.filter(s => s !== doc.slug);
                                  setSettingsForm({
                                    ...settingsForm, 
                                    pinned_documents: { ...settingsForm.pinned_documents, [editingRegion]: newPinned }
                                  });
                                }}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                              />
                              <div className="truncate">
                                <span className="text-sm font-medium text-slate-800">{doc.name}</span>
                                {prodLabel && (
                                  <span className="text-xs text-slate-500 ml-1.5">• {prodLabel}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                              {doc.type}
                            </span>
                          </label>
                        );
                      })}
                      {allDocs.filter(doc => editingDocProduct === 'all' || doc.products?.includes(editingDocProduct)).length === 0 && <p className="text-sm text-slate-500 p-2">No documents available for this product.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={() => setIsEditingSettings(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveSettings}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Save Dashboard Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {settings.important_notification && settings.important_notification.trim() !== '' && (
        settings.notification_global || 
        (country !== 'all' && settings.notification_countries?.includes(country)) ||
        (country === 'all' && settings.notification_countries?.length > 0)
      ) && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 mb-6 shadow-sm flex gap-3">
          <div className="shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h4 className="font-semibold text-red-900">Important Update</h4>
              {!settings.notification_global && (
                <div className="flex items-center gap-1">
                  {settings.notification_countries?.map(code => {
                    const cObj = COUNTRIES.find(c => c.code === code);
                    return cObj ? (
                      <span key={code} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-150 text-red-700 border border-red-200" title={`Applicable in ${cObj.name}`}>
                        {cObj.flag} {cObj.code.toUpperCase()}
                      </span>
                    ) : null;
                  })}
                </div>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{settings.important_notification}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Pinned Documents */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              {((settings.pinned_documents?.[country]?.length || 0) > 0 || (settings.pinned_documents?.['all']?.length || 0) > 0)
                ? 'Pinned Documents'
                : 'Featured Documents'}
            </CardTitle>
            {canEdit && (
              <button
                onClick={() => {
                  setSettingsForm(settings);
                  setIsEditingSettings(true);
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Pin Documents
              </button>
            )}
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="divide-y divide-slate-100">
              {recentDocs.length > 0 ? (
                recentDocs.map((doc) => {
                  const productNames = doc.product_name || (doc.products || [])
                    .map(slug => products.find(p => p.slug === slug)?.name || slug)
                    .filter(Boolean)
                    .join(', ');
                  const isNdaRequired = doc.requires_nda === 1 || doc.requires_nda === true;

                  return (
                    <div key={doc.slug} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-slate-900">{doc.name}</h4>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {doc.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 flex-wrap">
                          {productNames && (
                            <span className="font-medium text-slate-700">{productNames}</span>
                          )}
                          {doc.description && (
                            <>
                              {productNames && <span className="text-slate-300">•</span>}
                              <span className="text-slate-500 line-clamp-1">{doc.description}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                        {isNdaRequired || !doc.url ? (
                          <button
                            onClick={() => {
                              trackMetric('document_request', doc.products?.[0] || 'general', doc.name);
                              openRequestAccess(doc.name, doc.type, doc.products?.[0]);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            Request Access
                          </button>
                        ) : (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => trackMetric('document_download', doc.products?.[0] || 'general', doc.name)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors whitespace-nowrap"
                          >
                            View Document
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-600 italic font-medium">
                  No documents found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Certifications and Reports */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Certifications &amp; Reports
            </CardTitle>
            <Link 
              to="/certifications"
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              View All
            </Link>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <div className="divide-y divide-slate-100">
              {displayCertifications.length > 0 ? (
                displayCertifications.map((cert, idx) => (
                  <div key={`${cert.product_slug}-${cert.id}-${idx}`} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-900">{cert.name}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          cert.type === 'report' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {cert.type === 'report' ? 'Report' : 'Certificate'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{cert.product_name}</p>
                    </div>
                    <div className="shrink-0">
                      {cert.certificate_url && (
                        <a
                          href={cert.certificate_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                        >
                          View
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-600 italic font-medium">
                  No certifications found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Overview */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-slate-900">Products</h3>
          {canEdit && (
            <button 
              onClick={handleAddClick}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <div key={product.slug} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between hover:shadow-sm transition-shadow relative group">
                {canEdit && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                    <button 
                      onClick={() => handleEditClick(product)}
                      className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-blue-600 hover:border-blue-200 shadow-sm"
                      title="Edit Product"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setDeleteConfirm(product.slug)}
                      className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-red-600 hover:border-red-200 shadow-sm"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: product.color }}
                      />
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{product.category}</span>
                    </div>
                    {settings.show_status_page_link && product.status_url && product.status_url.trim() !== '' && (
                      <a 
                        href={product.status_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 text-right"
                      >
                        Status Page <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    )}
                  </div>
                  <h4 className="font-semibold text-slate-900 pr-6 text-base">
                    <Link
                      to={`/security-features/${product.slug}`}
                      onClick={() => setLastSelectedProduct(product.slug)}
                      className="hover:text-blue-600 transition-colors inline-flex items-center gap-1 group/pname"
                      title={`View ${product.name} Security Features`}
                    >
                      <span className="hover:underline">{product.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-blue-500 opacity-0 group-hover/pname:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  </h4>
                  {product.countries && product.countries.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {product.countries.map((c: string) => {
                        const countryObj = COUNTRIES.find(country => country.code === c);
                        return countryObj ? (
                          <span key={c} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200" title={countryObj.name}>
                            {countryObj.flag} {countryObj.code.toUpperCase()}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              {products.length === 0 ? "No products found." : "No products match your search or filter."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
