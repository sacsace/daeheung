import { useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { ActionInboxRow, ServerNotificationItem } from '../utils/notificationFeed';

const NOTIFICATIONS_INTERVAL_MS = 30_000;
const INBOX_INTERVAL_MS = 45_000;

const isPageVisible = () =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

type UseNotificationFeedOptions = {
  userId?: number;
  onServerNotifications: (rows: ServerNotificationItem[]) => void;
  onInboxActions: (rows: ActionInboxRow[]) => void;
};

/** Header 알림·인박스 폴링 — 탭 비활성 시 중단 */
export function useNotificationFeed({
  userId,
  onServerNotifications,
  onInboxActions,
}: UseNotificationFeedOptions) {
  const onServerRef = useRef(onServerNotifications);
  const onInboxRef = useRef(onInboxActions);
  onServerRef.current = onServerNotifications;
  onInboxRef.current = onInboxActions;

  const loadServerNotifications = useCallback(async () => {
    if (!isPageVisible()) return;
    try {
      const response = await api.get('/notifications', {
        params: { page: 1, limit: 20 },
      });
      if (response.data?.success) {
        const rows = Array.isArray(response.data.data) ? response.data.data : [];
        onServerRef.current(rows);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadInbox = useCallback(async () => {
    if (!userId || !isPageVisible()) return;
    try {
      const response = await api.get('/notifications/inbox');
      if (response.data?.success && Array.isArray(response.data.data)) {
        onInboxRef.current(response.data.data as ActionInboxRow[]);
      } else {
        onInboxRef.current([]);
      }
    } catch {
      /* ignore */
    }
  }, [userId]);

  useEffect(() => {
    void loadServerNotifications();
    const intervalId = window.setInterval(() => {
      void loadServerNotifications();
    }, NOTIFICATIONS_INTERVAL_MS);

    const onVisibility = () => {
      if (isPageVisible()) void loadServerNotifications();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadServerNotifications]);

  useEffect(() => {
    if (!userId) {
      onInboxRef.current([]);
      return;
    }
    void loadInbox();
    const inboxInterval = window.setInterval(() => {
      void loadInbox();
    }, INBOX_INTERVAL_MS);

    const onVisibility = () => {
      if (isPageVisible()) void loadInbox();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(inboxInterval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId, loadInbox]);
}
