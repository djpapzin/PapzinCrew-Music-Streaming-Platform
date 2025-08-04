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
    <div className="bg-black/95 backdrop-blur-xl border-t border-white/20 px-2 py-1">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-all duration-200 ${
                activePath === item.path
                  ? 'text-white bg-white/10'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <IconComponent className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default MobileNav;