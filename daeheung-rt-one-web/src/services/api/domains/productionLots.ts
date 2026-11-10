import { api } from '../client';

export const productionLotService = {
  list: async () => {
    const response = await api.get('/production-lots');
    return response.data;
  },
  detail: async (id: number) => {
    const response = await api.get(`/production-lots/${id}`);
    return response.data;
  },
  create: async (body: Record<string, unknown>) => {
    const response = await api.post('/production-lots', body);
    return response.data;
  },
  move: async (id: number, body: Record<string, unknown>) => {
    const response = await api.post(`/production-lots/${id}/movements`, body);
    return response.data;
  },
  remove: async (id: number) => {
    const response = await api.delete(`/production-lots/${id}`);
    return response.data;
  },
};
