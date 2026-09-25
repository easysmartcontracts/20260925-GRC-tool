import React, { useState } from 'react';
import { TopNav } from './TopNav';
import { Sidebar } from './Sidebar';

export function Layout({ children, activeSection }: { children: React.ReactNode, activeSection: string }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
        
        <main id="main-content" className="flex-1 lg:ml-64 print:ml-0 overflow-y-auto print:overflow-visible bg-slate-50/50 print:bg-white outline-none flex flex-col" tabIndex={-1}>
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 print:py-0 flex-1 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
