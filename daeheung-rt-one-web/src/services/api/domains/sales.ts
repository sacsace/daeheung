import { api } from '../client';

export const quotationService = {
  // 견적??목록 조회
  getQuotations: async (params?: { customer_id?: number; status?: string; start_date?: string; end_date?: string }) => {
    const response = await api.get('/quotations', { params });
    return response.data;
  },

  /** DB 기�? ?�음 견적 번호(비활??�??�함) ??중복 방�? */
  suggestNextQuotationNumber: async (params?: { year?: number }) => {
    const response = await api.get('/quotations/next-number', {
    params: params?.year != null ? { year: params.year } : undefined
    });
    return response.data;
  },

  // 견적???�세 조회
  getQuotation: async (id: number) => {
    const response = await api.get(`/quotations/${id}`);
    return response.data;
  },

  // 견적???�성
  createQuotation: async (data: any) => {
    const response = await api.post('/quotations', data);
    return response.data;
  },

  // 견적???�정
  updateQuotation: async (id: number, data: any) => {
    const response = await api.put(`/quotations/${id}`, data);
    return response.data;
  },

  // 견적????��
  deleteQuotation: async (id: number) => {
    const response = await api.delete(`/quotations/${id}`);
    return response.data;
  },

  // 견적???�송 (pdfBase64: ?�면 캡처 PDF ???�으�??�버?�서 ?�순 PDF ?�성). ?�?�량 base64·SMTP ?�송???�간??걸릴 ???�음
  sendQuotation: async (id: number, body?: { pdfBase64?: string }) => {
    const response = await api.post(`/quotations/${id}/send`, body ?? {}, { timeout: 120000 });
    return response.data;
  },

  approveQuotation: async (id: number) => {
    const response = await api.post(`/quotations/${id}/approve`);
    return response.data;
  },

  rejectQuotation: async (id: number, payload: { reason: string }) => {
    const response = await api.post(`/quotations/${id}/reject`, payload);
    return response.data;
  },

  /** 관리자: ?�성?�별 견적 집계(반려·?�인 ?? ????�� ?��? 참고 */
  getQuotationCreatorMetrics: async (params?: { company_id?: number }) => {
    const response = await api.get('/quotations/metrics/by-creator', { params });
    return response.data;
  }
};

/** 객실 ?�약 API (?�텔 ?�론?�·객???�약 관�??�이지?? `/work/room-bookings`) */
