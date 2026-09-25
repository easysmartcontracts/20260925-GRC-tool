import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCountry } from '../hooks/useCountry';
import { Shield, Lock, Database, Key, Globe, CheckCircle2, XCircle, Activity } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { getLastSelectedProduct, setLastSelectedProduct, resolveTargetProduct } from '../utils/productSelection';

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
    fetch('/api/public/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
      });
  }, []);

  useEffect(() => {
    if (slug) {
      setSelectedProduct(slug);
      setLastSelectedProduct(slug);
    }
  }, [slug]);

  const displayProducts = products.filter(p => {
    if (country !== 'all' && (!p.countries || !p.countries.includes(country))) {
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
          navigate(`/security-overview/${target}`, { replace: true });
        }
      }
    } else {
      setSelectedProduct(null);
    }
  }, [country, displayProducts, slug, navigate]);

  useEffect(() => {
    if (selectedProduct) {
      fetch(`/api/public/product-security/${selectedProduct}`)
        .then(res => res.json())
        .then(data => {
          setProductSecurity(data);
          setEditData(data || {
            backup: '',
            mfa: false,
            encryption: '',
            sso: false,
            data_residency: '',
            sla_uptime: ''
          });
        });
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Security Overview</h1>
          <p className="text-slate-600 mt-1">Detailed security information for our product portfolio.</p>
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
        <div className="w-full lg:w-1/4 sticky top-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm overflow-y-auto max-h-[calc(100vh-6rem)]">
            <h3 className="font-semibold text-slate-900 mb-3 px-2">Select Product</h3>
            <div className="flex flex-col gap-1">
              {displayProducts.map((product) => (
                <button
                  key={product.slug}
                  onClick={() => {
                    setLastSelectedProduct(product.slug);
                    navigate(`/security-overview/${product.slug}`);
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
          {/* Security Details */}
      {selectedProduct && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-fr">
          {SECURITY_TOPICS.map((topic) => {
            const value = editData ? editData[topic.id] : null;
            
            return (
              <div 
                key={topic.id} 
                className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-full"
              >
                {/* Header: Icon + Title + Description */}
                <div className="flex flex-col mb-4">
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg shrink-0">
                      {topic.icon}
                    </div>
                    <h3 className="font-semibold text-slate-900 text-base leading-snug">{topic.title}</h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed min-h-[44px] flex items-start">
                    {topic.description}
                  </p>
                </div>
                
                {/* Information Box: perfectly aligned across cards */}
                <div className="mt-auto bg-slate-50 rounded-xl p-4 border border-slate-200/80 min-h-[80px] flex flex-col justify-center">
                  {isEditing ? (
                    topic.id === 'mfa' || topic.id === 'sso' ? (
                      <div className="flex items-center gap-2.5">
                        <input 
                          type="checkbox" 
                          id={`edit-${topic.id}`}
                          checked={!!value}
                          onChange={(e) => setEditData({...editData, [topic.id]: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                        />
                        <label htmlFor={`edit-${topic.id}`} className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                          Supported
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-1 w-full">
                        <label htmlFor={`edit-${topic.id}`} className="sr-only">{topic.title}</label>
                        <textarea
                          id={`edit-${topic.id}`}
                          value={value || ''}
                          onChange={(e) => setEditData({...editData, [topic.id]: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none leading-relaxed"
                          rows={2}
                          placeholder={`Enter ${topic.title.toLowerCase()} details...`}
                        />
                      </div>
                    )
                  ) : (
                    typeof value === 'boolean' || topic.id === 'mfa' || topic.id === 'sso' ? (
                      <div className="flex items-center gap-2.5">
                        {value ? (
                          <>
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                            </span>
                            <span className="text-slate-900 font-semibold text-sm">Supported</span>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 shrink-0">
                              <XCircle className="w-4 h-4" aria-hidden="true" />
                            </span>
                            <span className="text-slate-900 font-semibold text-sm">Not Supported</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="text-slate-900 font-medium text-sm leading-relaxed">
                        {value || <span className="text-slate-400 italic font-normal">No information provided.</span>}
                      </p>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isEditing && (
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
