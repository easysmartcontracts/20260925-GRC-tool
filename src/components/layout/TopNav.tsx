import { Link, useNavigate } from 'react-router-dom';
import { Menu, LogOut, LogIn, ChevronLeft, Globe, Mail, Facebook, Linkedin, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { BjornLogo } from '../BjornLogo';
import { CountrySelector } from '../CountrySelector';

export function TopNav({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout, siteSettings } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const renderIcon = (iconName?: string) => {
    switch (iconName?.toLowerCase()) {
      case 'facebook': return <Facebook className="w-3.5 h-3.5" />;
      case 'linkedin': return <Linkedin className="w-3.5 h-3.5" />;
      case 'mail': return <Mail className="w-3.5 h-3.5" />;
      case 'globe': return <Globe className="w-3.5 h-3.5" />;
      case 'chevronleft':
      case 'chevron-left': return <ChevronLeft className="w-3.5 h-3.5" />;
      case 'external-link':
      case 'externallink': return <ExternalLink className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  return (
    <div className="sticky top-0 z-30 w-full flex flex-col">
      {siteSettings.top_bar_links && siteSettings.top_bar_links.length > 0 && (
        <div className="bg-slate-100 text-slate-600 text-[11px] font-medium border-b border-slate-200">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-8">
            <div className="flex items-center gap-4">
              {siteSettings.top_bar_links.filter(link => link.position === 'left').map((link) => (
                <a 
                  key={link.id} 
                  href={link.url} 
                  target={link.url.startsWith('http') ? "_blank" : undefined}
                  rel={link.url.startsWith('http') ? "noopener noreferrer" : undefined}
                  className="flex items-center gap-1.5 hover:text-slate-900 transition-colors"
                >
                  {renderIcon(link.icon)}
                  {link.label}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-4">
              {siteSettings.top_bar_links.filter(link => link.position === 'right').map((link) => (
                <a 
                  key={link.id} 
                  href={link.url} 
                  target={link.url.startsWith('http') ? "_blank" : undefined}
                  rel={link.url.startsWith('http') ? "noopener noreferrer" : undefined}
                  className="flex items-center gap-1.5 hover:text-slate-900 transition-colors"
                >
                  {renderIcon(link.icon)}
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
      <header className="bg-white border-b border-slate-200 w-full">
      <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              {siteSettings.site_logo ? (
                <img src={siteSettings.site_logo} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <BjornLogo className="w-8 h-8" />
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-lg font-bold leading-tight text-slate-900">{siteSettings.site_name}</h1>
              <span className="text-xs text-slate-600 font-bold tracking-wide uppercase hidden sm:inline-block">
                {siteSettings.header_text}
              </span>
            </div>
          </Link>
        </div>
        
        <div className="flex items-center gap-4">
          <CountrySelector />
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-sm font-medium text-slate-700 hidden sm:block">{user.username}</span>
                <button 
                  onClick={handleLogout}
                  className="text-slate-600 hover:text-slate-900 p-1 rounded-md hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <Link 
                to="/login"
                className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
                title="Log in"
              >
                <LogIn className="w-4 h-4" />
                <span>Log in</span>
              </Link>
            )}
          </div>
        </div>
      </div>
      </header>
    </div>
  );
}

