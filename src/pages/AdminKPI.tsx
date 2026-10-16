import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { 
  Activity, 
  Mail, 
  Download, 
  ShieldCheck, 
  FileText, 
  Filter, 
  Printer, 
  Briefcase, 
  Users, 
  Target, 
  CheckCircle2, 
  Search, 
  Building2, 
  UserCheck,
  ChevronDown,
  Layers,
  Clock,
  Sparkles,
  X,
  ShieldAlert
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export interface AccessRequestItem {
  id: number;
  document_name: string;
  document_type?: string;
  product_slug?: string | null;
  requester_name: string;
  business_email: string;
  company: string;
  job_title?: string | null;
  relationship?: string | null;
  purpose?: string | null;
  comments?: string | null;
  nda_accepted?: number | boolean;
  nda_accepted_at?: string | null;
  status: string;
  ip_address?: string;
  created_at: string;
}

export function AdminKPI() {
  const { getAuthHeaders, user } = useAuth();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Global Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productFilter, setProductFilter] = useState('all');

  // Governance Specific Filters
  const [governanceSearch, setGovernanceSearch] = useState('');
  const [selectedTitleFilter, setSelectedTitleFilter] = useState('all');
  const [selectedRelFilter, setSelectedRelFilter] = useState('all');
  const [selectedPurposeFilter, setSelectedPurposeFilter] = useState('all');

  // Print & PDF Export State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Direct authenticated PDF download URL with query token
  const authToken = user?.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : '') || '';
  const pdfDownloadUrl = `/api/admin/kpi-pdf?product=${encodeURIComponent(productFilter)}${startDate ? `&start=${encodeURIComponent(startDate)}` : ''}${endDate ? `&end=${encodeURIComponent(endDate)}` : ''}${authToken ? `&token=${encodeURIComponent(authToken)}` : ''}`;

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const res = await fetch(pdfDownloadUrl, { headers: getAuthHeaders() });
      if (!res.ok) {
        throw new Error('Failed to generate PDF');
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `Bjorn-Lunden-Executive-KPI-Report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);

      setToast({ message: 'Executive KPI Report generated & downloaded successfully.', type: 'success' });
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      console.error(err);
      // Direct navigation fallback
      window.location.href = pdfDownloadUrl;
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleBrowserPrint = () => {
    const reportElem = document.getElementById('kpi-printable-report');
    if (!reportElem) {
      try { window.print(); } catch (e) {}
      return;
    }

    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Bjorn Lunden - Executive KPI Report</title>
              <style>
                @page { size: A4 portrait; margin: 12mm; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 10px; font-size: 10pt; line-height: 1.4; background: #fff; }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 16px; font-size: 9pt; }
                th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
                th { background-color: #f8fafc; font-weight: 600; text-transform: uppercase; font-size: 8pt; color: #475569; }
                h2, h3, h4 { margin-top: 0; margin-bottom: 6px; }
                .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; background: #f8fafc; text-align: center; }
                .border-b-2 { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
                .text-blue-600 { color: #2563eb; }
                .text-emerald-700 { color: #047857; }
                .text-purple-700 { color: #7e22ce; }
                .font-bold { font-weight: 700; }
                .text-xs { font-size: 8pt; }
                .text-sm { font-size: 9pt; }
                .text-xl { font-size: 14pt; }
              </style>
            </head>
            <body>
              ${reportElem.innerHTML}
            </body>
          </html>
        `);
        frameDoc.close();
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.warn('Iframe print error:', e);
            try { window.print(); } catch (err) {}
          } finally {
            setTimeout(() => {
              if (document.body.contains(iframe)) document.body.removeChild(iframe);
            }, 3000);
          }
        }, 350);
      }
    } catch (e) {
      try { window.print(); } catch (err) {}
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, productsRes, requestsRes] = await Promise.all([
          fetch('/api/admin/metrics', { headers: getAuthHeaders() }),
          fetch('/api/public/products'),
          fetch('/api/admin/access-requests', { headers: getAuthHeaders() })
        ]);
        
        if (metricsRes.ok) {
          const data = await metricsRes.json();
          setMetrics(data);
        }
        if (productsRes.ok) {
          const data = await productsRes.json();
          setProducts(data);
        }
        if (requestsRes.ok) {
          const data = await requestsRes.json();
          setAccessRequests(data);
        }
      } catch (err) {
        console.error('Failed to load KPIs', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [getAuthHeaders]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading KPI metrics...</div>;
  }

  // Filter metrics events
  const filteredMetrics = metrics.filter(m => {
    if (productFilter !== 'all' && m.product_slug !== productFilter) return false;
    
    const metricDate = new Date(m.created_at);
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (metricDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (metricDate > end) return false;
    }
    
    return true;
  });

  // Filter access requests by global filters (product & date)
  const filteredRequests = accessRequests.filter(r => {
    if (productFilter !== 'all') {
      if (productFilter === 'general') {
        if (r.product_slug && r.product_slug !== 'general') return false;
      } else if (r.product_slug !== productFilter) {
        return false;
      }
    }

    const reqDate = new Date(r.created_at);
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (reqDate < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (reqDate > end) return false;
    }

    return true;
  });

  // Calculate totals and grouping for download/request metrics
  const requests = filteredMetrics.filter(m => m.event_type.startsWith('request_'));
  const downloads = filteredMetrics.filter(m => m.event_type.startsWith('download_'));

  // Group by document type/name
  const getTopDocuments = (typePrefix: string, limit = 5) => {
    const grouped: Record<string, { name: string, product: string, count: number }> = {};
    const relevant = filteredMetrics.filter(m => m.event_type.startsWith(typePrefix));
    
    for (const m of relevant) {
      const key = `${m.item_name}-${m.product_slug}`;
      if (!grouped[key]) {
        grouped[key] = { name: m.item_name, product: m.product_slug, count: 0 };
      }
      grouped[key].count++;
    }
    
    return Object.values(grouped).sort((a, b) => b.count - a.count).slice(0, limit);
  };

  const topRequested = getTopDocuments('request_', 5);
  const topDownloaded = getTopDocuments('download_', 5);

  // Generate last 30 days chart data
  const getChartData = () => {
    const data = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      data.push({
        date: dateStr,
        displayDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        downloads: 0,
        requests: 0,
      });
    }

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    filteredMetrics.forEach((m: any) => {
      const metricDate = new Date(m.created_at);
      if (metricDate > thirtyDaysAgo) {
        const dateStr = metricDate.toISOString().split('T')[0];
        const dayData = data.find(d => d.date === dateStr);
        if (dayData) {
          if (m.event_type.startsWith('download_')) {
            dayData.downloads++;
          } else if (m.event_type.startsWith('request_')) {
            dayData.requests++;
          }
        }
      }
    });

    return data;
  };

  const chartData = getChartData();

  // ==========================================
  // REQUEST GOVERNANCE AGGREGATION & BREAKDOWN
  // ==========================================
  const totalReqCount = filteredRequests.length;

  // 1. Job Titles Aggregation
  const jobTitleMap: Record<string, { 
    count: number; 
    companies: Set<string>; 
    relationships: Record<string, number>; 
    purposes: Record<string, number> 
  }> = {};

  filteredRequests.forEach(r => {
    const title = (r.job_title || '').trim() || 'Unspecified Role';
    if (!jobTitleMap[title]) {
      jobTitleMap[title] = { count: 0, companies: new Set(), relationships: {}, purposes: {} };
    }
    jobTitleMap[title].count++;
    if (r.company) jobTitleMap[title].companies.add(r.company);

    const rel = (r.relationship || '').trim() || 'Unspecified';
    jobTitleMap[title].relationships[rel] = (jobTitleMap[title].relationships[rel] || 0) + 1;

    const purp = (r.purpose || '').trim() || 'Unspecified';
    jobTitleMap[title].purposes[purp] = (jobTitleMap[title].purposes[purp] || 0) + 1;
  });

  const jobTitleStats = Object.entries(jobTitleMap).map(([title, data]) => ({
    title,
    count: data.count,
    percentage: totalReqCount > 0 ? Math.round((data.count / totalReqCount) * 100) : 0,
    uniqueCompanies: data.companies.size,
    topRelationship: Object.entries(data.relationships).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
    topPurpose: Object.entries(data.purposes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
  })).sort((a, b) => b.count - a.count);

  // 2. Relationship to Bjorn Lunden Aggregation
  const relationshipMap: Record<string, { 
    count: number; 
    titles: Record<string, number>; 
    purposes: Record<string, number>;
    companies: Set<string>;
  }> = {};

  filteredRequests.forEach(r => {
    const rel = (r.relationship || '').trim() || 'Unspecified Relationship';
    if (!relationshipMap[rel]) {
      relationshipMap[rel] = { count: 0, titles: {}, purposes: {}, companies: new Set() };
    }
    relationshipMap[rel].count++;
    if (r.company) relationshipMap[rel].companies.add(r.company);

    const title = (r.job_title || '').trim() || 'Unspecified';
    relationshipMap[rel].titles[title] = (relationshipMap[rel].titles[title] || 0) + 1;

    const purp = (r.purpose || '').trim() || 'Unspecified';
    relationshipMap[rel].purposes[purp] = (relationshipMap[rel].purposes[purp] || 0) + 1;
  });

  const relationshipStats = Object.entries(relationshipMap).map(([relationship, data]) => ({
    relationship,
    count: data.count,
    percentage: totalReqCount > 0 ? Math.round((data.count / totalReqCount) * 100) : 0,
    uniqueCompanies: data.companies.size,
    topJobTitle: Object.entries(data.titles).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
    topPurpose: Object.entries(data.purposes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
  })).sort((a, b) => b.count - a.count);

  // 3. Purpose of Request Aggregation
  const purposeMap: Record<string, { 
    count: number; 
    titles: Record<string, number>; 
    relationships: Record<string, number>;
    companies: Set<string>;
  }> = {};

  filteredRequests.forEach(r => {
    const purp = (r.purpose || '').trim() || 'Unspecified Purpose';
    if (!purposeMap[purp]) {
      purposeMap[purp] = { count: 0, titles: {}, relationships: {}, companies: new Set() };
    }
    purposeMap[purp].count++;
    if (r.company) purposeMap[purp].companies.add(r.company);

    const title = (r.job_title || '').trim() || 'Unspecified';
    purposeMap[purp].titles[title] = (purposeMap[purp].titles[title] || 0) + 1;

    const rel = (r.relationship || '').trim() || 'Unspecified';
    purposeMap[purp].relationships[rel] = (purposeMap[purp].relationships[rel] || 0) + 1;
  });

  const purposeStats = Object.entries(purposeMap).map(([purpose, data]) => ({
    purpose,
    count: data.count,
    percentage: totalReqCount > 0 ? Math.round((data.count / totalReqCount) * 100) : 0,
    uniqueCompanies: data.companies.size,
    topJobTitle: Object.entries(data.titles).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
    topRelationship: Object.entries(data.relationships).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
  })).sort((a, b) => b.count - a.count);

  // Top summary items
  const topJobTitle = jobTitleStats[0] || null;
  const topRelationship = relationshipStats[0] || null;
  const topPurpose = purposeStats[0] || null;
  const ndaAcceptedCount = filteredRequests.filter(r => r.nda_accepted).length;
  const ndaComplianceRate = totalReqCount > 0 ? Math.round((ndaAcceptedCount / totalReqCount) * 100) : 100;

  // Filtered requests for the Governance Registry table
  const searchFilteredRequests = filteredRequests.filter(r => {
    const titleVal = (r.job_title || 'Unspecified Role').trim();
    const relVal = (r.relationship || 'Unspecified Relationship').trim();
    const purpVal = (r.purpose || 'Unspecified Purpose').trim();

    if (selectedTitleFilter !== 'all' && titleVal !== selectedTitleFilter) return false;
    if (selectedRelFilter !== 'all' && relVal !== selectedRelFilter) return false;
    if (selectedPurposeFilter !== 'all' && purpVal !== selectedPurposeFilter) return false;

    if (governanceSearch.trim()) {
      const q = governanceSearch.toLowerCase();
      const matchName = r.requester_name?.toLowerCase().includes(q);
      const matchEmail = r.business_email?.toLowerCase().includes(q);
      const matchCompany = r.company?.toLowerCase().includes(q);
      const matchTitle = r.job_title?.toLowerCase().includes(q);
      const matchRel = r.relationship?.toLowerCase().includes(q);
      const matchPurpose = r.purpose?.toLowerCase().includes(q);
      const matchDoc = r.document_name?.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchCompany && !matchTitle && !matchRel && !matchPurpose && !matchDoc) {
        return false;
      }
    }

    return true;
  });

  // Badge stylers for clear visual identity
  const getJobTitleBadge = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('ciso') || t.includes('security')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (t.includes('dpo') || t.includes('privacy') || t.includes('compliance')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (t.includes('legal') || t.includes('counsel')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (t.includes('auditor') || t.includes('assessor')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (t.includes('cto') || t.includes('cio') || t.includes('vp') || t.includes('director')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (t.includes('finance') || t.includes('cfo') || t.includes('accounting')) {
      return 'bg-teal-50 text-teal-700 border-teal-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getRelationshipBadge = (rel: string) => {
    const r = rel.toLowerCase();
    if (r.includes('current customer') || r.includes('client')) {
      return 'bg-blue-100/80 text-blue-800 border-blue-200 font-medium';
    }
    if (r.includes('prospective') || r.includes('evaluation')) {
      return 'bg-purple-100/80 text-purple-800 border-purple-200 font-medium';
    }
    if (r.includes('partner') || r.includes('bureau') || r.includes('reseller')) {
      return 'bg-emerald-100/80 text-emerald-800 border-emerald-200 font-medium';
    }
    if (r.includes('auditor') || r.includes('compliance')) {
      return 'bg-amber-100/80 text-amber-800 border-amber-200 font-medium';
    }
    if (r.includes('vendor') || r.includes('supplier')) {
      return 'bg-slate-100 text-slate-800 border-slate-300 font-medium';
    }
    return 'bg-zinc-100 text-zinc-800 border-zinc-200 font-medium';
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s === 'fulfilled') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (s === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-in fade-in duration-300 relative">
      
      {/* Toast Feedback */}
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-xl z-[100] flex items-center gap-2.5 shadow-xl border animate-in slide-in-from-top-2 duration-300 print:hidden ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />}
          <span className="font-semibold text-xs sm:text-sm">{toast.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Executive KPI &amp; Governance Dashboard
            </h1>
          </div>
          <p className="text-slate-500 mt-1 max-w-2xl text-sm">
            Comprehensive analytics on document access, verified requester job titles, stakeholder relationships with Bjorn Lunden, and compliance evaluation purposes.
          </p>
        </div>
        <div className="flex items-center gap-2.5 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 whitespace-nowrap shadow-sm text-xs sm:text-sm font-semibold border-slate-300 hover:bg-slate-100"
            title="Download official Executive KPI Report PDF"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setShowPrintModal(true);
            }}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap shadow-sm text-xs sm:text-sm font-semibold cursor-pointer"
            title="Open printable executive report preview & print"
          >
            <Printer className="w-4 h-4 text-slate-300" />
            <span>Print Report</span>
          </Button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <Card className="print:hidden border-slate-200 shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Product Scope
              </label>
              <select
                value={productFilter}
                onChange={e => setProductFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg bg-white"
              >
                <option value="all">All Products (Global Scope)</option>
                <option value="general">General Updates / Unspecified</option>
                {products.map(p => (
                  <option key={p.slug} value={p.slug}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>
            {(startDate || endDate || productFilter !== 'all') && (
              <div className="w-full sm:w-auto flex justify-end">
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setProductFilter('all');
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ======================================================== */}
      {/* SECTION 1: REQUEST GOVERNANCE & STAKEHOLDER INTELLIGENCE */}
      {/* ======================================================== */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Stakeholder &amp; Request Intelligence
              </h2>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                {totalReqCount} Total Records
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Active monitoring of job titles requesting sensitive documentation, their verified relationship with Bjorn Lunden, and declared evaluation purposes.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>NDA Compliance: <strong>{ndaComplianceRate}% Opted-In</strong></span>
          </div>
        </div>

        {/* Governance KPI Executive Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Access Requests</p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{totalReqCount}</h3>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    Across {new Set(filteredRequests.map(r => r.company)).size} unique organizations
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Top Job Title Role</p>
                  <h3 className="text-lg font-bold text-slate-900 truncate mt-0.5" title={topJobTitle?.title || 'None'}>
                    {topJobTitle ? topJobTitle.title.split('(')[0].trim() : 'N/A'}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {topJobTitle ? `${topJobTitle.count} requests (${topJobTitle.percentage}% of total)` : 'No requests yet'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Primary Relationship</p>
                  <h3 className="text-lg font-bold text-slate-900 truncate mt-0.5" title={topRelationship?.relationship || 'None'}>
                    {topRelationship ? topRelationship.relationship : 'N/A'}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {topRelationship ? `${topRelationship.count} requests (${topRelationship.percentage}% share)` : 'No requests yet'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Target className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dominant Purpose</p>
                  <h3 className="text-lg font-bold text-slate-900 truncate mt-0.5" title={topPurpose?.purpose || 'None'}>
                    {topPurpose ? topPurpose.purpose : 'N/A'}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {topPurpose ? `${topPurpose.count} requests (${topPurpose.percentage}% of requests)` : 'No requests yet'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 3-Pillar Breakdown Visualizations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Pillar 1: Job Titles Breakdown */}
          <Card className="border-slate-200/90 shadow-sm flex flex-col">
            <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  Job Titles Requesting Info
                </CardTitle>
                <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">
                  {jobTitleStats.length} Roles
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Distribution of professional titles initiating documentation requests.
              </p>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                {jobTitleStats.slice(0, 6).map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate pr-2 max-w-[210px]" title={item.title}>
                        {item.title}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-bold text-slate-900">{item.count}</span>
                        <span className="text-slate-400 text-[11px]">({item.percentage}%)</span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(item.percentage, 4)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span className="truncate">Top Purpose: <em>{item.topPurpose}</em></span>
                      <span className="shrink-0 font-medium text-slate-600">{item.uniqueCompanies} orgs</span>
                    </div>
                  </div>
                ))}

                {jobTitleStats.length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-xs italic">
                    No job titles found for the selected filter period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pillar 2: Relationship to Bjorn Lunden Breakdown */}
          <Card className="border-slate-200/90 shadow-sm flex flex-col">
            <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Relationship to Bjorn Lunden
                </CardTitle>
                <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                  {relationshipStats.length} Segments
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Classification of requester relationship with the organization.
              </p>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                {relationshipStats.slice(0, 6).map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] border ${getRelationshipBadge(item.relationship)} truncate`} title={item.relationship}>
                          {item.relationship}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-bold text-slate-900">{item.count}</span>
                        <span className="text-slate-400 text-[11px]">({item.percentage}%)</span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(item.percentage, 4)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span className="truncate">Top Role: <em>{item.topJobTitle}</em></span>
                      <span className="shrink-0 font-medium text-slate-600">{item.uniqueCompanies} orgs</span>
                    </div>
                  </div>
                ))}

                {relationshipStats.length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-xs italic">
                    No relationships found for the selected filter period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pillar 3: Purpose of Request Breakdown */}
          <Card className="border-slate-200/90 shadow-sm flex flex-col">
            <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-600" />
                  Purpose of Request
                </CardTitle>
                <span className="text-xs font-semibold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md">
                  {purposeStats.length} Reasons
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Stated audit, privacy, or due diligence reasons for information requests.
              </p>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                {purposeStats.slice(0, 6).map((item, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate pr-2 max-w-[210px]" title={item.purpose}>
                        {item.purpose}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-bold text-slate-900">{item.count}</span>
                        <span className="text-slate-400 text-[11px]">({item.percentage}%)</span>
                      </div>
                    </div>
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(item.percentage, 4)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span className="truncate">Top Role: <em>{item.topJobTitle}</em></span>
                      <span className="shrink-0 font-medium text-slate-600">{item.uniqueCompanies} orgs</span>
                    </div>
                  </div>
                ))}

                {purposeStats.length === 0 && (
                  <div className="py-8 text-center text-slate-400 text-xs italic">
                    No request purposes recorded for the selected filter period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Multi-Dimensional Cross-Tabulation Matrix */}
        <Card className="border-slate-200/90 shadow-sm overflow-hidden">
          <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/70">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Stakeholder Cross-Analysis Matrix
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clear overview cross-referencing Job Titles with their dominant Relationships to Bjorn Lunden and stated Purposes.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Aggregation of active request patterns
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Job Title &amp; Professional Role</th>
                    <th className="px-5 py-3.5">Relationship with Bjorn Lunden</th>
                    <th className="px-5 py-3.5">Primary Purpose of Request</th>
                    <th className="px-5 py-3.5 text-center">Requests</th>
                    <th className="px-5 py-3.5 text-right">Organizations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobTitleStats.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-md text-xs border font-medium ${getJobTitleBadge(item.title)}`}>
                            {item.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded border ${getRelationshipBadge(item.topRelationship)}`}>
                          {item.topRelationship}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 text-xs font-medium max-w-xs truncate" title={item.topPurpose}>
                        {item.topPurpose}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {item.count}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-medium text-slate-700 text-xs">
                        {item.uniqueCompanies} {item.uniqueCompanies === 1 ? 'company' : 'companies'}
                      </td>
                    </tr>
                  ))}

                  {jobTitleStats.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-400 text-sm">
                        No stakeholder matrix records available for the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Information Requests Governance Registry */}
        <Card className="border-slate-200/90 shadow-sm overflow-hidden">
          <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/70">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  Information Requests Governance Registry
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete audit log of individual documentation requests with verified job titles, relationship status, and purpose.
                </p>
              </div>

              {/* In-table filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={governanceSearch}
                    onChange={e => setGovernanceSearch(e.target.value)}
                    placeholder="Search requester, company, role..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <select
                  value={selectedTitleFilter}
                  onChange={e => setSelectedTitleFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white max-w-[160px] truncate"
                  title="Filter by Job Title"
                >
                  <option value="all">All Job Titles</option>
                  {jobTitleStats.map(s => (
                    <option key={s.title} value={s.title}>{s.title}</option>
                  ))}
                </select>

                <select
                  value={selectedRelFilter}
                  onChange={e => setSelectedRelFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white max-w-[160px] truncate"
                  title="Filter by Relationship"
                >
                  <option value="all">All Relationships</option>
                  {relationshipStats.map(s => (
                    <option key={s.relationship} value={s.relationship}>{s.relationship}</option>
                  ))}
                </select>

                {(governanceSearch || selectedTitleFilter !== 'all' || selectedRelFilter !== 'all' || selectedPurposeFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setGovernanceSearch('');
                      setSelectedTitleFilter('all');
                      setSelectedRelFilter('all');
                      setSelectedPurposeFilter('all');
                    }}
                    className="px-2.5 py-1.5 text-xs bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Requester &amp; Company</th>
                    <th className="px-5 py-3.5">Job Title</th>
                    <th className="px-5 py-3.5">Relationship to Bjorn Lunden</th>
                    <th className="px-5 py-3.5">Purpose of Request</th>
                    <th className="px-5 py-3.5">Document Requested</th>
                    <th className="px-5 py-3.5">Timestamp</th>
                    <th className="px-5 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {searchFilteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900 text-xs">
                          {req.requester_name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                          {req.business_email}
                        </div>
                        <div className="text-[11px] font-medium text-slate-700 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{req.company}</span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2.5 py-1 rounded text-xs border ${getJobTitleBadge(req.job_title || 'Unspecified')}`}>
                          {req.job_title || 'Unspecified Role'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2.5 py-1 rounded text-xs border ${getRelationshipBadge(req.relationship || 'Unspecified')}`}>
                          {req.relationship || 'Unspecified'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="text-xs text-slate-800 font-medium max-w-xs" title={req.purpose || ''}>
                          {req.purpose || 'General compliance inquiry'}
                        </div>
                        {req.comments && (
                          <div className="text-[11px] text-slate-400 italic truncate max-w-xs mt-0.5" title={req.comments}>
                            Note: {req.comments}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-800 text-xs truncate max-w-[200px]" title={req.document_name}>
                          {req.document_name}
                        </div>
                        {req.product_slug && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">
                            {req.product_slug}
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <div className="text-[10px] text-slate-400">
                          {new Date(req.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] border font-bold capitalize ${getStatusBadge(req.status)}`}>
                          {req.status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {searchFilteredRequests.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-400 text-xs">
                        No information requests match the active filters or search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ======================================================== */}
      {/* SECTION 2: ACCESS TRENDS & DOCUMENT ACTIVITY METRICS     */}
      {/* ======================================================== */}
      <div className="space-y-6 pt-4 border-t border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Access Trends &amp; Document Activity
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tracking requests vs direct downloads, product interaction volumes, and 30-day velocity.
          </p>
        </div>

        {/* Global Activity KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-slate-200/90 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Metric Events</p>
                  <h3 className="text-2xl font-bold text-slate-900">{requests.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200/90 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Direct Downloads</p>
                  <h3 className="text-2xl font-bold text-slate-900">{downloads.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200/90 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Unique Products</p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {new Set(filteredMetrics.map(m => m.product_slug)).size}
                  </h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200/90 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Document Types</p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {new Set(filteredMetrics.map(m => m.item_name)).size}
                  </h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 30-Day Activity Trends */}
        <Card className="border-slate-200/90 shadow-sm">
          <CardHeader className="py-4 px-5 border-b border-slate-100">
            <CardTitle className="text-lg">30-Day Activity Trends</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="h-80 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="displayDate" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => Math.floor(value) === value ? value : ''} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 'bold', color: '#0f172a', marginBottom: '0.25rem' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" name="Downloads" dataKey="downloads" stroke="#4f46e5" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  <Line type="monotone" name="Requests" dataKey="requests" stroke="#0ea5e9" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Requested & Top Downloaded Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-slate-200/90 shadow-sm overflow-hidden">
            <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/60">
              <CardTitle className="text-base font-bold text-slate-900">Top 5 Requested Documents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3">Document Name</th>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3 text-right">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topRequested.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-900 text-xs">{item.name || 'Unknown'}</td>
                      <td className="px-5 py-3 text-slate-600 text-xs font-mono">{item.product}</td>
                      <td className="px-5 py-3 text-right font-bold text-blue-600 text-xs">{item.count}</td>
                    </tr>
                  ))}
                  {topRequested.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-6 text-center text-slate-400 text-xs">
                        No requests found for current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="border-slate-200/90 shadow-sm overflow-hidden">
            <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/60">
              <CardTitle className="text-base font-bold text-slate-900">Top 5 Downloaded Documents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3">Document Name</th>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3 text-right">Downloads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topDownloaded.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-medium text-slate-900 text-xs">{item.name || 'Unknown'}</td>
                      <td className="px-5 py-3 text-slate-600 text-xs font-mono">{item.product}</td>
                      <td className="px-5 py-3 text-right font-bold text-indigo-600 text-xs">{item.count}</td>
                    </tr>
                  ))}
                  {topDownloaded.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-6 text-center text-slate-400 text-xs">
                        No downloads found for current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* General Activity Event Stream */}
        <Card className="border-slate-200/90 shadow-sm overflow-hidden">
          <CardHeader className="py-4 px-5 border-b border-slate-100 bg-slate-50/60">
            <CardTitle className="text-base font-bold text-slate-900">Recent Public Activity Stream</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">User / Requester</th>
                  <th className="px-5 py-3">Action Type</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Target Item</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMetrics.slice(0, 50).map((m: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-5 py-2.5 whitespace-nowrap text-slate-500 font-mono text-xs">
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 font-medium text-slate-900 text-xs">
                      {m.user_email || <span className="text-slate-400 italic">Unknown / Public</span>}
                    </td>
                    <td className="px-5 py-2.5">
                      <Badge className="bg-blue-50 text-blue-700 text-xs">
                        {m.event_type.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </Badge>
                    </td>
                    <td className="px-5 py-2.5 text-slate-600 text-xs font-mono">
                      {m.product_slug}
                    </td>
                    <td className="px-5 py-2.5 text-slate-700 font-medium text-xs">
                      {m.item_name}
                    </td>
                  </tr>
                ))}
                {filteredMetrics.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-slate-400 text-xs">
                      No metric events found for the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Print & PDF Preview Modal */}
      {showPrintModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 print:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl shrink-0 shadow-sm">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Executive KPI &amp; Governance Report
                  </h3>
                  <p className="text-xs text-slate-500">
                    Scope: {productFilter === 'all' ? 'Global Scope (All Products)' : productFilter} • Generated on {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="flex items-center gap-1.5 px-3.5 py-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  title="Download and save official PDF report"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isGeneratingPdf ? 'Generating...' : 'Save PDF'}</span>
                </Button>
                <Button
                  size="sm"
                  onClick={handleBrowserPrint}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  title="Print report directly via browser"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors ml-1"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Note banner */}
            <div className="px-5 py-2.5 bg-blue-50/90 border-b border-blue-100 flex items-center justify-between text-xs text-blue-900 shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Report Ready:</strong> The complete PDF report has been generated and downloaded to your computer.
                </span>
              </div>
              <span className="text-[11px] text-blue-700 hidden md:inline font-mono">
                Click "Print Document" or "Save PDF"
              </span>
            </div>

            {/* Modal Body: Complete Printable Document Preview */}
            <div id="kpi-printable-report" className="p-6 overflow-y-auto space-y-6 text-slate-900 bg-white">
              {/* Document Header Banner */}
              <div className="border-b-2 border-slate-900 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
                      BJORN LUNDEN • TRUST CENTER COMPLIANCE PUBLICATION
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                      Executive KPI &amp; Stakeholder Governance Report
                    </h2>
                    <div className="text-xs text-slate-600 mt-1">
                      Scope: <strong>{productFilter === 'all' ? 'Global Scope (All Products)' : productFilter}</strong> • Date Period: <strong>{(startDate || endDate) ? `${startDate || 'Earliest'} to ${endDate || 'Latest'}` : 'All Time'}</strong>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div className="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px] uppercase mb-1 border border-emerald-300">
                      Certified Legal Registry
                    </div>
                    <div>Ref: KPI-REP-{new Date().toISOString().split('T')[0]}</div>
                    <div>Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                </div>
              </div>

              {/* KPI Summary Grid in Preview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Requests</div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">{totalReqCount}</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Direct Downloads</div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">{downloads.length}</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">NDA Compliance</div>
                  <div className="text-xl font-bold text-emerald-700 mt-0.5">{ndaComplianceRate}%</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Unique Orgs</div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">{new Set(filteredRequests.map(r => r.company)).size}</div>
                </div>
              </div>

              {/* Stakeholder Intelligence Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" />
                  1. Professional Job Titles &amp; Stakeholder Breakdown
                </h4>
                <table className="w-full text-xs text-left border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2 border-r border-slate-200">Professional Job Title</th>
                      <th className="p-2 border-r border-slate-200">Primary Relationship</th>
                      <th className="p-2 border-r border-slate-200">Primary Purpose</th>
                      <th className="p-2 text-center border-r border-slate-200">Count</th>
                      <th className="p-2 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {jobTitleStats.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="p-2 font-medium text-slate-900 border-r border-slate-100">{item.title}</td>
                        <td className="p-2 text-slate-600 border-r border-slate-100">{item.topRelationship}</td>
                        <td className="p-2 text-slate-600 border-r border-slate-100">{item.topPurpose}</td>
                        <td className="p-2 text-center font-bold text-blue-600 border-r border-slate-100">{item.count}</td>
                        <td className="p-2 text-right font-medium text-slate-500">{item.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Relationships & Purposes Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    2. Relationships to Bjorn Lunden
                  </h4>
                  <table className="w-full text-xs text-left border border-slate-200">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2 border-r border-slate-200">Relationship</th>
                        <th className="p-2 text-center border-r border-slate-200">Count</th>
                        <th className="p-2 text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {relationshipStats.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                          <td className="p-2 font-medium text-slate-900 border-r border-slate-100">{item.relationship}</td>
                          <td className="p-2 text-center font-bold text-emerald-700 border-r border-slate-100">{item.count}</td>
                          <td className="p-2 text-right text-slate-500">{item.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-purple-600" />
                    3. Evaluation Purposes
                  </h4>
                  <table className="w-full text-xs text-left border border-slate-200">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2 border-r border-slate-200">Purpose</th>
                        <th className="p-2 text-center border-r border-slate-200">Count</th>
                        <th className="p-2 text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {purposeStats.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                          <td className="p-2 font-medium text-slate-900 border-r border-slate-100 truncate max-w-[170px]" title={item.purpose}>{item.purpose}</td>
                          <td className="p-2 text-center font-bold text-purple-700 border-r border-slate-100">{item.count}</td>
                          <td className="p-2 text-right text-slate-500">{item.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Information Requests Registry */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  4. Information Requests Audit Log
                </h4>
                <table className="w-full text-xs text-left border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2 border-r border-slate-200">Requester &amp; Company</th>
                      <th className="p-2 border-r border-slate-200">Job Title</th>
                      <th className="p-2 border-r border-slate-200">Relationship</th>
                      <th className="p-2 border-r border-slate-200">Document</th>
                      <th className="p-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.slice(0, 20).map((req, idx) => (
                      <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="p-2 font-medium text-slate-900 border-r border-slate-100">
                          {req.requester_name} <span className="text-slate-500">({req.company})</span>
                        </td>
                        <td className="p-2 text-slate-700 border-r border-slate-100">{req.job_title || 'Unspecified'}</td>
                        <td className="p-2 text-slate-600 border-r border-slate-100">{req.relationship || 'Unspecified'}</td>
                        <td className="p-2 text-slate-700 border-r border-slate-100">{req.document_name}</td>
                        <td className="p-2 text-right font-bold capitalize text-blue-700">{req.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Bjorn Lunden Trust Center • Executive KPI &amp; Access Governance Record
              </span>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
