import { useEffect, useRef } from 'react';
import { userUiPreferencesService } from '../services/api';
import { useNotificationStore } from '../store/notificationStore';
import {
  ensureBrowserNotificationPermission,
  showBrowserDesktopNotification,
} from '../utils/browserNotifications';

/**
 * 메일/알림 설정의「브라우저 알림」이 켜져 있으면,
 * 새 미읽음 알림을 Windows·브라우저 OS 알림으로 표시한다.
 */
export function useBrowserDesktopNotifications(userId?: number) {
  const enabledRef = useRef(false);
  const primedRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    enabledRef.current = false;
    primedRef.current = false;
    seenIdsRef.current = new Set();
    if (!userId) return;

    let cancelled = false;
    userUiPreferencesService
      .get()
      .then((prefs) => {
        if (cancelled) return;
        // 미설정은 기본 ON(DEFAULT_NOTIFICATION_SETTINGS.browser)
        enabledRef.current = prefs.notificationSettings?.browser !== false;
        if (enabledRef.current) {
          void ensureBrowserNotificationPermission();
        }
      })
      .catch(() => {
        if (!cancelled) enabledRef.current = true;
      });

    const onPrefsUpdated = () => {
      userUiPreferencesService
        .get()
        .then((prefs) => {
          if (cancelled) return;
          enabledRef.current = prefs.notificationSettings?.browser !== false;
        })
        .catch(() => {});
    };
    window.addEventListener('mvs-notification-prefs-updated', onPrefsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('mvs-notification-prefs-updated', onPrefsUpdated);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    return useNotificationStore.subscribe((state) => {
      const items = state.items || [];
      if (!primedRef.current) {
        items.forEach((item) => seenIdsRef.current.add(item.id));
        primedRef.current = true;
        return;
      }
      if (!enabledRef.current) return;

      for (const item of items) {
        if (seenIdsRef.current.has(item.id)) continue;
        seenIdsRef.current.add(item.id);
        if (item.read) continue;
        showBrowserDesktopNotification({
          title: item.title || 'MVS',
          body: item.message || item.details || '',
          tag: item.id,
          href: item.href,
        });
      }

      // 메모리 상한
      if (seenIdsRef.current.size > 500) {
        const keep = items.map((i) => i.id);
        seenIdsRef.current = new Set(keep);
      }
    });
  }, [userId]);
}

/** 설정 화면에서 브라우저 알림을 켤 때 권한 요청 + 구독 훅에 반영 */
export async function enableBrowserNotificationsFromSettings(): Promise<boolean> {
  const ok = await ensureBrowserNotificationPermission();
  window.dispatchEvent(new Event('mvs-notification-prefs-updated'));
  return ok;
}

export function notifyNotificationPrefsUpdated() {
  window.dispatchEvent(new Event('mvs-notification-prefs-updated'));
}
