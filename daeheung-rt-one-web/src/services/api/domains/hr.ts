import { api } from '../client';

export const hrService = {
  // 급여 목록 조회
  getPayrolls: async (params?: any) => {
    const response = await api.get('/hr/payrolls', { params });
    return response.data;
  },

  // ?�정 급여 조회
  getPayroll: async (id: number) => {
    const response = await api.get(`/hr/payrolls/${id}`);
    return response.data;
  },

  // 급여 ?�성
  createPayroll: async (payrollData: any) => {
    const response = await api.post('/hr/payrolls', payrollData);
    return response.data;
  },

  // 급여 ?�정
  updatePayroll: async (id: number, payrollData: any) => {
    const response = await api.put(`/hr/payrolls/${id}`, payrollData);
    return response.data;
  },

  // 급여 ??��
  deletePayroll: async (id: number) => {
    const response = await api.delete(`/hr/payrolls/${id}`);
    return response.data;
  },

  // 직원 목록 조회
  getEmployees: async () => {
    const response = await api.get('/hr/employees');
    return response.data;
  }
};

// ?�고 관�?API ?�비??
export const vacationService = {
  // ?��? 목록 조회
  getVacations: async (params?: { user_id?: number; status?: string; vacation_type?: string; start_date?: string; end_date?: string; company_id?: number; approved_by?: number; same_department?: boolean }) => {
    const response = await api.get('/hr/vacations', { params });
    return response.data;
  },

  // ?��? ?�세 조회
  getVacation: async (id: number) => {
    const response = await api.get(`/hr/vacations/${id}`);
    return response.data;
  },

  // ?��? ?�성
  createVacation: async (data: { user_id?: number; vacation_type: string; start_date: string; end_date: string; reason: string; attachments?: string[] }) => {
    const response = await api.post('/hr/vacations', data);
    return response.data;
  },

  // ?��? ?�정
  updateVacation: async (id: number, data: {
    vacation_type?: string;
    start_date?: string;
    end_date?: string;
    reason?: string;
    attachments?: string[];
    approved_by?: number | null;
  }) => {
    const response = await api.put(`/hr/vacations/${id}`, data);
    return response.data;
  },

  // 연차 정보 조회
  getAnnualLeaveInfo: async (userId?: number) => {
    const params = userId ? { user_id: userId } : {};
    const response = await api.get('/hr/vacations/annual-leave', { params });
    return response.data;
  },

  // 직원별 휴가 잔여일
  getLeaveBalances: async (params?: { company_id?: number }) => {
    const response = await api.get('/hr/vacations/leave-balances', { params });
    return response.data;
  },

  // 휴가 정책 조회 (root는 company_id로 타사 정책 조회)
  getVacationPolicy: async (params?: { company_id?: number }) => {
    const response = await api.get('/hr/vacations/policy', { params });
    return response.data;
  },

  // 휴가 정책 저장 (root는 company_id로 타사 정책 수정)
  updateVacationPolicy: async (data: {
    annualLeaveStartDays?: number;
    annualLeaveEarnDays?: number;
    availableTypes?: string[];
    leaveTypeDays?: Record<string, number>;
    deductAbsenceFromLeave?: boolean;
    forceFixedAnnualForTenure?: boolean;
    forceFixedAnnualDays?: number;
    forceFixedAnnualMinYears?: number;
    company_id?: number;
  }) => {
    const response = await api.put('/hr/vacations/policy', data);
    return response.data;
  },

  // ?��? ??��
  deleteVacation: async (id: number) => {
    const response = await api.delete(`/hr/vacations/${id}`);
    return response.data;
  },

  // ?��? ?�인
  approveVacation: async (id: number) => {
    const response = await api.post(`/hr/vacations/${id}/approve`);
    return response.data;
  },

  // ?��? 거�?
  rejectVacation: async (id: number, rejection_reason?: string) => {
    const response = await api.post(`/hr/vacations/${id}/reject`, { rejection_reason });
    return response.data;
  },

  // ?��? ?�이??Excel ?�보?�기
  exportVacationsToExcel: async (params?: { user_id?: number; status?: string; vacation_type?: string; start_date?: string; end_date?: string; approved_by?: number }) => {
    const response = await api.get('/hr/vacations/excel/export', {
    params,
    responseType: 'blob'
    });
    return response;
  }
};

