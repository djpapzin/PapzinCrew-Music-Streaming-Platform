import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Bell, Settings, User, Menu } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ searchQuery, setSearchQuery, onMenuClick }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const location = useLocation();

  const getTitle = () => {
    switch (location.pathname) {
      case '/': return 'Good evening';
      case '/search': return 'Search';
      case '/library': return 'Your Library';
      case '/playlists': return 'Your Playlists';
      case '/artists': return 'Your Artists';
      case '/albums': return 'Your Albums';
      case '/liked': return 'Liked Songs';
      case '/independent': return 'Independent Artists';
      case '/trending': return 'Trending Now';
      case '/upload': return 'Upload Music';
      default: return 'Papzin & Crew';
    }
  };

  return (
    <div className="bg-black/50 backdrop-blur-xl border-b border-white/10 px-4 lg:px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden w-8 h-8 bg-black/40 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors duration-200"
          >
            <Menu className="w-4 h-4 text-white" />
          </button>

          {/* Desktop navigation buttons */}
          <div className="hidden lg:flex space-x-2">
            <button className="w-8 h-8 bg-black/40 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors duration-200">
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <button className="w-8 h-8 bg-black/40 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors duration-200">
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
          
          {location.pathname === '/search' ? (
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search for songs, artists, albums..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-full pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          ) : (
            <h1 className="text-xl lg:text-2xl font-bold text-white truncate">{getTitle()}</h1>
          )}
        </div>

        {/* Right section */}
        <div className="flex items-center space-x-2 lg:space-x-3">
          <button className="hidden sm:flex w-8 h-8 bg-black/40 hover:bg-white/10 rounded-full items-center justify-center transition-colors duration-200">
            <Bell className="w-4 h-4 text-white" />
          </button>
          
          <button className="hidden sm:flex w-8 h-8 bg-black/40 hover:bg-white/10 rounded-full items-center justify-center transition-colors duration-200">
            <Settings className="w-4 h-4 text-white" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center hover:shadow-lg transition-shadow duration-200"
            >
              <User className="w-4 h-4 text-white" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-900 rounded-lg shadow-xl border border-white/20 py-2 z-50">
                <a href="#" className="block px-4 py-2 text-white hover:bg-white/10 transition-colors duration-200">
                  Profile
                </a>
                <a href="#" className="block px-4 py-2 text-white hover:bg-white/10 transition-colors duration-200">
                  Account
                </a>
                <a href="#" className="block px-4 py-2 text-white hover:bg-white/10 transition-colors duration-200">
                  Settings
                </a>
                <hr className="border-white/20 my-2" />
                <a href="#" className="block px-4 py-2 text-white hover:bg-white/10 transition-colors duration-200">
                  Artist Dashboard
                </a>
                <a href="#" className="block px-4 py-2 text-white hover:bg-white/10 transition-colors duration-200">
                  Submit Music
                </a>
                <hr className="border-white/20 my-2" />
                <a href="#" className="block px-4 py-2 text-white hover:bg-white/10 transition-colors duration-200">
                  Log out
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;