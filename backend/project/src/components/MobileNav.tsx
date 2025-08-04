import React from 'react';
import { Home, Search, Library, Star, TrendingUp, Upload } from 'lucide-react';

interface MobileNavProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

const MobileNav: React.FC<MobileNavProps> = ({ activeView, setActiveView }) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'independent', label: 'Artists', icon: Star },
    { id: 'upload', label: 'Upload', icon: Upload }
  ];

  return (
    <div className="bg-black/95 backdrop-blur-xl border-t border-white/20 px-2 py-1">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-lg transition-all duration-200 ${
                activeView === item.id
                  ? 'text-white bg-white/10'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <IconComponent className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileNav;