/** 브라우저·OS(Windows 등) 데스크톱 알림 (Web Notification API) */

export type BrowserNotificationPayload = {
  title: string;
  body?: string;
  tag?: string;
  href?: string;
};

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/** 권한이 없으면 요청. 허용되면 true */
export async function ensureBrowserNotificationPermission(): Promise<boolean> {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/**
 * OS/브라우저 알림 표시.
 * 탭이 포커스 중이면 생략(헤더 알림과 중복 방지). 숨김·다른 창일 때만 표시.
 */
export function showBrowserDesktopNotification(payload: BrowserNotificationPayload): boolean {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return false;
  }

  const title = String(payload.title || 'MVS').trim() || 'MVS';
  const body = String(payload.body || '').trim();
  const tag = payload.tag ? String(payload.tag).slice(0, 120) : undefined;

  try {
    const n = new Notification(title, {
      body: body || undefined,
      tag,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    });
    n.onclick = () => {
      try {
        window.focus();
        if (payload.href && payload.href.startsWith('/') && !payload.href.startsWith('//')) {
          window.location.assign(payload.href);
        }
      } catch {
        /* ignore */
      }
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
