import { Router } from 'express';
import {
  getNotices,
  getNotice,
  createNotice,
  updateNotice,
  deleteNotice,
  publishNotice,
  archiveNotice,
} from '../controllers/noticeController';
import { createNoticePoll, voteNoticePoll } from '../controllers/noticePollController';
import {
  listCompanyCalendarSchedules,
  createCompanyCalendarSchedule,
  updateCompanyCalendarSchedule,
  deleteCompanyCalendarSchedule,
  listPublicPersonalCalendarSchedules,
} from '../controllers/companyCalendarScheduleController';
import { authenticateToken, restrictAuditToReadOnly } from '../middleware/auth';
import { requireMenuPermissionAny } from '../middleware/menuPermission';
import { validateBody } from '../middleware/validate';

const router = Router();

/**
 * DB별로 공지 메뉴 route가 다를 수 있음.
 * - 하위: `/communication/notice`, `/communication/notices`
 * - 일부 구 DB: 상위만 `/communication` 이고 이름만「공지사항」(20260125141000 rename) → 권한 행이 이 id에만 묶임
 */
const MENU_NOTICE_ROUTES = ['/communication/notice', '/communication/notices', '/communication', '/my/notices'];

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 공지사항 관련 라우트 — 메뉴 권한과 동일하게 API에서 강제
router.get('/notices', requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_view'), getNotices);
router.get('/notices/:id', requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_view'), getNotice);
router.post(
  '/notices',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_create'),
  validateBody({
    title: { required: true, type: 'string', minLength: 1, maxLength: 255 },
    content: { required: true, type: 'string', minLength: 1 },
    category: { type: 'string', oneOf: ['general', 'urgent', 'maintenance', 'policy', 'event'] },
    priority: { type: 'string', oneOf: ['low', 'medium', 'high', 'urgent'] },
    status: { type: 'string', oneOf: ['draft', 'published', 'archived'] },
    target_audience: { type: 'string', oneOf: ['all', 'employees', 'managers', 'specific'] },
    is_public: { type: 'boolean' },
    attachments: { type: 'array' }
  }),
  createNotice
);
router.put(
  '/notices/:id',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_edit'),
  validateBody({
    title: { type: 'string', minLength: 1, maxLength: 255 },
    content: { type: 'string', minLength: 1 },
    category: { type: 'string', oneOf: ['general', 'urgent', 'maintenance', 'policy', 'event'] },
    priority: { type: 'string', oneOf: ['low', 'medium', 'high', 'urgent'] },
    status: { type: 'string', oneOf: ['draft', 'published', 'archived'] },
    target_audience: { type: 'string', oneOf: ['all', 'employees', 'managers', 'specific'] },
    is_public: { type: 'boolean' },
    attachments: { type: 'array' }
  }),
  updateNotice
);
router.delete(
  '/notices/:id',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_delete'),
  deleteNotice
);
router.post(
  '/notices/:id/publish',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_edit'),
  publishNotice
);
router.post(
  '/notices/:id/archive',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_edit'),
  archiveNotice
);
router.post(
  '/notices/:id/poll',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_create'),
  createNoticePoll
);
router.post(
  '/notices/:id/poll/vote',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_view'),
  voteNoticePoll
);

// 회사 공통 연간 스케줄 (모든 사용자 조회·CRUD)
router.get(
  '/company-calendar-schedules',
  requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_view'),
  listCompanyCalendarSchedules
);
router.post(
  '/company-calendar-schedules',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_view'),
  createCompanyCalendarSchedule
);
router.put(
  '/company-calendar-schedules/:id',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_view'),
  updateCompanyCalendarSchedule
);
router.delete(
  '/company-calendar-schedules/:id',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_view'),
  deleteCompanyCalendarSchedule
);

// 다른 사용자의 공개 개인 스케줄
router.get(
  '/public-personal-calendar-schedules',
  requireMenuPermissionAny(MENU_NOTICE_ROUTES, 'can_view'),
  listPublicPersonalCalendarSchedules
);

export default router;



