import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Library, Heart, PlusCircle, Music, Users, Disc3, Star, TrendingUp, Upload } from 'lucide-react';

interface SidebarProps {
  onNavigate?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const location = useLocation();
  const activePath = location.pathname;

  const mainMenuItems = [
    { id: 'home', path: '/', label: 'Home', icon: Home },
    { id: 'search', path: '/search', label: 'Search', icon: Search },
    { id: 'library', path: '/library', label: 'Your Library', icon: Library }
  ];

  const libraryItems = [
    { id: 'playlists', path: '/playlists', label: 'Playlists', icon: Music },
    { id: 'artists', path: '/artists', label: 'Artists', icon: Users },
    { id: 'albums', path: '/albums', label: 'Albums', icon: Disc3 },
    { id: 'liked', path: '/liked', label: 'Liked Songs', icon: Heart }
  ];

  const discoverItems = [
    { id: 'independent', path: '/independent', label: 'Independent Artists', icon: Star },
    { id: 'trending', path: '/trending', label: 'Trending Now', icon: TrendingUp },
    { id: 'upload', path: '/upload', label: 'Upload Music', icon: Upload }
  ];

  const NavLink = ({ to, onClick, isActive, children }) => (
    <Link
      to={to}
      onClick={onClick}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
        isActive ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      {children}
    </Link>
  );

  return (
    <div className="w-64 bg-black/90 backdrop-blur-xl border-r border-white/10 flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <Music className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg lg:text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Papzin & Crew
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="p-4 flex-shrink-0">
        <nav className="space-y-2">
          {mainMenuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                onClick={onNavigate}
                isActive={activePath === item.path}
              >
                <IconComponent className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Create Playlist */}
      <div className="px-4 pb-4 flex-shrink-0">
        <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200">
          <PlusCircle className="w-5 h-5" />
          <span className="font-medium">Create Playlist</span>
        </button>
      </div>

      {/* Library Section */}
      <div className="px-4 pb-4 flex-shrink-0">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider px-4">
            Your Library
          </h3>
        </div>
        <nav className="space-y-2">
          {libraryItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                onClick={onNavigate}
                isActive={activePath === item.path}
              >
                <IconComponent className="w-4 h-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Discover Section - Papzin & Crew Integration */}
      <div className="flex-1 px-4 overflow-y-auto">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider px-4">
            Discover
          </h3>
        </div>
        <nav className="space-y-2">
          {discoverItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                onClick={onNavigate}
                isActive={activePath === item.path}
              >
                <IconComponent className="w-4 h-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom section - Updated for Papzin & Crew */}
      <div className="p-4 border-t border-white/10 flex-shrink-0">
        <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg p-4 border border-purple-500/20">
          <h4 className="text-white font-semibold mb-1">Join Papzin & Crew</h4>
          <p className="text-gray-400 text-sm mb-3">
            Connect with independent artists and discover fresh talent.
          </p>
          <button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:shadow-lg transition-shadow duration-200 w-full">
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;