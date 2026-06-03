'use client';
import React from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useNotificationStore, type Notification, type NotificationType } from '@/lib/notificationStore';

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  success: { icon: CheckCircle, color: '#16A34A', bgColor: '#F0FDF4', borderColor: '#BBF7D0' },
  error:   { icon: XCircle,     color: '#EF4444', bgColor: '#FEF2F2', borderColor: '#FECACA' },
  info:    { icon: Info,        color: '#0EA5E9', bgColor: '#EFF6FF', borderColor: '#BFDBFE' },
  warning: { icon: AlertTriangle, color: '#D97706', bgColor: '#FFF7ED', borderColor: '#FED7AA' },
};

function Toast({ notification }: { notification: Notification }) {
  const { removeNotification } = useNotificationStore();
  const config = TYPE_CONFIG[notification.type];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 10,
        background: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxWidth: 360,
        width: '100%',
        position: 'relative',
        animation: 'slideInRight 0.3s ease-out',
      }}
    >
      <config.icon size={20} style={{ color: config.color, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: config.color }}>{notification.title}</div>
        <div style={{ fontSize: 12, color: '#475569', marginTop: 4, lineHeight: 1.4 }}>{notification.message}</div>
      </div>
      <button
        onClick={() => removeNotification(notification.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#94A3B8',
          padding: 0,
          display: 'flex',
          flexShrink: 0,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { notifications } = useNotificationStore();

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {notifications.map((notif) => (
        <Toast key={notif.id} notification={notif} />
      ))}
    </div>
  );
}