import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Mail, Globe, CheckCircle2, XCircle, Plus, Trash2, Edit2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRequestAccess } from '../contexts/RequestAccessContext';
import { useCountry } from '../hooks/useCountry';
import { Button } from '../components/ui/Button';
import { getLastSelectedProduct, setLastSelectedProduct, resolveTargetProduct } from '../utils/productSelection';
import { fetchPublicProducts, fetchJson } from '../utils/api';

type Policy = {
  id: number;
  product_slug: string;
  name: string;
  description: string;
  is_requestable: number;
  effective_date?: string;
  version?: string;
};

export function Policies() {
  const { user, publicPages, refreshPublicPages, getAuthHeaders, siteSettings } = useAuth();
  const { openRequestAccess } = useRequestAccess();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const country = useCountry();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(() => slug || getLastSelectedProduct() || null);
  const [isPublic, setIsPublic] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [newPolicy, setNewPolicy] = useState({ name: '', description: '', is_requestable: 1, effective_date: '', version: '' });
  const [editingPolicyId, setEditingPolicyId] = useState<number | null>(null);
  const [editPolicyState, setEditPolicyState] = useState({ name: '', description: '', is_requestable: 1, effective_date: '', version: '' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
      if (target && target !== slug) {
        navigate(`/policies/${target}`, { replace: true });
      }
    }
  }, [country, displayProducts, slug, navigate]);

  useEffect(() => {
    if (selectedProduct) {
      fetchJson<Policy[]>(`/api/public/product-policies/${selectedProduct}`)
        .then(data => {
          if (Array.isArray(data)) setPolicies(data);
        })
        .catch(err => console.warn('Could not fetch policies:', err));
    }
  }, [selectedProduct]);

  useEffect(() => {
    setIsPublic(publicPages.includes('policies'));
  }, [publicPages]);

  const togglePublic = async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return;
    
    try {
      const res = await fetch('/api/admin/pages/policies', {
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

  const handleAddPolicy = async () => {
    if (!selectedProduct || !newPolicy.name) return;
    
    try {
      const res = await fetch(`/api/admin/product-policies/${selectedProduct}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(newPolicy)
      });
      
      if (res.ok) {
        // Refresh policies
        const policiesRes = await fetch(`/api/public/product-policies/${selectedProduct}`);
        const data = await policiesRes.json();
        setPolicies(data);
        setNewPolicy({ name: '', description: '', is_requestable: 1, effective_date: '', version: '' });
        setToast({ message: 'Policy added successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to add policy', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleUpdatePolicy = async (id: number) => {
    if (!editPolicyState.name) return;
    
    try {
      const res = await fetch(`/api/admin/product-policies/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(editPolicyState)
      });
      
      if (res.ok) {
        const policiesRes = await fetch(`/api/public/product-policies/${selectedProduct}`);
        const data = await policiesRes.json();
        setPolicies(data);
        setEditingPolicyId(null);
        setToast({ message: 'Policy updated successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to update policy', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeletePolicy = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/product-policies/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      
      if (res.ok) {
        setPolicies(policies.filter(p => p.id !== id));
        setToast({ message: 'Policy deleted successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to delete policy', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleRequestPolicy = (policyName: string) => {
    const productName = products.find(p => p.slug === selectedProduct)?.name || '';
    openRequestAccess({
      documentName: `Policy: ${policyName}`,
      productName,
      productSlug: selectedProduct || 'general',
      documentType: 'policy',
      recipientEmail: siteSettings?.mailto_policies || 'security@bjornlunden.com'
    });
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Policies</h1>
          <p className="text-slate-600 mt-1">Security and compliance policies for our product portfolio.</p>
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
                    navigate(`/policies/${product.slug}`);
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
          {products.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
          <Shield className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No Products Available</h3>
          <p className="text-slate-500 max-w-md mx-auto mt-2">There are currently no products to display.</p>
        </div>
      )}

      {selectedProduct && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Product Policies</h2>
            <p className="text-slate-600 text-sm mt-1">Policies applicable to this product.</p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col space-y-3">
              {policies.map((policy) => (
                <div key={policy.id} className="bg-white p-4 sm:px-5 sm:py-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs transition-colors group">
                  {editingPolicyId === policy.id ? (
                    <div className="flex flex-col space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input 
                          type="text" 
                          value={editPolicyState.name}
                          onChange={(e) => setEditPolicyState({...editPolicyState, name: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 md:col-span-1"
                          placeholder="Policy Name"
                        />
                        <input 
                          type="date" 
                          value={editPolicyState.effective_date}
                          onChange={(e) => setEditPolicyState({...editPolicyState, effective_date: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="Effective Date"
                        />
                        <input 
                          type="text" 
                          value={editPolicyState.version}
                          onChange={(e) => setEditPolicyState({...editPolicyState, version: e.target.value})}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                          placeholder="Version (e.g. 1.0)"
                        />
                      </div>
                      <textarea 
                        value={editPolicyState.description}
                        onChange={(e) => setEditPolicyState({...editPolicyState, description: e.target.value})}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none h-20"
                        placeholder="Description"
                      />
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id={`policy-edit-requestable-${policy.id}`}
                            checked={editPolicyState.is_requestable === 1}
                            onChange={(e) => setEditPolicyState({...editPolicyState, is_requestable: e.target.checked ? 1 : 0})}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <label htmlFor={`policy-edit-requestable-${policy.id}`} className="text-sm font-medium text-slate-700">
                            Allow users to request this policy
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingPolicyId(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleUpdatePolicy(policy.id)}>
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h4 className="font-bold text-slate-900 text-base">{policy.name}</h4>
                          {(policy.version || policy.effective_date) && (
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                              {policy.version && <span>Version {policy.version}</span>}
                              {policy.version && policy.effective_date && <span aria-hidden="true">·</span>}
                              {policy.effective_date && <span>Effective {new Date(policy.effective_date).toLocaleDateString()}</span>}
                            </div>
                          )}
                        </div>
                        {policy.description && (
                          <p className="text-sm text-slate-600 mt-1 leading-relaxed">{policy.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {policy.is_requestable === 1 && (
                          <button 
                            onClick={() => handleRequestPolicy(policy.name)}
                            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Request Policy
                          </button>
                        )}
                        {(user?.role === 'admin' || user?.role === 'moderator') && (
                          <div className="flex items-center gap-1 pl-1">
                            <button 
                              onClick={() => {
                                setEditingPolicyId(policy.id);
                                setEditPolicyState({
                                  name: policy.name,
                                  description: policy.description,
                                  is_requestable: policy.is_requestable,
                                  effective_date: policy.effective_date || '',
                                  version: policy.version || ''
                                });
                              }}
                              className="text-slate-400 hover:text-blue-600 transition-colors p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              aria-label={`Edit ${policy.name}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeletePolicy(policy.id)}
                              className="text-slate-400 hover:text-red-600 transition-colors p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                              aria-label={`Delete ${policy.name}`}
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

              {/* Admin Add Policy */}
              {(user?.role === 'admin' || user?.role === 'moderator') && (
                <div className="bg-slate-50 p-5 rounded-xl border border-dashed border-slate-300 flex flex-col gap-3 mt-2">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Policy
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input 
                      type="text" 
                      placeholder="Policy Name (e.g. Information Security Policy)"
                      value={newPolicy.name}
                      onChange={(e) => setNewPolicy({...newPolicy, name: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <input 
                      type="date" 
                      value={newPolicy.effective_date}
                      onChange={(e) => setNewPolicy({...newPolicy, effective_date: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                      placeholder="Effective Date"
                    />
                    <input 
                      type="text" 
                      value={newPolicy.version}
                      onChange={(e) => setNewPolicy({...newPolicy, version: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                      placeholder="Version (e.g. 1.0)"
                    />
                  </div>
                  <textarea 
                    placeholder="Description (optional)"
                    value={newPolicy.description}
                    onChange={(e) => setNewPolicy({...newPolicy, description: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none h-16"
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="policy-requestable"
                        checked={newPolicy.is_requestable === 1}
                        onChange={(e) => setNewPolicy({...newPolicy, is_requestable: e.target.checked ? 1 : 0})}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <label htmlFor="policy-requestable" className="text-sm font-medium text-slate-700">
                        Allow users to request this policy
                      </label>
                    </div>
                    <Button onClick={handleAddPolicy} size="sm" className="sm:w-auto w-full">Add to List</Button>
                  </div>
                </div>
              )}
            </div>

            {policies.length === 0 && !(user?.role === 'admin' || user?.role === 'moderator') && (
              <div className="text-center py-8 text-slate-500">
                No policies available for this product.
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
