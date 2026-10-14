import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { BjornLogo } from '../components/BjornLogo';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { AnalyticsPanel } from '../components/AnalyticsPanel';
import { ActivityLog } from '../components/ActivityLog';
import { DocumentWatermarkManager } from '../components/DocumentWatermarkManager';
import { setLastSelectedProduct } from '../utils/productSelection';
import { 
  Check, 
  AlertCircle, 
  Edit2, 
  Trash2, 
  Plus, 
  ExternalLink, 
  X, 
  Globe, 
  History, 
  Calendar, 
  User, 
  Eye, 
  RotateCcw, 
  Clock, 
  CheckCircle2, 
  Search, 
  ArrowLeftRight, 
  FileText, 
  ChevronRight, 
  Stamp, 
  BarChart3, 
  Users, 
  Palette, 
  Package, 
  ChevronDown, 
  ShieldCheck,
  SlidersHorizontal,
  Bell
} from 'lucide-react';
import { ControlSubscriptionsManager } from '../components/subscriptions/ControlSubscriptionsManager';
import { COUNTRIES } from '../constants';

export type NdaVersion = {
  id: number;
  version: string;
  content: string;
  nda_url: string;
  change_summary: string;
  created_by: string;
  effective_date: string;
  is_current: number;
  created_at: string;
};

