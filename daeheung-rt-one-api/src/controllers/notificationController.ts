import { Request, Response } from 'express';
import SocketService from '../services/socketService';
import { ExpenseReport, Vacation, Quotation, User, Customer, Approval, EmploymentContract } from '../models';
import { Op } from 'sequelize';
import { isMissingTableError } from '../utils/dbErrors';
import { sendUserNotificationEmail } from '../utils/userNotificationMail';

type NotificationTarget = 'user' | 'tenant' | 'all';

interface NotificationRecord {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  data?: any;
  timestamp: string;
  read: boolean;
  target_type: NotificationTarget;
  target_id?: number;
  tenant_id?: number;
}

const notificationsStore: NotificationRecord[] = [];

/** user 타입 불일치(문자/숫자)로 멘션 알림 등이 목록에서 빠지지 않도록 비교 */
function isNotificationForUser(notification: NotificationRecord, userId: number | undefined): boolean {
  if (notification.target_type !== 'user' || userId == null) return false;
  return Number(notification.target_id) === Number(userId);
}

/** 일일 리마인드용 — 사용자별 미읽음 인앱 알림 */
export function listUnreadNotificationsForUser(userId: number, limit = 30): NotificationRecord[] {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return [];
  return notificationsStore
    .filter((n) => !n.read && isNotificationForUser(n, uid))
    .slice(0, Math.max(1, limit));
}

/** 미읽음 알림이 있는 user id 집합 */
export function listUserIdsWithUnreadNotifications(): number[] {
  const ids = new Set<number>();
  for (const n of notificationsStore) {
    if (n.read || n.target_type !== 'user' || n.target_id == null) continue;
    const uid = Number(n.target_id);
    if (Number.isFinite(uid) && uid > 0) ids.add(uid);
  }
  return [...ids];
}

const parseExpenseItemsMeta = (itemsValue: any) => {
  if (!itemsValue) return {};
  if (typeof itemsValue === 'string') {
    try {
      const parsed = JSON.parse(itemsValue);
      return parsed?.meta || {};
    } catch {
      return {};
    }
  }
  if (typeof itemsValue === 'object' && itemsValue !== null) {
    return (itemsValue as any).meta || {};
  }
  return {};
};

const canApproveExpensePayment = (expense: any, user: any) => {
  if (!user) return false;
  // 본인이 요청한 결제는 '받은 알림' 대상 아님
  if (expense.requester_id != null && Number(expense.requester_id) === Number(user.id)) {
    return false;
  }
  const meta = parseExpenseItemsMeta(expense.items);
  const approvedById = meta.approvedById ? Number(meta.approvedById) : null;
  if (approvedById !== null && approvedById === Number(user.id)) return true;
  // 결제 담당자만 (admin/root 전원에게 알림 브로드캐스트하지 않음)
  if (user.is_payment_officer === true) return true;
  return false;
};

