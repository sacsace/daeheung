import { useEffect } from 'react';
import { useStore, useMenuStore } from '../store';
import menuService from '../services/menuService';

const LOAD_TIMEOUT_MS = 20000;
const MAX_RETRY = 3;

/**
 * 로그인 사용자의 메뉴 트리와 권한을 스토어에 채운다.
 * 네비게이션 UI가 어디에 붙든 한 번만 호출되도록 레이아웃 최상단에서만 사용한다.
 */
export const useMenuLoader = () => {
  const { user } = useStore();
  const { language, setMenus, setUserPermissions, setLoading, setError } = useMenuStore();

  useEffect(() => {
    let cancelled = false;

    const loadMenus = async (retryCount = 0) => {
      if (!user) {
        setLoading(false);
        setMenus([]);
        setUserPermissions([]);
        return;
      }

      setLoading(true);
      const timeoutId = window.setTimeout(() => {
        if (cancelled) return;
        setLoading(false);
        setError('메뉴 로드 시간이 초과되었습니다. 새로고침 후 다시 시도해주세요.');
      }, LOAD_TIMEOUT_MS);

      try {
        const [menusResponse, permissionsResponse] = await Promise.all([
          menuService.getUserMenus(user.id, user.tenant_id, language),
          menuService.getUserPermissions(user.id),
        ]);
        if (cancelled) return;

        if (menusResponse.success) setMenus(menusResponse.data);
        if (permissionsResponse.success) setUserPermissions(permissionsResponse.data);
        setError(null);
      } catch (error: any) {
        if (cancelled) return;
        if (error.response?.status === 429 && retryCount < MAX_RETRY) {
          window.clearTimeout(timeoutId);
          window.setTimeout(() => {
            if (!cancelled) void loadMenus(retryCount + 1);
          }, (retryCount + 1) * 2000);
          return;
        }
        setError('메뉴를 불러오는데 실패했습니다.');
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    };

    void loadMenus();

    return () => {
      cancelled = true;
    };
  }, [user, language, setMenus, setUserPermissions, setLoading, setError]);
};

/** 메뉴 로드 실패 후 사용자가 재시도할 때 호출 */
export const reloadMenusNow = async () => {
  const { user } = useStore.getState();
  const { language, setMenus, setUserPermissions, setLoading, setError } = useMenuStore.getState();
  if (!user) return;
  setLoading(true);
  try {
    const [menusResponse, permissionsResponse] = await Promise.all([
      menuService.getUserMenus(user.id, user.tenant_id, language),
      menuService.getUserPermissions(user.id),
    ]);
    if (menusResponse.success) setMenus(menusResponse.data);
    if (permissionsResponse.success) setUserPermissions(permissionsResponse.data);
    setError(null);
  } catch {
    setError('메뉴를 불러오는데 실패했습니다.');
  } finally {
    setLoading(false);
  }
};

export default useMenuLoader;
