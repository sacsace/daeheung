import { api, API_BASE_URL, getAuthTokenFromStorage } from '../client';

async function postMultipartFormData(path: string, formData: FormData, timeoutMs = 120000) {
  const token = getAuthTokenFromStorage();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer =
    controller && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
      signal: controller?.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err: any = new Error(
        String((data as any)?.message || '').trim() || `Upload failed (${response.status})`
      );
      err.response = { data, status: response.status };
      throw err;
    }
    return data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const accountingService = {
  // SAP Excel / CSV Import
  inspectSapImport: async (
    file: File,
    params?: { company_id?: number; sheetName?: string; headerRowNumber?: number }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    if (params?.company_id) formData.append('company_id', String(params.company_id));
    if (params?.sheetName) formData.append('sheetName', params.sheetName);
    if (params?.headerRowNumber) formData.append('headerRowNumber', String(params.headerRowNumber));
    const response = await api.post('/accounting/sap/inspect', formData, {
      timeout: 600000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      transformRequest: [(data) => data],
    });
    return response.data;
  },

  getSapImportTemplates: async (params?: { company_id?: number }) => {
    const response = await api.get('/accounting/sap/templates', { params });
    return response.data;
  },

  previewSapImport: async (
    file: File,
    template: {
      columnMapping: Record<string, string>;
      documentGroupKeys: string[];
      amountMode: 'separate_columns' | 'amount_indicator';
      debitCreditConfig?: { debitIndicators?: string[]; creditIndicators?: string[] };
    },
    params?: { company_id?: number }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('template', JSON.stringify(template));
    if (params?.company_id) formData.append('company_id', String(params.company_id));
    const response = await api.post('/accounting/sap/preview', formData, {
      timeout: 600000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      transformRequest: [(data) => data],
    });
    return response.data;
  },

  getSapImportMappings: async (params?: { company_id?: number; mappingType?: 'gl' | 'party' | 'gst' }) => {
    const response = await api.get('/accounting/sap/mappings', { params });
    return response.data;
  },

  createSapImportMapping: async (
    data: { mappingType: 'gl' | 'party' | 'gst'; sourceCode?: string; sourceName?: string; targetId: number },
    companyId?: number
  ) => {
    const response = await api.post('/accounting/sap/mappings', {
      ...data,
      ...(companyId ? { company_id: companyId } : {}),
    });
    return response.data;
  },

  approveSapImportMapping: async (id: number, reason: string, companyId?: number) => {
    const response = await api.post(`/accounting/sap/mappings/${id}/approve`, {
      reason,
      ...(companyId ? { company_id: companyId } : {}),
    });
    return response.data;
  },

  // 인보이스 목록 조회
  getInvoices: async (params?: any) => {
    const response = await api.get('/accounting/invoices', { params });
    return response.data;
  },

  getProformaInvoices: async (params?: any) => {
    const response = await api.get('/accounting/proforma-invoices', { params });
    return response.data;
  },

  createProformaInvoice: async (invoiceData: any) => {
    const response = await api.post('/accounting/proforma-invoices', invoiceData);
    return response.data;
  },

  updateProformaInvoiceStatus: async (id: number | string, status: string) => {
    const response = await api.put(`/accounting/proforma-invoices/${id}/status`, { status });
    return response.data;
  },

  // 다음 인보이스 번호 조회 (root/audit는 company_id로 타사 번호 조회)
  getNextInvoiceNumber: async (params?: { company_id?: number }) => {
    const response = await api.get('/accounting/invoices/next-number', { params });
    return response.data;
  },

  // ?�정 ?�보?�스 조회
  getInvoice: async (id: number) => {
    const response = await api.get(`/accounting/invoices/${id}`);
    return response.data;
  },

  approveInvoice: async (id: number) => {
    const response = await api.post(`/accounting/invoices/${id}/approve`);
    return response.data;
  },

  rejectInvoice: async (id: number) => {
    const response = await api.post(`/accounting/invoices/${id}/reject`);
    return response.data;
  },

  // ?�보?�스 ?�성
  createInvoice: async (invoiceData: any) => {
    const response = await api.post('/accounting/invoices', invoiceData);
    return response.data;
  },

  /** ?�보?�스 PDF 첨�? 메일 ??본문 ?�?�량·SMTP 지???��??�?�아???�장 (기본 10�?초과 방�?) */
  sendInvoiceEmail: async (id: number, data: { to: string; subject?: string; message?: string; filename?: string }) => {
    const response = await api.post(`/accounting/invoices/${id}/send-email`, data, {
    timeout: 120000
    });
    return response.data;
  },

  // ?�보?�스 ?�정
  updateInvoice: async (id: number, invoiceData: any) => {
    const response = await api.put(`/accounting/invoices/${id}`, invoiceData);
    return response.data;
  },

  // ?�보?�스 ?�태/결제?�태 ?�데?�트
  updateInvoiceStatus: async (
    id: number,
    data: {
      status?: string;
      payment_status?: string;
      payment_method?: string;
      payment_date?: string;
    }
  ) => {
    const response = await api.put(`/accounting/invoices/${id}/status`, data);
    return response.data;
  },

  // ?�보?�스 ??�� ?�인 ?�청 (직접 ??�� ?�님)
  deleteInvoice: async (
    id: number,
    data: { approver_user_id: number; memo?: string }
  ) => {
    const response = await api.delete(`/accounting/invoices/${id}`, { data });
    return response.data;
  },

  // ?�계 ?�계 조회
  getAccountingStats: async (params?: any) => {
    const response = await api.get('/accounting/stats', { params });
    return response.data;
  },

  // 지출결?�서 목록 조회
  getExpenseReports: async (params?: any) => {
    const response = await api.get('/accounting/expenses', { params });
    return response.data;
  },

  // 지출결의서 상세 조회
  getExpenseReport: async (id: number, options?: { skipErrorPopup?: boolean }) => {
    const response = await api.get(`/accounting/expenses/${id}`, {
      headers: options?.skipErrorPopup ? { 'x-skip-error-popup': 'true' } : undefined,
    });
    return response.data;
  },

  addExpenseReportComment: async (id: number, comment: string, parentId?: number | null) => {
    const payload: { comment: string; parentId?: number } = { comment };
    if (parentId != null && Number.isFinite(parentId) && parentId > 0) {
      payload.parentId = parentId;
    }
    const response = await api.post(`/accounting/expenses/${id}/comments`, payload);
    return response.data;
  },

  markExpenseCommentsRead: async (id: number, options?: { skipErrorPopup?: boolean }) => {
    const response = await api.post(
      `/accounting/expenses/${id}/comments/read`,
      {},
      {
        headers: options?.skipErrorPopup ? { 'x-skip-error-popup': 'true' } : undefined,
      }
    );
    return response.data;
  },

  updateExpenseReportComment: async (id: number, commentId: number, comment: string) => {
    const response = await api.put(`/accounting/expenses/${id}/comments/${commentId}`, { comment });
    return response.data;
  },

  // 지출결?�서 ?�성
  createExpenseReport: async (data: any) => {
    const response = await api.post('/accounting/expenses', data);
    return response.data;
  },

  // 지출결?�서 ?�정
  updateExpenseReport: async (id: number, data: any) => {
    const response = await api.put(`/accounting/expenses/${id}`, data);
    return response.data;
  },

  // 지출결?�서 ??��
  deleteExpenseReport: async (id: number) => {
    const response = await api.delete(`/accounting/expenses/${id}`);
    return response.data;
  },

  // 지출결?�서 ?�태 변�?
  updateExpenseReportStatus: async (
    id: number,
    status: string,
    extra?: { reason?: string; reject_kind?: 'final' | 'revision' }
  ) => {
    const response = await api.put(`/accounting/expenses/${id}/status`, {
      status,
      ...(extra?.reason ? { reason: extra.reason } : {}),
      ...(extra?.reject_kind ? { reject_kind: extra.reject_kind } : {}),
    });
    return response.data;
  },

  changeExpenseApprover: async (id: number, approverId: number) => {
    const response = await api.put(`/accounting/expenses/${id}/approver`, {
      approver_id: approverId,
    });
    return response.data;
  },

  // 지출결?�서 ?�수�??�로???�큰 발급
  getReceiptUploadToken: async (id: number) => {
    const response = await api.get(`/accounting/expenses/${id}/receipt-upload-token`);
    return response.data;
  },

  // 토큰으로 영수증 업로드 (휴대폰에서 사용)
  uploadExpenseReceipt: async (token: string, file: File, invoiceType: 'tax' | 'proforma' | 'none' = 'tax') => {
    const formData = new FormData();
    formData.append('token', token);
    formData.append('file', file);
    formData.append('invoiceType', invoiceType);
    // axios Content-Type 이슈 회피: fetch는 boundary를 브라우저가 자동 설정
    return postMultipartFormData('/accounting/expenses/upload-receipt', formData);
  },

  // 지출결의서 영수증 업로드 (PC)
  uploadExpenseReceiptById: async (
    id: number,
    files: File[],
    invoiceType: 'tax' | 'proforma' | 'none'
  ) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('invoiceType', invoiceType);
    return postMultipartFormData(`/accounting/expenses/${id}/upload-receipt`, formData);
  },

  deleteExpenseReceipt: async (id: number, path: string) => {
    const response = await api.delete(`/accounting/expenses/${id}/receipt`, { data: { path } });
    return response.data;
  },

  // 지출결?�서 결제 ?�청
  requestExpensePayment: async (id: number) => {
    const response = await api.post(`/accounting/expenses/${id}/request-payment`);
    return response.data;
  },

  // 지출결?�서 결제 반려
  rejectExpensePayment: async (id: number, reason?: string) => {
    const response = await api.post(`/accounting/expenses/${id}/reject-payment`, { reason });
    return response.data;
  },

  // 지출결?�서 최종 ?�인
  approveExpensePayment: async (id: number, reason?: string) => {
    const response = await api.post(`/accounting/expenses/${id}/approve-payment`, { reason });
    return response.data;
  },

  // 지출결의서 송금 처리 (금액 + 확인증 업로드, 은행 API 미사용)
  completeExpensePayment: async (id: number, amount?: number, proof?: File) => {
    const formData = new FormData();
    if (amount != null) formData.append('amount', String(amount));
    if (proof) formData.append('proof', proof);
    const response = await api.post(`/accounting/expenses/${id}/complete-payment`, formData, {
      timeout: 120000,
      transformRequest: [(data) => data],
    });
    return response.data;
  },

  // Manual remittance retry (same as complete with proof)
  retryExpenseTransfer: async (id: number, amount?: number, proof?: File) => {
    const formData = new FormData();
    if (amount != null) formData.append('amount', String(amount));
    if (proof) formData.append('proof', proof);
    const response = await api.post(`/accounting/expenses/${id}/retry-transfer`, formData, {
      timeout: 120000,
      transformRequest: [(data) => data],
    });
    return response.data;
  },

  getBudgets: async (params?: any) => {
    const response = await api.get('/accounting/budgets', { params });
    return response.data;
  },

  // ?�산 ?�성
  createBudget: async (data: any) => {
    const response = await api.post('/accounting/budgets', data);
    return response.data;
  },

  // ?�산 ?�정
  updateBudget: async (id: number, data: any) => {
    const response = await api.put(`/accounting/budgets/${id}`, data);
    return response.data;
  },

  // ?�산 ??��
  deleteBudget: async (id: number) => {
    const response = await api.delete(`/accounting/budgets/${id}`);
    return response.data;
  },

  // ?�산 목록 조회
  getAssets: async (params?: any) => {
    const response = await api.get('/accounting/assets', { params });
    return response.data;
  },

  // ?�산 ?�성
  createAsset: async (data: any) => {
    const response = await api.post('/accounting/assets', data);
    return response.data;
  },

  // ?�산 ?�정
  updateAsset: async (id: number, data: any) => {
    const response = await api.put(`/accounting/assets/${id}`, data);
    return response.data;
  },

  // ?�산 ??��
  deleteAsset: async (id: number) => {
    const response = await api.delete(`/accounting/assets/${id}`);
    return response.data;
  },

  getAssetDepreciationSchedule: async (id: number) => {
    const response = await api.get(`/accounting/assets/${id}/depreciation-schedule`);
    return response.data;
  },

  // AI 자동 전표 목록
  getAutoVouchers: async (params?: { status?: string; sourceDocType?: string; q?: string; company_id?: number }) => {
    const response = await api.get('/accounting/auto-vouchers', { params });
    return response.data;
  },

  // AI 자동 전표 상세
  getAutoVoucher: async (id: number, companyId?: number) => {
    const response = await api.get(`/accounting/auto-vouchers/${id}`, {
    params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  // AI 자동 전표 업로드 + 초안 생성
  uploadAutoVoucher: async (file: File, sourceDocType: string, companyId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceDocType', sourceDocType);
    const response = await api.post('/accounting/auto-vouchers/upload', formData, {
      timeout: 120000,
      transformRequest: [(data) => data],
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  // AI 자동 전표 수정
  updateAutoVoucher: async (id: number, data: any, companyId?: number) => {
    const response = await api.put(`/accounting/auto-vouchers/${id}`, data, {
    params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  // AI 자동 전표 승인
  approveAutoVoucher: async (id: number, companyId?: number) => {
    const response = await api.post(`/accounting/auto-vouchers/${id}/approve`, {}, {
    params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  // AI 자동 전표 Post
  postAutoVoucher: async (id: number, companyId?: number) => {
    const response = await api.post(`/accounting/auto-vouchers/${id}/post`, {}, {
    params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  // AI 자동 전표 반려
  rejectAutoVoucher: async (id: number, reason: string, companyId?: number) => {
    const response = await api.post(
    `/accounting/auto-vouchers/${id}/reject`,
    { reason },
    { params: companyId ? { company_id: companyId } : undefined }
    );
    return response.data;
  },

  // AI 자동 전표 규칙 목록
  getAutoVoucherRules: async () => {
    const response = await api.get('/accounting/auto-voucher-rules');
    return response.data;
  },

  /** Accounting Brain — recommend only (never posts) */
  brainRecommend: async (
    data: {
      description?: string;
      sourceDocType?: string;
      vendorName?: string;
      customerName?: string;
      invoiceNumber?: string;
      amount?: number;
      currency?: string;
      transactionDate?: string;
      gstin?: string;
      ocrText?: string;
      narration?: string;
      source?: string;
    },
    companyId?: number
  ) => {
    const response = await api.post('/accounting/brain/recommend', data, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  brainAsk: async (question: string, companyId?: number) => {
    const response = await api.post(
      '/accounting/brain/ask',
      { question },
      { params: companyId ? { company_id: companyId } : undefined }
    );
    return response.data;
  },

  brainLearn: async (
    data: {
      fieldName: string;
      afterValue: string;
      beforeValue?: string;
      counterpartyName?: string;
      keyword?: string;
      docType?: string;
      sourceType?: string;
      sourceId?: number;
      recommendationSnapshot?: Record<string, unknown>;
    },
    companyId?: number
  ) => {
    const response = await api.post('/accounting/brain/learn', data, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  brainRecommendFromInvoice: async (invoiceId: number, companyId?: number) => {
    const response = await api.post(
      `/accounting/brain/from-invoice/${invoiceId}`,
      {},
      { params: companyId ? { company_id: companyId } : undefined }
    );
    return response.data;
  },

  brainRecommendFromExpense: async (expenseId: number, companyId?: number) => {
    const response = await api.post(
      `/accounting/brain/from-expense/${expenseId}`,
      {},
      { params: companyId ? { company_id: companyId } : undefined }
    );
    return response.data;
  },

  brainListAudits: async (params?: { limit?: number; company_id?: number }) => {
    const response = await api.get('/accounting/brain/audits', { params });
    return response.data;
  },

  // AI 자동 전표 규칙 저장
  upsertAutoVoucherRule: async (data: any) => {
    const response = await api.post('/accounting/auto-voucher-rules', data);
    return response.data;
  },

  getGlAccounts: async (params?: { tree?: boolean; ledgerOnly?: boolean; company_id?: number }) => {
    const response = await api.get('/accounting/gl/accounts', {
      params: {
        tree: params?.tree ? 'true' : undefined,
        ledgerOnly: params?.ledgerOnly ? 'true' : undefined,
        company_id: params?.company_id,
      },
    });
    return response.data;
  },

  seedGlAccounts: async (companyId?: number) => {
    const response = await api.post('/accounting/gl/accounts/seed-defaults', {}, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  createGlAccount: async (data: any, companyId?: number) => {
    const response = await api.post('/accounting/gl/accounts', data, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  updateGlAccount: async (id: number, data: any, companyId?: number) => {
    const response = await api.put(`/accounting/gl/accounts/${id}`, data, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  deleteGlAccount: async (id: number, companyId?: number) => {
    const response = await api.delete(`/accounting/gl/accounts/${id}`, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  getGlVouchers: async (params?: { status?: string; from?: string; to?: string; company_id?: number }) => {
    const response = await api.get('/accounting/gl/vouchers', { params });
    return response.data;
  },

  getGlVoucher: async (id: number, companyId?: number) => {
    const response = await api.get(`/accounting/gl/vouchers/${id}`, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  createGlVoucher: async (data: any, companyId?: number) => {
    const response = await api.post('/accounting/gl/vouchers', data, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  postGlVoucher: async (id: number, companyId?: number) => {
    const response = await api.post(`/accounting/gl/vouchers/${id}/post`, {}, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  /** Post all draft vouchers (or selected ids) for the company */
  bulkPostGlVouchers: async (companyId?: number, ids?: number[]) => {
    const response = await api.post(
      '/accounting/gl/vouchers/bulk-post',
      ids?.length ? { ids } : {},
      {
        params: companyId ? { company_id: companyId } : undefined,
        timeout: 300000,
      }
    );
    return response.data;
  },

  getAccountLedger: async (params: { accountId: number; from?: string; to?: string; company_id?: number }) => {
    const response = await api.get('/accounting/gl/ledger', { params });
    return response.data;
  },

  getTrialBalance: async (params?: {
    from?: string;
    to?: string;
    company_id?: number;
    tallyOnly?: boolean;
  }) => {
    const response = await api.get('/accounting/gl/trial-balance', { params });
    return response.data;
  },

  getProfitAndLoss: async (params?: { from?: string; to?: string; company_id?: number }) => {
    const response = await api.get('/accounting/gl/profit-and-loss', { params });
    return response.data;
  },

  getBalanceSheet: async (params?: { from?: string; asOf?: string; company_id?: number }) => {
    const response = await api.get('/accounting/gl/balance-sheet', { params });
    return response.data;
  },

  /** Tally Export XML/JSON preview (no DB write) */
  previewTallyImport: async (formData: FormData, companyId?: number) => {
    const response = await api.post('/accounting/tally/preview', formData, {
      params: companyId ? { company_id: companyId } : undefined,
      timeout: 600000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      // Content-Type 생략: client 인터셉터가 FormData면 multipart+boundary로 설정
      transformRequest: [(data) => data],
    });
    return response.data;
  },

  /** Tally Export → MSV GL (draft vouchers; never auto-posts) */
  importTallyExport: async (
    formData: FormData,
    companyId?: number
  ) => {
    const response = await api.post('/accounting/tally/import', formData, {
      params: companyId ? { company_id: companyId } : undefined,
      timeout: 600000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      transformRequest: [(data) => data],
    });
    return response.data;
  },

  /** Tally Import Batch summary */
  getTallyImportBatch: async (batchId: number, companyId?: number) => {
    const response = await api.get(`/accounting/tally/batches/${batchId}`, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  /** Tally source-to-MVS voucher movement reconciliation */
  getTallyImportReconciliation: async (batchId: number, companyId?: number) => {
    const response = await api.get(`/accounting/tally/batches/${batchId}/reconciliation`, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  // ── 직관적 전표 입력 마스터 API ──
  seedAccountingMasters: async (companyId?: number) => {
    const response = await api.post('/accounting/masters/seed', {}, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  getVoucherTypes: async (companyId?: number) => {
    const response = await api.get('/accounting/voucher-types', {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  getTransactionItems: async (params?: { search?: string; company_id?: number }) => {
    const response = await api.get('/accounting/transaction-items', { params });
    return response.data;
  },

  getGstCodes: async (params?: { voucherDate?: string; company_id?: number }) => {
    const response = await api.get('/accounting/gst-codes', { params });
    return response.data;
  },

  getTdsCodes: async (companyId?: number) => {
    const response = await api.get('/accounting/tds-codes', {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  getBankAccounts: async (companyId?: number) => {
    const response = await api.get('/accounting/bank-accounts', {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  getFinancialYears: async (companyId?: number) => {
    const response = await api.get('/accounting/financial-years', {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  searchAccountingParties: async (params?: { search?: string; company_id?: number }) => {
    const response = await api.get('/accounting/parties', { params });
    return response.data;
  },

  searchGlAccounts: async (params?: { search?: string; company_id?: number }) => {
    const response = await api.get('/accounting/accounts/search', { params });
    return response.data;
  },

  previewVoucher: async (data: any, companyId?: number) => {
    const response = await api.post('/accounting/vouchers/preview', data, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  validateVoucherEntry: async (data: any, companyId?: number) => {
    const response = await api.post('/accounting/vouchers/validate', data, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  createEnhancedVoucher: async (data: any, companyId?: number) => {
    const response = await api.post('/accounting/vouchers/enhanced', data, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  getNextVoucherNumber: async (params: { voucherTypeId: number; voucherDate: string; company_id?: number }) => {
    const response = await api.get('/accounting/vouchers/next-number', { params });
    return response.data;
  },

  submitVoucherEntry: async (id: number, companyId?: number) => {
    const response = await api.post(`/accounting/vouchers/${id}/submit`, {}, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  approveVoucherEntry: async (id: number, companyId?: number) => {
    const response = await api.post(`/accounting/vouchers/${id}/approve`, {}, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  rejectVoucherEntry: async (id: number, reason: string, companyId?: number) => {
    const response = await api.post(`/accounting/vouchers/${id}/reject`, { reason }, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  upsertVoucherType: async (data: any, companyId?: number) => {
    const response = await api.post('/accounting/voucher-types', data, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  upsertTransactionItem: async (data: any, companyId?: number) => {
    const response = await api.post('/accounting/transaction-items', data, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  upsertGstCode: async (data: any, companyId?: number) => {
    const response = await api.post('/accounting/gst-codes', data, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  upsertTdsCode: async (data: any, companyId?: number) => {
    const response = await api.post('/accounting/tds-codes', data, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },

  upsertBankAccount: async (data: any, companyId?: number) => {
    const response = await api.post('/accounting/bank-accounts', data, {
      params: companyId ? { company_id: companyId } : undefined,
    });
    return response.data;
  },
};

export const payrollService = {
  getPayrollBonuses: async (params: {
    company_id?: number;
    fiscal_year?: string;
    installments_per_year?: number;
    installment?: number;
  }) => {
    const response = await api.get('/hr/payroll-bonuses', { params });
    return response.data;
  },

  removePayrollBonuses: async (data: {
    company_id?: number;
    fiscal_year: string;
    installments_per_year: number;
    installment: number;
    employee_ids: number[];
  }) => {
    const response = await api.post('/hr/payroll-bonuses/remove', data);
    return response.data;
  },

  registerPayrollBonuses: async (data: {
    company_id?: number;
    fiscal_year: string;
    installments_per_year: number;
    installment: number;
    employee_ids?: number[];
    generate_all?: boolean;
    mark_paid?: boolean;
  }) => {
    const response = await api.post('/hr/payroll-bonuses', data);
    return response.data;
  },

  updatePayrollBonusLine: async (data: {
    company_id?: number;
    fiscal_year: string;
    installments_per_year: number;
    installment: number;
    employee_id: number;
    rate_percent: number;
    amount: number;
  }) => {
    const response = await api.put('/hr/payroll-bonuses/line', data);
    return response.data;
  },

  requestPayrollBonusApproval: async (data: {
    company_id?: number;
    fiscal_year: string;
    installments_per_year: number;
    installment: number;
    approver_id: number;
  }) => {
    const response = await api.post('/hr/payroll-bonuses/approval', data);
    return response.data;
  },

  downloadPayrollBonusStatement: async (data: {
    company_id?: number;
    fiscal_year: string;
    installments_per_year: number;
    installment: number;
    employee_ids: number[];
  }) => {
    const response = await api.post('/hr/payroll-bonuses/statement', data);
    return response.data;
  },

  sendPayrollBonusStatements: async (
    data: {
      company_id?: number;
      fiscal_year: string;
      installments_per_year: number;
      installment: number;
      employee_ids: number[];
      statements?: Array<{ employee_id: number; pdf_base64: string }>;
    },
    options?: { skipErrorPopup?: boolean; timeout?: number }
  ) => {
    const response = await api.post('/hr/payroll-bonuses/send', data, {
      timeout: options?.timeout ?? 300000,
      headers: options?.skipErrorPopup ? { 'x-skip-error-popup': 'true' } : undefined,
    });
    return response.data;
  },

  // 급여 목록 조회
  getPayrolls: async (params?: { page?: number; limit?: number; employee_id?: number; period?: string; company_id?: number }) => {
    const response = await api.get('/hr/payrolls', { params });
    return response.data;
  },

  // 급여 ?�세 조회
  getPayroll: async (id: number) => {
    const response = await api.get(`/hr/payrolls/${id}`);
    return response.data;
  },

  // 급여 ?�성
  createPayroll: async (data: any) => {
    const response = await api.post('/hr/payrolls', data);
    return response.data;
  },

  /** 확정된 급여 근무월(YYYY-MM) 목록 */
  getPayrollPeriodLocks: async (params?: { company_id?: number }) => {
    const response = await api.get('/hr/payroll-period-locks', { params });
    return response.data;
  },

  /** 급여월 결재 상태 */
  getPayrollPeriodApproval: async (params: { payroll_period: string; company_id?: number }) => {
    const response = await api.get('/hr/payroll-period-approval', { params });
    return response.data;
  },

  /** 급여월 결재 요청 */
  requestPayrollPeriodApproval: async (data: {
    payroll_period: string;
    approver_id: number;
    company_id?: number;
  }) => {
    const response = await api.post('/hr/payroll-period-approval/request', data);
    return response.data;
  },

  /** 선택한 근무월 급여 확정(잠금) — 결재 승인 후 */
  completePayrollPeriod: async (payroll_period: string, opts?: { company_id?: number }) => {
    const response = await api.post('/hr/payroll-periods/complete', {
      payroll_period,
      ...(opts?.company_id != null ? { company_id: opts.company_id } : {}),
    });
    return response.data;
  },

  /** 회사별 급여 그리드 컬럼·상수 % (companies.settings.payroll.grid) */
  getPayrollGridSettings: async (params?: { company_id?: number }) => {
    const response = await api.get('/hr/payroll-grid-settings', { params });
    return response.data;
  },

  updatePayrollGridSettings: async (data: {
    company_id?: number;
    columnPrefs: unknown;
    salaryRatios: unknown;
    otRateFormula?: unknown;
  }) => {
    const response = await api.put('/hr/payroll-grid-settings', data);
    return response.data;
  },

  /** 회사별 근무형태 → 급여 계산 옵션 */
  getEmploymentTypePaySettings: async (params?: { company_id?: number }) => {
    const response = await api.get('/hr/employment-type-pay-settings', { params });
    return response.data;
  },

  updateEmploymentTypePaySettings: async (data: {
    company_id?: number;
    types: unknown[];
  }) => {
    const response = await api.put('/hr/employment-type-pay-settings', data);
    return response.data;
  },

  /** ?�재 ?�사 ?�성 ?�용??기�? 급여 ?�괄 ?�성 (?�도 PF/ESI/PT/TDS ?�션 ?�택 가?? */
  /** ?�괄 ?�성 ?? ?�정·중복·직원�??�당 ??출퇴�?건수 ?�약 */
  previewBulkPayrollGeneration: async (
    payroll_period: string,
    opts?: { company_id?: number }
  ) => {
    const response = await api.post('/hr/payrolls/bulk-generate/preview', {
      payroll_period,
      ...(opts?.company_id != null ? { company_id: opts.company_id } : {}),
    });
    return response.data;
  },

  bulkGeneratePayrolls: async (
    payroll_period: string,
    opts?: {
      company_id?: number;
      statutory_india?: boolean;
      /** 기본 gross_6pct(참고 ?�트). epf_12pct_half = ?�전 50%×12% EPF??*/
      pf_mode?: 'gross_6pct' | 'epf_12pct_half';
      pf_cap_1800?: boolean;
      pf_calc_mode?: 'cap_1800' | 'basic_12pct' | 'total_12pct' | 'none';
      estimate_tds?: boolean;
    }
  ) => {
    const response = await api.post('/hr/payrolls/bulk-generate', {
    payroll_period,
    ...opts
    });
    return response.data;
  },

  /** 급여 명세서 PDF(보관) + PNG 첨부 + HTML 본문을 직원 이메일로 발송 */
  sendPayrollPayslip: async (
    id: number,
    pdf_base64: string,
    opts?: {
      company_id?: number;
      html_body?: string;
      image_base64?: string;
      /** 그리드 재계산 실수령액 — 내 명세서 목록 net과 PDF 일치 */
      net_salary?: number;
    }
  ) => {
    const response = await api.post(`/hr/payrolls/${id}/send-payslip`, {
      pdf_base64,
      ...(opts?.company_id != null ? { company_id: opts.company_id } : {}),
      ...(opts?.html_body ? { html_body: opts.html_body } : {}),
      ...(opts?.image_base64 ? { image_base64: opts.image_base64 } : {}),
      ...(opts?.net_salary != null && Number.isFinite(opts.net_salary)
        ? { net_salary: opts.net_salary }
        : {}),
    }, {
      // PDF+PNG 첨부 SMTP는 테스트 메일보다 훨씬 김. 기본 10초면 전부 실패로 집계됨
      timeout: 120000,
      headers: { 'x-skip-error-popup': 'true' },
    });
    return response.data;
  },

  /** DB 저장 없이 업로드 급여 리스트의 명세서를 지정 이메일로 발송 (MVS 사용자면 내 명세서에도 보관) */
  sendImportedPayslip: async (data: {
    to: string;
    employee_name: string;
    payroll_period: string;
    emp_id?: string;
    net_salary?: number;
    subject: string;
    message: string;
    pdf_base64: string;
    image_base64?: string;
    html_body?: string;
    company_id?: number;
  }) => {
    const response = await api.post('/hr/payslips/send-imported', data, {
      timeout: 120000,
      headers: { 'x-skip-error-popup': 'true' },
    });
    return response.data;
  },

  getMyPayslips: async (params?: { period?: string; q?: string }) => {
    const response = await api.get('/hr/my/payslips', { params });
    return response.data;
  },

  downloadMyPayslip: async (id: number) => {
    try {
      const response = await api.get(`/hr/my/payslips/${id}/download`, {
        responseType: 'blob',
        headers: { 'x-skip-error-popup': 'true' },
      });
      const data = response.data as Blob;
      if (!data || typeof (data as any).arrayBuffer !== 'function') {
        throw new Error('명세서 파일을 불러오지 못했습니다.');
      }
      const contentType = String(response.headers?.['content-type'] || data.type || '');
      const buf = await data.arrayBuffer();
      const bytes = new Uint8Array(buf.slice(0, 5));
      let head = '';
      for (let i = 0; i < bytes.length; i += 1) head += String.fromCharCode(bytes[i]);
      const looksLikePdf = head.startsWith('%PDF');
      if (
        !looksLikePdf ||
        contentType.includes('application/json') ||
        contentType.includes('text/') ||
        buf.byteLength < 64
      ) {
        let message = '명세서 파일이 없습니다. 급여 관리에서 명세서를 다시 발송해 주세요.';
        try {
          const text = new TextDecoder().decode(buf);
          const parsed = JSON.parse(text);
          if (parsed?.message) message = String(parsed.message);
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }
      return new Blob([buf], { type: 'application/pdf' });
    } catch (e: any) {
      const errData = e?.response?.data;
      if (errData && typeof errData.arrayBuffer === 'function') {
        try {
          const text = await (errData as Blob).text();
          const parsed = JSON.parse(text);
          if (parsed?.message) throw new Error(String(parsed.message));
        } catch (inner: any) {
          if (inner?.message && !String(inner.message).startsWith('Unexpected')) throw inner;
        }
      }
      if (e?.message) throw e;
      throw new Error('명세서 파일을 불러오지 못했습니다.');
    }
  },

  // 급여 ?�정
  updatePayroll: async (id: number, data: any, opts?: { company_id?: number }) => {
    const response = await api.put(`/hr/payrolls/${id}`, {
      ...data,
      ...(opts?.company_id != null ? { company_id: opts.company_id } : {}),
    });
    return response.data;
  },

  // 급여 ??��
  deletePayroll: async (id: number, opts?: { company_id?: number }) => {
    const response = await api.delete(`/hr/payrolls/${id}`, {
      params: opts?.company_id != null ? { company_id: opts.company_id } : undefined,
    });
    return response.data;
  },

  // 급여 ?�인
  approvePayroll: async (id: number) => {
    const response = await api.post(`/hr/payrolls/${id}/approve`);
    return response.data;
  },

  // 급여 지�?
  payPayroll: async (id: number) => {
    const response = await api.post(`/hr/payrolls/${id}/pay`);
    return response.data;
  }
};

// ?��? 관�?API ?�비??
export const ewayBillService = {
  // E-Way Bill 목록 조회
  getEWayBills: async (params?: { status?: string; invoice_number?: string; start_date?: string; end_date?: string; company_id?: number; page?: number; limit?: number }) => {
    const response = await api.get('/accounting/eway-bills', { params });
    return response.data;
  },

  // E-Way Bill ?�세 조회
  getEWayBill: async (id: number) => {
    const response = await api.get(`/accounting/eway-bills/${id}`);
    return response.data;
  },

  // E-Way Bill ?�성
  createEWayBill: async (data: any) => {
    const response = await api.post('/accounting/eway-bills', data);
    return response.data;
  },

  // E-Way Bill ?�정
  updateEWayBill: async (id: number, data: any) => {
    const response = await api.put(`/accounting/eway-bills/${id}`, data);
    return response.data;
  },

  // E-Way Bill ?�성 (?�태�?generated�?변�?
  generateEWayBill: async (id: number) => {
    const response = await api.post(`/accounting/eway-bills/${id}/generate`);
    return response.data;
  },

  // E-Way Bill 취소
  cancelEWayBill: async (id: number, cancellationReason?: string) => {
    const response = await api.post(`/accounting/eway-bills/${id}/cancel`, {
    cancellation_reason: cancellationReason
    });
    return response.data;
  },

  // E-Way Bill ??��
  deleteEWayBill: async (id: number) => {
    const response = await api.delete(`/accounting/eway-bills/${id}`);
    return response.data;
  }
};