/** 결제·휴가·견적 등 승인 대기 건 — 로그인 사용자에게 지정된 건만 */
export const getActionInbox = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    const tenantId = user?.tenant_id;
    const companyId = user?.company_id;

    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }

    const items: Array<{
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
    }> = [];

    const baseCompany = (where: any) => {
      if (tenantId) where.tenant_id = tenantId;
      if (companyId) where.company_id = companyId;
    };

    // 1) 지출결의서 결제 승인 대기 — 문서가 승인된 뒤 결제 요청된 건만
    //    (문서 in_review 등인데 payment_request_status만 requested로 남은 불일치 건은 알림에서 제외)
    try {
      const expenseWhere: any = {
        is_active: true,
        payment_request_status: 'requested',
        status: { [Op.in]: ['approved', 'paid'] },
      };
      baseCompany(expenseWhere);

      const expenses = await (ExpenseReport as any).findAll({
        where: expenseWhere,
        order: [['payment_requested_at', 'DESC']],
        limit: 40
      });

      for (const exp of expenses) {
        const row = exp.toJSON ? exp.toJSON() : exp;
        if (!canApproveExpensePayment(row, user)) continue;
        const reqAt = row.payment_requested_at || row.updated_at || row.created_at;
        items.push({
          id: `expense_payment-${row.id}`,
          kind: 'expense_payment',
          timestamp: reqAt ? new Date(reqAt).toISOString() : new Date().toISOString(),
          href: '/accounting/expense',
          payload: {
            expenseId: row.id,
            requesterName: row.requester_name || '',
            expenseTitle: row.title || row.expense_id || '',
            amount: row.total_amount != null ? String(row.total_amount) : '',
            currency: row.currency || 'INR'
          }
        });
      }
    } catch (expenseError) {
      if (!isMissingTableError(expenseError)) throw expenseError;
      console.warn('알림 인박스: expense_reports 조회 건너뜀 —', (expenseError as Error).message);
    }

    // 2) 휴가 승인 대기 — 지정 결재자(본인)에게 온 건만
    try {
      const vacWhere: any = {
        is_active: true,
        status: 'pending',
        user_id: { [Op.ne]: userId },
        approved_by: userId,
      };
      baseCompany(vacWhere);

      const vacations = await (Vacation as any).findAll({
        where: vacWhere,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username'],
            required: false
          }
        ],
        order: [['applied_date', 'DESC']],
        limit: 40
      });

      for (const v of vacations) {
        const row = v.toJSON ? v.toJSON() : v;
        const start = row.start_date ? String(row.start_date).slice(0, 10) : '';
        const end = row.end_date ? String(row.end_date).slice(0, 10) : '';
        items.push({
          id: `vacation_pending-${row.id}`,
          kind: 'vacation_pending',
          timestamp: row.applied_date
            ? new Date(row.applied_date).toISOString()
            : new Date().toISOString(),
          href: '/hr/leave',
          payload: {
            vacationId: row.id,
            applicantName: (row as any).user?.username || '',
            start,
            end,
            days: row.days != null ? Number(row.days) : 0,
            vacationType: row.vacation_type || ''
          }
        });
      }
    } catch (vacationError) {
      if (!isMissingTableError(vacationError)) throw vacationError;
      console.warn('알림 인박스: vacations 조회 건너뜀 —', (vacationError as Error).message);
    }

    // 3) 견적서 승인 대기 — 지정 승인자(본인)에게 온 건만
    try {
      const qWhere: any = {
        is_active: true,
        status: 'pending_approval',
        created_by: { [Op.ne]: userId },
        approver_user_id: userId,
      };
      baseCompany(qWhere);

      const quotations = await (Quotation as any).findAll({
        where: qWhere,
        include: [
          {
            model: Customer,
            as: 'customer',
            attributes: ['id', 'name'],
            required: false
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 40
      });

      for (const q of quotations) {
        const row = q.toJSON ? q.toJSON() : q;
        items.push({
          id: `quotation_pending-${row.id}`,
          kind: 'quotation_pending',
          timestamp: row.created_at
            ? new Date(row.created_at).toISOString()
            : new Date().toISOString(),
          href: '/work/quotation',
          payload: {
            quotationId: row.id,
            quotationNumber: row.quotation_number || row.id,
            customerName: (row as any).customer?.name || ''
          }
        });
      }
    } catch (quotationError) {
      if (!isMissingTableError(quotationError)) throw quotationError;
      console.warn('알림 인박스: quotations 조회 건너뜀 —', (quotationError as Error).message);
    }

    // 4) 전자결재 승인 대기 — 현재 승인자(본인)에게 온 건만
    try {
      const approvalWhere: any = {
        is_active: true,
        status: { [Op.in]: ['submitted', 'in_review'] },
        current_approver_id: userId,
        requester_id: { [Op.ne]: userId },
      };
      baseCompany(approvalWhere);

      const approvals = await (Approval as any).findAll({
        where: approvalWhere,
        include: [
          {
            model: User,
            as: 'requester',
            attributes: ['id', 'username', 'email'],
            required: false,
          },
        ],
        order: [['updated_at', 'DESC']],
        limit: 40,
      });

      for (const a of approvals) {
        const row = a.toJSON ? a.toJSON() : a;
        items.push({
          id: `approval_pending-${row.id}`,
          kind: 'approval_pending',
          timestamp: row.updated_at
            ? new Date(row.updated_at).toISOString()
            : row.created_at
              ? new Date(row.created_at).toISOString()
              : new Date().toISOString(),
          href: '/work/approval',
          payload: {
            approvalId: row.id,
            documentId: row.document_id || '',
            approvalTitle: row.title || '',
            requesterName: (row as any).requester?.username || '',
            type: row.type || '',
          },
        });
      }
    } catch (approvalError) {
      if (!isMissingTableError(approvalError)) throw approvalError;
      console.warn('알림 인박스: approvals 조회 건너뜀 —', (approvalError as Error).message);
    }

    // 5) 전자근로계약 — 지정 승인자(본인) 승인 대기만
    try {
      const contractApprovalWhere: any = {
        is_active: true,
        status: { [Op.in]: ['pending_approval', 'in_review'] },
        approver_id: userId,
      };
      baseCompany(contractApprovalWhere);

      const pendingContracts = await (EmploymentContract as any).findAll({
        where: contractApprovalWhere,
        include: [
          {
            model: User,
            as: 'employee',
            attributes: ['id', 'username'],
            required: false,
          },
        ],
        order: [['updated_at', 'DESC']],
        limit: 40,
      });

      for (const c of pendingContracts) {
        const row = c.toJSON ? c.toJSON() : c;
        items.push({
          id: `contract_approval_pending-${row.id}`,
          kind: 'contract_approval_pending',
          timestamp: row.updated_at
            ? new Date(row.updated_at).toISOString()
            : row.created_at
              ? new Date(row.created_at).toISOString()
              : new Date().toISOString(),
          href: '/hr/employment-contracts',
          payload: {
            contractId: row.id,
            contractTitle: row.title || '',
            employeeName: (row as any).employee?.username || '',
          },
        });
      }
    } catch (contractApprovalError) {
      if (!isMissingTableError(contractApprovalError)) throw contractApprovalError;
      console.warn('알림 인박스: employment_contracts(승인) 조회 건너뜀 —', (contractApprovalError as Error).message);
    }

    // 6) 전자근로계약 — 본인(근로자) 서명 대기만
    try {
      const contractSignWhere: any = {
        is_active: true,
        status: 'awaiting_employee_sign',
        employee_id: userId,
      };
      baseCompany(contractSignWhere);

      const signContracts = await (EmploymentContract as any).findAll({
        where: contractSignWhere,
        order: [['updated_at', 'DESC']],
        limit: 40,
      });

      for (const c of signContracts) {
        const row = c.toJSON ? c.toJSON() : c;
        items.push({
          id: `contract_sign_pending-${row.id}`,
          kind: 'contract_sign_pending',
          timestamp: row.approved_at
            ? new Date(row.approved_at).toISOString()
            : row.updated_at
              ? new Date(row.updated_at).toISOString()
              : new Date().toISOString(),
          href: '/my/contracts',
          payload: {
            contractId: row.id,
            contractTitle: row.title || '',
          },
        });
      }
    } catch (contractSignError) {
      if (!isMissingTableError(contractSignError)) throw contractSignError;
      console.warn('알림 인박스: employment_contracts(서명) 조회 건너뜀 —', (contractSignError as Error).message);
    }

    items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('알림 인박스 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '알림 인박스를 불러오지 못했습니다.'
    });
  }
};

