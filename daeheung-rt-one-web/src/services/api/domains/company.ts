import { api } from '../client';

export type GetCompaniesParams = {
  /** true면 MVS 사용 종료 회사도 포함 (회사 관리용). 기본 false */
  include_expired?: boolean;
};

export const companyService = {
  // 회사 목록 조회
  getCompanies: async (params?: GetCompaniesParams) => {
    const response = await api.get('/company', {
      params: params?.include_expired ? { include_expired: '1' } : undefined,
    });
    return response.data;
  },

  // 특정 회사 조회
  getCompany: async (id: number) => {
    const response = await api.get(`/company/${id}`);
    return response.data;
  },

  // 특정 회사 GST 번호 조회
  getCompanyGstNumbers: async (id: number) => {
    const response = await api.get(`/company/${id}/gst-numbers`);
    return response.data;
  },

  // 회사 생성
  createCompany: async (companyData: any) => {
    const response = await api.post('/company', companyData);
    return response.data;
  },

  // 회사 수정
  updateCompany: async (id: number, companyData: any) => {
    const response = await api.put(`/company/${id}`, companyData);
    return response.data;
  },

  // 회사 삭제
  deleteCompany: async (id: number) => {
    const response = await api.delete(`/company/${id}`);
    return response.data;
  },

  /** 송금 API 연결 테스트 (실제 송금 없음) */
  testBankTransferConnection: async (payload: {
    provider: 'icici' | 'kotak';
    companyId?: number;
    apiUrl?: string;
    apiKey?: string;
    transferPath?: string;
  }) => {
    const response = await api.post('/company/bank-transfer/test', payload);
    return response.data;
  },
};
