import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Library, Star, Upload } from 'lucide-react';

const MobileNav: React.FC = () => {
  const location = useLocation();
  const activePath = location.pathname;

  const navItems = [
    { id: 'home', path: '/', label: 'Home', icon: Home },
    { id: 'search', path: '/search', label: 'Search', icon: Search },
    { id: 'library', path: '/library', label: 'Library', icon: Library },
    { id: 'independent', path: '/independent', label: 'Artists', icon: Star },
    { id: 'upload', path: '/upload', label: 'Upload', icon: Upload }
  ];

  return (
    <nav className="bg-black/95 backdrop-blur-xl border-t border-white/20 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2" aria-label="Primary">
      <div className="flex justify-around gap-1">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activePath === item.path;

          return (
            <Link
              key={item.id}
              to={item.path}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`min-h-14 flex-1 flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white/30 ${
                isActive
                  ? 'text-white bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <IconComponent className="w-5 h-5" aria-hidden="true" />
              <span className="text-[11px] leading-none font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;