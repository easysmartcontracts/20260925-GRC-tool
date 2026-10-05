import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Globe, CheckCircle2, XCircle, Plus, Trash2, Edit, Bell, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRequestAccess } from '../contexts/RequestAccessContext';
import { useCountry } from '../hooks/useCountry';
import { Button } from '../components/ui/Button';
import { getLastSelectedProduct, setLastSelectedProduct, resolveTargetProduct } from '../utils/productSelection';

type Certification = {
  id: number;
  product_slug: string;
  name: string;
  certificate_url: string;
  soa_available: number;
  type: 'certificate' | 'report';
  logo_url?: string;
};

export function Certifications() {
  const { user, publicPages, refreshPublicPages, getAuthHeaders, siteSettings } = useAuth();
  const { openRequestAccess } = useRequestAccess();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(() => slug || getLastSelectedProduct() || null);
  const [isPublic, setIsPublic] = useState(false);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [newCert, setNewCert] = useState<{
    name: string;
    certificate_url: string;
    soa_available: boolean;
    type: 'certificate' | 'report';
  }>({
    name: '',
    certificate_url: '',
    soa_available: false,
    type: 'certificate'
  });
  const [editingCertId, setEditingCertId] = useState<number | null>(null);
  const [editCert, setEditCert] = useState<{
    name: string;
    certificate_url: string;
    soa_available: boolean;
    type: 'certificate' | 'report';
  }>({
    name: '',
    certificate_url: '',
    soa_available: false,
    type: 'certificate'
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const country = useCountry();

  useEffect(() => {
    fetch('/api/public/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
      });
  }, [user]);

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
          navigate(`/certifications/${target}`, { replace: true });
        }
      }
    } else {
      setSelectedProduct(null);
    }
  }, [country, displayProducts, slug, navigate]);

  useEffect(() => {
    if (selectedProduct) {
      fetch(`/api/public/product-certifications/${selectedProduct}`)
        .then(res => res.json())
        .then(data => {
          setCertifications(data.certifications || []);
        });
    }
  }, [selectedProduct]);

  useEffect(() => {
    setIsPublic(publicPages.includes('certifications'));
  }, [publicPages]);

  const togglePublic = async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return;
    
    try {
      const res = await fetch('/api/admin/pages/certifications', {
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
        setToast({ message: 'Failed to update page status', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleAddCert = async () => {
    if (!selectedProduct || !newCert.name.trim()) return;
    
    try {
      const res = await fetch(`/api/admin/product-certifications/${selectedProduct}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(newCert)
      });
      
      if (res.ok) {
        const certsRes = await fetch(`/api/public/product-certifications/${selectedProduct}`);
        const data = await certsRes.json();
        setCertifications(data.certifications || []);
        setNewCert({ name: '', certificate_url: '', soa_available: false, type: 'certificate' });
        setToast({ message: 'Added successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to add', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteCert = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/product-certifications/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      
      if (res.ok) {
        setCertifications(certifications.filter(c => c.id !== id));
        setToast({ message: 'Certification deleted successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to delete certification', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleUpdateCert = async (id: number) => {
    if (!selectedProduct || !editCert.name.trim()) return;
    
    try {
      const res = await fetch(`/api/admin/product-certifications/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(editCert)
      });
      
      if (res.ok) {
        const certsRes = await fetch(`/api/public/product-certifications/${selectedProduct}`);
        const data = await certsRes.json();
        setCertifications(data.certifications || []);
        setEditingCertId(null);
        setToast({ message: 'Updated successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to update', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleRequestSoA = (certName: string) => {
    const prod = products.find(p => p.slug === selectedProduct);
    openRequestAccess({
      documentName: `Statement of Applicability (SoA) - ${certName}`,
      productName: prod?.name || '',
      productSlug: selectedProduct || 'general',
      documentType: 'statement_of_applicability',
      recipientEmail: siteSettings?.mailto_certifications || 'security@bjornlunden.com'
    });
  };

  const handleRequestISAE = (certName: string) => {
    const prod = products.find(p => p.slug === selectedProduct);
    openRequestAccess({
      documentName: `${certName} Report`,
      productName: prod?.name || '',
      productSlug: selectedProduct || 'general',
      documentType: 'compliance_report',
      recipientEmail: siteSettings?.mailto_certifications || 'security@bjornlunden.com'
    });
  };

  const handleSubscribeCertifications = () => {
    const productName = products.find(p => p.slug === selectedProduct)?.name || '';
    const subject = encodeURIComponent(`Subscribe to Certification Updates - ${productName}`);
    const body = encodeURIComponent(`Hello,\n\nI would like to subscribe to notifications regarding new certifications and reports for ${productName}.\n\nThank you.`);
    const email = siteSettings?.mailto_certifications || 'security@bjornlunden.com';
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

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

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Certifications and Reports</h1>
          <p className="text-slate-600 mt-1">Compliance certifications and reports for our product portfolio.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <Button 
              variant={isPublic ? "outline" : "primary"}
              onClick={togglePublic}
              className="flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              {isPublic ? "Make Private" : "Make Public"}
            </Button>
          )}
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
        {/* Left Sidebar (Products & Subscription) */}
        <div className="w-full lg:w-1/4 sticky top-6 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm overflow-y-auto max-h-[calc(100vh-16rem)]">
            <h3 className="font-semibold text-slate-900 mb-3 px-2">Select Product</h3>
            <div className="flex flex-col gap-1">
              {displayProducts.map((product) => (
                <button
                  key={product.slug}
                  onClick={() => {
                    setLastSelectedProduct(product.slug);
                    navigate(`/certifications/${product.slug}`);
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

          {selectedProduct && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-blue-900 shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <Bell className="w-4 h-4 text-blue-700 shrink-0" />
                <h4 className="font-bold text-sm text-blue-950">Subscribe to Updates</h4>
              </div>
              <p className="text-xs text-blue-800/90 mb-3 leading-relaxed">
                We will notify you when new certifications or reports are added or updated for this product.
              </p>
              <button 
                onClick={handleSubscribeCertifications}
                className="w-full bg-blue-600 text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                Subscribe Now
              </button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="w-full lg:w-3/4 space-y-8">
          {displayProducts.length === 0 && (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
              <h3 className="text-lg font-semibold text-slate-900">No Products Available</h3>
              <p className="text-slate-500 max-w-md mx-auto mt-2">
                {products.length === 0 
                  ? "There are currently no products with applicable certifications or reports to display."
                  : "No products match your selected country filter."}
              </p>
            </div>
          )}

          {/* Active Certifications and Reports (Matching Policies & Legal) */}
          {selectedProduct && (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-900">Active Certifications and Reports</h2>
                <p className="text-slate-600 text-sm mt-1">Compliance certifications and independent audit reports for this product.</p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col space-y-3">
                  {certifications.map((cert) => (
                    <div 
                      key={cert.id} 
                      className="bg-white p-4 sm:px-5 sm:py-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-colors group"
                    >
                      {editingCertId === cert.id ? (
                        <div className="flex flex-col space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="font-semibold text-sm text-slate-900">
                              Edit {editCert.type === 'report' ? 'Report' : 'Certification'}
                            </h5>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                              <select
                                value={editCert.type}
                                onChange={(e) => setEditCert({...editCert, type: e.target.value as 'certificate' | 'report'})}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                              >
                                <option value="certificate">Certification</option>
                                <option value="report">Report</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                              <input 
                                type="text" 
                                placeholder="e.g. ISO 27001 or SOC 2"
                                value={editCert.name}
                                onChange={(e) => setEditCert({...editCert, name: e.target.value})}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">Document URL</label>
                              <input 
                                type="text" 
                                placeholder="https://..."
                                value={editCert.certificate_url}
                                onChange={(e) => setEditCert({...editCert, certificate_url: e.target.value})}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={editCert.soa_available}
                                onChange={(e) => setEditCert({...editCert, soa_available: e.target.checked})}
                                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                              />
                              <span className="text-sm font-medium text-slate-700">Statement of Applicability available</span>
                            </label>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => setEditingCertId(null)}>
                                Cancel
                              </Button>
                              <Button size="sm" onClick={() => handleUpdateCert(cert.id)}>
                                Save
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <h4 className="font-bold text-slate-900 text-base">{cert.name}</h4>
                              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">Active</span>
                                <span className="capitalize">{cert.type === 'report' ? 'Report' : 'Certification'}</span>
                                {cert.soa_available === 1 && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>Statement of Applicability Available</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {cert.certificate_url && (
                              <a 
                                href={cert.certificate_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                              >
                                {cert.type === 'report' ? 'Download Report' : 'Download Certificate'}
                              </a>
                            )}
                            {cert.soa_available === 1 && (
                              <button 
                                onClick={() => handleRequestSoA(cert.name)}
                                className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                              >
                                Request SoA
                              </button>
                            )}
                            {cert.name.includes('ISAE 3000') && (
                              <button 
                                onClick={() => handleRequestISAE(cert.name)}
                                className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                              >
                                Request Report
                              </button>
                            )}
                            {(user?.role === 'admin' || user?.role === 'moderator') && (
                              <div className="flex items-center gap-1 pl-1">
                                <button 
                                  onClick={() => {
                                    setEditingCertId(cert.id);
                                    setEditCert({ 
                                      name: cert.name, 
                                      certificate_url: cert.certificate_url || '', 
                                      soa_available: cert.soa_available === 1, 
                                      type: cert.type
                                    });
                                  }}
                                  className="text-slate-400 hover:text-blue-600 transition-colors p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  aria-label={`Edit ${cert.name}`}
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteCert(cert.id)}
                                  className="text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                                  aria-label={`Delete ${cert.name}`}
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {certifications.length === 0 && (
                    <div className="py-8 text-center text-slate-500 text-sm">
                      No active certifications or reports listed for this product.
                    </div>
                  )}
                </div>

                {/* Admin Add Certification or Report (matching Policies & Legal) */}
                {(user?.role === 'admin' || user?.role === 'moderator') && (
                  <div className="bg-slate-50 p-5 rounded-xl border border-dashed border-slate-300 flex flex-col gap-3 mt-4">
                    <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Plus className="w-4 h-4 text-blue-600" /> Add Certification or Report
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
                        <select
                          value={newCert.type}
                          onChange={(e) => setNewCert({...newCert, type: e.target.value as 'certificate' | 'report'})}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                        >
                          <option value="certificate">Certification</option>
                          <option value="report">Report</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Name *</label>
                        <input 
                          type="text" 
                          placeholder="e.g. ISO 27001 or SOC 2"
                          value={newCert.name}
                          onChange={(e) => setNewCert({...newCert, name: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Document URL</label>
                        <input 
                          type="text" 
                          placeholder="https://..."
                          value={newCert.certificate_url}
                          onChange={(e) => setNewCert({...newCert, certificate_url: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={newCert.soa_available}
                          onChange={(e) => setNewCert({...newCert, soa_available: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <span className="text-sm font-medium text-slate-700">Statement of Applicability available</span>
                      </label>
                      <Button size="sm" onClick={handleAddCert} disabled={!newCert.name.trim()}>
                        Add to List
                      </Button>
                    </div>
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
