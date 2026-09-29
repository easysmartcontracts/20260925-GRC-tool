import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { FileText, ShieldAlert, ExternalLink, Server, Globe, Mail, Activity, Edit2, X, Plus, Database, Key, Lock, Shield, CheckCircle2, XCircle, Info, MapPin, Clock, Phone, Building2, Printer, Target, Users, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import { useCountry } from '../hooks/useCountry';
import { useAuth } from '../contexts/AuthContext';
import { useRequestAccess } from '../contexts/RequestAccessContext';
import { COUNTRIES } from '../constants';
import { setLastSelectedProduct } from '../utils/productSelection';

const categoryIcons: Record<string, React.ReactNode> = {
  'Hosting': <Server className="w-4 h-4" />,
  'Email Services': <Mail className="w-4 h-4" />,
  'Monitoring': <Activity className="w-4 h-4" />
};

const SECURITY_TOPICS = [
  { 
    id: 'backup', 
    title: 'Backup & Recovery', 
    icon: <Database className="w-5 h-5 text-blue-500" />,
    description: 'How we ensure your data is safe and recoverable in case of failure.'
  },
  { 
    id: 'mfa', 
    title: 'Multi-Factor Authentication', 
    icon: <Key className="w-5 h-5 text-emerald-500" />,
    description: 'Support for additional security layers during login.'
  },
  { 
    id: 'encryption', 
    title: 'Encryption', 
    icon: <Lock className="w-5 h-5 text-indigo-500" />,
    description: 'How data is protected at rest and in transit.'
  },
  { 
    id: 'sso', 
    title: 'Single Sign-On (SSO)', 
    icon: <Shield className="w-5 h-5 text-amber-500" />,
    description: 'Integration with enterprise identity providers.'
  },
  { 
    id: 'data_residency', 
    title: 'Data Residency', 
    icon: <Globe className="w-5 h-5 text-slate-500" />,
    description: 'Where your data is physically stored.'
  },
  {
    id: 'sla_uptime',
    title: 'SLA Uptime',
    icon: <Activity className="w-5 h-5 text-purple-500" />,
    description: 'Service level agreement for platform availability.'
  }
];

const LEGAL_DOC_NAMES: Record<string, string> = {
  'tc': 'Terms and Conditions',
  'privacy': 'Privacy Notice',
  'dpa': 'Data Protection Agreement (DPA)',
  'exit': 'Data Exit Strategy Addendum',
  'sla': 'Service Level Agreement (SLA)'
};

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const country = useCountry();
  const { user, getAuthHeaders, siteSettings } = useAuth();
  const { openRequestAccess } = useRequestAccess();
  const [product, setProduct] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [relatedDocs, setRelatedDocs] = useState<any[]>([]);
  const [relatedSubprocessors, setRelatedSubprocessors] = useState<any[]>([]);
  const [securityData, setSecurityData] = useState<any>(null);
  const [controls, setControls] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [inspectingSub, setInspectingSub] = useState<any | null>(null);

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
  
  // General details state
  const [generalInfo, setGeneralInfo] = useState<any>(null);
  const [isEditingGeneral, setIsEditingGeneral] = useState(false);
  const [generalForm, setGeneralForm] = useState({
    office_location: '',
    contact_info: '',
    opening_hours: ''
  });
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', category: '', status_url: '', color: '', countries: [] as string[] });
  const [isSaving, setIsSaving] = useState(false);
  const [showPrintHelper, setShowPrintHelper] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'moderator';

  const fetchData = async () => {
    if (!slug) return;
    setIsLoading(true);
    try {
      const qs = country !== 'all' ? `?country=${country}` : '';
      const [prodRes, docsRes, subsRes, secRes, ctrlRes, certRes, polRes, genRes] = await Promise.all([
        fetch('/api/public/products'),
        fetch(`/api/public/product-legal/${slug}${qs}`),
        fetch(`/api/public/product-subprocessors/${slug}${qs}`),
        fetch(`/api/public/product-security/${slug}`),
        fetch(`/api/public/product-controls/${slug}`),
        fetch(`/api/public/product-certifications/${slug}`),
        fetch(`/api/public/product-policies/${slug}${qs}`),
        fetch(`/api/public/product-general/${slug}`)
      ]);

      if (prodRes.ok) {
        const allProducts = await prodRes.json();
        const found = allProducts.find((p: any) => p.slug === slug);
        setProduct(found);
        if (found) {
          setEditForm({
            name: found.name,
            category: found.category,
            status_url: found.status_url,
            color: found.color,
            countries: found.countries || []
          });
        }
      }
      
      if (docsRes.ok) {
        setRelatedDocs(await docsRes.json());
      }
      
      if (subsRes.ok) {
        const subData = await subsRes.json();
        setRelatedSubprocessors(subData.subprocessors || []);
      }

      if (secRes.ok) {
        // Will return { error: ... } if not found, we check if there's no error
        const data = await secRes.json();
        if (data && !data.error) setSecurityData(data);
        else setSecurityData(null);
      }

      if (ctrlRes.ok) {
        setControls(await ctrlRes.json());
      }

      if (certRes.ok) {
        const certData = await certRes.json();
        setCertifications(certData.certifications || []);
      }

      if (polRes.ok) {
        setPolicies(await polRes.json());
      }

      if (genRes.ok) {
        const genData = await genRes.json();
        setGeneralInfo(genData);
        if (genData) {
          setGeneralForm({
            office_location: genData.office_location || '',
            contact_info: genData.contact_info || '',
            opening_hours: genData.opening_hours || ''
          });
        } else {
          setGeneralForm({
            office_location: '',
            contact_info: '',
            opening_hours: ''
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch product data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (slug) {
      setLastSelectedProduct(slug);
    }
    fetchData();
  }, [slug, country]);

  useEffect(() => {
    if (!isLoading && product) {
      const isPrint = new URLSearchParams(window.location.search).get('print') === 'true';
      if (isPrint) {
        const timer = setTimeout(() => {
          window.print();
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, product]);

  const handleSave = async () => {
    if (!slug) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${slug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          ...editForm,
          url: editForm.status_url // API expects 'url' for status_url
        })
      });

      if (res.ok) {
        setIsEditing(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save product');
      }
    } catch (err) {
      console.error('Error saving product:', err);
      alert('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGeneral = async () => {
    if (!slug) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/product-general/${slug}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(generalForm)
      });

      if (res.ok) {
        setIsEditingGeneral(false);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save general info');
      }
    } catch (err) {
      console.error('Error saving general info:', err);
      alert('Network error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    const printUrl = `/api/public/product-whitepaper/${slug}${country !== 'all' ? `?country=${country}` : ''}`;
    if (window.self !== window.top) {
      setShowPrintHelper(true);
    } else {
      window.open(printUrl, '_blank');
    }
  };

  if (isLoading && !product) {
    return <div className="p-8 text-center text-slate-500">Loading product details...</div>;
  }

  if (!product) {
    return <div className="p-8 text-center text-slate-500">Product not found.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Print-Only Whitepaper Header Block */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-6 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--primary)] text-blue-600 block mb-1">
              {siteSettings?.site_name || 'Bjorn Lunden'} Compliance Registry
            </span>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mt-1">{product.name}</h1>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mt-0.5">{product.category}</p>
          </div>
          <div className="flex flex-col items-end gap-2 text-right text-xs text-slate-500 font-mono">
            {siteSettings?.site_logo && (
              <img 
                src={siteSettings.site_logo} 
                alt="Logo" 
                className="max-h-12 max-w-[140px] mb-2 object-contain" 
                referrerPolicy="no-referrer" 
              />
            )}
            <div>
              <p><strong>Published:</strong> {new Date().toLocaleDateString('en-GB')}</p>
              <p><strong>Ref Code:</strong> WP-{product.slug.toUpperCase()}-026</p>
            </div>
            <span className="inline-block px-2 py-0.5 text-[10px] bg-slate-100 text-slate-800 border border-slate-300 rounded font-bold uppercase tracking-wider">
              CONFIDENTIAL & PROPRIETARY
            </span>
          </div>
        </div>
        <p className="text-slate-600 text-xs mt-4 italic leading-relaxed">
          This whitepaper serves as the official regulatory and security overview for <strong>{product.name}</strong> as provided officially by <strong>{siteSettings?.site_name || 'Bjorn Lunden'}</strong>. It catalogs key office directory contacts, organizational security controls, compliance assessments, risk management policies, and approved third-party subprocessors. All details are kept current in sync with our legal registries.
        </p>
      </div>

      {/* Standard Interactive screen Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-8 print:hidden">
        <div className="flex items-center gap-4">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-sm"
            style={{ backgroundColor: product.color }}
          >
            {product.name.charAt(0)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{product.name}</h1>
              <a 
                href={product.status_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full border border-blue-100"
              >
                View System Status <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-slate-500 font-medium uppercase tracking-wider text-sm">{product.category}</p>
            {product.countries && product.countries.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {product.countries.map((code: string) => {
                  const c = COUNTRIES.find(curr => curr.code === code);
                  if (!c) return null;
                  return (
                    <span key={code} className="inline-flex items-center gap-1.2 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-tight border border-slate-200">
                      {c.flag} {c.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow-sm w-fit group"
            title="Print overview or save as a PDF"
          >
            <Printer className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
            Print / Save PDF
          </button>

          {canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm w-fit"
            >
              <Edit2 className="w-4 h-4" />
              Edit Product
            </button>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Edit Product: {product.name}</h3>
              <button 
                onClick={() => setIsEditing(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={isSaving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <input 
                  type="text" 
                  value={editForm.category}
                  onChange={e => setEditForm({...editForm, category: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status Page URL</label>
                <input 
                  type="url" 
                  value={editForm.status_url}
                  onChange={e => setEditForm({...editForm, status_url: e.target.value})}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Brand Color</label>
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
                <label className="block text-sm font-medium text-slate-700 mb-1 font-bold">Applicable Countries</label>
                <p className="text-xs text-slate-500 mb-2">Select which countries this product is available in.</p>
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
                          ? 'bg-blue-100 text-blue-800 border border-blue-200 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {c.flag} {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Product Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit General Info Modal */}
      {isEditingGeneral && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Edit General & Office Information</h3>
              <button 
                onClick={() => setIsEditingGeneral(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-700"
                disabled={isSaving}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Office Location</label>
                <p className="text-xs text-slate-500 mb-2">Physical address, headquarters details, or office location text.</p>
                <textarea 
                  value={generalForm.office_location}
                  onChange={e => setGeneralForm({...generalForm, office_location: e.target.value})}
                  rows={3}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/45 focus:border-blue-500"
                  placeholder="e.g. Havnegata 12, 3012 Drammen, Norway"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Contact Channels</label>
                <p className="text-xs text-slate-500 mb-2">Email address, phone support lines, or other ways to reach you.</p>
                <textarea 
                  value={generalForm.contact_info}
                  onChange={e => setGeneralForm({...generalForm, contact_info: e.target.value})}
                  rows={3}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/45 focus:border-blue-500"
                  placeholder="e.g. Email: support@example.com&#10;Phone: +47 32 80 00 00"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Opening Hours</label>
                <p className="text-xs text-slate-500 mb-2">Regular business days, timezone details, or holiday availability.</p>
                <textarea 
                  value={generalForm.opening_hours}
                  onChange={e => setGeneralForm({...generalForm, opening_hours: e.target.value})}
                  rows={3}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/45 focus:border-blue-500"
                  placeholder="e.g. Mon - Fri: 08:00 - 16:00 (CET)&#10;Sat - Sun: Closed"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button 
                onClick={() => setIsEditingGeneral(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveGeneral}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save General Details'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <p className="text-sm text-slate-650 leading-relaxed">
                Because this live preview runs inside a secure, sandboxed browser iframe, standard browser print menus are blocked by your browser's security policies.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-xs text-blue-800 space-y-1.5 font-medium leading-relaxed">
                <p className="font-bold flex items-center gap-1 text-blue-900">💡 What will happen next:</p>
                <p>1. We will open the document in a clean, isolated browser tab.</p>
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
                href={`/api/public/product-whitepaper/${slug}${country !== 'all' ? `?country=${country}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={async (e) => {
                  e.preventDefault();
                  setShowPrintHelper(false);
                  await trackMetric('download_whitepaper', slug || '');
                  window.open(e.currentTarget.href, '_blank');
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-sm inline-flex items-center gap-1.5"
              >
                Open in New Tab & Print
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General Info Card */}
        <Card className="md:col-span-2 overflow-hidden border border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between py-4 px-6">
            <CardTitle className="flex items-center gap-2 text-slate-800 text-lg font-bold">
              <Building2 className="w-5 h-5 text-blue-500" />
              General & Office Overview
            </CardTitle>
            {canEdit && (
              <button
                onClick={() => setIsEditingGeneral(true)}
                className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 rounded-md transition-all shadow-sm"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit General Info
              </button>
            )}
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Office Location */}
              <div className="border border-slate-200/50 rounded-xl p-5 hover:border-slate-300/60 transition-all flex flex-col h-full bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm tracking-tight">Office Location</h3>
                </div>
                <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap flex-1 bg-slate-50 p-3 border border-slate-100 rounded-lg">
                  {generalInfo?.office_location ? (
                    generalInfo.office_location
                  ) : (
                    <span className="text-slate-400 italic">No office location listed.</span>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="border border-slate-200/50 rounded-xl p-5 hover:border-slate-300/60 transition-all flex flex-col h-full bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm tracking-tight">Contact Channels</h3>
                </div>
                <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap flex-1 bg-slate-50 p-3 border border-slate-100 rounded-lg">
                  {generalInfo?.contact_info ? (
                    generalInfo.contact_info
                  ) : (
                    <span className="text-slate-400 italic">No contact information listed.</span>
                  )}
                </div>
              </div>

              {/* Opening Hours */}
              <div className="border border-slate-200/50 rounded-xl p-5 hover:border-slate-300/60 transition-all flex flex-col h-full bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-50 text-purple-600 rounded-lg border border-purple-100 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm tracking-tight">Opening Hours</h3>
                </div>
                <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap flex-1 bg-slate-50 p-3 border border-slate-100 rounded-lg">
                  {generalInfo?.opening_hours ? (
                    generalInfo.opening_hours
                  ) : (
                    <span className="text-slate-400 italic">No opening hours listed.</span>
                  )}
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Security Overview */}
        {securityData ? (
          <Card className="md:col-span-2">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-slate-400" />
                Security Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
                {SECURITY_TOPICS.map((topic) => {
                  const value = securityData[topic.id];
                  const isBool = topic.id === 'mfa' || topic.id === 'sso';
                  
                  return (
                    <div key={topic.id} className="bg-slate-50 border border-slate-200/65 rounded-xl p-5 hover:bg-slate-100/40 transition-all flex flex-col justify-between h-full">
                      <div className="flex flex-col mb-3">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm shrink-0">
                            {topic.icon}
                          </div>
                          <h3 className="font-semibold text-slate-950 text-sm leading-tight">{topic.title}</h3>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed min-h-[36px] flex items-start">{topic.description}</p>
                      </div>
                      
                      <div className="bg-white rounded-lg p-3.5 border border-slate-200 text-sm mt-auto min-h-[64px] flex flex-col justify-center">
                        {isBool ? (
                          <div className="flex items-center gap-2">
                            {value === 1 || value === true || value === '1' ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                                <span className="text-slate-900 font-medium text-xs">Supported</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />
                                <span className="text-slate-900 font-medium text-xs">Not Supported</span>
                              </>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-900 font-medium text-xs leading-relaxed">{value || <span className="text-slate-400 italic">No information provided.</span>}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="md:col-span-2">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-slate-400" />
                Security Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center text-slate-500 text-sm">
              No security details found.
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-slate-400" />
              Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {controls && controls.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {controls.map((control: any) => {
                  const formatTopicName = (id: string) => {
                    return id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                  };
                  return (
                  <div key={control.topic_id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900">{formatTopicName(control.topic_id)}</h4>
                      <p className="text-sm text-slate-500 mt-1">{control.description || 'No description provided.'}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold self-start md:self-center shrink-0 ${
                      control.status === 'Implemented' ? 'bg-emerald-100 text-emerald-800' : 
                      control.status === 'Partial' ? 'bg-amber-100 text-amber-800' : 
                      'bg-red-100 text-red-800'
                    }`}>
                      {control.status}
                    </span>
                  </div>
                )})}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 text-sm">No controls listed.</div>
            )}
          </CardContent>
        </Card>

        {/* Certifications and Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-slate-400" />
              Certifications & Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {certifications && certifications.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {certifications.map((cert: any) => (
                  <div key={cert.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      {cert.logo_url && (
                        <div className="w-[110px] sm:w-[130px] h-[80px] sm:h-[90px] p-2 bg-slate-50 border border-slate-200/80 rounded-lg shrink-0 flex items-center justify-center">
                          <img src={cert.logo_url} alt={`${cert.name} logo`} className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-medium text-slate-900">{cert.name}</h4>
                        {cert.issuer && <p className="text-xs text-slate-500">{cert.issuer}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {cert.name.includes('ISAE 3000') && (
                        <button 
                          type="button"
                          onClick={() => {
                            openRequestAccess({
                              documentName: `${cert.name} Report`,
                              productName: product?.name || '',
                              productSlug: slug || 'general',
                              documentType: 'compliance_report',
                              recipientEmail: siteSettings?.mailto_certifications || 'security@bjornlunden.com'
                            });
                          }}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 focus:outline-none"
                        >
                          <Mail className="w-4 h-4" /> Request Report
                        </button>
                      )}
                      {cert.url && (
                        <a 
                          href={cert.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={async (e) => {
                            e.preventDefault();
                            await trackMetric('download_certification', slug || '', cert.name);
                            const finalUrl = cert.url.startsWith('http') ? cert.url : `https://${cert.url}`;
                            window.open(finalUrl, '_blank');
                          }} 
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          View
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 text-sm">No certifications or reports listed.</div>
            )}
          </CardContent>
        </Card>

        {/* Policies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              Policies
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {policies && policies.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {policies.map((policy: any) => (
                  <div key={policy.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div>
                      <h4 className="font-medium text-slate-900">{policy.name}</h4>
                      {policy.description && <p className="text-xs text-slate-500 mt-0.5">{policy.description}</p>}
                      {(policy.version || policy.effective_date) && (
                        <div className="flex gap-2 text-[10px] text-slate-400 mt-1 font-medium">
                          {policy.version && <span>Version: {policy.version}</span>}
                          {policy.effective_date && <span>Effective: {new Date(policy.effective_date).toLocaleDateString()}</span>}
                        </div>
                      )}
                    </div>
                    {policy.is_requestable === 1 && (
                      <button 
                        type="button"
                        onClick={() => {
                          openRequestAccess({
                            documentName: `Policy: ${policy.name}`,
                            productName: product?.name || '',
                            productSlug: slug || 'general',
                            documentType: 'policy',
                            recipientEmail: siteSettings?.mailto_policies || 'security@bjornlunden.com'
                          });
                        }}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 focus:outline-none"
                      >
                        <Mail className="w-4 h-4" /> Request Policy
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 text-sm">No policies listed.</div>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              Legal Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {relatedDocs.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {Object.values(
                  relatedDocs.reduce((acc: any, doc: any) => {
                    if (!acc[doc.document_type] || doc.is_current === 1) {
                      acc[doc.document_type] = doc;
                    }
                    return acc;
                  }, {})
                ).map((doc: any) => (
                  <div key={doc.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div>
                      <h4 className="font-medium text-slate-900">
                        {LEGAL_DOC_NAMES[doc.document_type] || doc.document_type}
                      </h4>
                      <p className="text-xs text-slate-500">{doc.version}</p>
                    </div>
                    <a 
                      href={doc.file_url || doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      onClick={async (e) => {
                        e.preventDefault();
                        await trackMetric('download_legal', slug || '', doc.document_type || '');
                        const finalUrl = (doc.file_url || doc.url).startsWith('http') ? (doc.file_url || doc.url) : `https://${doc.file_url || doc.url}`;
                        window.open(finalUrl, '_blank');
                      }} 
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 text-sm">No specific documents listed.</div>
            )}
          </CardContent>
        </Card>

        {/* Subprocessors */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5 text-slate-400" />
              Subprocessors & Data Processors
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {relatedSubprocessors.length > 0 ? (
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="w-1/4 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Identity</th>
                    <th className="w-1/6 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                    <th className="w-1/5 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nature of Processing</th>
                    <th className="w-1/5 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categories of Data</th>
                    <th className="w-1/5 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Purpose</th>
                    <th className="w-1/6 px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Certifications</th>
                    <th className="w-12 px-2 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Info</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {relatedSubprocessors.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 align-top">
                        <div className="flex items-start gap-1">
                          <div className="min-w-0 flex-1">
                            {sub.website_url ? (
                              <a 
                                href={sub.website_url.startsWith('http') ? sub.website_url : `https://${sub.website_url}`}
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5"
                              >
                                {sub.name} <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-sm font-semibold text-slate-800">{sub.name}</span>
                            )}
                            
                            {sub.contact_details ? (
                              <div className="mt-2 text-xs text-slate-600 font-normal leading-relaxed break-words whitespace-pre-wrap text-left">
                                {sub.contact_details}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 italic mt-1 font-normal">Contact info not listed</p>
                            )}
                            {(sub.org_number || sub.lei_number) && (
                              <div className="mt-2 space-y-1 text-[11px] text-slate-500 font-normal">
                                {sub.org_number && <div className="flex items-center gap-1.5"><span className="font-medium text-slate-700 uppercase tracking-wider text-[10px]">Org No:</span> {sub.org_number}</div>}
                                {sub.lei_number && <div className="flex items-center gap-1.5"><span className="font-medium text-slate-700 uppercase tracking-wider text-[10px]">LEI:</span> {sub.lei_number}</div>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600 align-top">
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-slate-800 text-sm">{sub.region}</span>
                          {sub.countries && sub.countries.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {sub.countries.map((c: string) => {
                                const countryObj = COUNTRIES.find(country => country.code === c);
                                return countryObj ? (
                                  <span key={c} className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200" title={countryObj.name}>
                                    {countryObj.flag} {c.toUpperCase()}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600 align-top">
                        <p className="text-xs text-slate-705 whitespace-pre-wrap leading-relaxed">
                          {sub.nature_of_processing || sub.category}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600 align-top">
                        <p className="text-xs text-slate-705 whitespace-pre-wrap leading-relaxed">
                          {sub.data_categories || 'Not specified'}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600 align-top">
                        <p className="text-xs text-slate-705 whitespace-pre-wrap leading-relaxed">
                          {sub.purpose}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600 align-top">
                        {sub.certifications ? (
                          <div className="flex flex-wrap gap-1">
                            {sub.certifications.split(',').map((cert: string) => (
                              <span key={cert} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                                🛡️ {cert.trim()}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-450 text-xs italic font-normal">None listed</span>
                        )}
                      </td>

                      <td className="px-2 py-4 text-center align-top whitespace-nowrap">
                        <button 
                          type="button" 
                          onClick={() => setInspectingSub(sub)}
                          className="text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-all p-1.5 rounded inline-block"
                          title="Click to view full detail profile"
                        >
                          <Info className="w-4 h-4 cursor-pointer" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-center text-slate-500 text-sm">No subprocessors listed.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subprocessor Inspection Modal */}
      {inspectingSub && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col transition-all border border-slate-100">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-xl flex items-start justify-between">
              <div>
                <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-150 rounded uppercase tracking-wider mb-1">
                  Sub-processor Profile
                </span>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-1.5">
                  {inspectingSub.name}
                </h3>
                {inspectingSub.website_url && (
                  <a 
                    href={inspectingSub.website_url.startsWith('http') ? inspectingSub.website_url : `https://${inspectingSub.website_url}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                  >
                    View Official Website <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <button 
                onClick={() => setInspectingSub(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all font-semibold text-sm"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-sm text-slate-705">
              {/* 1. Contact Details */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-600" /> 1. Contact Details
                </h4>
                <div className="space-y-2">
                  <p className="text-slate-800"><strong className="text-slate-700 font-semibold">Legal Entity:</strong> {inspectingSub.name}</p>
                  
                  {(inspectingSub.org_number || inspectingSub.lei_number) && (
                    <div className="flex flex-col sm:flex-row gap-4">
                      {inspectingSub.org_number && (
                        <p className="text-slate-600 text-xs">
                          <strong className="text-slate-700 font-semibold uppercase tracking-wider">Organisation No:</strong> {inspectingSub.org_number}
                        </p>
                      )}
                      {inspectingSub.lei_number && (
                        <p className="text-slate-600 text-xs">
                          <strong className="text-slate-700 font-semibold uppercase tracking-wider">LEI No:</strong> {inspectingSub.lei_number}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <strong className="text-slate-700 font-semibold block text-xs uppercase tracking-wider mb-1">Official Address &amp; Compliance Channel:</strong>
                    <div className="text-slate-700 bg-white p-3 border border-slate-200 rounded-md text-xs whitespace-pre-wrap leading-relaxed font-sans">
                      {inspectingSub.contact_details || 'No contact details specified.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Purposes */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-purple-600" /> 2. Purposes
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Purpose of Processing &amp; Involvement:</span>
                    <p className="text-xs text-slate-800 bg-white p-3 border border-slate-200 rounded-md leading-relaxed whitespace-pre-wrap">
                      {inspectingSub.purpose || 'No purpose specified.'}
                    </p>
                  </div>
                  {inspectingSub.nature_of_processing && (
                    <div>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Nature of Processing Activity:</span>
                      <p className="text-xs text-slate-700 bg-white p-2.5 border border-slate-200 rounded-md leading-relaxed whitespace-pre-wrap">
                        {inspectingSub.nature_of_processing}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Categories (Data Subjects & Personal Data) */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" /> 3. Categories (Data Subjects &amp; Types of Personal Data Collected)
                </h4>
                <div className="bg-white p-3 border border-slate-200 rounded-md text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {inspectingSub.data_categories || 'Not specified.'}
                </div>
              </div>

              {/* 4. Recipients */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> 4. Recipients
                </h4>
                <div className="bg-white p-3 border border-slate-200 rounded-md text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {inspectingSub.recipients || 'Authorized technical operations and support personnel under confidentiality agreements and strict access controls.'}
                </div>
              </div>

              {/* 5. Transfers */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-amber-600" /> 5. Transfers
                </h4>
                <div className="space-y-2">
                  <p className="text-slate-800 text-xs"><strong className="text-slate-700 font-semibold">Hosting Region:</strong> {inspectingSub.region}</p>
                  
                  {inspectingSub.countries && inspectingSub.countries.length > 0 && (
                    <div>
                      <strong className="text-slate-700 font-semibold block text-xs mb-1">Applicable Jurisdictions:</strong>
                      <div className="flex flex-wrap gap-1.5">
                        {inspectingSub.countries.map((c: string) => {
                          const countryObj = COUNTRIES.find(country => country.code === c);
                          return countryObj ? (
                            <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-white text-slate-700 border border-slate-200 shadow-sm">
                              {countryObj.flag} <span className="font-medium">{countryObj.name}</span> <span className="text-[10px] text-slate-400">({countryObj.code.toUpperCase()})</span>
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">International Transfers &amp; Safeguards:</span>
                    <div className="bg-white p-3 border border-slate-200 rounded-md text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {inspectingSub.transfers || 'Processing occurs in the specified region. Any cross-border transfers are governed by EU Standard Contractual Clauses (SCCs) and appropriate supplementary measures.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Retention */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-600" /> 6. Retention
                </h4>
                <div className="bg-white p-3 border border-slate-200 rounded-md text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {inspectingSub.retention || 'Personal data is retained only for as long as necessary to fulfill the documented processing purpose or as required by applicable statutory obligations, followed by secure cryptographic erasure.'}
                </div>
              </div>

              {/* 7. Security (Overview of Technical and Organizational Security Measures - TOMs) */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-600" /> 7. Security (Technical and Organizational Security Measures)
                </h4>
                
                {inspectingSub.security_measures ? (
                  <div className="bg-white p-3 border border-slate-200 rounded-md text-xs text-slate-700 leading-relaxed whitespace-pre-wrap mb-3">
                    {inspectingSub.security_measures}
                  </div>
                ) : (
                  <div className="bg-white p-3 border border-slate-200 rounded-md text-xs text-slate-700 leading-relaxed whitespace-pre-wrap mb-3">
                    Enforces industry-standard technical and organizational security measures (TOMs) including data encryption at rest and in transit, strict role-based access control (RBAC), multi-factor authentication, perimeter network protections, and regular vulnerability audits.
                  </div>
                )}

                {inspectingSub.certifications && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Audit Certifications &amp; Attestations:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {inspectingSub.certifications.split(',').map((cert: string) => (
                        <span key={cert} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          🛡️ {cert.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* DPA Section */}
                {(inspectingSub.dpa_url || inspectingSub.dpa_requestable === 1) && (
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Data Processing Agreement (DPA) Addendum
                    </h5>
                    {inspectingSub.dpa_url ? (
                      <a 
                        href={inspectingSub.dpa_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        Download Custom DPA Addendum
                      </a>
                    ) : inspectingSub.dpa_requestable === 1 ? (
                      <button 
                        type="button"
                        onClick={() => {
                          openRequestAccess({
                            documentName: `DPA Addendum - ${inspectingSub.name}`,
                            productName: product?.name || '',
                            productSlug: slug || 'general',
                            documentType: 'dpa',
                            recipientEmail: siteSettings?.mailto_legal || 'security@bjornlunden.com'
                          });
                        }}
                        className="inline-flex items-center px-3 py-1.5 rounded text-sm font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
                      >
                        Request Document via NDA
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end shrink-0">
              <button 
                onClick={() => setInspectingSub(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg transition-colors text-sm"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
