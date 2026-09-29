import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path?: string;
  isCurrent?: boolean;
  isHome?: boolean;
}

interface BackLink {
  label: string;
  path: string;
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

  const { crumbs, backLink } = useMemo<{ crumbs: BreadcrumbItem[]; backLink?: BackLink }>(() => {
    const pathname = location.pathname;

    // 1. Home / Root Dashboard
    if (pathname === '/' || pathname === '') {
      return {
        crumbs: [
          { label: 'Trust Center', path: '/', isHome: true, isCurrent: true }
        ]
      };
    }

    // 2. Login Page
    if (pathname === '/login') {
      return {
        crumbs: [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Sign In', path: '/login', isCurrent: true }
        ],
        backLink: { label: 'Dashboard', path: '/' }
      };
    }

    // 3. NDA Page
    if (pathname === '/nda') {
      return {
        crumbs: [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Legal', path: '/legal' },
          { label: 'Non-Disclosure Agreement', path: '/nda', isCurrent: true }
        ],
        backLink: { label: 'Legal Documents', path: '/legal' }
      };
    }

    // 4. Admin Portal & KPI
    if (pathname === '/admin/kpi') {
      return {
        crumbs: [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Administration', path: '/admin' },
          { label: 'Admin Portal', path: '/admin' },
          { label: 'Executive KPI Dashboard', path: '/admin/kpi', isCurrent: true }
        ],
        backLink: { label: 'Admin Portal', path: '/admin' }
      };
    }

    if (pathname === '/admin') {
      return {
        crumbs: [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Administration', path: '/admin' },
          { label: 'Admin Portal', path: '/admin', isCurrent: true }
        ],
        backLink: { label: 'Dashboard', path: '/' }
      };
    }

    // 5. All Documents
    if (pathname === '/documents') {
      return {
        crumbs: [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Documents', path: '/documents' },
          { label: 'All Documents', path: '/documents', isCurrent: true }
        ],
        backLink: { label: 'Dashboard', path: '/' }
      };
    }

    // 6. Direct Product Detail: /product/:slug
    if (pathname.startsWith('/product/')) {
      const slug = pathname.split('/')[2];
      const productName = slug ? formatSlug(slug) : 'Product';
      return {
        crumbs: [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Products', path: '/' },
          { label: productName, path: pathname, isCurrent: true }
        ],
        backLink: { label: 'All Products', path: '/' }
      };
    }

    // 7. Security Category
    if (pathname.startsWith('/security-overview')) {
      const slug = pathname.split('/')[2];
      if (slug) {
        return {
          crumbs: [
            { label: 'Home', path: '/', isHome: true },
            { label: 'Security', path: '/security-overview' },
            { label: 'Security Overview', path: '/security-overview' },
            { label: formatSlug(slug), path: pathname, isCurrent: true }
          ],
          backLink: { label: 'Security Overview', path: '/security-overview' }
        };
      }
      return {
        crumbs: [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Security', path: '/security-overview' },
          { label: 'Security Overview', path: '/security-overview', isCurrent: true }
        ],
        backLink: { label: 'Dashboard', path: '/' }
      };
    }

    if (pathname.startsWith('/controls')) {
      const slug = pathname.split('/')[2];
      if (slug) {
        return {
          crumbs: [
            { label: 'Home', path: '/', isHome: true },
            { label: 'Security', path: '/security-overview' },
            { label: 'Controls', path: '/controls' },
            { label: formatSlug(slug), path: pathname, isCurrent: true }
          ],
          backLink: { label: 'Controls', path: '/controls' }
        };
      }
      return {
        crumbs: [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Security', path: '/security-overview' },
          { label: 'Controls', path: '/controls', isCurrent: true }
        ],
        backLink: { label: 'Security', path: '/security-overview' }
      };
    }

    // 8. Compliance Category
    if (pathname.startsWith('/certifications')) {
      const slug = pathname.split('/')[2];
      if (slug) {
        return {
          crumbs: [
            { label: 'Home', path: '/', isHome: true },
            { label: 'Compliance', path: '/certifications' },
            { label: 'Certifications & Reports', path: '/certifications' },
            { label: formatSlug(slug), path: pathname, isCurrent: true }
          ],
          backLink: { label: 'Certifications', path: '/certifications' }
        };
      }
      return {
        crumbs: [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Compliance', path: '/certifications' },
          { label: 'Certifications & Reports', path: '/certifications', isCurrent: true }
        ],
        backLink: { label: 'Dashboard', path: '/' }
      };
    }

    if (pathname.startsWith('/policies')) {
      const slug = pathname.split('/')[2];
      if (slug) {
        return {
          crumbs: [
            { label: 'Home', path: '/', isHome: true },
            { label: 'Compliance', path: '/certifications' },
            { label: 'Policies', path: '/policies' },
            { label: formatSlug(slug), path: pathname, isCurrent: true }
          ],
          backLink: { label: 'Policies', path: '/policies' }
        };
      }
      return {
        crumbs: [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Compliance', path: '/certifications' },
          { label: 'Policies', path: '/policies', isCurrent: true }
        ],
        backLink: { label: 'Compliance', path: '/certifications' }
      };
    }

    // 9. Legal Category
    if (pathname.startsWith('/legal')) {
      const slug = pathname.split('/')[2];
      if (slug) {
        return {
          crumbs: [
            { label: 'Home', path: '/', isHome: true },
            { label: 'Legal', path: '/legal' },
            { label: 'Legal Documents', path: '/legal' },
            { label: formatSlug(slug), path: pathname, isCurrent: true }
          ],
          backLink: { label: 'Legal Documents', path: '/legal' }
        };
      }
      return {
        crumbs: [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Legal', path: '/legal' },
          { label: 'Legal Documents', path: '/legal', isCurrent: true }
        ],
        backLink: { label: 'Dashboard', path: '/' }
      };
    }

    if (pathname.startsWith('/subprocessors')) {
      const slug = pathname.split('/')[2];
      if (slug) {
        return {
          crumbs: [
            { label: 'Home', path: '/', isHome: true },
            { label: 'Legal', path: '/legal' },
            { label: 'Subprocessors', path: '/subprocessors' },
            { label: formatSlug(slug), path: pathname, isCurrent: true }
          ],
          backLink: { label: 'Subprocessors', path: '/subprocessors' }
        };
      }
      return {
        crumbs: [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Legal', path: '/legal' },
          { label: 'Subprocessors', path: '/subprocessors', isCurrent: true }
        ],
        backLink: { label: 'Legal', path: '/legal' }
      };
    }

    if (pathname === '/dpa') {
      return {
        crumbs: [
          { label: 'Home', path: '/', isHome: true },
          { label: 'Legal', path: '/legal' },
          { label: 'Data Processing Agreement', path: '/dpa', isCurrent: true }
        ],
        backLink: { label: 'Legal', path: '/legal' }
      };
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

    const previousPath = segments.length > 1
      ? '/' + segments.slice(0, -1).join('/')
      : '/';

    const previousLabel = segments.length > 1
      ? formatSlug(segments[segments.length - 2])
      : 'Dashboard';

    return {
      crumbs: parsedCrumbs,
      backLink: { label: previousLabel, path: previousPath }
    };
  }, [location.pathname, products]);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center justify-between gap-3 text-xs w-full select-none"
    >
      {/* Breadcrumb Trail */}
      <ol className="flex items-center gap-1.5 min-w-0 overflow-x-auto scrollbar-none py-0.5">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <li
              key={crumb.path || crumb.label + index}
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

      {/* Quick Navigate Back to Parent Category Link */}
      {backLink && (
        <div className="shrink-0 pl-2">
          <Link
            to={backLink.path}
            className="group inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-md transition-all border border-slate-200/70 shadow-2xs whitespace-nowrap"
            title={`Navigate back to ${backLink.label}`}
          >
            <ChevronLeft className="w-3 h-3 text-slate-400 group-hover:text-slate-800 transition-colors shrink-0" />
            <span className="hidden sm:inline">Back to</span>
            <span className="truncate max-w-[120px]">{backLink.label}</span>
          </Link>
        </div>
      )}
    </nav>
  );
}
