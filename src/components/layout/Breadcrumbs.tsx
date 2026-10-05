import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path?: string;
  isCurrent?: boolean;
  isHome?: boolean;
}

interface Product {
  slug: string;
  name: string;
  category?: string;
}

export function Breadcrumbs() {
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/public/products')
      .then(res => res.json())
      .then(data => {
        if (isMounted && Array.isArray(data)) {
          setProducts(data);
        }
      })
      .catch(err => {
        console.error('Failed to load products for breadcrumbs:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const formatSlug = (slug: string): string => {
    const found = products.find(p => p.slug.toLowerCase() === slug.toLowerCase());
    if (found) return found.name;
    return slug
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const crumbs = useMemo<BreadcrumbItem[]>(() => {
    const pathname = location.pathname;

    // 1. Home / Root Dashboard
    if (pathname === '/' || pathname === '') {
      return [
        { label: 'Trust Center', path: '/', isHome: true, isCurrent: true }
      ];
    }

    // 2. Login Page
    if (pathname === '/login') {
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Sign In', path: '/login', isCurrent: true }
      ];
    }

    // 3. NDA Page
    if (pathname === '/nda') {
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Legal Documents', path: '/legal' },
        { label: 'Non-Disclosure Agreement', path: '/nda', isCurrent: true }
      ];
    }

    // 3b. Privacy Notice Page
    if (pathname === '/privacy') {
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Legal Documents', path: '/legal' },
        { label: 'Privacy Notice', path: '/privacy', isCurrent: true }
      ];
    }

    // 3c. Cookie Statement Page
    if (pathname === '/cookies') {
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Legal Documents', path: '/legal' },
        { label: 'Cookie Statement', path: '/cookies', isCurrent: true }
      ];
    }

    // 4. Admin Portal & KPI
    if (pathname === '/admin/kpi') {
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Admin Portal', path: '/admin' },
        { label: 'Executive KPI Dashboard', path: '/admin/kpi', isCurrent: true }
      ];
    }

    if (pathname === '/admin') {
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Admin Portal', path: '/admin', isCurrent: true }
      ];
    }

    // 5. All Documents
    if (pathname === '/documents') {
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'All Documents', path: '/documents', isCurrent: true }
      ];
    }

    // 6. Direct Product Detail: /product/:slug
    if (pathname.startsWith('/product/')) {
      const slug = pathname.split('/')[2];
      const productName = slug ? formatSlug(slug) : 'Product';
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Products', path: '/' },
        { label: productName, path: pathname, isCurrent: true }
      ];
    }

    // 7. Security Category
    if (pathname.startsWith('/security-overview')) {
      const slug = pathname.split('/')[2];
      if (slug) {
        return [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Security Overview', path: '/security-overview' },
          { label: formatSlug(slug), path: pathname, isCurrent: true }
        ];
      }
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Security Overview', path: '/security-overview', isCurrent: true }
      ];
    }

    if (pathname.startsWith('/controls')) {
      const slug = pathname.split('/')[2];
      if (slug) {
        return [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Controls', path: '/controls' },
          { label: formatSlug(slug), path: pathname, isCurrent: true }
        ];
      }
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Controls', path: '/controls', isCurrent: true }
      ];
    }

    // 8. Compliance Category
    if (pathname.startsWith('/certifications')) {
      const slug = pathname.split('/')[2];
      if (slug) {
        return [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Certifications & Reports', path: '/certifications' },
          { label: formatSlug(slug), path: pathname, isCurrent: true }
        ];
      }
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Certifications & Reports', path: '/certifications', isCurrent: true }
      ];
    }

    if (pathname.startsWith('/policies')) {
      const slug = pathname.split('/')[2];
      if (slug) {
        return [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Policies', path: '/policies' },
          { label: formatSlug(slug), path: pathname, isCurrent: true }
        ];
      }
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Policies', path: '/policies', isCurrent: true }
      ];
    }

    // 9. Legal Category
    if (pathname.startsWith('/legal')) {
      const slug = pathname.split('/')[2];
      if (slug) {
        return [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Legal Documents', path: '/legal' },
          { label: formatSlug(slug), path: pathname, isCurrent: true }
        ];
      }
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Legal Documents', path: '/legal', isCurrent: true }
      ];
    }

    if (pathname.startsWith('/subprocessors')) {
      const slug = pathname.split('/')[2];
      if (slug) {
        return [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Subprocessors', path: '/subprocessors' },
          { label: formatSlug(slug), path: pathname, isCurrent: true }
        ];
      }
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Subprocessors', path: '/subprocessors', isCurrent: true }
      ];
    }

    if (pathname === '/dpa') {
      return [
        { label: 'Home', path: '/', isHome: true },
        { label: 'Legal Documents', path: '/legal' },
        { label: 'Data Processing Agreement', path: '/dpa', isCurrent: true }
      ];
    }

    // Fallback: Segment parser
    const segments = pathname.split('/').filter(Boolean);
    const parsedCrumbs: BreadcrumbItem[] = [
      { label: 'Home', path: '/', isHome: true }
    ];

    let accumulatedPath = '';
    segments.forEach((seg, idx) => {
      accumulatedPath += `/${seg}`;
      const isLast = idx === segments.length - 1;
      parsedCrumbs.push({
        label: formatSlug(seg),
        path: accumulatedPath,
        isCurrent: isLast
      });
    });

    return parsedCrumbs;
  }, [location.pathname, products]);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center text-xs w-full select-none"
    >
      {/* Breadcrumb Trail */}
      <ol className="flex items-center gap-1.5 min-w-0 overflow-x-auto scrollbar-none py-0.5">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <li
              key={`crumb-${crumb.path || ''}-${crumb.label}-${index}`}
              className="flex items-center gap-1.5 shrink-0"
            >
              {index > 0 && (
                <ChevronRight
                  className="w-3.5 h-3.5 text-slate-400 shrink-0"
                  aria-hidden="true"
                />
              )}

              {crumb.isCurrent ? (
                <span
                  aria-current="page"
                  className="font-semibold text-slate-900 truncate flex items-center gap-1.5"
                >
                  {crumb.isHome && (
                    <Home className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                  )}
                  <span>{crumb.label}</span>
                </span>
              ) : (
                <Link
                  to={crumb.path || '/'}
                  className="font-medium text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 rounded-xs"
                >
                  {crumb.isHome && (
                    <Home className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700 shrink-0" aria-hidden="true" />
                  )}
                  <span>{crumb.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
