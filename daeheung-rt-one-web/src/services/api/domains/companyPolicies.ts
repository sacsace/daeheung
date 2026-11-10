import { api } from '../client';

export type CompanyPolicyKey =
  | 'employment'
  | 'attendance'
  | 'leave'
  | 'salary_payroll'
  | 'confidentiality_data'
  | 'posh'
  | 'separation'
  | string;

/** 기본 시스템 탭 라벨용 (실제 탭 목록은 API 응답 기준) */
export const COMPANY_POLICY_SYSTEM_KEYS = [
  'employment',
  'attendance',
  'leave',
  'salary_payroll',
  'confidentiality_data',
  'posh',
  'separation',
] as const;

/** @deprecated Use API list; kept for callers that still import the name */
export const COMPANY_POLICY_TAB_ORDER = [...COMPANY_POLICY_SYSTEM_KEYS];

export interface CompanyPolicyItem {
  id: number;
  policy_key: CompanyPolicyKey | string;
  title_ko: string;
  title_en: string;
  content_ko: string;
  content_en: string;
  version: number;
  updated_by?: number | null;
  updated_by_name?: string | null;
  updated_at?: string;
  created_at?: string;
  is_system?: boolean;
  can_edit?: boolean;
}

export interface CompanyPolicyRevisionSummary {
  id: number;
  policy_key: string;
  version: number;
  title_ko: string;
  title_en: string;
  change_summary?: string | null;
  changed_by?: number | null;
  changed_by_name?: string | null;
  created_at?: string;
}

export interface CompanyPolicyRevisionDetail extends CompanyPolicyRevisionSummary {
  content_ko: string;
  content_en: string;
}

export const companyPolicyService = {
  list: async () => {
    const res = await api.get('/company-policies');
    return res.data;
  },
  get: async (key: string) => {
    const res = await api.get(`/company-policies/${encodeURIComponent(key)}`);
    return res.data;
  },
  create: async (payload: {
    title_ko: string;
    title_en: string;
    content_ko?: string;
    content_en?: string;
    policy_key?: string;
  }) => {
    const res = await api.post('/company-policies', payload);
    return res.data;
  },
  update: async (
    key: string,
    payload: {
      title_ko: string;
      title_en: string;
      content_ko: string;
      content_en: string;
      change_summary?: string;
    }
  ) => {
    const res = await api.put(`/company-policies/${encodeURIComponent(key)}`, payload);
    return res.data;
  },
  remove: async (key: string) => {
    const res = await api.delete(`/company-policies/${encodeURIComponent(key)}`);
    return res.data;
  },
  history: async (key: string) => {
    const res = await api.get(`/company-policies/${encodeURIComponent(key)}/history`);
    return res.data;
  },
  revision: async (key: string, version: number) => {
    const res = await api.get(
      `/company-policies/${encodeURIComponent(key)}/history/${version}`
    );
    return res.data;
  },
};
