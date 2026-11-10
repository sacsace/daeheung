import { api, API_BASE_URL, getAuthTokenFromStorage } from '../client';

const companyParams = (companyId?: number) =>
  companyId != null && companyId > 0 ? { company_id: companyId } : undefined;

export const partnerService = {
  // Excel ?�플 ?�운로드
  downloadExcelSample: async () => {
    const authToken = getAuthTokenFromStorage() || '';

    const response = await fetch(`${API_BASE_URL}/partners/excel/sample`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Excel ?�플 ?�일 ?�운로드???�패?�습?�다.');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `?�트???�체_?�력_?�플_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Excel ?�일 ?�보?�기
  exportExcel: async (companyId?: number) => {
    const authToken = getAuthTokenFromStorage() || '';
    const query = companyId != null && companyId > 0 ? `?company_id=${encodeURIComponent(String(companyId))}` : '';

    const response = await fetch(`${API_BASE_URL}/partners/excel/export${query}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Excel ?�일 ?�보?�기???�패?�습?�다.');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `?�트???�체_목록_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Excel ?�일 ?�로??
  importExcel: async (file: File, companyId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    if (companyId != null && companyId > 0) {
      formData.append('company_id', String(companyId));
    }

    const authToken = getAuthTokenFromStorage() || '';

    const response = await api.post('/partners/excel/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${authToken}`
      }
    });

    return response.data;
  },

  // ?�트??목록 조회
  getPartners: async (companyId?: number) => {
    const response = await api.get('/partners', { params: companyParams(companyId) });
    return response.data;
  },

  // ?�정 ?�트??조회
  getPartner: async (id: number, companyId?: number) => {
    const response = await api.get(`/partners/${id}`, { params: companyParams(companyId) });
    return response.data;
  },

  // ?�트???�성
  createPartner: async (partnerData: any, companyId?: number) => {
    const response = await api.post('/partners', {
      ...partnerData,
      ...(companyParams(companyId) || {}),
    });
    return response.data;
  },

  // ?�트???�정
  updatePartner: async (id: number, partnerData: any, companyId?: number) => {
    const response = await api.put(`/partners/${id}`, {
      ...partnerData,
      ...(companyParams(companyId) || {}),
    });
    return response.data;
  },

  // 파트너 합치기 (keepId 유지, mergeIds soft-delete)
  mergePartners: async (keepId: number, mergeIds: number[], companyId?: number) => {
    const response = await api.post('/partners/merge', {
      keepId,
      mergeIds,
      ...(companyParams(companyId) || {}),
    });
    return response.data;
  },

  // 파트너 삭제
  deletePartner: async (id: number, companyId?: number) => {
    const response = await api.delete(`/partners/${id}`, { params: companyParams(companyId) });
    return response.data;
  }
};

// ?�스???�정 API ?�비??
