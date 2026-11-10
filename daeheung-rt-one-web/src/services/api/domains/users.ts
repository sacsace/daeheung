import { api } from '../client';

export const userService = {
  getUsers: async (params?: { search?: string; company_id?: number }) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getNextEmployeeNumber: async (companyId?: number) => {
    const params = companyId != null ? { company_id: companyId } : undefined;
    const response = await api.get('/users/next-employee-number', { params });
    return response.data;
  },

  getMyProfile: async () => {
    const response = await api.get('/users/me/profile');
    return response.data;
  },

  updateMyProfile: async (data: {
    username?: string;
    email?: string;
    birth_date?: string | null;
    gender?: 'male' | 'female' | 'other' | '';
    phone?: string;
    address?: string;
    emergency_contact?: string;
    emergency_phone?: string;
  }) => {
    const response = await api.patch('/users/me/profile', data);
    return response.data;
  },

  changeMyPassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await api.post('/users/me/password', data);
    return response.data;
  },

  uploadMyAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await api.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /** 급여 조회 — 로그인 비밀번호 확인 */
  revealMySalary: async (password: string) => {
    const response = await api.post('/users/me/salary/reveal', { password });
    return response.data;
  },

  revealUserSalary: async (userId: number, password: string) => {
    const response = await api.post(`/users/${userId}/salary/reveal`, { password });
    return response.data;
  },

  listSalaryApprovers: async (companyId?: number) => {
    const response = await api.get('/users/salary-approvers', {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  getSalaryHistory: async (userId: number, password: string) => {
    const response = await api.post(`/users/${userId}/salary/history`, { password });
    return response.data;
  },

  listPendingSalaryChanges: async () => {
    const response = await api.get('/users/salary-changes/pending');
    return response.data;
  },

  decideSalaryChange: async (changeId: number, action: 'approve' | 'reject', reason?: string) => {
    const response = await api.post(`/users/salary-changes/${changeId}/decision`, { action, reason });
    return response.data;
  },
};

/** 로그인 정보 관리 API */
export const loginInfoService = {
  getLoginInfoTabs: async (companyId: number) => {
    const response = await api.get('/login-info/tabs', { params: { company_id: companyId } });
    return response.data;
  },

  createLoginInfoTab: async (data: { company_id: number; name: string }) => {
    const response = await api.post('/login-info/tabs', data);
    return response.data;
  },

  updateLoginInfoTab: async (
    tabId: number,
    data: {
      name?: string;
      column_headers?: Record<string, string> | null;
      column_hidden?: string[] | null;
      column_schema?: {
        columns: Array<
          | { kind: 'builtin'; key: string }
          | { kind: 'custom'; id: string; label: string }
        >;
      } | null;
    }
  ) => {
    const response = await api.put(`/login-info/tabs/${tabId}`, data);
    return response.data;
  },

  deleteLoginInfoTab: async (tabId: number) => {
    const response = await api.delete(`/login-info/tabs/${tabId}`);
    return response.data;
  },

  getLoginInfos: async (params: { company_id: number; tab_id: number }) => {
    const response = await api.get('/login-info', { params });
    return response.data;
  },

  getLoginLogs: async (params?: {
    company_id?: number;
    status?: 'success' | 'failure' | '';
    event_type?: 'login' | 'logout' | 'delete' | 'create' | 'update' | 'security' | '';
    userid?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
  }) => {
    const response = await api.get('/login-info/logs', { params });
    return response.data;
  },

  createLoginInfo: async (data: any) => {
    const response = await api.post('/login-info', data);
    return response.data;
  },

  updateLoginInfo: async (id: number, data: any) => {
    const response = await api.put(`/login-info/${id}`, data);
    return response.data;
  },

  deleteLoginInfo: async (id: number) => {
    const response = await api.delete(`/login-info/${id}`);
    return response.data;
  },

  importExcel: async (file: File, companyId: number, tabId: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('company_id', String(companyId));
    formData.append('tab_id', String(tabId));
    const response = await api.post('/login-info/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export type {
  UserUiCalendarScheduleItem,
  UserUiPreferencesData,
} from './userPreferences';
export { userUiPreferencesService } from './userPreferences';
export type { UserMailServerData } from './userMailServer';
export { userMailServerService } from './userMailServer';
