import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Bell, User, LogOut, Settings, Home, Wifi, RefreshCw } from 'lucide-react';
import { Notification } from './Notification';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, signOut, isDemo, error, retryConnection } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/'); // Redirect to home or dashboard instead of login
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Appointments', href: '/appointments', icon: Calendar },
    { name: 'Notifications', href: '/notifications', icon: Bell },
    ...(profile?.role === 'staff'
      ? [
          { name: 'Availability', href: '/availability', icon: Settings },
          { name: 'Reports', href: '/reports', icon: User },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Notification />

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-600" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">AppointmentHub</h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              {(isDemo || error) && (
                <div className="flex items-center space-x-2">
                  {error && (
                    <button
                      onClick={retryConnection}
                      className="flex items-center space-x-1 text-yellow-600 hover:text-yellow-800 px-2 py-1 rounded-md text-sm hover:bg-yellow-50 transition-colors"
                      title="Retry connection"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span className="hidden sm:inline">Retry</span>
                    </button>
                  )}
                  <div className="flex items-center space-x-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-md text-sm">
                    <Wifi className="h-4 w-4" />
                    <span className="hidden sm:inline">Demo Mode</span>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-400" />
{profile ? (
  <span className="text-sm text-gray-700">{profile.full_name}</span>
) : (
  <span className="text-sm text-gray-400 italic">Loading...</span>
)}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                  {profile?.role}
                </span>
              </div>

              {!isDemo && (
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <nav className="w-64 bg-white shadow-sm h-screen sticky top-0">
          <div className="p-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
