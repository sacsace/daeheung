import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Menu, UserPermission } from '../services/menuService';
import { detectOsLanguage } from '../locales/i18n';
import { useNotificationStore, bindNotificationPrefsUser } from './notificationStore';
import { useErrorStore } from './errorStore';

export interface User {
  id: number;
  userid: string;
  username: string;
  email: string;
  role: string;
  tenant_id: number;
  company_id: number;
  department?: string;
  position?: string;
  is_payment_officer?: boolean;
  avatar_url?: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

interface MenuState {
  menus: Menu[];
  userPermissions: UserPermission[];
  loading: boolean;
  error: string | null;
  language: 'ko' | 'en';
  setMenus: (menus: Menu[]) => void;
  setUserPermissions: (permissions: UserPermission[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLanguage: (language: 'ko' | 'en') => void;
  hasMenuPermission: (menuId: number, action: 'view' | 'create' | 'edit' | 'delete') => boolean;
  getMenuByRoute: (route: string) => Menu | undefined;
  getMenusByLevel: (level: number) => Menu[];
}

export const useStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      token: null,
      user: null,
      login: (token: string, user: User) => {
        bindNotificationPrefsUser(user.id);
        set({
          isAuthenticated: true,
          token,
          user
        });
      },
      logout: () => {
        useNotificationStore.getState().resetLocalPrefs();
        bindNotificationPrefsUser(null);
        useErrorStore.getState().clearNotifications();
        useErrorStore.getState().clearErrors();
        try {
          // 동적 import 순환 참조 방지 — sessionStorage 키 직접 제거
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem('mvs_login_notice_version');
          }
        } catch {
          /* ignore */
        }
        set({
          isAuthenticated: false,
          token: null,
          user: null
        });
      },
      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...userData }
          });
        }
      }
    }),
    {
      name: 'mvs-auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        token: state.token,
        user: state.user
      }),
      onRehydrateStorage: () => (state) => {
        const userId = state?.user?.id;
        if (userId != null) {
          bindNotificationPrefsUser(userId);
        }
      } }
  )
);

export const useMenuStore = create<MenuState>()(
  persist(
    (set, get) => ({
      menus: [],
      userPermissions: [],
      /** Sidebar 첫 fetch 전까지 true — AppLayout이 “권한 없음”을 잠깐 띄우지 않도록 */
      loading: true,
      error: null,
      language: detectOsLanguage(),

      setMenus: (menus: Menu[]) => set({ menus }),
      setUserPermissions: (permissions: UserPermission[]) => set({ userPermissions: permissions }),
      setLoading: (loading: boolean) => set({ loading }),
      setError: (error: string | null) => set({ error }),
      setLanguage: (language: 'ko' | 'en') => set({ language }),

      hasMenuPermission: (menuId: number, action: 'view' | 'create' | 'edit' | 'delete') => {
        const { userPermissions } = get();
        const authUser = useStore.getState().user;
        /** root만 전역 우회 — admin 포함 역할은 메뉴권한관리(user_permissions)를 따름 */
        if (authUser?.role === 'root') {
          return true;
        }
        const mid = Number(menuId);
        if (!Number.isFinite(mid)) return false;
        const permission = userPermissions.find((p) => Number(p.menu_id) === mid);
        if (!permission) return false;

        switch (action) {
          case 'view':
            return Boolean(permission.can_view);
          case 'create':
            return Boolean(permission.can_create);
          case 'edit':
            return Boolean(permission.can_edit);
          case 'delete':
            return Boolean(permission.can_delete);
          default:
            return false;
        }
      },

      getMenuByRoute: (route: string) => {
        const { menus } = get();
        const findMenuByRoute = (menuList: Menu[]): Menu | undefined => {
          for (const menu of menuList) {
            if (menu.route === route) return menu;
            if (menu.children) {
              const found = findMenuByRoute(menu.children);
              if (found) return found;
            }
          }
          return undefined;
        };
        return findMenuByRoute(menus);
      },

      getMenusByLevel: (level: number) => {
        const { menus } = get();
        const getMenusAtLevel = (menuList: Menu[], currentLevel: number = 0): Menu[] => {
          if (currentLevel === level) return menuList;

          const result: Menu[] = [];
          menuList.forEach((menu) => {
            if (menu.children) {
              result.push(...getMenusAtLevel(menu.children, currentLevel + 1));
            }
          });
          return result;
        };
        return getMenusAtLevel(menus);
      }
    }),
    {
      name: 'mvs-menu-ui',
      storage: createJSONStorage(() => sessionStorage),
      // 언어는 OS(및 로그인 후 서버 prefs)로 결정 — sessionStorage에 고정하지 않음
      partialize: () => ({}),
    }
  )
);
