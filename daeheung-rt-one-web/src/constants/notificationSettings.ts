import type { UserUiPreferencesData } from '../services/api/domains/userPreferences';

export type NotificationSettings = NonNullable<UserUiPreferencesData['notificationSettings']>;

/** 알림 수신 기본값 (메일 설정·알림 관리 공용) */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  realtime: true,
  email: true,
  browser: true,
  system: true,
  approval: true,
  vacation: true,
  expense: true,
  workReport: true,
  workBoard: true,
  comments: true,
  unreadReminder: true,
  emailDigest: 'immediate',
};

/** 메일·인앱 유형 토글 순서 */
export const NOTIFICATION_CATEGORY_KEYS = [
  'system',
  'approval',
  'vacation',
  'expense',
  'workReport',
  'workBoard',
  'comments',
  'unreadReminder',
] as const;

export type NotificationCategoryKey = (typeof NOTIFICATION_CATEGORY_KEYS)[number];

/** i18n key suffix under notificationManagement */
export const NOTIFICATION_CATEGORY_I18N: Record<NotificationCategoryKey, string> = {
  system: 'catSystem',
  approval: 'catApproval',
  vacation: 'catVacation',
  expense: 'catExpense',
  workReport: 'catWorkReport',
  workBoard: 'catWorkBoard',
  comments: 'catComments',
  unreadReminder: 'catUnreadReminder',
};