export const employmentContractService = {
  getTemplates: async (company_id?: number) => {
    const response = await api.get('/hr/employment-contract-templates', {
    params: company_id ? { company_id } : undefined
    });
    return response.data;
  },
  createTemplate: async (data: any) => {
    const response = await api.post('/hr/employment-contract-templates', data);
    return response.data;
  },
  updateTemplate: async (id: number, data: any) => {
    const response = await api.put(`/hr/employment-contract-templates/${id}`, data);
    return response.data;
  },
  deleteTemplate: async (id: number) => {
    const response = await api.delete(`/hr/employment-contract-templates/${id}`);
    return response.data;
  },
  getContracts: async (params?: { company_id?: number; employee_id?: number; status?: string }) => {
    const response = await api.get('/hr/employment-contracts', { params });
    return response.data;
  },
  getContract: async (id: number) => {
    const response = await api.get(`/hr/employment-contracts/${id}`);
    return response.data;
  },
  createContract: async (data: any) => {
    const response = await api.post('/hr/employment-contracts', data);
    return response.data;
  },
  updateContract: async (id: number, data: any) => {
    const response = await api.put(`/hr/employment-contracts/${id}`, data);
    return response.data;
  },
  deleteContract: async (id: number) => {
    const response = await api.delete(`/hr/employment-contracts/${id}`);
    return response.data;
  },
  signContract: async (
    id: number,
    signer_type: 'company' | 'employee',
    sign_method: 'internal_ack' | 'aadhaar_esign' = 'internal_ack',
    extra?: { aadhaar_consent?: boolean; aadhaar_last4?: string; aadhaar_auth_ref?: string; signature_data?: string }
  ) => {
    const response = await api.post(`/hr/employment-contracts/${id}/sign`, {
    signer_type,
    sign_method,
    ...(extra || {})
    });
    return response.data;
  },
  sendContractToEmployee: async (id: number) => {
    const response = await api.post(`/hr/employment-contracts/${id}/send`);
    return response.data;
  },
  getPendingApprovals: async () => {
    const response = await api.get('/hr/employment-contracts/pending-approvals');
    return response.data;
  },
  submitForApproval: async (id: number) => {
    const response = await api.post(`/hr/employment-contracts/${id}/submit-approval`);
    return response.data;
  },
  approveContract: async (id: number) => {
    const response = await api.post(`/hr/employment-contracts/${id}/approve`);
    return response.data;
  },
  rejectApproval: async (id: number, rejection_reason?: string) => {
    const response = await api.post(`/hr/employment-contracts/${id}/reject-approval`, {
      rejection_reason,
    });
    return response.data;
  },
  completeContract: async (id: number) => {
    const response = await api.post(`/hr/employment-contracts/${id}/complete`);
    return response.data;
  },
  getMyContracts: async (status?: string) => {
    const response = await api.get('/hr/my/employment-contracts', {
    params: status ? { status } : undefined
    });
    return response.data;
  },
  initiateAadhaarEsign: async (
    id: number,
    data: { signer_type?: 'company' | 'employee'; aadhaar_consent: boolean; aadhaar_last4: string; return_url?: string }
  ) => {
    const response = await api.post(`/hr/employment-contracts/${id}/aadhaar-esign/initiate`, data);
    return response.data;
  },
  completeAadhaarEsign: async (data: { session_token: string; mock_otp?: string; callback_payload?: any }) => {
    const response = await api.post('/hr/employment-contracts/aadhaar-esign/complete', data);
    return response.data;
  },
  getAadhaarEsignConfig: async () => {
    const response = await api.get('/hr/employment-contracts/aadhaar-esign/config');
    return response.data;
  },
  getContractAuditLogs: async (id: number, params?: { limit?: number }) => {
    const response = await api.get(`/hr/employment-contracts/${id}/audit-logs`, { params });
    return response.data;
  },
  downloadContractPdf: async (id: number) => {
    const response = await api.get(`/hr/employment-contracts/${id}/pdf`, {
      responseType: 'blob',
    });
    return response;
  },
};

/** ?�사 ??부??관�?*/

