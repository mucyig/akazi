import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, FileText, User, PlusCircle, LayoutDashboard, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';

export default function MobileBottomNav() {
  const { user, isEmployee, isActiveEmployer, isAdmin } = useAuth();
  const { tr } = useLanguage();
  const { unseenResults } = useNotifications();
  const location = useLocation();

  // Hide on multi-step fullscreen auth wizards (e.g. registration step wizard)
  if (location.pathname === '/register') return null;

  let items = [];

  if (isAdmin) {
    items = [
      { to: '/', label: tr('Home', 'Ahabanza'), icon: Home },
      { to: '/jobs', label: tr('Jobs', 'Imirimo'), icon: Search },
      { to: '/admin', label: tr('Admin', 'Ubuyobozi'), icon: Shield },
      { to: '/profile', label: tr('Profile', 'Konti'), icon: User },
    ];
  } else if (isActiveEmployer) {
    items = [
      { to: '/', label: tr('Home', 'Ahabanza'), icon: Home },
      { to: '/employer/dashboard', label: tr('Dashboard', 'Ibikorwa'), icon: LayoutDashboard },
      { to: '/employer/jobs/new', label: tr('Post Job', 'Shyiraho akazi'), icon: PlusCircle },
      { to: '/jobs', label: tr('Jobs', 'Imirimo'), icon: Search },
      { to: '/profile', label: tr('Profile', 'Konti'), icon: User },
    ];
  } else if (isEmployee) {
    items = [
      { to: '/', label: tr('Home', 'Ahabanza'), icon: Home },
      { to: '/jobs', label: tr('Find Jobs', 'Shaka Akazi'), icon: Search },
      { to: '/applications', label: tr('Applied', 'Ubusabe'), icon: FileText, badge: unseenResults },
      { to: '/profile', label: tr('Profile', 'Konti'), icon: User },
    ];
  } else {
    // Visitor / Guest
    items = [
      { to: '/', label: tr('Home', 'Ahabanza'), icon: Home },
      { to: '/jobs', label: tr('Find Jobs', 'Shaka Akazi'), icon: Search },
      { to: '/register?role=hire', label: tr('Hire', 'Tanga Akazi'), icon: PlusCircle },
      { to: '/login', label: tr('Sign In', 'Injira'), icon: User },
    ];
  }

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#faf9f6]/95 backdrop-blur-md border-t border-zinc-200/80 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-all duration-150 relative group ${
                isActive ? 'text-blue-900' : 'text-zinc-500 hover:text-zinc-900 active:scale-95'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-150 ${isActive ? 'scale-110 stroke-[2.3]' : 'stroke-[1.8]'}`} />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600 text-white text-[9px] font-bold items-center justify-center ring-2 ring-[#faf9f6]">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-1 transition-all leading-tight ${
                  isActive ? 'font-bold text-blue-900' : 'font-medium text-zinc-500'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-1 h-1 rounded-full bg-blue-900" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
