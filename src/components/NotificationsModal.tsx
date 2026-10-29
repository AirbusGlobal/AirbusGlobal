import React from 'react';
import { NotificationItem } from '../types';
import { X, Bell, CheckCheck, Trash2, ArrowLeft } from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAllNotifications: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onDeleteNotification,
  onClearAllNotifications,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-[#15171e] text-stone-900 dark:text-stone-100 rounded-3xl p-6 shadow-2xl border border-stone-200 dark:border-stone-800">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 mr-1 cursor-pointer"
              title="Go back"
            >
              <ArrowLeft className="w-4 h-4 text-[#e4002b]" />
            </button>
            <Bell className="w-4 h-4 text-[#e4002b]" />
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Notifications ({notifications.length})
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <>
                <button
                  onClick={onMarkAllRead}
                  className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>

                <button
                  onClick={onClearAllNotifications}
                  className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                  title="Delete all notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400 italic">
              <Bell className="w-8 h-8 text-stone-300 dark:text-stone-700 mx-auto mb-2 opacity-50" />
              <span>You're all caught up! No notifications.</span>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className={`p-3.5 rounded-2xl border text-xs transition-colors flex items-start justify-between gap-3 ${
                  !n.read
                    ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60'
                    : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-[#e4002b] shrink-0" />
                    )}
                    <span className="font-extrabold text-stone-900 dark:text-white truncate">
                      {n.title}
                    </span>
                  </div>

                  <p className="text-stone-600 dark:text-stone-300 leading-snug">
                    {n.message}
                  </p>

                  <span className="text-[10px] text-stone-400 mt-1 block">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Individual Delete Button */}
                <button
                  onClick={() => onDeleteNotification(n.id)}
                  className="p-1 text-stone-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0"
                  title="Delete notification"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
