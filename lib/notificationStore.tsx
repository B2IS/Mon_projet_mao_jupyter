import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number; // ms, default 5000
}

/** Message persistant adressé à un utilisateur (boîte de réception in-app). */
export interface InboxItem {
  id: string;
  recipientEmail: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;           // route à ouvrir au clic (ex: /workflows)
  createdAt: string;       // ISO
  read: boolean;
  source?: string;         // ex: 'workflow', 'projet', 'systeme'
  ref?: string;            // référence métier (ex: FAC-2026-0342)
}

/** E-mail simulé (file d'envoi — pas de SMTP réel en démo). */
export interface EmailItem {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;          // ISO
  status: 'envoye';
}

interface NotificationState {
  /* Toasts transitoires */
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;

  /* Boîte de réception persistante (par utilisateur) */
  inbox: InboxItem[];
  emailOutbox: EmailItem[];
  pushInbox: (item: Omit<InboxItem, 'id' | 'createdAt' | 'read'> & { read?: boolean }) => string;
  sendEmail: (mail: Omit<EmailItem, 'id' | 'sentAt' | 'status'>) => string;
  /** Notifie un destinataire (in-app + e-mail simulé) en une fois. */
  notifyUser: (args: {
    recipientEmail: string;
    title: string;
    message: string;
    type?: NotificationType;
    link?: string;
    source?: string;
    ref?: string;
    sendMail?: boolean;     // défaut true
  }) => void;
  markInboxRead: (id: string) => void;
  markAllInboxRead: (recipientEmail?: string) => void;
  removeInbox: (id: string) => void;
  clearInbox: (recipientEmail?: string) => void;

  /* Alertes système traitées (persistées → ne réapparaissent pas à la navigation) */
  dismissedAlertes: string[];
  dismissAlerte: (id: string) => void;
  dismissAlertes: (ids: string[]) => void;
}

let notificationIdCounter = 0;
const INBOX_KEY = 'sigepp_inbox_v1';
const EMAIL_KEY = 'sigepp_email_outbox_v1';
const DISMISSED_KEY = 'sigepp_dismissed_alertes_v1';

function loadDismissed(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); } catch { return []; }
}
function persistDismissed(ids: string[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-500))); } catch { /* quota */ }
}

function loadInbox(): InboxItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(INBOX_KEY) || '[]'); } catch { return []; }
}
function loadEmails(): EmailItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(EMAIL_KEY) || '[]'); } catch { return []; }
}
function persistInbox(items: InboxItem[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(INBOX_KEY, JSON.stringify(items.slice(-200))); } catch { /* quota */ }
}
function persistEmails(items: EmailItem[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(EMAIL_KEY, JSON.stringify(items.slice(-200))); } catch { /* quota */ }
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(notificationIdCounter++).toString(36)}`;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  addNotification: (notification) => {
    const id = `notif_${notificationIdCounter++}`;
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }],
    }));
    // Auto-remove after duration
    setTimeout(() => set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })), notification.duration ?? 5000);
  },
  removeNotification: (id) =>
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),

  inbox: loadInbox(),
  emailOutbox: loadEmails(),
  dismissedAlertes: loadDismissed(),

  dismissAlerte: (id) => set((state) => {
    if (state.dismissedAlertes.includes(id)) return state;
    const next = [...state.dismissedAlertes, id];
    persistDismissed(next);
    return { dismissedAlertes: next };
  }),
  dismissAlertes: (ids) => set((state) => {
    const next = Array.from(new Set([...state.dismissedAlertes, ...ids]));
    persistDismissed(next);
    return { dismissedAlertes: next };
  }),

  pushInbox: (item) => {
    const recipient = (item.recipientEmail || '').toLowerCase().trim();
    // Idempotence : si une notification de même ref existe déjà pour ce destinataire,
    // on ne la recrée pas (évite les doublons en mode strict React / au rechargement).
    if (item.ref) {
      const existing = get().inbox.find(n => n.ref === item.ref && n.recipientEmail === recipient);
      if (existing) return existing.id;
    }
    const id = uid('inbox');
    const full: InboxItem = {
      id,
      recipientEmail: recipient,
      title: item.title,
      message: item.message,
      type: item.type,
      link: item.link,
      source: item.source,
      ref: item.ref,
      createdAt: new Date().toISOString(),
      read: item.read ?? false,
    };
    set((state) => {
      const next = [...state.inbox, full];
      persistInbox(next);
      return { inbox: next };
    });
    return id;
  },

  sendEmail: (mail) => {
    const id = uid('mail');
    const full: EmailItem = { id, to: (mail.to || '').toLowerCase().trim(), subject: mail.subject, body: mail.body, sentAt: new Date().toISOString(), status: 'envoye' };
    set((state) => {
      const next = [...state.emailOutbox, full];
      persistEmails(next);
      return { emailOutbox: next };
    });
    return id;
  },

  notifyUser: ({ recipientEmail, title, message, type = 'info', link, source, ref, sendMail = true }) => {
    if (!recipientEmail || !recipientEmail.includes('@')) return;
    get().pushInbox({ recipientEmail, title, message, type, link, source, ref });
    if (sendMail) {
      get().sendEmail({ to: recipientEmail, subject: title, body: message });
    }
  },

  markInboxRead: (id) => set((state) => {
    const next = state.inbox.map((n) => (n.id === id ? { ...n, read: true } : n));
    persistInbox(next);
    return { inbox: next };
  }),

  markAllInboxRead: (recipientEmail) => set((state) => {
    const em = recipientEmail?.toLowerCase().trim();
    const next = state.inbox.map((n) => (!em || n.recipientEmail === em ? { ...n, read: true } : n));
    persistInbox(next);
    return { inbox: next };
  }),

  removeInbox: (id) => set((state) => {
    const next = state.inbox.filter((n) => n.id !== id);
    persistInbox(next);
    return { inbox: next };
  }),

  clearInbox: (recipientEmail) => set((state) => {
    const em = recipientEmail?.toLowerCase().trim();
    const next = em ? state.inbox.filter((n) => n.recipientEmail !== em) : [];
    persistInbox(next);
    return { inbox: next };
  }),
}));

/** Hook utilitaire : messages d'un utilisateur (triés du plus récent au plus ancien). */
export function selectInboxFor(items: InboxItem[], email?: string): InboxItem[] {
  const em = (email || '').toLowerCase().trim();
  return items
    .filter((n) => !em || n.recipientEmail === em)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
