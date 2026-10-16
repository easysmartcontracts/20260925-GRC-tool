import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getLastSelectedProduct } from '../../utils/productSelection';
import { fetchPublicProducts } from '../../utils/api';

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  activeSection: string;
};

export function Sidebar({ isOpen, onClose, activeSection }: SidebarProps) {
  const { user, publicPages, siteSettings } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [lastSelected, setLastSelected] = useState<string | null>(getLastSelectedProduct());

  useEffect(() => {
    const handleProductChange = (e: any) => {
      setLastSelected(e.detail || getLastSelectedProduct());
    };
    window.addEventListener('selected-product-change', handleProductChange);
    return () => window.removeEventListener('selected-product-change', handleProductChange);
  }, []);

  useEffect(() => {
    fetchPublicProducts().then(data => {
      if (Array.isArray(data)) {
        setProducts(data);
      }
    });
  }, []);

  const navItems = [
    { 
      id: 'dashboard', 
      label: 'SOFTWARE OVERVIEW', 
      path: '/' 
    },
    { 
      id: 'security-overview', 
      label: 'SECURITY FEATURES', 
      path: lastSelected ? `/security-features/${lastSelected}` : '/security-features' 
    },
    { 
      id: 'certifications', 
      label: 'CERTIFICATIONS', 
      path: lastSelected ? `/certifications/${lastSelected}` : '/certifications' 
    },
    { 
      id: 'legal', 
      label: 'LEGAL DOCUMENTS', 
      path: lastSelected ? `/legal/${lastSelected}` : '/legal' 
    },
    { 
      id: 'subprocessors', 
      label: 'SUBPROCESSORS', 
      path: lastSelected ? `/subprocessors/${lastSelected}` : '/subprocessors' 
    },
  ];

  const visibleItems = navItems.filter(item => {
    if (user?.role === 'admin' || user?.role === 'moderator') return true;
    if (publicPages.includes(item.id)) return true;
    if (user?.role === 'viewer' && user.allowedModules?.includes(item.id)) return true;
    return false;
  });

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed ${siteSettings?.top_bar_links?.length > 0 ? 'top-24' : 'top-16'} bottom-0 left-0 z-40 w-64 bg-slate-50 border-r border-slate-200 
        overflow-y-auto transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <nav className="p-4 space-y-6" aria-label="Main Navigation">
          
          {/* Main Navigation Items - No category head titles */}
          <ul className="space-y-1.5">
            {visibleItems.map((item) => {
              const isActive = activeSection === item.id || (item.id === 'legal' && activeSection === 'policies');
              return (
                <li key={item.id}>
                  <Link
                    to={item.path}
                    onClick={onClose}
                    aria-current={isActive ? 'page' : undefined}
                    className={`block px-3.5 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors ${
                      isActive 
                        ? 'bg-slate-200 text-slate-900 shadow-2xs' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Admin Section */}
          {(user?.role === 'admin' || user?.role === 'moderator') && (
            <div className="pt-4 border-t border-slate-200" aria-label="Administration">
              <h3 className="px-3 font-bold text-slate-700 uppercase tracking-wider mb-2 text-xs">
                Administration
              </h3>
              <ul className="space-y-1.5">
                <li>
                  <Link
                    to="/admin"
                    onClick={onClose}
                    aria-current={activeSection === 'admin' ? 'page' : undefined}
                    className={`block px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeSection === 'admin' 
                        ? 'bg-slate-200 text-slate-900 font-semibold' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    Admin Portal
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/kpi"
                    onClick={onClose}
                    aria-current={activeSection === 'admin-kpi' ? 'page' : undefined}
                    className={`block px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeSection === 'admin-kpi' 
                        ? 'bg-slate-200 text-slate-900 font-semibold' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    KPI Dashboard
                  </Link>
                </li>
              </ul>
            </div>
          )}

        </nav>
      </aside>
    </>
  );
}