interface NotificationRequest extends Request {
  body: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    target_type: NotificationTarget;
    target_id?: number;
    data?: any;
  };
}

interface NotificationPayload {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  target_type: NotificationTarget;
  target_id?: number;
  data?: any;
  tenant_id?: number;
  company_id?: number;
  sender_user_id?: number;
  /** true면 인앱·소켓만 전송(업무 보고서 등 별도 메일 템플릿 사용 시) */
  skip_email?: boolean;
}

export const pushNotification = (
  payload: NotificationPayload,
  socketService?: SocketService
) => {
  const {
    title,
    message,
    type,
    target_type,
    target_id,
    data,
    tenant_id,
    company_id,
    sender_user_id,
    skip_email
  } = payload;

  const notification: NotificationRecord = {
    id: Date.now(),
    title,
    message,
    type,
    data,
    timestamp: new Date().toISOString(),
    read: false,
    target_type,
    target_id: target_id !== undefined && target_id !== null ? Number(target_id) : undefined,
    tenant_id: target_type === 'tenant' ? tenant_id : undefined
  };

  notificationsStore.unshift(notification);

  if (socketService) {
    switch (target_type) {
      case 'user':
        if (target_id) {
          socketService.sendNotificationToUser(target_id, notification);
        }
        break;
      case 'tenant':
        if (tenant_id) {
          socketService.sendNotificationToTenant(tenant_id, notification);
        }
        break;
      case 'all':
        socketService.sendSystemNotification(notification);
        break;
    }
  }

  if (target_type === 'user' && target_id && !skip_email) {
    void sendUserNotificationEmail({
      targetUserId: Number(target_id),
      title,
      message,
      data: data && typeof data === 'object' ? data : undefined,
      tenantId: tenant_id,
      companyId: company_id,
      senderUserId: sender_user_id != null ? Number(sender_user_id) : undefined,
    }).catch((err) => {
      console.error('[pushNotification] email:', err?.message || err);
    });
  }

  return notification;
};

