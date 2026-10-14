import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TopNav } from './TopNav';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { useAuth } from '../../contexts/AuthContext';

export function Layout({ children, activeSection }: { children: React.ReactNode, activeSection: string }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { siteSettings } = useAuth();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 flex flex-col">
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:shadow-lg"
      >
        Skip to content
      </a>
      <div className="print:hidden sticky top-0 z-50 w-full">
        <TopNav 
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} 
        />
      </div>
      
      <div className="flex flex-1 overflow-hidden print:overflow-visible print:block">
        <div className="print:hidden">
          <Sidebar 
            isOpen={isSidebarOpen} 
            onClose={() => setIsSidebarOpen(false)}
            activeSection={activeSection}
          />
        </div>
        
        <main ref={mainRef} id="main-content" className="flex-1 lg:ml-64 print:ml-0 overflow-y-auto print:overflow-visible bg-slate-50/50 print:bg-white outline-none flex flex-col justify-between" tabIndex={-1}>
          {/* Breadcrumb Navigation Bar below the main header */}
          <div className="print:hidden border-b border-slate-200/80 bg-white/90 backdrop-blur-xs sticky top-0 z-30 shadow-2xs">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
              <Breadcrumbs />
            </div>
          </div>

          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 print:py-0 flex-1 w-full">
            {children}
          </div>

          {/* Right side footer with NDA, Cookie statement, and Privacy notice */}
          <footer className="print:hidden border-t border-slate-200 bg-white py-6 mt-auto">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>© {new Date().getFullYear()} {siteSettings.site_name || 'Bjorn Lunden'}. All rights reserved.</span>
              </div>
              <div className="flex flex-wrap items-center gap-6 font-medium text-slate-600">
                <Link 
                  to="/nda" 
                  className="hover:text-slate-900 transition-colors"
                >
                  Non-Disclosure Agreement (NDA)
                </Link>
                <Link 
                  to="/cookies" 
                  className="hover:text-slate-900 transition-colors"
                >
                  Cookie Statement
                </Link>
                <Link 
                  to="/privacy" 
                  className="hover:text-slate-900 transition-colors"
                >
                  Privacy Notice
                </Link>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