interface AccordionSectionProps {
  id: string;
  isOpen: boolean;
  onToggle: () => void;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

function AccordionSection({
  id,
  isOpen,
  onToggle,
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  badge,
  children
}: AccordionSectionProps) {
  return (
    <div 
      id={`section-${id}`} 
      className={`bg-white rounded-xl border transition-all duration-200 shadow-2xs scroll-mt-6 ${
        isOpen ? 'border-slate-300 ring-1 ring-slate-200/80 shadow-xs' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full p-4.5 sm:p-5 text-left flex items-center justify-between gap-4 transition-colors rounded-xl select-none cursor-pointer ${
          isOpen ? 'bg-slate-50/80 border-b border-slate-200/80 rounded-b-none' : 'hover:bg-slate-50/60'
        }`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-2xs`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">{title}</h2>
              {badge}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xl">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-slate-400 hidden sm:inline">
            {isOpen ? 'Collapse' : 'Expand'}
          </span>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 bg-white border border-slate-200/70 transition-transform duration-200 ${
            isOpen ? 'rotate-180 bg-slate-100 text-slate-800' : ''
          }`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="p-5 sm:p-6 animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const { user, publicPages, refreshPublicPages, getAuthHeaders, siteSettings, refreshSiteSettings } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);

  // Accordion Sections State
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'watermark-hub': true,      // Open by default for immediate document fulfillment
    'activity-log': false,
    'analytics': false,
    'user-management': false,
    'branding': false,
    'product-management': false,
    'public-pages': false,
    'subscriptions': false
  });

  const toggleSection = (sectionKey: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const expandAll = () => {
    setOpenSections({
      'watermark-hub': true,
      'activity-log': true,
      'analytics': true,
      'user-management': true,
      'branding': true,
      'product-management': true,
      'public-pages': true,
      'subscriptions': true
    });
  };

  const collapseAll = () => {
    setOpenSections({
      'watermark-hub': false,
      'activity-log': false,
      'analytics': false,
      'user-management': false,
      'branding': false,
      'product-management': false,
      'public-pages': false,
      'subscriptions': false
    });
  };

  const openAndScrollTo = (sectionKey: string) => {
    setOpenSections(prev => ({ ...prev, [sectionKey]: true }));
    setTimeout(() => {
      const el = document.getElementById(`section-${sectionKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  // Site Branding states
  const [brandingForm, setBrandingForm] = useState({
    site_logo: siteSettings.site_logo,
    site_favicon: siteSettings.site_favicon || '',
    site_name: siteSettings.site_name,
    header_text: siteSettings.header_text,
    mailto_certifications: siteSettings.mailto_certifications,
    mailto_policies: siteSettings.mailto_policies,
    mailto_legal: siteSettings.mailto_legal,
    privacy_notice: siteSettings.privacy_notice,
    cookie_notice: siteSettings.cookie_notice,
    nda_notice: siteSettings.nda_notice || '',
    nda_url: siteSettings.nda_url || '',
    show_status_page_link: siteSettings.show_status_page_link ?? true,
    top_bar_links: siteSettings.top_bar_links || []
  });
  const [uploading, setUploading] = useState(false);

  // Product Management states
  const [products, setProducts] = useState<any[]>([]);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [productForm, setProductForm] = useState({ slug: '', name: '', category: '', status_url: '', color: '#1F79C3', countries: [] as string[] });
  const [deleteProductConfirm, setDeleteProductConfirm] = useState<string | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productCountryFilter, setProductCountryFilter] = useState<string>('all');
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>('all');

  // NDA Version History states
  const [ndaVersions, setNdaVersions] = useState<NdaVersion[]>([]);
  const [loadingNdaVersions, setLoadingNdaVersions] = useState(false);
  const [isNdaHistoryOpen, setIsNdaHistoryOpen] = useState(false);
  const [selectedVersionForView, setSelectedVersionForView] = useState<NdaVersion | null>(null);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [restoreConfirmVersion, setRestoreConfirmVersion] = useState<NdaVersion | null>(null);
  const [deleteVersionConfirm, setDeleteVersionConfirm] = useState<NdaVersion | null>(null);
  const [versionSearchQuery, setVersionSearchQuery] = useState('');
  const [viewTab, setViewTab] = useState<'rendered' | 'compare'>('rendered');

  const [newVersionData, setNewVersionData] = useState({
    version: '',
    effective_date: new Date().toISOString().split('T')[0],
    change_summary: '',
    content: '',
    nda_url: '',
    set_as_current: true
  });

  useEffect(() => {
    setBrandingForm({
      site_logo: siteSettings.site_logo,
      site_favicon: siteSettings.site_favicon || '',
      site_name: siteSettings.site_name,
      header_text: siteSettings.header_text,
      mailto_certifications: siteSettings.mailto_certifications,
      mailto_policies: siteSettings.mailto_policies,
      mailto_legal: siteSettings.mailto_legal,
      privacy_notice: siteSettings.privacy_notice,
      cookie_notice: siteSettings.cookie_notice,
      nda_notice: siteSettings.nda_notice || '',
      nda_url: siteSettings.nda_url || '',
      show_status_page_link: siteSettings.show_status_page_link ?? true,
      top_bar_links: siteSettings.top_bar_links || []
    });
  }, [siteSettings]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    setUploading(true);
    try {
      const res = await fetch('/api/admin/upload-logo', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setBrandingForm(prev => ({ ...prev, site_logo: data.url }));
        setToast({ message: 'Logo uploaded successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Upload failed', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error during upload', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('favicon', file);

    setUploading(true);
    try {
      const res = await fetch('/api/admin/upload-favicon', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setBrandingForm(prev => ({ ...prev, site_favicon: data.url }));
        setToast({ message: 'Favicon uploaded successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Upload failed', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error during upload', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/dashboard-settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(brandingForm)
      });
      if (res.ok) {
        refreshSiteSettings();
        setToast({ message: 'Site branding updated successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Failed to update branding', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const allModules = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'security-overview', label: 'Security Overview' },
    { id: 'controls', label: 'Controls' },
    { id: 'certifications', label: 'Certifications and Reports' },
    { id: 'policies', label: 'Policies' },
    { id: 'legal', label: 'Legal Documents' },
    { id: 'subprocessors', label: 'Subprocessors' },
  ];

  useEffect(() => {
    fetchUsers();
    fetchProducts();
    fetchNdaVersions();
  }, []);

  const fetchNdaVersions = async () => {
    setLoadingNdaVersions(true);
    try {
      const res = await fetch('/api/admin/nda-versions', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setNdaVersions(data);
      }
    } catch (err) {
      console.error('Failed to fetch NDA versions:', err);
    } finally {
      setLoadingNdaVersions(false);
    }
  };

  const currentNdaVersion = ndaVersions.find(v => v.is_current === 1) || (ndaVersions.length > 0 ? ndaVersions[0] : null);

  const getSuggestedNextVersion = () => {
    if (!currentNdaVersion) return '1.2.0';
    const parts = currentNdaVersion.version.replace(/^v/i, '').split('.');
    if (parts.length >= 2) {
      const major = parseInt(parts[0], 10);
      const minor = parseInt(parts[1], 10);
      if (!isNaN(minor)) {
        return `${isNaN(major) ? 1 : major}.${minor + 1}.0`;
      }
    }
    return `${currentNdaVersion.version}.1`;
  };

  const handleOpenCreateVersion = () => {
    setNewVersionData({
      version: getSuggestedNextVersion(),
      effective_date: new Date().toISOString().split('T')[0],
      change_summary: '',
      content: brandingForm.nda_notice || siteSettings.nda_notice || '',
      nda_url: brandingForm.nda_url || siteSettings.nda_url || '',
      set_as_current: true
    });
    setIsCreatingVersion(true);
  };

  const handleSaveNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionData.version.trim() || !newVersionData.content.trim()) {
      setToast({ message: 'Version number and agreement content are required', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    try {
      const res = await fetch('/api/admin/nda-versions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(newVersionData)
      });

      if (res.ok) {
        const data = await res.json();
        setNdaVersions(data.versions);
        if (newVersionData.set_as_current) {
          setBrandingForm(prev => ({
            ...prev,
            nda_notice: newVersionData.content,
            nda_url: newVersionData.nda_url
          }));
          refreshSiteSettings();
        }
        setIsCreatingVersion(false);
        setToast({ message: `NDA Version ${newVersionData.version} published successfully!`, type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json();
        setToast({ message: errData.error || 'Failed to save version', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleRestoreVersion = async (version: NdaVersion) => {
    try {
      const res = await fetch(`/api/admin/nda-versions/${version.id}/restore`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setNdaVersions(data.versions);
        setBrandingForm(prev => ({
          ...prev,
          nda_notice: version.content,
          nda_url: version.nda_url || ''
        }));
        refreshSiteSettings();
        setRestoreConfirmVersion(null);
        setSelectedVersionForView(null);
        setToast({ message: `Restored Version ${version.version} as the active NDA!`, type: 'success' });
        setTimeout(() => setToast(null), 3500);
      } else {
        const errData = await res.json();
        setToast({ message: errData.error || 'Failed to restore version', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteVersion = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/nda-versions/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setNdaVersions(data.versions);
        setDeleteVersionConfirm(null);
        setToast({ message: 'Version deleted from history', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errData = await res.json();
        setToast({ message: errData.error || 'Failed to delete version', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/public/products');
      if (res.ok) {
        setProducts(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(new Set(products.map(p => p.category))).filter(Boolean).sort();

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;
    if (!passwordRegex.test(newPassword)) {
      setToast({ 
        message: 'Password does not meet the minimum requirements.', 
        type: 'error' 
      });
      setTimeout(() => setToast(null), 4000);
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole })
      });
      if (res.ok) {
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
        setToast({ message: 'User created successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Failed to create user', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, { 
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        fetchUsers();
        setToast({ message: 'User deleted successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Failed to delete user', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleUpdatePermissions = async (id: number, allowedModules: string[], allowedProducts: string[]) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/permissions`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ allowedModules, allowedProducts })
      });
      if (res.ok) fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePublicPage = async (pageId: string, isPublic: boolean) => {
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ is_public: isPublic })
      });
      if (res.ok) refreshPublicPages();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditProductClick = (product: any) => {
    setProductForm({
      slug: product.slug,
      name: product.name,
      category: product.category,
      status_url: product.status_url,
      color: product.color,
      countries: product.countries || []
    });
    setEditingProduct(product);
    setIsAddingProduct(false);
  };

  const handleAddProductClick = () => {
    setProductForm({ slug: '', name: '', category: '', status_url: '', color: '#1F79C3', countries: [] });
    setEditingProduct(null);
    setIsAddingProduct(true);
  };

  const handleSaveProduct = async () => {
    try {
      if (!productForm.slug) {
        setToast({ message: 'Slug is required', type: 'error' });
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const isNew = isAddingProduct;
      const url = isNew ? '/api/admin/products' : `/api/admin/products/${encodeURIComponent(productForm.slug)}`;
      const method = isNew ? 'POST' : 'PUT';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({
          slug: productForm.slug,
          name: productForm.name,
          category: productForm.category,
          url: productForm.status_url,
          color: productForm.color,
          countries: productForm.countries
        })
      });
      
      if (res.ok) {
        fetchProducts();
        setEditingProduct(null);
        setIsAddingProduct(false);
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

  const handleDeleteProduct = async (slug: string) => {
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
      setDeleteProductConfirm(null);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
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
        title="Delete User"
        message={`Are you sure you want to delete this user? This action cannot be undone.`}
        onConfirm={() => deleteConfirm && handleDeleteUser(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmationModal 
        isOpen={!!deleteProductConfirm}
        title="Delete Product"
        message={`Are you sure you want to delete "${products.find(p => p.slug === deleteProductConfirm)?.name}"? This action cannot be undone.`}
        onConfirm={() => deleteProductConfirm && handleDeleteProduct(deleteProductConfirm)}
        onCancel={() => setDeleteProductConfirm(null)}
        confirmText="Delete"
        variant="danger"
      />

      {/* NDA Restore Confirmation */}
      <ConfirmationModal 
        isOpen={!!restoreConfirmVersion}
        title="Restore NDA Version"
        message={`Are you sure you want to restore Version ${restoreConfirmVersion?.version} as the active NDA? This will replace the currently published terms across the Trust Center and request flow.`}
        onConfirm={() => restoreConfirmVersion && handleRestoreVersion(restoreConfirmVersion)}
        onCancel={() => setRestoreConfirmVersion(null)}
        confirmText="Restore as Active"
        variant="primary"
      />

      {/* NDA Delete Confirmation */}
      <ConfirmationModal 
        isOpen={!!deleteVersionConfirm}
        title="Delete NDA Version"
        message={`Are you sure you want to permanently delete Version ${deleteVersionConfirm?.version} from the version history? This cannot be undone.`}
        onConfirm={() => deleteVersionConfirm && handleDeleteVersion(deleteVersionConfirm.id)}
        onCancel={() => setDeleteVersionConfirm(null)}
        confirmText="Delete Version"
        variant="danger"
      />

      {/* NDA Version History Modal */}
      {isNdaHistoryOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 sm:p-6 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                  <History className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">NDA Version History & Audit Trail</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Track legal revisions over time, inspect past agreements, and restore previous versions.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  size="sm"
                  onClick={handleOpenCreateVersion}
                  className="flex items-center gap-1.5 text-xs shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Publish New Version
                </Button>
                <button
                  type="button"
                  onClick={() => setIsNdaHistoryOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Metrics & Search Bar */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-medium">
                  Total Revisions: <strong className="text-slate-900">{ndaVersions.length}</strong>
                </span>
                {currentNdaVersion && (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-lg font-medium border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Active Version: <strong>v{currentNdaVersion.version}</strong>
                  </span>
                )}
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={versionSearchQuery}
                  onChange={(e) => setVersionSearchQuery(e.target.value)}
                  placeholder="Filter versions, notes, author..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* Version List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {loadingNdaVersions ? (
                <div className="py-12 text-center text-sm text-slate-400">Loading NDA versions...</div>
              ) : ndaVersions.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  No version history records found. Click "Publish New Version" to create one.
                </div>
              ) : (
                (() => {
                  const filtered = ndaVersions.filter(v => {
                    const q = versionSearchQuery.toLowerCase();
                    return (
                      v.version.toLowerCase().includes(q) ||
                      (v.change_summary && v.change_summary.toLowerCase().includes(q)) ||
                      (v.created_by && v.created_by.toLowerCase().includes(q)) ||
                      (v.effective_date && v.effective_date.toLowerCase().includes(q))
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-12 text-center text-sm text-slate-400">
                        No versions matching "{versionSearchQuery}"
                      </div>
                    );
                  }

                  return filtered.map((v) => {
                    const isActive = v.is_current === 1;
                    return (
                      <div
                        key={v.id}
                        className={`p-5 rounded-xl border transition-all ${
                          isActive
                            ? 'bg-emerald-50/20 border-emerald-200 ring-1 ring-emerald-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg mt-0.5 ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="text-base font-bold text-slate-900">
                                  Version {v.version}
                                </h4>
                                {isActive ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Current Active Version
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                    Archived / Previous
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  Effective: <strong className="text-slate-700">{v.effective_date || 'N/A'}</strong>
                                </span>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  Published: {new Date(v.created_at).toLocaleDateString()}
                                </span>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1">
                                  <User className="w-3.5 h-3.5 text-slate-400" />
                                  Author: {v.created_by || 'Admin'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 self-start shrink-0 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedVersionForView(v);
                                setViewTab('rendered');
                              }}
                              className="flex items-center gap-1 text-xs"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-600" /> View / Compare
                            </Button>

                            {!isActive && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setRestoreConfirmVersion(v)}
                                  className="flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-800"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" /> Restore as Active
                                </Button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteVersionConfirm(v)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete Version from History"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Changelog & Notes */}
                        <div className="mt-2 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-lg border border-slate-100 flex items-start gap-2">
                          <span className="font-semibold text-slate-700 shrink-0">Revision Notes:</span>
                          <span className="leading-relaxed">{v.change_summary || 'No revision notes provided.'}</span>
                        </div>

                        {v.nda_url && (
                          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5 text-slate-400" />
                            <span>Document Link: </span>
                            <a href={v.nda_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-md">
                              {v.nda_url}
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <div>
                <span>Total records in audit trail: <strong>{ndaVersions.length}</strong></span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNdaHistoryOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* NDA View / Compare Modal */}
      {selectedVersionForView && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-3 sm:p-6 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-lg font-bold text-slate-900">
                    NDA Version {selectedVersionForView.version}
                  </h3>
                  {selectedVersionForView.is_current === 1 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Current Active Version
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      Archived / Previous
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Effective Date: <strong>{selectedVersionForView.effective_date}</strong> • Recorded: {new Date(selectedVersionForView.created_at).toLocaleDateString()} by {selectedVersionForView.created_by}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVersionForView(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode Tabs */}
            <div className="px-6 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewTab('rendered')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    viewTab === 'rendered'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Rendered Document View
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab('compare')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                    viewTab === 'compare'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Compare Side-by-Side with Active Version
                </button>
              </div>

              {selectedVersionForView.is_current === 0 && (
                <Button
                  size="sm"
                  onClick={() => setRestoreConfirmVersion(selectedVersionForView)}
                  className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore This Version
                </Button>
              )}
            </div>

            {/* Revision Notes Header */}
            <div className="px-6 py-3 bg-amber-50/50 border-b border-amber-100 text-xs text-amber-900 flex items-start gap-2">
              <span className="font-semibold text-amber-950 shrink-0">Changelog / Notes:</span>
              <span className="leading-relaxed">{selectedVersionForView.change_summary || 'No revision notes provided for this version.'}</span>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {viewTab === 'rendered' ? (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs max-w-3xl mx-auto">
                  <article 
                    className="prose prose-slate max-w-none text-slate-800 prose-headings:font-bold prose-headings:text-slate-900 prose-p:leading-relaxed prose-li:text-slate-700 text-sm"
                    dangerouslySetInnerHTML={{ __html: selectedVersionForView.content }}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Selected Version Column */}
                  <div className="flex flex-col bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 text-xs">Version {selectedVersionForView.version}</span>
                        <span className="text-[11px] text-slate-500 ml-2">({selectedVersionForView.is_current ? 'Active' : 'Archived'})</span>
                      </div>
                      <span className="text-[11px] text-slate-500">Effective: {selectedVersionForView.effective_date}</span>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[55vh] text-xs">
                      <article 
                        className="prose prose-slate max-w-none text-xs"
                        dangerouslySetInnerHTML={{ __html: selectedVersionForView.content }}
                      />
                    </div>
                  </div>

                  {/* Current Active Version Column */}
                  <div className="flex flex-col bg-emerald-50/20 rounded-xl border border-emerald-200 overflow-hidden">
                    <div className="p-3 bg-emerald-100/70 border-b border-emerald-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-emerald-950 text-xs">Current Active Version ({currentNdaVersion?.version || '1.1.0'})</span>
                        <span className="text-[11px] text-emerald-700 ml-2 font-medium">(Live)</span>
                      </div>
                      <span className="text-[11px] text-emerald-800">Effective: {currentNdaVersion?.effective_date || '2025-01-01'}</span>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[55vh] text-xs">
                      <article 
                        className="prose prose-slate max-w-none text-xs"
                        dangerouslySetInnerHTML={{ __html: currentNdaVersion?.content || brandingForm.nda_notice }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <div className="text-xs text-slate-500">
                {selectedVersionForView.nda_url && (
                  <span>Custom URL: <strong>{selectedVersionForView.nda_url}</strong></span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedVersionForView(null)}
              >
                Close View
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Publish New Version Modal */}
      {isCreatingVersion && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-3 sm:p-6 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <form onSubmit={handleSaveNewVersion} className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Publish New NDA Version</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Save a timestamped revision snapshot in the version history.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingVersion(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Version Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={newVersionData.version}
                      onChange={(e) => setNewVersionData({ ...newVersionData, version: e.target.value })}
                      placeholder="e.g. 1.2.0"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Recommended semantic format: 1.2.0, 2.0.0
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Effective Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={newVersionData.effective_date}
                      onChange={(e) => setNewVersionData({ ...newVersionData, effective_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Summary of Changes / Revision Notes *
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={newVersionData.change_summary}
                    onChange={(e) => setNewVersionData({ ...newVersionData, change_summary: e.target.value })}
                    placeholder="e.g. Updated Section 3 on confidentiality obligations, updated dispute jurisdiction."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Custom Document Link (Optional)
                  </label>
                  <input
                    type="url"
                    value={newVersionData.nda_url}
                    onChange={(e) => setNewVersionData({ ...newVersionData, nda_url: e.target.value })}
                    placeholder="Leave empty to use standard Trust Center /nda page"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg">
                  <label className="flex items-center gap-2.5 text-xs text-blue-900 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newVersionData.set_as_current}
                      onChange={(e) => setNewVersionData({ ...newVersionData, set_as_current: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-blue-300"
                    />
                    <span>Publish immediately as the active NDA across the Trust Center</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    NDA Terms & Legal Text *
                  </label>
                  <div className="bg-white">
                    <ReactQuill
                      theme="snow"
                      value={newVersionData.content}
                      onChange={(content) => setNewVersionData({ ...newVersionData, content })}
                      className="h-48 mb-12"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreatingVersion(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                >
                  Publish Version Snapshot
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(editingProduct || isAddingProduct) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">{isAddingProduct ? 'Add New Product' : 'Edit Product Details'}</h3>
              <button onClick={() => { setEditingProduct(null); setIsAddingProduct(false); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {isAddingProduct && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slug (Unique ID)</label>
                  <input 
                    type="text" 
                    value={productForm.slug}
                    onChange={e => setProductForm({...productForm, slug: e.target.value})}
                    placeholder="e.g. my-product"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input 
                  type="text" 
                  value={productForm.name}
                  onChange={e => setProductForm({...productForm, name: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Topic / Category</label>
                <input 
                  type="text" 
                  value={productForm.category}
                  onChange={e => setProductForm({...productForm, category: e.target.value})}
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
                  value={productForm.status_url}
                  onChange={e => setProductForm({...productForm, status_url: e.target.value})}
                  placeholder="https://status.yourproduct.com"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty if this product does not have an external status page. Only products with a filled-in URL will display a "Status Page" link on the dashboard overview.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Brand Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={productForm.color}
                    onChange={e => setProductForm({...productForm, color: e.target.value})}
                    className="h-9 w-9 rounded border border-slate-300 cursor-pointer"
                  />
                  <input 
                    type="text" 
                    value={productForm.color}
                    onChange={e => setProductForm({...productForm, color: e.target.value})}
                    className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
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
                        const newCountries = productForm.countries.includes(c.code)
                          ? productForm.countries.filter(code => code !== c.code)
                          : [...productForm.countries, c.code];
                        setProductForm({...productForm, countries: newCountries});
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors ${
                        productForm.countries.includes(c.code)
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
                onClick={() => { setEditingProduct(null); setIsAddingProduct(false); }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProduct}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Dashboard Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Portal</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Unified management dashboard for document watermarking, security audit trails, telemetry, access permissions, and trust center branding.
          </p>
        </div>

        {/* Global Expand / Collapse All Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            {Object.values(openSections).filter(Boolean).length} of 7 sections open
          </span>
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={expandAll}
            className="text-xs text-slate-700 hover:text-slate-900 bg-white shadow-2xs"
          >
            Expand All
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={collapseAll}
            className="text-xs text-slate-700 hover:text-slate-900 bg-white shadow-2xs"
          >
            Collapse All
          </Button>
        </div>
      </div>

      {/* Accordion Quick-Jump Navigation Tabs */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider shrink-0 mr-1 flex items-center gap-1">
          <SlidersHorizontal className="w-3 h-3" />
          Sections:
        </span>

        <button
          type="button"
          onClick={() => openAndScrollTo('watermark-hub')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            openSections['watermark-hub'] 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Stamp className="w-3.5 h-3.5" />
          Document Watermarking
        </button>

        <button
          type="button"
          onClick={() => openAndScrollTo('activity-log')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            openSections['activity-log'] 
              ? 'bg-purple-600 text-white shadow-xs' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Security Audit Log
        </button>

        <button
          type="button"
          onClick={() => openAndScrollTo('analytics')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            openSections['analytics'] 
              ? 'bg-emerald-600 text-white shadow-xs' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Analytics Telemetry
        </button>

        <button
          type="button"
          onClick={() => openAndScrollTo('user-management')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            openSections['user-management'] 
              ? 'bg-slate-800 text-white shadow-xs' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Users &amp; Roles ({users.length})
        </button>

        <button
          type="button"
          onClick={() => openAndScrollTo('branding')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            openSections['branding'] 
              ? 'bg-amber-600 text-white shadow-xs' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          Branding &amp; NDA
        </button>

        <button
          type="button"
          onClick={() => openAndScrollTo('product-management')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            openSections['product-management'] 
              ? 'bg-cyan-700 text-white shadow-xs' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          Products ({products.length})
        </button>

        <button
          type="button"
          onClick={() => openAndScrollTo('public-pages')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            openSections['public-pages'] 
              ? 'bg-indigo-600 text-white shadow-xs' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Public Pages
        </button>

        <button
          type="button"
          onClick={() => openAndScrollTo('subscriptions')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
            openSections['subscriptions'] 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          Control Subscriptions
        </button>
      </div>

      {/* Accordion Stack Container */}
      <div className="space-y-4">
        {/* Accordion 1: Document Watermarking & Delivery Hub */}
        <AccordionSection
          id="watermark-hub"
          isOpen={openSections['watermark-hub']}
          onToggle={() => toggleSection('watermark-hub')}
          icon={Stamp}
          iconBg="bg-blue-100"
          iconColor="text-blue-700"
          title="Document Watermarking & Fulfillment Hub"
          subtitle="Associate access requests with documents and automatically generate recipient watermarked PDFs"
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              Security Stamping
            </span>
          }
        >
          <DocumentWatermarkManager />
        </AccordionSection>

        {/* Accordion 2: Security Audit Trail & Activity Log */}
        <AccordionSection
          id="activity-log"
          isOpen={openSections['activity-log']}
          onToggle={() => toggleSection('activity-log')}
          icon={ShieldCheck}
          iconBg="bg-purple-100"
          iconColor="text-purple-700"
          title="Security Audit Trail & Activity Log"
          subtitle="Track compliance events, document changes, user sessions, and access requests (SOC 2 CC5.2 / ISO 27001)"
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
              SOC 2 / ISO 27001
            </span>
          }
        >
          <ActivityLog />
        </AccordionSection>

        {/* Accordion 3: Analytics & Trust Center Metrics */}
        <AccordionSection
          id="analytics"
          isOpen={openSections['analytics']}
          onToggle={() => toggleSection('analytics')}
          icon={BarChart3}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-700"
          title="Analytics & Trust Center Metrics"
          subtitle="Real-time visitor counts, daily telemetry graphs, top visited modules, and document requests"
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Live Telemetry
            </span>
          }
        >
          <AnalyticsPanel />
        </AccordionSection>

        {/* Accordion 4: User Accounts & Role Permissions */}
        <AccordionSection
          id="user-management"
          isOpen={openSections['user-management']}
          onToggle={() => toggleSection('user-management')}
          icon={Users}
          iconBg="bg-slate-100"
          iconColor="text-slate-800"
          title="User Accounts & Role Permissions"
          subtitle="Manage administrative accounts, role levels, and granular module & product permissions"
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {users.length} {users.length === 1 ? 'User' : 'Users'}
            </span>
          }
        >
          <div className="space-y-6">
            {/* Header with "+ Add New User" toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Portal Accounts ({users.length})</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure role-based access control (Admin, Editor, Viewer) and fine-grained permissions.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddUser(!showAddUser)}
                className="flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                {showAddUser ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {showAddUser ? 'Cancel' : 'Add New User'}
              </Button>
            </div>

            {/* Create User Form */}
            {showAddUser && (
              <form onSubmit={handleCreateUser} className="p-5 bg-slate-50/80 rounded-xl border border-slate-200/90 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    Create New Account
                  </h4>
                  <span className="text-xs text-slate-500">All fields required</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="e.g. jdoe@company.com"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Initial Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 12 chars, Aa1!"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Min 12 chars with upper, digit & symbol.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Role Level *
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                    >
                      <option value="viewer">Viewer (Granular Permissions)</option>
                      <option value="editor">Editor (Content Management)</option>
                      <option value="admin">Administrator (Full Access)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/60">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddUser(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                  >
                    Create Account
                  </Button>
                </div>
              </form>
            )}

            {/* User List */}
            <div className="space-y-4">
              {users.map(u => (
                <div key={u.id} className="border border-slate-200/90 rounded-xl p-4.5 bg-white hover:border-slate-300 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold uppercase shrink-0">
                        {u.username.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                          {u.username}
                          {u.id === user?.id && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-medium px-1.5 py-0.5 rounded">
                              Current Session
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                          <span className={`inline-block font-semibold uppercase text-[11px] px-2 py-0.5 rounded-full ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : u.role === 'editor'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {u.role}
                          </span>
                          <span>•</span>
                          <span>ID #{u.id}</span>
                        </div>
                      </div>
                    </div>
                    {u.id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs w-full sm:w-auto"
                        onClick={() => setDeleteConfirm(u.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Delete User
                      </Button>
                    )}
                  </div>

                  {u.role === 'viewer' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
                      <div className="bg-slate-50/80 p-3.5 rounded-lg border border-slate-200/70">
                        <h4 className="text-xs font-semibold text-slate-900 mb-2.5 uppercase tracking-wider">
                          Allowed Modules
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {allModules.map(mod => (
                            <label key={mod.id} className="flex items-start gap-2.5 text-xs cursor-pointer group">
                              <input 
                                type="checkbox" 
                                checked={u.allowedModules?.includes(mod.id) || false}
                                onChange={(e) => {
                                  const newModules = e.target.checked 
                                    ? [...(u.allowedModules || []), mod.id]
                                    : (u.allowedModules || []).filter((m: string) => m !== mod.id);
                                  handleUpdatePermissions(u.id, newModules, u.allowedProducts || []);
                                }}
                                className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                              />
                              <span className="text-slate-600 group-hover:text-slate-900 transition-colors">{mod.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="bg-slate-50/80 p-3.5 rounded-lg border border-slate-200/70">
                        <h4 className="text-xs font-semibold text-slate-900 mb-2.5 uppercase tracking-wider">
                          Allowed Products
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {products.map(prod => (
                            <label key={prod.slug} className="flex items-start gap-2.5 text-xs cursor-pointer group">
                              <input 
                                type="checkbox" 
                                checked={u.allowedProducts?.includes(prod.slug) || false}
                                onChange={(e) => {
                                  const newProds = e.target.checked 
                                    ? [...(u.allowedProducts || []), prod.slug]
                                    : (u.allowedProducts || []).filter((p: string) => p !== prod.slug);
                                  handleUpdatePermissions(u.id, u.allowedModules || [], newProds);
                                }}
                                className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                              />
                              <span className="text-slate-600 group-hover:text-slate-900 transition-colors">{prod.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </AccordionSection>

        {/* Accordion 5: Site Branding & Compliance Configuration */}
        <AccordionSection
          id="branding"
          isOpen={openSections['branding']}
          onToggle={() => toggleSection('branding')}
          icon={Palette}
          iconBg="bg-amber-100"
          iconColor="text-amber-800"
          title="Site Branding & Compliance Configuration"
          subtitle="Manage site logo, favicon, portal colors, top bar links, and legal NDA versioning"
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              Branding &amp; Legal
            </span>
          }
        >
          <form onSubmit={handleUpdateBranding} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center bg-slate-50 overflow-hidden">
                    {brandingForm.site_logo ? (
                      <img src={brandingForm.site_logo} alt="Preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <BjornLogo className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden" 
                      id="logo-upload"
                      disabled={uploading}
                    />
                    <label 
                      htmlFor="logo-upload"
                      className={`inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {uploading ? 'Uploading...' : 'Upload New Logo'}
                    </label>
                    <p className="text-xs text-slate-500 mt-2">Recommended: Square PNG or SVG (max 2MB).</p>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Logo URL (Optional)</label>
                <input 
                  type="text" 
                  value={brandingForm.site_logo} 
                  onChange={e => setBrandingForm({ ...brandingForm, site_logo: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900" 
                  placeholder="https://example.com/logo.png" 
                />
                <p className="text-xs text-slate-500 mt-1">Or paste a direct link to an image hosted elsewhere.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Favicon (Browser Tab Icon)</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center bg-slate-50 overflow-hidden">
                    {brandingForm.site_favicon ? (
                      <img src={brandingForm.site_favicon} alt="Favicon Preview" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <Globe className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input 
                      type="file" 
                      accept=".ico,.png,.svg,.jpg,.jpeg"
                      onChange={handleFaviconUpload}
                      className="hidden" 
                      id="favicon-upload"
                      disabled={uploading}
                    />
                    <label 
                      htmlFor="favicon-upload"
                      className={`inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {uploading ? 'Uploading...' : 'Upload Favicon'}
                    </label>
                    <p className="text-xs text-slate-500 mt-2">Recommended: ICO, PNG or SVG (32x32).</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Favicon URL (Optional)</label>
                <input 
                  type="text" 
                  value={brandingForm.site_favicon} 
                  onChange={e => setBrandingForm({ ...brandingForm, site_favicon: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900" 
                  placeholder="https://example.com/favicon.ico" 
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                <input 
                  type="text" 
                  value={brandingForm.site_name} 
                  onChange={e => setBrandingForm({ ...brandingForm, site_name: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900" 
                  placeholder="Bjorn Lunden" 
                />
                <p className="text-xs text-slate-500 mt-1">The main name displayed in the header.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Header Text</label>
                <input 
                  type="text" 
                  value={brandingForm.header_text} 
                  onChange={e => setBrandingForm({ ...brandingForm, header_text: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900" 
                  placeholder="Trust Center" 
                />
                <p className="text-xs text-slate-500 mt-1">This text appears in the header next to the company name.</p>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Preview</h4>
                <div className="flex items-center gap-3 bg-white p-3 rounded border border-slate-200 shadow-sm scale-90 origin-left">
                  <div className="w-6 h-6 flex items-center justify-center">
                    {brandingForm.site_logo ? (
                      <img src={brandingForm.site_logo} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <BjornLogo className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-slate-900">{brandingForm.site_name || 'Bjorn Lunden'}</span>
                    <span className="text-[10px] text-slate-600 font-bold uppercase">{brandingForm.header_text || 'Trust Center'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Email Subscriptions (mailto)</h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Certifications Email</label>
                <input 
                  type="email" 
                  value={brandingForm.mailto_certifications} 
                  onChange={e => setBrandingForm({ ...brandingForm, mailto_certifications: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900" 
                  placeholder="security@bjornlunden.com" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Policies Email</label>
                <input 
                  type="email" 
                  value={brandingForm.mailto_policies} 
                  onChange={e => setBrandingForm({ ...brandingForm, mailto_policies: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900" 
                  placeholder="security@bjornlunden.com" 
                />
              </div>
            </div>
            
            <div className="space-y-6 pt-4 border-t border-slate-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Privacy Notice</label>
                <div className="bg-white">
                  <ReactQuill 
                    theme="snow" 
                    value={brandingForm.privacy_notice} 
                    onChange={(content) => setBrandingForm({ ...brandingForm, privacy_notice: content })} 
                    className="h-48 mb-12"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 mt-8">Cookie Notice</label>
                <div className="bg-white">
                  <ReactQuill 
                    theme="snow" 
                    value={brandingForm.cookie_notice} 
                    onChange={(content) => setBrandingForm({ ...brandingForm, cookie_notice: content })} 
                    className="h-48 mb-12"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 mt-4">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <label className="block text-sm font-semibold text-slate-900">
                        Non-Disclosure Agreement (NDA)
                      </label>
                      {currentNdaVersion && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Active: v{currentNdaVersion.version}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Required for requesting copies of documents and policies. Visitors must accept this NDA with a required opt-in, and this link is included in request emails.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsNdaHistoryOpen(true)}
                      className="flex items-center gap-1.5 text-xs text-slate-700 bg-white hover:bg-slate-50 border-slate-300 shadow-sm"
                    >
                      <History className="w-3.5 h-3.5 text-blue-600" />
                      Version History ({ndaVersions.length})
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleOpenCreateVersion}
                      className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-600" />
                      Publish New Version
                    </Button>
                    <a
                      href="/nda"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 py-1.5 px-2.5 rounded-md hover:bg-slate-100 transition-colors"
                    >
                      Preview Public NDA <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Active version contextual helper banner */}
                <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800">Current Active Terms:</span>
                    <span className="font-medium text-slate-700">Version {currentNdaVersion?.version || siteSettings.nda_version || '1.1.0'}</span>
                    <span className="text-slate-400">•</span>
                    <span>Effective: {currentNdaVersion?.effective_date || siteSettings.nda_effective_date || '2025-01-01'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNdaHistoryOpen(true)}
                    className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                  >
                    View audit trail & previous versions ({ndaVersions.length}) <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    NDA Link / Custom Document URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={brandingForm.nda_url}
                    onChange={(e) => setBrandingForm({ ...brandingForm, nda_url: e.target.value })}
                    placeholder="Leave empty to use Trust Center built-in link (/nda) or enter https://..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    If left blank, the request modal and generated emails will automatically link to the Trust Center's NDA page.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-700">
                      NDA Terms & Legal Text (Rich Text Editor)
                    </label>
                    <span className="text-[11px] text-slate-500 hidden sm:inline">
                      Saving Site Branding updates these active terms. Use "Publish New Version" to record a timestamped version snapshot.
                    </span>
                  </div>
                  <div className="bg-white">
                    <ReactQuill 
                      theme="snow" 
                      value={brandingForm.nda_notice} 
                      onChange={(content) => setBrandingForm({ ...brandingForm, nda_notice: content })} 
                      className="h-56 mb-12"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-semibold text-slate-900">Top Toolbar Links</h3>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setBrandingForm({
                    ...brandingForm, 
                    top_bar_links: [...brandingForm.top_bar_links, { id: Date.now().toString(), label: '', url: '', position: 'right', icon: 'globe' }]
                  })}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Link
                </Button>
              </div>
              <div className="space-y-4">
                {brandingForm.top_bar_links.map((link, index) => (
                  <div key={link.id} className="relative grid grid-cols-1 md:grid-cols-12 gap-4 items-start border p-5 rounded-lg border-slate-200 bg-white shadow-sm">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Label</label>
                      <input 
                        type="text" 
                        value={link.label}
                        onChange={e => {
                          const newLinks = [...brandingForm.top_bar_links];
                          newLinks[index].label = e.target.value;
                          setBrandingForm({ ...brandingForm, top_bar_links: newLinks });
                        }}
                        className="w-full px-4 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="Link Label"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">URL</label>
                      <input 
                        type="text" 
                        value={link.url}
                        onChange={e => {
                          const newLinks = [...brandingForm.top_bar_links];
                          newLinks[index].url = e.target.value;
                          setBrandingForm({ ...brandingForm, top_bar_links: newLinks });
                        }}
                        className="w-full px-4 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                        placeholder="https://"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Position</label>
                      <select
                        value={link.position}
                        onChange={e => {
                          const newLinks = [...brandingForm.top_bar_links];
                          newLinks[index].position = e.target.value as 'left' | 'right';
                          setBrandingForm({ ...brandingForm, top_bar_links: newLinks });
                        }}
                        className="w-full px-4 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                      >
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Icon</label>
                      <select
                        value={link.icon || ''}
                        onChange={e => {
                          const newLinks = [...brandingForm.top_bar_links];
                          newLinks[index].icon = e.target.value;
                          setBrandingForm({ ...brandingForm, top_bar_links: newLinks });
                        }}
                        className="w-full px-4 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                      >
                        <option value="">None</option>
                        <option value="globe">Globe</option>
                        <option value="mail">Mail</option>
                        <option value="facebook">Facebook</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="chevron-left">Chevron Left</option>
                        <option value="external-link">External Link</option>
                      </select>
                    </div>
                    <div className="md:col-span-1 flex items-end justify-end h-full pb-1">
                      <button 
                        type="button"
                        onClick={() => {
                          const newLinks = brandingForm.top_bar_links.filter((_, i) => i !== index);
                          setBrandingForm({ ...brandingForm, top_bar_links: newLinks });
                        }}
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-red-500 rounded-md transition-colors focus:outline-none"
                        title="Remove link"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
                {brandingForm.top_bar_links.length === 0 && (
                  <p className="text-sm text-slate-500 italic py-2">No top toolbar links configured.</p>
                )}
              </div>
            </div>

            {/* Status Page Links Visibility Setting */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">Status Page Links Visibility</h3>
              <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <input 
                  type="checkbox"
                  id="show_status_page_link"
                  checked={brandingForm.show_status_page_link ?? false}
                  onChange={e => setBrandingForm({ ...brandingForm, show_status_page_link: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                />
                <div>
                  <label htmlFor="show_status_page_link" className="block text-sm font-medium text-slate-800 cursor-pointer">
                    Show links to status page on product cards
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When enabled, only products configured with a valid Status URL will show a status page link. Leave unchecked to hide all status page links across dashboard overviews.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={uploading}>Save Branding Changes</Button>
          </div>
        </form>
      </AccordionSection>

      {/* Accordion 6: Product Catalog Management */}
      <AccordionSection
        id="product-management"
        isOpen={openSections['product-management']}
        onToggle={() => toggleSection('product-management')}
        icon={Package}
        iconBg="bg-cyan-100"
        iconColor="text-cyan-800"
        title="Product Catalog Management"
        subtitle="Add, edit, or configure products, country availability, categories, and live status endpoints"
        badge={
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800">
            {products.length} Products
          </span>
        }
      >
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Products &amp; Solutions ({products.length})</h3>
              <p className="text-xs text-slate-500 mt-0.5">Filter by country or category, and manage availability across regional portals.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <input
                type="text"
                placeholder="Search products..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="w-full md:w-48 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
              <select
                value={productCountryFilter}
                onChange={(e) => setProductCountryFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs bg-white"
              >
                <option value="all">All Countries</option>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code.toUpperCase()}</option>
                ))}
              </select>
              <select
                value={productCategoryFilter}
                onChange={(e) => setProductCategoryFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs bg-white"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <Button size="sm" onClick={handleAddProductClick} className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                <Plus className="w-3.5 h-3.5" />
                Add Product
              </Button>
            </div>
          </div>

          {/* Quick status page link visibility banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800">Status Page Links:</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                siteSettings.show_status_page_link
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {siteSettings.show_status_page_link ? 'Active for products with a URL' : 'Turned off globally'}
              </span>
              <span className="text-slate-500">
                ({products.filter(p => p.status_url && p.status_url.trim() !== '').length} of {products.length} products have a Status URL configured)
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                const newVal = !siteSettings.show_status_page_link;
                try {
                  const res = await fetch('/api/admin/dashboard-settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                    credentials: 'include',
                    body: JSON.stringify({ show_status_page_link: newVal })
                  });
                  if (res.ok) {
                    refreshSiteSettings();
                    setToast({ message: `Status page links ${newVal ? 'enabled' : 'disabled'}!`, type: 'success' });
                    setTimeout(() => setToast(null), 3000);
                  }
                } catch (e: any) {
                  setToast({ message: e.message, type: 'error' });
                  setTimeout(() => setToast(null), 3000);
                }
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer self-start sm:self-auto"
            >
              {siteSettings.show_status_page_link ? 'Turn off status page links' : 'Turn on status page links'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products
              .filter(p => {
                const matchesSearch = p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || 
                                      p.category.toLowerCase().includes(productSearchQuery.toLowerCase());
                const matchesCountry = productCountryFilter === 'all' || !p.countries || p.countries.length === 0 || p.countries.includes(productCountryFilter);
                const matchesCategory = productCategoryFilter === 'all' || p.category === productCategoryFilter;
                return matchesSearch && matchesCountry && matchesCategory;
              })
              .map((product) => (
              <div key={product.slug} className="bg-white border border-slate-200 rounded-xl p-4.5 flex flex-col justify-between hover:border-slate-300 transition-colors relative group">
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                  <button 
                    onClick={() => handleEditProductClick(product)}
                    className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-blue-600 hover:border-blue-200 shadow-2xs"
                    title="Edit Product"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => setDeleteProductConfirm(product.slug)}
                    className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 hover:text-red-600 hover:border-red-200 shadow-2xs"
                    title="Delete Product"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div 
                      className="w-3 h-3 rounded-full mt-1 shrink-0" 
                      style={{ backgroundColor: product.color }}
                    />
                    {siteSettings?.show_status_page_link && product.status_url && product.status_url.trim() !== '' && (
                      <div className="flex items-center gap-2">
                        <a 
                          href={product.status_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 text-right"
                        >
                          Status Page <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                  <h4 className="font-semibold text-slate-900 pr-12 text-sm">
                    <Link
                      to={`/security-overview/${product.slug}`}
                      onClick={() => setLastSelectedProduct(product.slug)}
                      className="hover:text-blue-600 hover:underline transition-colors"
                      title={`View ${product.name} Security Overview`}
                    >
                      {product.name}
                    </Link>
                  </h4>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mt-1">{product.category}</p>
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
            ))}
            {products.filter(p => {
                const matchesSearch = p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) || 
                                      p.category.toLowerCase().includes(productSearchQuery.toLowerCase());
                const matchesCountry = productCountryFilter === 'all' || !p.countries || p.countries.length === 0 || p.countries.includes(productCountryFilter);
                const matchesCategory = productCategoryFilter === 'all' || p.category === productCategoryFilter;
                return matchesSearch && matchesCountry && matchesCategory;
              }).length === 0 && (
              <div className="col-span-full p-8 text-center text-slate-500 border border-dashed border-slate-300 rounded-xl">
                {products.length === 0 ? "No products found. Add a product to get started." : "No products match your search or filter."}
              </div>
            )}
          </div>
        </div>
      </AccordionSection>

      {/* Accordion 7: Public Page Visibility */}
      <AccordionSection
        id="public-pages"
        isOpen={openSections['public-pages']}
        onToggle={() => toggleSection('public-pages')}
        icon={Globe}
        iconBg="bg-indigo-100"
        iconColor="text-indigo-800"
        title="Public Pages & Visitor Visibility"
        subtitle="Configure which core modules and product pages are publicly accessible without authentication"
        badge={
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
            {publicPages.length} Enabled
          </span>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Check the modules and products that unauthenticated visitors are allowed to view on the Trust Center.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/70">
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">Core Modules</h4>
              <div className="space-y-2.5">
                {allModules.map(mod => (
                  <label key={mod.id} className="flex items-start gap-3 text-sm cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={publicPages.includes(mod.id)}
                      onChange={(e) => togglePublicPage(mod.id, e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <span className="text-slate-700 group-hover:text-slate-900 transition-colors">{mod.label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/70">
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">Product Pages</h4>
              <div className="space-y-2.5">
                {products.map(prod => (
                  <label key={`product-${prod.slug}`} className="flex items-start gap-3 text-sm cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={publicPages.includes(`product-${prod.slug}`)}
                      onChange={(e) => togglePublicPage(`product-${prod.slug}`, e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                    <span className="text-slate-700 group-hover:text-slate-900 transition-colors">{prod.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* Accordion 8: Control Subscriptions Management */}
      <AccordionSection
        id="subscriptions"
        isOpen={openSections['subscriptions']}
        onToggle={() => toggleSection('subscriptions')}
        icon={Bell}
        iconBg="bg-blue-100"
        iconColor="text-blue-700"
        title="Control Subscriptions & Notification Lists"
        subtitle="View, alter subscriber emails, change status (active/paused/cancelled), and export controls subscriptions"
        badge={
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            Updates &amp; Alerts
          </span>
        }
      >
        <ControlSubscriptionsManager />
      </AccordionSection>
      </div>
    </div>
  );
}
