import { api } from './api';

export interface Menu {
  id: number;
  name: string;
  name_ko: string;
  name_en: string;
  route: string;
  icon: string;
  order: number;
  level: number;
  is_active: boolean;
  description?: string;
  children?: Menu[];
}

export interface UserPermission {
  id: number;
  user_id: number;
  menu_id: number;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  menu?: Menu;
}

class MenuService {
  // 사용자별 메뉴 조회 (권한 기반)
  async getUserMenus(userId: number, tenantId: number, language: string = 'ko') {
    try {
      const response = await api.get(`/menus/user/${userId}/tenant/${tenantId}`, {
        params: { language }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // 모든 메뉴 조회 (관리자용)
  async getAllMenus(tenantId: number, language: string = 'ko') {
    try {
      const response = await api.get(`/menus/tenant/${tenantId}`, {
        params: { language }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }


  // 메뉴 생성 (관리자용)
  async createMenu(tenantId: number, menuData: Partial<Menu>) {
    try {
      const response = await api.post(`/menus/tenant/${tenantId}`, menuData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // 메뉴 수정 (관리자용)
  async updateMenu(menuId: number, menuData: Partial<Menu>) {
    try {
      const response = await api.put(`/menus/${menuId}`, menuData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // 메뉴 삭제 (관리자용)
  async deleteMenu(menuId: number) {
    try {
      const response = await api.delete(`/menus/${menuId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // 사용자 권한 설정 (관리자용)
  async setUserPermissions(userId: number, permissions: Partial<UserPermission>[]) {
    try {
      const response = await api.post(`/menus/permissions/user/${userId}`, {
        permissions
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // 사용자 권한 조회
  async getUserPermissions(userId: number) {
    try {
      const response = await api.get(`/menus/permissions/user/${userId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // 메뉴 트리 구조를 평면 배열로 변환
  flattenMenuTree(menuTree: Menu[]): Menu[] {
    const flattened: Menu[] = [];
    
    const flatten = (menus: Menu[], level: number = 0) => {
      menus.forEach(menu => {
        const flatMenu = { ...menu, level };
        flattened.push(flatMenu);
        if (menu.children && menu.children.length > 0) {
          flatten(menu.children, level + 1);
        }
      });
    };
    
    flatten(menuTree);
    return flattened;
  }

  // 메뉴 검색
  searchMenus(menus: Menu[], searchTerm: string): Menu[] {
    if (!searchTerm.trim()) return menus;
    
    const searchLower = searchTerm.toLowerCase();
    
    const searchInMenu = (menu: Menu): boolean => {
      const nameMatch = menu.name_ko.toLowerCase().includes(searchLower) ||
                       menu.name_en.toLowerCase().includes(searchLower);
      const descriptionMatch = menu.description?.toLowerCase().includes(searchLower) || false;
      
      if (nameMatch || descriptionMatch) return true;
      
      if (menu.children) {
        return menu.children.some(child => searchInMenu(child));
      }
      
      return false;
    };
    
    const filterMenus = (menuList: Menu[]): Menu[] => {
      return menuList.filter(menu => {
        const hasMatchingChild = menu.children ? filterMenus(menu.children).length > 0 : false;
        return searchInMenu(menu) || hasMatchingChild;
      }).map(menu => ({
        ...menu,
        children: menu.children ? filterMenus(menu.children) : []
      }));
    };
    
    return filterMenus(menus);
  }

  // 메뉴 권한 확인
  hasPermission(permissions: UserPermission[], menuId: number, action: 'view' | 'create' | 'edit' | 'delete'): boolean {
    const permission = permissions.find(p => p.menu_id === menuId);
    if (!permission) return false;
    
    switch (action) {
      case 'view':
        return permission.can_view;
      case 'create':
        return permission.can_create;
      case 'edit':
        return permission.can_edit;
      case 'delete':
        return permission.can_delete;
      default:
        return false;
    }
  }
}

const menuService = new MenuService();

export default menuService;
