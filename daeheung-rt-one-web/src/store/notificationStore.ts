import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AppNotification } from '../utils/notificationFeed';
import { api } from '../services/api';

interface NotificationState {
  items: AppNotification[];
  headerDismissedIds: string[];
  /** 폴링으로 다시 합쳐져도 읽음 유지 */
  readIds: string[];
  mergeFromSources: (incoming: AppNotification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  dismissAllFromHeader: () => void;
  resetLocalPrefs: () => void;
}

const MAX_PREF_IDS = 2000;
const LEGACY_PREFS_KEY = 'mvs-notification-prefs';

/** 로그인 사용자별 sessionStorage 키 — auth store와 순환 참조 없이 바인딩 */
let prefsUserId: number | null = null;

const prefsStorageKey = (userId: number) => `mvs-notification-prefs:${userId}`;

const uniqTrim = (ids: string[]) => Array.from(new Set(ids.filter(Boolean))).slice(-MAX_PREF_IDS);

const parseServerNotificationId = (id: string): number | null => {
  const matched = /^server-(\d+)$/.exec(id);
  if (!matched) return null;
  const numericId = Number(matched[1]);
  return Number.isFinite(numericId) ? numericId : null;
};

const syncServerRead = (ids: string[]) => {
  ids.forEach((id) => {
    const serverId = parseServerNotificationId(id);
    if (serverId == null) return;
    api.put(`/notifications/${serverId}`, { read: true }).catch(() => {
      /* 로컬 읽음은 유지 — 서버 동기화 실패는 무시 */
    });
  });
};

const userScopedSessionStorage = {
  getItem: (_name: string): string | null => {
    if (prefsUserId == null) return null;
    return sessionStorage.getItem(prefsStorageKey(prefsUserId));
  },
  setItem: (_name: string, value: string): void => {
    if (prefsUserId == null) return;
    sessionStorage.setItem(prefsStorageKey(prefsUserId), value);
  },
  removeItem: (_name: string): void => {
    if (prefsUserId == null) return;
    sessionStorage.removeItem(prefsStorageKey(prefsUserId));
  },
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      items: [],
      headerDismissedIds: [],
      readIds: [],

      mergeFromSources: (incoming) => {
        set((state) => {
          const readSet = new Set(state.readIds);
          state.items.forEach((item) => {
            if (item.read) readSet.add(item.id);
          });

          const merged = incoming.map((item) => {
            const read = readSet.has(item.id) || Boolean(item.read);
            if (read) readSet.add(item.id);
            return { ...item, read };
          });

          // 헤더에서 지운 항목은 목록에 다시 넣되, 읽음으로 유지
          state.headerDismissedIds.forEach((id) => readSet.add(id));

          return {
            items: merged.slice(0, 200),
            readIds: uniqTrim(Array.from(readSet)),
          };
        });
      },

      markRead: (id) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, read: true } : item
          ),
          readIds: uniqTrim([...state.readIds, id]),
        }));
        syncServerRead([id]);
      },

      markAllRead: () => {
        const ids = get().items.map((item) => item.id);
        set((state) => ({
          items: state.items.map((item) => ({ ...item, read: true })),
          readIds: uniqTrim([...state.readIds, ...ids]),
        }));
        syncServerRead(ids);
      },

      remove: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
          headerDismissedIds: uniqTrim([...state.headerDismissedIds, id]),
          readIds: uniqTrim([...state.readIds, id]),
        }));
      },

      clearAll: () => {
        const ids = get().items.map((item) => item.id);
        set((state) => ({
          items: state.items.map((item) => ({ ...item, read: true })),
          headerDismissedIds: uniqTrim([...state.headerDismissedIds, ...ids]),
          readIds: uniqTrim([...state.readIds, ...ids]),
        }));
        syncServerRead(ids);
      },

      dismissAllFromHeader: () => {
        const ids = get().items.map((item) => item.id);
        set((state) => ({
          items: state.items.map((item) => ({ ...item, read: true })),
          headerDismissedIds: uniqTrim([...state.headerDismissedIds, ...ids]),
          readIds: uniqTrim([...state.readIds, ...ids]),
        }));
        syncServerRead(ids);
      },

      resetLocalPrefs: () => {
        set({
          items: [],
          headerDismissedIds: [],
          readIds: [],
        });
      },
    }),
    {
      name: LEGACY_PREFS_KEY,
      storage: createJSONStorage(() => userScopedSessionStorage),
      partialize: (state) => ({
        headerDismissedIds: state.headerDismissedIds,
        readIds: state.readIds,
      }),
    }
  )
);

/**
 * 로그인/로그아웃 시 호출. 사용자별 prefs 키로 전환 후 rehydrate.
 * 구버전 공통 키(mvs-notification-prefs)는 제거한다.
 */
export const bindNotificationPrefsUser = (userId: number | null) => {
  try {
    sessionStorage.removeItem(LEGACY_PREFS_KEY);
  } catch {
    /* ignore */
  }

  prefsUserId = userId != null && Number.isFinite(userId) ? Number(userId) : null;
  useNotificationStore.getState().resetLocalPrefs();

  if (prefsUserId != null) {
    void useNotificationStore.persist.rehydrate();
  }
};
