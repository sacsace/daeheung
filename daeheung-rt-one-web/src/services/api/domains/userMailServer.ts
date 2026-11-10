import { api } from '../client';

export type UserMailServerData = {
  host: string;
  port: number;
  secure: boolean;
  authUser: string;
  authPass?: string;
  authPassConfigured?: boolean;
  fromEmail: string;
  fromName: string;
};

export const userMailServerService = {
  get: async (): Promise<UserMailServerData> => {
    const response = await api.get('/users/me/mail-server');
    return response.data?.data || {};
  },
  patch: async (mailServer: Partial<UserMailServerData>): Promise<UserMailServerData> => {
    const response = await api.patch('/users/me/mail-server', { mailServer });
    return response.data?.data || {};
  },
  test: async (to: string): Promise<void> => {
    await api.post('/users/me/mail-server/test', { to });
  },
};