export const departmentService = {
  list: async (includeInactive = false, companyId?: number) => {
    const params: Record<string, string | number> = {};
    if (includeInactive) params.include_inactive = '1';
    if (companyId != null) params.company_id = companyId;
    const response = await api.get('/hr/departments', { params });
    return response.data;
  },
  create: async (data: {
    name: string;
    code?: string;
    sort_order?: number;
    is_active?: boolean;
    company_id?: number;
  }) => {
    const response = await api.post('/hr/departments', data);
    return response.data;
  },
  update: async (
    id: number,
    data: {
      name?: string;
      code?: string | null;
      sort_order?: number;
      is_active?: boolean;
      company_id?: number;
    }
  ) => {
    const response = await api.put(`/hr/departments/${id}`, data);
    return response.data;
  },
  delete: async (id: number, companyId?: number) => {
    const response = await api.delete(`/hr/departments/${id}`, {
      params: companyId != null ? { company_id: companyId } : undefined,
    });
    return response.data;
  },
};

export const positionService = {
  list: async (includeInactive = false, companyId?: number) => {
    const params: Record<string, string | number> = {};
    if (includeInactive) params.include_inactive = '1';
    if (companyId != null) params.company_id = companyId;
    const response = await api.get('/hr/positions', { params });
    return response.data;
  },
  create: async (data: {
    name: string;
    code?: string;
    sort_order?: number;
    is_active?: boolean;
    company_id?: number;
  }) => {
    const response = await api.post('/hr/positions', data);
    return response.data;
  },
  update: async (
    id: number,
    data: {
      name?: string;
      code?: string | null;
      sort_order?: number;
      is_active?: boolean;
      company_id?: number;
    }
  ) => {
    const response = await api.put(`/hr/positions/${id}`, data);
    return response.data;
  },
  delete: async (id: number, companyId?: number) => {
    const response = await api.delete(`/hr/positions/${id}`, {
      params: companyId != null ? { company_id: companyId } : undefined,
    });
    return response.data;
  },
};


// ?�로?�트 관�?API ?�비??
export const attendanceService = {
  // 근태 목록 조회
  getAttendances: async (params?: { date?: string; start_date?: string; end_date?: string; status?: string }) => {
    const response = await api.get('/hr/attendances', { params });
    return response.data;
  },

  /** ?�사 ?�체 근태 (HR ?�계) ??admin/root/audit �?*/
  getCompanyAttendances: async (params?: {
    user_id?: number;
    date?: string;
    start_date?: string;
    end_date?: string;
    department?: string;
    status?: string;
  }) => {
    const response = await api.get('/hr/attendances/company', { params });
    return response.data;
  },

  // ?�늘??근태 조회
  getTodayAttendance: async (clientDate?: string) => {
    const response = await api.get('/hr/attendances/today', {
    params: clientDate ? { client_date: clientDate } : undefined
    });
    return response.data;
  },

  // 근태 ?�세 조회
  getAttendance: async (id: number) => {
    const response = await api.get(`/hr/attendances/${id}`);
    return response.data;
  },

  // 출근 처리
  checkIn: async (payload?: { latitude?: number; longitude?: number; accuracy?: number; client_time?: string; client_date?: string; use_server_time?: boolean; skip_geo?: boolean }) => {
    const response = await api.post('/hr/attendances/check-in', payload || {});
    return response.data;
  },

  // ?�근 처리
  checkOut: async (payload?: { client_time?: string; client_date?: string; use_server_time?: boolean; skip_geo?: boolean }) => {
    const response = await api.post('/hr/attendances/check-out', payload || {});
    return response.data;
  },

  // 근태 ?�성
  createAttendance: async (data: { user_id: number; date: string; check_in?: string; check_out?: string; status?: string; notes?: string }) => {
    const response = await api.post('/hr/attendances', data);
    return response.data;
  },

  // 근태 ?�정
  updateAttendance: async (id: number, data: { check_in?: string; check_out?: string; status?: string; notes?: string }) => {
    const response = await api.put(`/hr/attendances/${id}`, data);
    return response.data;
  },

  // 근태 ??��
  deleteAttendance: async (id: number) => {
    const response = await api.delete(`/hr/attendances/${id}`);
    return response.data;
  }
};
