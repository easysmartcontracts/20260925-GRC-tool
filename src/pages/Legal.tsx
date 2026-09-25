import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Scale, FileText, Mail, Globe, CheckCircle2, XCircle, Plus, Trash2, ExternalLink, Calendar, History, Edit2, X, Save, Filter } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRequestAccess } from '../contexts/RequestAccessContext';
import { useCountry } from '../hooks/useCountry';
import { Button } from '../components/ui/Button';
import { COUNTRIES } from '../constants';
import { getLastSelectedProduct, setLastSelectedProduct, resolveTargetProduct } from '../utils/productSelection';

type LegalDocument = {
  id: number;
  product_slug: string;
  document_type: string;
  url: string;
  file_url?: string;
  effective_date: string | null;
  version: string | null;
  is_current: number;
};

const DOCUMENT_TYPES = [
  { id: 'tc', title: 'Terms and Conditions', description: 'General terms of service and usage conditions.' },
  { id: 'privacy', title: 'Privacy Notice', description: 'Details on how personal data is collected and processed.' },
  { id: 'dpa', title: 'Data Protection Agreement (DPA)', description: 'Standard agreement outlining data processing commitments.', requestable: true },
  { id: 'exit', title: 'Data Exit Strategy Addendum', description: 'Procedures for data retrieval and deletion upon termination.' },
  { id: 'sla', title: 'Service Level Agreement (SLA)', description: 'Service availability, support response times, and performance guarantees.' }
];

