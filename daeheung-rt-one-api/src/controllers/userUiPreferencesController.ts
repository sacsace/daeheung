import { Response } from 'express';
import { User } from '../models';
import { AuthRequest } from '../types';

/** users.settings.ui 에 저장되는 클라이언트 UI 상태 (JSON) */
export type UserUiPreferencesPayload = {
  calendarSchedules?: Record<
    string,
    Array<{
      id: string;
      title: string;
      type?: 'normal' | 'company_holiday';
      isPublic?: boolean;
    }>
  >;
  dashboardCards?: string[];
  quickActionRoutes?: string[];
  sidebarWidth?: number;
  language?: 'ko' | 'en';
  /** 회사 휴일 알림: 날짜키 -> 표시일 키 */
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
    /** 업무 보드·프로젝트 Task 댓글/답글 */
    comments?: boolean;
    /** 미읽음 알림·대기 지출·미답변 댓글 일일 리마인드 */
    unreadReminder?: boolean;
    emailDigest?: 'realtime' | 'daily' | 'weekly' | 'immediate';
  };
  notificationTemplates?: Array<{
    id: string;
    name: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }>;
};

const sanitizeSchedules = (
  input: unknown
): UserUiPreferencesPayload['calendarSchedules'] => {
  if (!input || typeof input !== 'object') return undefined;
  const out: NonNullable<UserUiPreferencesPayload['calendarSchedules']> = {};
  for (const [dateKey, value] of Object.entries(input as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const list = value
      .filter((item: any) => item && typeof item.title === 'string')
      .map((item: any) => ({
        id: String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        title: String(item.title).trim(),
        type: (item.type === 'company_holiday' ? 'company_holiday' : 'normal') as
          | 'normal'
          | 'company_holiday',
        isPublic: Boolean(item.isPublic ?? item.is_public),
      }))
      .filter((item) => item.title.length > 0);
    if (list.length > 0) out[dateKey] = list;
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

export const getUserUiPreferences = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.user!.tenant_id;
    const companyId = req.user!.company_id;

    const user = await User.findOne({
      where: { id: userId, tenant_id: tenantId, company_id: companyId },
      attributes: ['id', 'settings']
    });

    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const settings = (user.settings || {}) as Record<string, unknown>;
    const ui = (settings.ui || {}) as UserUiPreferencesPayload;
    const calendarSchedules =
      sanitizeSchedules(ui.calendarSchedules) ?? ui.calendarSchedules;

    const data: UserUiPreferencesPayload = {
      ...ui,
      calendarSchedules,
      sidebarWidth: ui.sidebarWidth
    };
    delete (data as { sidebarAutoCollapse?: boolean }).sidebarAutoCollapse;

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('getUserUiPreferences:', error);
    return res.status(500).json({
      success: false,
      message: 'UI 설정을 불러오지 못했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
};

export const patchUserUiPreferences = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tenantId = req.user!.tenant_id;
    const companyId = req.user!.company_id;

    const user = await User.findOne({
      where: { id: userId, tenant_id: tenantId, company_id: companyId },
      attributes: ['id', 'settings']
    });

    if (!user) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
    }

    const patch = (req.body || {}) as UserUiPreferencesPayload;
    // 개인 스케줄(calendarSchedules)은 본인 prefs — 모든 로그인 사용자 저장 가능

    const existing = (user.settings || {}) as Record<string, any>;
    const existingUi = { ...(existing.ui || {}) } as UserUiPreferencesPayload;

    const nextUi: UserUiPreferencesPayload = { ...existingUi };
    const keys: (keyof UserUiPreferencesPayload)[] = [
      'calendarSchedules',
      'dashboardCards',
      'quickActionRoutes',
      'sidebarWidth',
      'language',
      'companyHolidayReminderShown',
      'roomInvoiceTaxSnapshot',
      'notificationSettings',
      'notificationTemplates'
    ];

    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined) {
        if (key === 'calendarSchedules') {
          const s = sanitizeSchedules(patch.calendarSchedules);
          if (s === undefined) {
            delete nextUi.calendarSchedules;
          } else {
            nextUi.calendarSchedules = s;
          }
        } else {
          (nextUi as any)[key] = patch[key];
        }
      }
    }
    delete (nextUi as { sidebarAutoCollapse?: boolean }).sidebarAutoCollapse;

    await user.update({
      settings: {
        ...existing,
        ui: nextUi
      }
    });

    return res.json({ success: true, data: nextUi });
  } catch (error: any) {
    console.error('patchUserUiPreferences:', error);
    return res.status(500).json({
      success: false,
      message: 'UI 설정을 저장하지 못했습니다.',
      error: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
};
