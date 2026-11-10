import { api } from '../client';

export type UserUiCalendarScheduleItem = {
  id: string;
  title: string;
  type?: 'normal' | 'company_holiday';
  isPublic?: boolean;
};

export type UserUiPreferencesData = {
  calendarSchedules?: Record<string, UserUiCalendarScheduleItem[]>;
  dashboardCards?: string[];
  quickActionRoutes?: string[];
  sidebarWidth?: number;
  language?: 'ko' | 'en';
  companyHolidayReminderShown?: Record<string, string>;
  roomInvoiceTaxSnapshot?: Record<string, unknown>;
  notificationSettings?: {
    realtime?: boolean;
    email?: boolean;
    browser?: boolean;
    system?: boolean;
    approval?: boolean;
    vacation?: boolean;
    expense?: boolean;
    workReport?: boolean;
    workBoard?: boolean;
    /** 댓글·답글 (업무 보드 / 프로젝트 Task) */
    comments?: boolean;
    /** 읽지 않은 알림·대기 지출·미답변 댓글 일일 리마인드 */
    unreadReminder?: boolean;
    emailDigest?: 'immediate' | 'daily' | 'weekly';
  };
  notificationTemplates?: Array<{
    id: string;
    name: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }>;
};

export const userUiPreferencesService = {
  get: async (): Promise<UserUiPreferencesData> => {
    const response = await api.get('/users/me/ui-preferences');
    return response.data?.data || {};
  },
  patch: async (patch: Partial<UserUiPreferencesData>): Promise<UserUiPreferencesData> => {
    const response = await api.patch('/users/me/ui-preferences', patch);
    return response.data?.data || {};
  },
};