export function Legal() {
  const { user, publicPages, refreshPublicPages, getAuthHeaders, siteSettings } = useAuth();
  const { openRequestAccess } = useRequestAccess();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(() => slug || getLastSelectedProduct() || null);
  const [isPublic, setIsPublic] = useState(false);
  
  const [documents, setDocuments] = useState<LegalDocument[]>([]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const country = useCountry();

  // Admin state
  const [isAdding, setIsAdding] = useState<string | null>(null); // document_type
  const [customSectionTitle, setCustomSectionTitle] = useState('');
  const [editingDoc, setEditingDoc] = useState<LegalDocument | null>(null);
  const [newDoc, setNewDoc] = useState<Partial<LegalDocument>>({
    url: '',
    file_url: '',
    effective_date: '',
    version: '',
    is_current: 1
  });

  const customTypes = Array.from(new Set(
    documents
      .map(d => d.document_type)
      .filter(type => !DOCUMENT_TYPES.find(dt => dt.id === type))
  )).map((typeId: unknown) => ({
    id: typeId as string,
    title: typeId as string,
    description: 'Custom document section.',
    requestable: false
  }));

  const allDocumentSections = [...DOCUMENT_TYPES, ...customTypes];

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
      if (target && target !== slug) {
        navigate(`/legal/${target}`, { replace: true });
      }
    }
  }, [country, displayProducts, slug, navigate]);

  const fetchDocuments = () => {
    if (selectedProduct) {
      fetch(`/api/public/product-legal/${selectedProduct}`)
        .then(res => res.json())
        .then(data => {
          setDocuments(data);
        });
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedProduct]);

  useEffect(() => {
    setIsPublic(publicPages.includes('legal'));
  }, [publicPages]);

  const togglePublic = async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return;
    
    try {
      const res = await fetch('/api/admin/pages/legal', {
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

  const handleSaveDoc = async (document_type: string) => {
    if (!selectedProduct) return;
    
    try {
      const isUpdate = !!editingDoc;
      const url = isUpdate ? `/api/admin/product-legal/${editingDoc.id}` : `/api/admin/product-legal/${selectedProduct}`;
      const method = isUpdate ? 'PUT' : 'POST';
      const body = {
        ...newDoc,
        document_type,
        product_slug: selectedProduct
      };

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        fetchDocuments();
        setIsAdding(null);
        setEditingDoc(null);
        setNewDoc({ url: '', effective_date: '', version: '', is_current: 1 });
        setToast({ message: `Document ${isUpdate ? 'updated' : 'added'} successfully!`, type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to save document', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteDoc = async (id: number) => {
    if (!confirm('Are you sure you want to delete this document version?')) return;
    
    try {
      const res = await fetch(`/api/admin/product-legal/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      
      if (res.ok) {
        fetchDocuments();
        setToast({ message: 'Document deleted successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to delete document', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const startEdit = (doc: LegalDocument) => {
    setEditingDoc(doc);
    setNewDoc({
      url: doc.url,
      effective_date: doc.effective_date || '',
      version: doc.version || '',
      is_current: doc.is_current
    });
    setIsAdding(doc.document_type);
  };

  const cancelEdit = () => {
    setIsAdding(null);
    setEditingDoc(null);
    setNewDoc({ url: '', file_url: '', effective_date: '', version: '', is_current: 1 });
    setCustomSectionTitle('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('document', file);

    try {
      const res = await fetch('/api/admin/upload-pdf', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        setNewDoc(prev => ({ ...prev, file_url: data.url }));
        setToast({ message: 'File uploaded successfully!', type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: 'Failed to upload file', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: 'Network error occurred during upload', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const renderDocumentSection = (typeDef: typeof DOCUMENT_TYPES[0]) => {
    const typeDocs = documents.filter(d => d.document_type === typeDef.id);
    const currentDoc = typeDocs.find(d => d.is_current === 1) || typeDocs[0]; // Fallback to first if no current
    const previousDocs = typeDocs.filter(d => d.id !== currentDoc?.id);
    const isAdmin = user?.role === 'admin' || user?.role === 'moderator';
    const isEditingThis = isAdding === typeDef.id;

    return (
      <div key={typeDef.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 shrink-0 mt-0.5">
            <FileText className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <div className="min-h-[52px] flex flex-col justify-start">
                <h4 className="font-bold text-slate-900 text-base leading-snug">{typeDef.title}</h4>
                <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{typeDef.description}</p>
              </div>
              {isAdmin && !isEditingThis && (
                <Button variant="outline" size="sm" onClick={() => {
                  setIsAdding(typeDef.id);
                  setEditingDoc(null);
                  setNewDoc({ url: '', file_url: '', effective_date: '', version: '', is_current: 1 });
                }} className="shrink-0 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Version
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content Body - flex-1 and flex-col justify-end ensures bottom alignment of View Document */}
        <div className="flex-1 flex flex-col justify-end">
          {isEditingThis ? (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
              <h5 className="font-medium text-sm text-slate-900 flex items-center gap-2">
                {editingDoc ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingDoc ? 'Edit Version' : 'Add New Version'}
              </h5>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Document URL</label>
                  <input 
                    type="url" 
                    value={newDoc.url}
                    onChange={(e) => setNewDoc({...newDoc, url: e.target.value})}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Or Upload PDF Document</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      accept="application/pdf"
                      onChange={handleFileUpload}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    {newDoc.file_url && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md shrink-0 border border-green-200">
                        Uploaded
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Effective Date</label>
                    <input 
                      type="date" 
                      value={newDoc.effective_date || ''}
                      onChange={(e) => setNewDoc({...newDoc, effective_date: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Version (e.g. v1.2)</label>
                    <input 
                      type="text" 
                      value={newDoc.version || ''}
                      onChange={(e) => setNewDoc({...newDoc, version: e.target.value})}
                      placeholder="v1.0"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id={`current-${typeDef.id}`}
                    checked={newDoc.is_current === 1}
                    onChange={(e) => setNewDoc({...newDoc, is_current: e.target.checked ? 1 : 0})}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <label htmlFor={`current-${typeDef.id}`} className="text-sm text-slate-700">
                    Set as current version
                  </label>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={cancelEdit} className="flex-1">
                  Cancel
                </Button>
                <Button size="sm" onClick={() => handleSaveDoc(typeDef.id)} className="flex-1" disabled={!newDoc.url && !newDoc.file_url}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-end">
              {currentDoc ? (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 mt-auto flex flex-col justify-between min-h-[104px]">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">Current</span>
                      {currentDoc.version && (
                        <span className="text-xs font-medium text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded-md">{currentDoc.version}</span>
                      )}
                      {currentDoc.effective_date && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" /> Effective: {new Date(currentDoc.effective_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => startEdit(currentDoc)} className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors" title="Edit Version">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteDoc(currentDoc.id)} className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors" title="Delete Version">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-slate-200/70 flex items-center justify-between">
                    <a 
                      href={currentDoc.file_url || currentDoc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors group"
                    >
                      View Document <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50/50 rounded-xl p-4 border border-dashed border-slate-200 mt-auto min-h-[104px] flex items-center justify-center text-sm text-slate-400 italic">
                  No documents available.
                </div>
              )}

              {previousDocs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <History className="w-3 h-3" /> Previous Versions
                  </h5>
                  <ul className="space-y-2">
                    {previousDocs.map(doc => (
                      <li key={doc.id} className="flex items-center justify-between text-sm p-2 hover:bg-slate-50 rounded-md border border-transparent hover:border-slate-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <a href={doc.file_url || doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                            {doc.version || 'Previous Version'} <ExternalLink className="w-3 h-3" />
                          </a>
                          {doc.effective_date && (
                            <span className="text-xs text-slate-500">
                              Effective: {new Date(doc.effective_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(doc)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteDoc(doc.id)} className="p-1 text-slate-400 hover:text-red-600 rounded">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {typeDef.requestable && !isEditingThis && currentDoc && (
          <div className="mt-3 pt-4 border-t border-slate-100">
            <button 
              type="button"
              onClick={() => {
                const productName = products.find(p => p.slug === selectedProduct)?.name || '';
                openRequestAccess({
                  documentName: `Data Protection Agreement (DPA) - ${productName}`,
                  productName,
                  productSlug: selectedProduct || 'general',
                  documentType: 'dpa',
                  recipientEmail: siteSettings?.mailto_legal || 'security@bjornlunden.com'
                });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors w-full justify-center"
            >
              <Mail className="w-4 h-4" />
              Request Signed Copy
            </button>
          </div>
        )}
      </div>
    );
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Legal Documents</h1>
          <p className="text-slate-600 mt-1">Review terms, privacy notices, SLAs, and data protection agreements.</p>
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
                    navigate(`/legal/${product.slug}`);
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
          <Scale className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No Products Available</h3>
          <p className="text-slate-500 max-w-md mx-auto mt-2">There are currently no products to display.</p>
        </div>
      )}

      {selectedProduct && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-700">
                <Scale className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Legal & Privacy Documents</h2>
                <p className="text-slate-600 text-sm">Documents applicable to this product.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
            {allDocumentSections.map(typeDef => renderDocumentSection(typeDef))}
          </div>

          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <div className="mt-8 pt-8 border-t border-slate-100">
              {isAdding === 'new_custom' ? (
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-600" /> Add Custom Document Section
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Document Title / Type Name *</label>
                      <input 
                        type="text" 
                        value={customSectionTitle}
                        onChange={(e) => setCustomSectionTitle(e.target.value)}
                        placeholder="e.g. Master Services Agreement"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Document URL</label>
                      <input 
                        type="url" 
                        value={newDoc.url}
                        onChange={(e) => setNewDoc({...newDoc, url: e.target.value})}
                        placeholder="https://..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Or Upload PDF Document</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="file" 
                          accept="application/pdf"
                          onChange={handleFileUpload}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                        {newDoc.file_url && (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md shrink-0 border border-green-200">
                            Uploaded
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Effective Date</label>
                        <input 
                          type="date" 
                          value={newDoc.effective_date || ''}
                          onChange={(e) => setNewDoc({...newDoc, effective_date: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
                        <input 
                          type="text" 
                          value={newDoc.version || ''}
                          onChange={(e) => setNewDoc({...newDoc, version: e.target.value})}
                          placeholder="e.g. v1.0"
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input 
                        type="checkbox" 
                        id="custom-current"
                        checked={newDoc.is_current === 1}
                        onChange={(e) => setNewDoc({...newDoc, is_current: e.target.checked ? 1 : 0})}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                      <label htmlFor="custom-current" className="text-sm font-medium text-slate-700">
                        Set as current active version
                      </label>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-200 mt-6">
                      <Button variant="outline" onClick={cancelEdit} className="bg-white">
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => handleSaveDoc(customSectionTitle)} 
                        disabled={!customSectionTitle.trim() || (!newDoc.url && !newDoc.file_url)}
                        className="flex-1"
                      >
                        Save Custom Document
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <p className="text-sm text-slate-500 mb-3 text-center">Need to add a different type of legal document not listed above?</p>
                  <Button variant="outline" onClick={() => {
                    setIsAdding('new_custom');
                    setEditingDoc(null);
                    setNewDoc({ url: '', effective_date: '', version: '', is_current: 1 });
                    setCustomSectionTitle('');
                  }}>
                    <Plus className="w-4 h-4 mr-2" /> Add Custom Document Section
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