export const sendNotification = async (req: NotificationRequest, res: Response) => {
  try {
    const { title, message, type, target_type, target_id, data } = req.body;

    if (!title || !message || !type || !target_type) {
      return res.status(400).json({
        success: false,
        message: '필수 필드를 입력해주세요.'
      });
    }

    const tenantId = (req as any).user?.tenant_id;
    const socketService = (req as any).socketService as SocketService;
    const notification = pushNotification(
      {
        title,
        message,
        type,
        target_type,
        target_id,
        data,
        tenant_id: tenantId
      },
      socketService
    );

    res.json({
      success: true,
      data: notification,
      message: '알림이 전송되었습니다.'
    });
  } catch (error) {
    console.error('알림 전송 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20; // 기본 20개만 반환
    const offset = (page - 1) * limit;
    const userId = (req as any).user?.id;
    const tenantId = (req as any).user?.tenant_id;

    const filteredNotifications = notificationsStore.filter((notification) => {
      if (notification.target_type === 'all') {
        return true;
      }
      if (notification.target_type === 'tenant') {
        return notification.tenant_id === tenantId;
      }
      return isNotificationForUser(notification, userId);
    });

    const notifications = filteredNotifications.slice(offset, offset + limit);
    const totalCount = filteredNotifications.length;

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('알림 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

export const updateNotification = async (req: Request, res: Response) => {
  try {
    const notificationId = Number(req.params.id);
    const { read, title, message, type, data } = req.body || {};
    const userId = (req as any).user?.id;
    const tenantId = (req as any).user?.tenant_id;

    const notification = notificationsStore.find((item) => item.id === notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: '알림을 찾을 수 없습니다.'
      });
    }

    const isAccessible =
      notification.target_type === 'all' ||
      (notification.target_type === 'tenant' && notification.tenant_id === tenantId) ||
      isNotificationForUser(notification, userId);

    if (!isAccessible) {
      return res.status(403).json({
        success: false,
        message: '알림에 대한 권한이 없습니다.'
      });
    }

    if (typeof read === 'boolean') {
      notification.read = read;
    }
    if (title) {
      notification.title = title;
    }
    if (message) {
      notification.message = message;
    }
    if (type) {
      notification.type = type;
    }
    if (data !== undefined) {
      notification.data = data;
    }

    res.json({
      success: true,
      data: notification,
      message: '알림이 업데이트되었습니다.'
    });
  } catch (error) {
    console.error('알림 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const notificationId = Number(req.params.id);
    const userId = (req as any).user?.id;
    const tenantId = (req as any).user?.tenant_id;

    const notificationIndex = notificationsStore.findIndex((item) => item.id === notificationId);

    if (notificationIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '알림을 찾을 수 없습니다.'
      });
    }

    const notification = notificationsStore[notificationIndex];
    const isAccessible =
      notification.target_type === 'all' ||
      (notification.target_type === 'tenant' && notification.tenant_id === tenantId) ||
      isNotificationForUser(notification, userId);

    if (!isAccessible) {
      return res.status(403).json({
        success: false,
        message: '알림에 대한 권한이 없습니다.'
      });
    }

    notificationsStore.splice(notificationIndex, 1);

    res.json({
      success: true,
      message: '알림이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('알림 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
};
