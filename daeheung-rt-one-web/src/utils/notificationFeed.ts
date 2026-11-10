/** `useTranslation().t` — i18next 버전별 TFunction export 차이 회피 */
export type I18nTranslate = (key: string, options?: Record<string, unknown>) => string;

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  details?: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  href?: string;
  inboxChip?: 'payment' | 'vacation' | 'quotation' | 'approval' | 'contract';
  source?: 'error' | 'notification' | 'server' | 'inbox';
}

export interface ActionInboxRow {
  id: string;
  kind:
    | 'expense_payment'
    | 'vacation_pending'
    | 'quotation_pending'
    | 'approval_pending'
    | 'contract_approval_pending'
    | 'contract_sign_pending';
  timestamp: string;
  href: string;
  payload: Record<string, unknown>;
}

export interface ServerNotificationItem {
  id: number | string;
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  timestamp?: string;
  read?: boolean;
  data?: Record<string, unknown>;
}

export function hrefFromServerNotificationData(data: unknown): string | undefined {
  if (data == null || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;

  // `//evil.example` 같은 프로토콜-상대 URL은 외부 이동이 되므로 거부
  if (
    typeof d.href === 'string' &&
    d.href.startsWith('/') &&
    !d.href.startsWith('//') &&
    !d.href.includes('://')
  ) {
    return d.href;
  }

  if (
    d.feature === 'work_board' ||
    d.feature === 'work_board_comment' ||
    d.feature === 'work_board_comment_reply'
  ) {
    const boardId = Number(d.board_id);
    const cardId = Number(d.card_id);
    if (Number.isInteger(boardId) && boardId > 0) {
      if (Number.isInteger(cardId) && cardId > 0) {
        return `/work/projects/${boardId}?card=${cardId}`;
      }
      return `/work/projects/${boardId}`;
    }
  }

  if (d.feature === 'approval') {
    return typeof d.href === 'string' && d.href.startsWith('/') && !d.href.startsWith('//')
      ? d.href
      : '/work/approval';
  }

  if (d.feature === 'employment_contract') {
    return typeof d.href === 'string' && d.href.startsWith('/') && !d.href.startsWith('//')
      ? d.href
      : '/hr/employment-contracts';
  }

  if (d.feature === 'project') {
    const projectId = Number(d.project_id);
    if (Number.isInteger(projectId) && projectId > 0) {
      return `/work/project-management/${projectId}`;
    }
    return typeof d.href === 'string' && d.href.startsWith('/') && !d.href.startsWith('//')
      ? d.href
      : '/work/project-management';
  }

  if (d.feature !== 'work_report') return undefined;
  const rawId = d.id;
  const reportId =
    typeof rawId === 'number' && Number.isInteger(rawId)
      ? rawId
      : parseInt(String(rawId ?? ''), 10);
  if (!Number.isInteger(reportId) || reportId <= 0) return undefined;
  const list =
    d.list === 'authored' || d.list === 'received' || d.list === 'cc' ? d.list : 'received';
  return `/work/reports?report=${reportId}&list=${list}`;
}

export const mapInboxRowToNotification = (
  row: ActionInboxRow,
  t: I18nTranslate
): AppNotification => {
  const ts = row.timestamp || new Date().toISOString();
  const p = row.payload || {};

  if (row.kind === 'expense_payment') {
    return {
      id: `inbox-${row.id}`,
      title: t('common.notificationInbox.expenseTitle'),
      message: t('common.notificationInbox.expenseBody', {
        requester: String(p.requesterName ?? ''),
        title: String(p.expenseTitle ?? ''),
        amount: String(p.amount ?? ''),
        currency: String(p.currency ?? ''),
      }),
      timestamp: ts,
      severity: 'warning',
      read: false,
      href: row.href,
      inboxChip: 'payment',
      source: 'inbox',
    };
  }

  if (row.kind === 'vacation_pending') {
    return {
      id: `inbox-${row.id}`,
      title: t('common.notificationInbox.vacationTitle'),
      message: t('common.notificationInbox.vacationBody', {
        name: String(p.applicantName ?? '—'),
        start: String(p.start ?? ''),
        end: String(p.end ?? ''),
        days: String(p.days ?? ''),
      }),
      timestamp: ts,
      severity: 'info',
      read: false,
      href: row.href,
      inboxChip: 'vacation',
      source: 'inbox',
    };
  }

  if (row.kind === 'approval_pending') {
    return {
      id: `inbox-${row.id}`,
      title: t('common.notificationInbox.approvalTitle'),
      message: t('common.notificationInbox.approvalBody', {
        requester: String(p.requesterName ?? '—'),
        title: String(p.approvalTitle ?? ''),
        documentId: String(p.documentId ?? ''),
      }),
      timestamp: ts,
      severity: 'warning',
      read: false,
      href: row.href,
      inboxChip: 'approval',
      source: 'inbox',
    };
  }

  if (row.kind === 'contract_approval_pending') {
    return {
      id: `inbox-${row.id}`,
      title: t('common.notificationInbox.contractApprovalTitle'),
      message: t('common.notificationInbox.contractApprovalBody', {
        employee: String(p.employeeName ?? '—'),
        title: String(p.contractTitle ?? ''),
      }),
      timestamp: ts,
      severity: 'warning',
      read: false,
      href: row.href,
      inboxChip: 'contract',
      source: 'inbox',
    };
  }

  if (row.kind === 'contract_sign_pending') {
    return {
      id: `inbox-${row.id}`,
      title: t('common.notificationInbox.contractSignTitle'),
      message: t('common.notificationInbox.contractSignBody', {
        title: String(p.contractTitle ?? ''),
      }),
      timestamp: ts,
      severity: 'warning',
      read: false,
      href: row.href,
      inboxChip: 'contract',
      source: 'inbox',
    };
  }

  return {
    id: `inbox-${row.id}`,
    title: t('common.notificationInbox.quotationTitle'),
    message: t('common.notificationInbox.quotationBody', {
      customer: String(p.customerName ?? '—'),
      number: String(p.quotationNumber ?? ''),
    }),
    timestamp: ts,
    severity: 'success',
    read: false,
    href: row.href,
    inboxChip: 'quotation',
    source: 'inbox',
  };
};

/** 액션 인박스에 이미 있는 건과 동일 푸시 알림을 걸러내기 위한 ID 집합 */
function collectInboxEntityIds(inboxActions: ActionInboxRow[]) {
  const vacationIds = new Set<number>();
  const expenseIds = new Set<number>();
  const quotationIds = new Set<number>();
  const approvalIds = new Set<number>();
  const contractIds = new Set<number>();

  for (const row of inboxActions) {
    const p = row.payload || {};
    if (row.kind === 'vacation_pending') {
      const id = Number(p.vacationId);
      if (Number.isFinite(id) && id > 0) vacationIds.add(id);
    } else if (row.kind === 'expense_payment') {
      const id = Number(p.expenseId);
      if (Number.isFinite(id) && id > 0) expenseIds.add(id);
    } else if (row.kind === 'quotation_pending') {
      const id = Number(p.quotationId);
      if (Number.isFinite(id) && id > 0) quotationIds.add(id);
    } else if (row.kind === 'approval_pending') {
      const id = Number(p.approvalId);
      if (Number.isFinite(id) && id > 0) approvalIds.add(id);
    } else if (row.kind === 'contract_approval_pending' || row.kind === 'contract_sign_pending') {
      const id = Number(p.contractId);
      if (Number.isFinite(id) && id > 0) contractIds.add(id);
    }
  }

  return { vacationIds, expenseIds, quotationIds, approvalIds, contractIds };
}

/** 대기 인박스에 이미 노출 중인 승인 요청이면 서버 푸시는 목록에서 제외 */
function isServerNotificationCoveredByInbox(
  item: ServerNotificationItem,
  ids: ReturnType<typeof collectInboxEntityIds>
): boolean {
  const raw = item.data;
  if (raw == null || typeof raw !== 'object') return false;
  const d = raw as Record<string, unknown>;
  const feature = String(d.feature || '');

  if (feature === 'vacation') {
    const id = Number(d.vacation_id);
    return Number.isFinite(id) && ids.vacationIds.has(id);
  }
  if (feature === 'expense_report') {
    const id = Number(d.expense_id);
    return Number.isFinite(id) && ids.expenseIds.has(id);
  }
  if (feature === 'quotation') {
    const id = Number(d.quotation_id);
    return Number.isFinite(id) && ids.quotationIds.has(id);
  }
  if (feature === 'approval') {
    const id = Number(d.approval_id ?? d.id);
    return Number.isFinite(id) && ids.approvalIds.has(id);
  }
  if (feature === 'employment_contract') {
    const id = Number(d.contract_id);
    return Number.isFinite(id) && ids.contractIds.has(id);
  }
  return false;
}

export function buildNotificationsFromSources(params: {
  serverNotifications: ServerNotificationItem[];
  clientNotifications: Array<{
    id: string;
    message: string;
    severity: 'info' | 'warning' | 'success';
    timestamp: Date;
  }>;
  errors: Array<{
    id: string;
    title: string;
    message: string;
    details?: string;
    timestamp: Date;
    type?: 'error' | 'warning' | 'info';
  }>;
  inboxActions: ActionInboxRow[];
  t: I18nTranslate;
}): AppNotification[] {
  const { serverNotifications, clientNotifications, errors, inboxActions, t } = params;
  const items: AppNotification[] = [];
  const inboxEntityIds = collectInboxEntityIds(inboxActions);

  inboxActions.forEach((row) => {
    items.push(mapInboxRowToNotification(row, t));
  });

  serverNotifications.forEach((item) => {
    if (isServerNotificationCoveredByInbox(item, inboxEntityIds)) return;
    const href = hrefFromServerNotificationData(item.data);
    items.push({
      id: `server-${item.id}`,
      title: item.title || t('common.notification'),
      message: item.message,
      timestamp: item.timestamp || new Date().toISOString(),
      severity: (item.type || 'info') as AppNotification['severity'],
      read: Boolean(item.read),
      ...(href ? { href } : {}),
      source: 'server',
    });
  });

  clientNotifications.forEach((item) => {
    items.push({
      id: `notification-${item.id}`,
      title: t('common.notification'),
      message: item.message,
      timestamp: item.timestamp.toISOString(),
      severity: item.severity,
      read: false,
      source: 'notification',
    });
  });

  errors.forEach((item) => {
    items.push({
      id: `error-${item.id}`,
      title: item.title || t('common.notification'),
      message: item.message,
      timestamp: item.timestamp.toISOString(),
      severity: (item.type || 'error') as AppNotification['severity'],
      read: false,
      source: 'error',
    });
  });

  items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return items;
}

export function getNotificationChipLabel(
  item: AppNotification,
  t: I18nTranslate
): string {
  if (item.inboxChip === 'payment') return t('common.notificationInbox.chipPayment');
  if (item.inboxChip === 'vacation') return t('common.notificationInbox.chipVacation');
  if (item.inboxChip === 'quotation') return t('common.notificationInbox.chipQuotation');
  if (item.inboxChip === 'approval') return t('common.notificationInbox.chipApproval');
  if (item.inboxChip === 'contract') return t('common.notificationInbox.chipContract');
  return item.severity.toUpperCase();
}

export function getNotificationChipColor(
  item: AppNotification
): 'warning' | 'info' | 'secondary' | 'error' | 'success' {
  if (item.inboxChip === 'payment') return 'warning';
  if (item.inboxChip === 'vacation') return 'info';
  if (item.inboxChip === 'quotation') return 'secondary';
  if (item.inboxChip === 'approval') return 'warning';
  if (item.inboxChip === 'contract') return 'warning';
  if (item.severity === 'error') return 'error';
  if (item.severity === 'warning') return 'warning';
  if (item.severity === 'success') return 'success';
  return 'info';
}
