import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCountry } from '../hooks/useCountry';
import { Shield, Lock, Database, Key, Globe, CheckCircle2, XCircle, Activity, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { getLastSelectedProduct, setLastSelectedProduct, resolveTargetProduct } from '../utils/productSelection';
import { fetchPublicProducts, fetchJson } from '../utils/api';

type SecurityTopic = {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
};

type ProductSecurityInfo = {
  [productSlug: string]: {
    backup: string;
    mfa: boolean;
    encryption: string;
    sso: boolean;
    data_residency: string;
    sla_uptime: string;
  }
};

const SECURITY_TOPICS: SecurityTopic[] = [
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

const DEFAULT_SECURITY_DATA: ProductSecurityInfo = {
  'bl-administration': {
    backup: 'Daily backups with 30-day retention. Point-in-time recovery available.',
    mfa: true,
    encryption: 'AES-256 at rest, TLS 1.3 in transit.',
    sso: true,
    data_residency: 'EU (Sweden)',
    sla_uptime: '99.9%'
  },
  'lundify': {
    backup: 'Continuous data protection with snapshots every 4 hours.',
    mfa: true,
    encryption: 'AES-256 at rest, TLS 1.2+ in transit.',
    sso: false,
    data_residency: 'EU (Ireland)',
    sla_uptime: '99.9%'
  },
  'king-finance': {
    backup: 'Real-time replication across multiple availability zones.',
    mfa: true,
    encryption: 'AES-256 at rest, TLS 1.3 in transit.',
    sso: true,
    data_residency: 'EU (Netherlands)',
    sla_uptime: '99.95%'
  }
};

export function SecurityOverview() {
  const { user, publicPages, refreshPublicPages, getAuthHeaders } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(() => slug || getLastSelectedProduct() || null);
  const [isPublic, setIsPublic] = useState(false);
  const [productSecurity, setProductSecurity] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const country = useCountry();

  useEffect(() => {
    fetchPublicProducts().then(data => {
      if (Array.isArray(data)) setProducts(data);
    });
  }, []);

  useEffect(() => {
    if (slug) {
      setSelectedProduct(slug);
      setLastSelectedProduct(slug);
    }
  }, [slug]);

  const displayProducts = products.filter(p => {
    if (country !== 'all' && p.countries && p.countries.length > 0 && !p.countries.includes(country)) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (displayProducts.length > 0) {
      const target = resolveTargetProduct(slug, displayProducts);
      if (target) {
        setSelectedProduct(target);
        if (target !== slug) {
          navigate(`/security-features/${target}`, { replace: true });
        }
      }
    } else {
      setSelectedProduct(null);
    }
  }, [country, displayProducts, slug, navigate]);

  useEffect(() => {
    if (selectedProduct) {
      fetchJson(`/api/public/product-security/${selectedProduct}`)
        .then(data => {
          if (data) {
            setProductSecurity(data);
            setEditData(data || {
              backup: '',
              mfa: false,
              encryption: '',
              sso: false,
              data_residency: '',
              sla_uptime: ''
            });
          }
        })
        .catch(err => console.warn('Could not fetch product security:', err));
    }
  }, [selectedProduct]);

  useEffect(() => {
    setIsPublic(publicPages.includes('security-overview'));
  }, [publicPages]);

  const togglePublic = async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return;
    
    try {
      const res = await fetch('/api/admin/pages/security-overview', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify({ is_public: !isPublic })
      });
      if (res.ok) {
        refreshPublicPages();
        setToast({ message: `Page is now ${!isPublic ? 'public' : 'private'}`, type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to update page status' }));
        setToast({ message: errorData.error || 'Failed to update page status', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleSave = async () => {
    if (!selectedProduct) return;
    
    try {
      const res = await fetch(`/api/admin/product-security/${selectedProduct}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(editData)
      });
      
      if (res.ok) {
        setProductSecurity(editData);
        setIsEditing(false);
        setToast({ message: 'Security information updated successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to save changes' }));
        setToast({ message: errorData.error || 'Failed to save changes', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const productInfo = productSecurity;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded z-[100] flex items-center gap-2 shadow-md border animate-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Security Features</h1>
          <p className="text-slate-600 mt-1">Detailed security features, technical measures, and data protections for our product portfolio.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <>
              <Button 
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "Cancel" : "Edit Security Info"}
              </Button>
              <Button 
                variant={isPublic ? "outline" : "primary"}
                onClick={togglePublic}
                className="flex items-center gap-2"
              >
                <Globe className="w-4 h-4" />
                {isPublic ? "Make Private" : "Make Public"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
        {/* Left Sidebar (Products) */}
        <div className="w-full lg:w-1/4 sticky top-6 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm overflow-y-auto max-h-[calc(100vh-14rem)]">
            <h3 className="font-semibold text-slate-900 mb-3 px-2">Select Product</h3>
            <div className="flex flex-col gap-1">
              {displayProducts.map((product) => (
                <button
                  key={product.slug}
                  onClick={() => {
                    setLastSelectedProduct(product.slug);
                    navigate(`/security-features/${product.slug}`);
                    setIsEditing(false);
                  }}
                  aria-pressed={selectedProduct === product.slug}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left focus:outline-none focus:ring-2 focus:ring-slate-900 ${
                    selectedProduct === product.slug
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {product.name}
                </button>
              ))}
              {displayProducts.length === 0 && (
                <div className="p-3 text-sm text-slate-500 text-center italic">No products available</div>
              )}
            </div>
          </div>

        </div>

        {/* Main Content */}
        <div className="w-full lg:w-3/4 space-y-8">
          {displayProducts.length === 0 && (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
              <h3 className="text-lg font-semibold text-slate-900">No Products Available</h3>
              <p className="text-slate-500 max-w-md mx-auto mt-2">
                {products.length === 0 
                  ? "There are currently no products with security information to display."
                  : "No products match your selected country filter."}
              </p>
            </div>
          )}

          {selectedProduct && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">Security Features & Measures</h2>
                <p className="text-slate-600 text-sm mt-1">
                  Technical safeguards, encryption standards, and platform security capabilities for {products.find(p => p.slug === selectedProduct)?.name || 'this product'}.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col space-y-3">
                  {SECURITY_TOPICS.map((topic) => {
                    const value = editData ? editData[topic.id] : null;
                    
                    return (
                      <div 
                        key={topic.id} 
                        className="bg-white p-4 sm:px-5 sm:py-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-colors group"
                      >
                        {isEditing ? (
                          <div className="flex items-start gap-3.5">
                            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg shrink-0 mt-0.5">
                              {topic.icon}
                            </div>
                            <div className="min-w-0 flex-1 space-y-3">
                              <div>
                                <h4 className="font-bold text-slate-900 text-base">{topic.title}</h4>
                                <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">{topic.description}</p>
                              </div>

                              {topic.id === 'mfa' || topic.id === 'sso' ? (
                                <div className="flex items-center gap-2.5 pt-1">
                                  <input 
                                    type="checkbox" 
                                    id={`edit-${topic.id}`}
                                    checked={!!value}
                                    onChange={(e) => setEditData({...editData, [topic.id]: e.target.checked})}
                                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                                  />
                                  <label htmlFor={`edit-${topic.id}`} className="text-sm font-medium text-slate-800 cursor-pointer select-none">
                                    Supported for this product
                                  </label>
                                </div>
                              ) : (
                                <div>
                                  <label htmlFor={`edit-${topic.id}`} className="block text-xs font-semibold text-slate-700 mb-1">
                                    Specification / Details
                                  </label>
                                  <input 
                                    type="text"
                                    id={`edit-${topic.id}`}
                                    value={value || ''}
                                    onChange={(e) => setEditData({...editData, [topic.id]: e.target.value})}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 leading-relaxed"
                                    placeholder={`Enter ${topic.title.toLowerCase()} details...`}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3.5 min-w-0 flex-1">
                              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg shrink-0 mt-0.5">
                                {topic.icon}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <h4 className="font-bold text-slate-900 text-base">{topic.title}</h4>
                                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 flex-wrap">
                                    {topic.id === 'mfa' || topic.id === 'sso' ? (
                                      value ? (
                                        <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Supported
                                        </span>
                                      ) : (
                                        <span className="bg-slate-100 text-slate-600 text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                          <XCircle className="w-3 h-3 text-slate-400" /> Inactive
                                        </span>
                                      )
                                    ) : (
                                      <span className="bg-slate-100 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                        Standard Measure
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                                  {topic.description}
                                </p>
                                {!(topic.id === 'mfa' || topic.id === 'sso') && (
                                  <div className="mt-2 text-xs sm:text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-2 flex items-baseline gap-2">
                                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider shrink-0">Specification:</span>
                                    <span className="text-slate-900 font-semibold">{value || <span className="text-slate-400 italic font-normal">Not configured</span>}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right side status / value badge */}
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {topic.id === 'mfa' || topic.id === 'sso' ? (
                                value ? (
                                  <div className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg whitespace-nowrap">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>Supported</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold rounded-lg whitespace-nowrap">
                                    <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                                    <span>Not Supported</span>
                                  </div>
                                )
                              ) : topic.id === 'sla_uptime' ? (
                                <div className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold rounded-lg whitespace-nowrap">
                                  <Activity className="w-4 h-4 text-purple-600 shrink-0" />
                                  <span>{value || '99.9%'} SLA</span>
                                </div>
                              ) : topic.id === 'data_residency' ? (
                                <div className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-lg whitespace-nowrap">
                                  <Globe className="w-4 h-4 text-slate-500 shrink-0" />
                                  <span>{value || 'EU'}</span>
                                </div>
                              ) : topic.id === 'encryption' ? (
                                <div className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-lg whitespace-nowrap">
                                  <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
                                  <span>Enforced</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold rounded-lg whitespace-nowrap">
                                  <Database className="w-4 h-4 text-blue-600 shrink-0" />
                                  <span>Automated</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isEditing && (
                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsEditing(false);
                        setEditData(productSecurity || {
                          backup: '',
                          mfa: false,
                          encryption: '',
                          sso: false,
                          data_residency: '',
                          sla_uptime: ''
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSave} className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
