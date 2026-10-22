import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  AlertTriangle, 
  Briefcase, 
  CheckCircle2, 
  Info, 
  X,
  ExternalLink 
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import { formatRelativeTime } from '../utils/time';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { language, tr } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleNotificationClick = async (item) => {
    if (!item.is_read) {
      await markAsRead(item.id);
    }
    setOpen(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  const getNotificationIcon = (item) => {
    const titleLower = (item.title || '').toLowerCase();
    const typeLower = (item.type || '').toLowerCase();

    if (titleLower.includes('removed') || titleLower.includes('warning') || titleLower.includes('rejected')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    }
    if (typeLower === 'new_application' || titleLower.includes('applicant')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
          <Briefcase className="w-4 h-4" />
        </div>
      );
    }
    if (typeLower === 'payment' || titleLower.includes('approved') || titleLower.includes('interview')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-600 flex items-center justify-center shrink-0">
        <Info className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`relative p-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-600 ${
          open 
            ? 'bg-zinc-200 text-zinc-950 ring-2 ring-zinc-300' 
            : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60'
        }`}
        aria-label={tr(`Notifications (${unreadCount} unread)`, `Ubutumwa (${unreadCount} butarasomwa)`)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5 transition-transform active:scale-95" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold leading-none shadow-xs ring-2 ring-[#faf9f6] animate-in zoom-in-75 duration-150">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div 
          className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-full mt-2 sm:w-96 bg-white rounded-2xl border border-zinc-200/90 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          role="region"
          aria-label={tr('Notifications Menu', 'Ibikubiye mu Butumwa')}
        >
          {/* Header */}
          <div className="p-4 border-b border-zinc-100 bg-zinc-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900">
                {tr('Notifications', 'Ubutumwa')}
              </h3>
              {unreadCount > 0 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {unreadCount} {tr('new', 'bushya')}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 hover:underline transition"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>{tr('Mark all read', 'Soma byose')}</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[65vh] sm:max-h-96 overflow-y-auto divide-y divide-zinc-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                  <Bell className="w-6 h-6 stroke-[1.5]" />
                </div>
                <p className="text-sm font-semibold text-zinc-800">
                  {tr('No notifications yet', 'Nta butumwa buraboneka')}
                </p>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                  {tr('You are all caught up! Updates about your postings and applications will appear here.', 'Nta butumwa bushya. Amakuru yose azajya akugeraho hano.')}
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.is_read;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 flex items-start gap-3 transition cursor-pointer select-none ${
                      isUnread 
                        ? 'bg-blue-50/50 hover:bg-blue-50/80' 
                        : 'bg-white hover:bg-zinc-50'
                    }`}
                  >
                    {getNotificationIcon(n)}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs ${isUnread ? 'font-bold text-zinc-950' : 'font-semibold text-zinc-800'}`}>
                          {n.title}
                        </p>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1" />
                        )}
                      </div>

                      <p className="text-xs text-zinc-600 mt-1 leading-relaxed line-clamp-3">
                        {n.message}
                      </p>

                      <div className="flex items-center justify-between gap-2 mt-2 text-[10px] text-zinc-400">
                        <span>{formatRelativeTime(n.created_at, language)}</span>
                        {n.link && (
                          <span className="inline-flex items-center gap-0.5 text-blue-700 font-medium">
                            <span>{tr('View details', 'Reba amakuru')}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
