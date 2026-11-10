import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { ensureUploadRoot } from '../utils/uploadPath';
import {
  getWorkStatistics,
  getWorkStatistic,
  createWorkStatistic,
  updateWorkStatistic,
  deleteWorkStatistic,
} from '../controllers/workStatisticController';
import {
  getApprovals,
  getApproval,
  createApproval,
  updateApproval,
  deleteApproval,
  submitApproval,
  approveApproval,
  rejectApproval,
  escalateApproval,
  addComment,
} from '../controllers/approvalController';
import {
  getApprovalTypes,
  createApprovalType,
  updateApprovalType,
  deleteApprovalType,
} from '../controllers/approvalTypeController';
import {
  getRoomBookings,
  getRoomBooking,
  createRoomBooking,
  updateRoomBooking,
  deleteRoomBooking,
  confirmRoomBooking,
  cancelRoomBooking,
} from '../controllers/roomBookingController';
import {
  getRoomTypes,
  createRoomType,
  updateRoomType,
  deleteRoomType,
} from '../controllers/roomTypeController';
import {
  getRoomTypeRooms,
  upsertRoomTypeRoom,
} from '../controllers/roomTypeRoomController';
import {
  getWorkReports,
  getWorkReport,
  createWorkReport,
  updateWorkReport,
  deleteWorkReport,
  submitWorkReport,
  reviewWorkReport,
} from '../controllers/workReportController';
import {
  getWorkBoards,
  createWorkBoard,
  getWorkBoardDetail,
  updateWorkBoard,
  deleteWorkBoard,
  moveWorkBoard,
  createWorkBoardList,
  updateWorkBoardList,
  moveWorkBoardList,
  deleteWorkBoardList,
  createWorkBoardCard,
  updateWorkBoardCard,
  moveWorkBoardCard,
  deleteWorkBoardCard,
  getWorkBoardCardComments,
  createWorkBoardCardComment,
  deleteWorkBoardCardComment,
  markWorkBoardCardCommentsRead,
  getWorkBoardMembers,
  inviteWorkBoardMember,
  removeWorkBoardMember,
  updateWorkBoardMember,
  uploadWorkBoardCardAttachments,
  deleteWorkBoardCardAttachment,
} from '../controllers/workBoardController';
import {
  getRecurringOverview,
  createRecurringTemplate,
  updateRecurringTemplate,
  deleteRecurringTemplate,
  seedRecurringSampleTemplates,
  addRecurringClients,
  removeRecurringClient,
  upsertRecurringAssignment,
  bulkUpsertRecurringAssignments,
  getRecurringChecklist,
  generateRecurringPeriod,
  generateRecurringPeriodAllBoards,
  getRecurringInstance,
  updateRecurringInstance,
  uploadRecurringInstanceAttachments,
  deleteRecurringInstanceAttachment,
} from '../controllers/recurringTaskController';
import {
  getWorkAssigneeList,
  createWorkAssignee,
  updateWorkAssignee,
  deleteWorkAssignee,
  moveWorkAssignee,
  createWorkAssigneeItem,
  updateWorkAssigneeItem,
  deleteWorkAssigneeItem,
  moveWorkAssigneeItem,
  getMyAssignedClientScope,
} from '../controllers/workAssigneeListController';
import {
  authenticateToken,
  restrictAuditToReadOnly,
  requireRootOrMinsubEmployee,
} from '../middleware/auth';
import { requireMenuPermission, requireMenuPermissionAny } from '../middleware/menuPermission';

/** DB `menus.route` 값과 동일 (프론트 App 라우트 기준) */
const MENU_WORK_PROJECTS = '/work/projects';
const MENU_WORK_ASSIGNEE_LIST = '/work/assignee-list';
const MENU_WORK_STATISTICS = '/work/statistics';
const MENU_WORK_APPROVAL = '/work/approval';
/** 객실 예약·호실·예약현황: 업무/호텔 메뉴에 동일·연관 화면이 여러 줄로 존재 → API는 후보 중 하나 권한으로 허용 */
const MENU_ROOM_RESERVATION_ROUTES = [
  '/work/room-reservation',
  '/hotel/room-reservation',
  '/hotel/reservations',
];
const MENU_WORK_REPORTS = '/work/reports';

const router = Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 작업 보드 (칸반 / 트렐로형) — 메뉴 권한과 동일하게 API에서 강제
router.get('/boards', requireMenuPermission(MENU_WORK_PROJECTS, 'can_view'), getWorkBoards);
router.post(
  '/boards',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_create'),
  createWorkBoard
);
router.get('/boards/:boardId', requireMenuPermission(MENU_WORK_PROJECTS, 'can_view'), getWorkBoardDetail);
router.put(
  '/boards/:boardId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  updateWorkBoard
);
router.delete(
  '/boards/:boardId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_delete'),
  deleteWorkBoard
);
router.post(
  '/boards/:boardId/move',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  moveWorkBoard
);

/** 정기 업무(RECURRING) — 템플릿 / 고객사 / 담당 배정 */
router.get(
  '/boards/:boardId/recurring/overview',
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_view'),
  getRecurringOverview
);
router.post(
  '/boards/:boardId/recurring/templates',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  createRecurringTemplate
);
router.put(
  '/boards/:boardId/recurring/templates/:templateId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  updateRecurringTemplate
);
router.delete(
  '/boards/:boardId/recurring/templates/:templateId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  deleteRecurringTemplate
);
router.post(
  '/boards/:boardId/recurring/templates/seed-samples',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  seedRecurringSampleTemplates
);
router.post(
  '/boards/:boardId/recurring/clients',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  addRecurringClients
);
router.delete(
  '/boards/:boardId/recurring/clients/:customerId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  removeRecurringClient
);
router.put(
  '/boards/:boardId/recurring/assignments',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  upsertRecurringAssignment
);
router.put(
  '/boards/:boardId/recurring/assignments/bulk',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  bulkUpsertRecurringAssignments
);
router.get(
  '/boards/:boardId/recurring/checklist',
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_view'),
  getRecurringChecklist
);
router.post(
  '/boards/:boardId/recurring/generate',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  generateRecurringPeriod
);
router.post(
  '/recurring/generate-all',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  generateRecurringPeriodAllBoards
);
router.get(
  '/boards/:boardId/recurring/instances/:instanceId',
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_view'),
  getRecurringInstance
);
router.put(
  '/boards/:boardId/recurring/instances/:instanceId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  updateRecurringInstance
);

router.post(
  '/boards/:boardId/lists',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_create'),
  createWorkBoardList
);
router.put(
  '/boards/:boardId/lists/:listId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  updateWorkBoardList
);
router.post(
  '/boards/:boardId/lists/:listId/move',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  moveWorkBoardList
);
router.delete(
  '/boards/:boardId/lists/:listId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_delete'),
  deleteWorkBoardList
);
router.post(
  '/boards/:boardId/lists/:listId/cards',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_create'),
  createWorkBoardCard
);
router.put(
  '/boards/:boardId/cards/:cardId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  updateWorkBoardCard
);
router.post(
  '/boards/:boardId/cards/:cardId/move',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  moveWorkBoardCard
);
router.delete(
  '/boards/:boardId/cards/:cardId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_delete'),
  deleteWorkBoardCard
);
router.get(
  '/boards/:boardId/cards/:cardId/comments',
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_view'),
  getWorkBoardCardComments
);
router.post(
  '/boards/:boardId/cards/:cardId/comments',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  createWorkBoardCardComment
);
router.delete(
  '/boards/:boardId/cards/:cardId/comments/:commentId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  deleteWorkBoardCardComment
);
router.post(
  '/boards/:boardId/cards/:cardId/comments/read',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_view'),
  markWorkBoardCardCommentsRead
);
router.get('/boards/:boardId/members', requireMenuPermission(MENU_WORK_PROJECTS, 'can_view'), getWorkBoardMembers);
router.post(
  '/boards/:boardId/members',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  inviteWorkBoardMember
);
router.put(
  '/boards/:boardId/members/:userId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  updateWorkBoardMember
);
router.delete(
  '/boards/:boardId/members/:userId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  removeWorkBoardMember
);

// 첨부 파일 업로드 설정
const uploadPath = ensureUploadRoot();
const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
const allowedExtensionSet = new Set(allowedExtensions);
const isAllowedWorkAttachment = (file: Express.Multer.File): boolean => {
  const extension = path.extname(String(file.originalname || '')).toLowerCase();
  if (!allowedExtensionSet.has(extension)) return false;
  const mime = String(file.mimetype || '').toLowerCase();
  if (!mime || mime === 'application/octet-stream') return true;
  return allowedMimeTypes.includes(mime);
};
const ensureUploadDir = () => {
  ensureUploadRoot();
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    let finalName = safeName;
    let counter = 1;
    while (fs.existsSync(path.join(uploadPath, finalName))) {
      const extIndex = safeName.lastIndexOf('.');
      const base = extIndex > -1 ? safeName.slice(0, extIndex) : safeName;
      const ext = extIndex > -1 ? safeName.slice(extIndex) : '';
      finalName = `${base}_${counter}${ext}`;
      counter += 1;
    }
    cb(null, finalName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedWorkAttachment(file)) return cb(null, true);
    const extension = path.extname(String(file.originalname || '')).toLowerCase();
    if (!allowedExtensionSet.has(extension)) {
      return cb(new Error('허용되지 않은 파일 확장자입니다.'));
    }
    return cb(new Error(`허용되지 않은 파일 형식입니다. (${file.mimetype || 'unknown'})`));
  }
});

const cardAttachmentStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    ensureUploadDir();
    const cardId = String(req.params.cardId || 'unknown');
    const dir = path.join(uploadPath, 'work-board-cards', cardId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    let original = file.originalname || 'attachment';
    try {
      original = Buffer.from(original, 'latin1').toString('utf8');
    } catch {
      // keep original
    }
    const safeName = original.replace(/[^a-zA-Z0-9.\-_]/g, '_') || 'attachment';
    let finalName = safeName;
    let counter = 1;
    const cardId = String(req.params.cardId || 'unknown');
    const dir = path.join(uploadPath, 'work-board-cards', cardId);
    while (fs.existsSync(path.join(dir, finalName))) {
      const extIndex = safeName.lastIndexOf('.');
      const base = extIndex > -1 ? safeName.slice(0, extIndex) : safeName;
      const ext = extIndex > -1 ? safeName.slice(extIndex) : '';
      finalName = `${base}_${counter}${ext}`;
      counter += 1;
    }
    cb(null, finalName);
  }
});

const cardAttachmentUpload = multer({
  storage: cardAttachmentStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedWorkAttachment(file)) return cb(null, true);
    const extension = path.extname(String(file.originalname || '')).toLowerCase();
    if (!allowedExtensionSet.has(extension)) {
      return cb(new Error('허용되지 않은 파일 확장자입니다.'));
    }
    return cb(new Error(`허용되지 않은 파일 형식입니다. (${file.mimetype || 'unknown'})`));
  }
});

router.post(
  '/boards/:boardId/cards/:cardId/attachments',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  cardAttachmentUpload.array('files', 10),
  uploadWorkBoardCardAttachments
);
router.delete(
  '/boards/:boardId/cards/:cardId/attachments/:storedName',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  deleteWorkBoardCardAttachment
);

const recurringInstanceAttachmentStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    ensureUploadDir();
    const instanceId = String(req.params.instanceId || 'unknown');
    const dir = path.join(uploadPath, 'recurring-instances', instanceId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    let original = file.originalname || 'attachment';
    try {
      original = Buffer.from(original, 'latin1').toString('utf8');
    } catch {
      // keep
    }
    const safeName = original.replace(/[^a-zA-Z0-9.\-_]/g, '_') || 'attachment';
    let finalName = safeName;
    let counter = 1;
    const instanceId = String(req.params.instanceId || 'unknown');
    const dir = path.join(uploadPath, 'recurring-instances', instanceId);
    while (fs.existsSync(path.join(dir, finalName))) {
      const extIndex = safeName.lastIndexOf('.');
      const base = extIndex > -1 ? safeName.slice(0, extIndex) : safeName;
      const ext = extIndex > -1 ? safeName.slice(extIndex) : '';
      finalName = `${base}_${counter}${ext}`;
      counter += 1;
    }
    cb(null, finalName);
  },
});

const recurringInstanceAttachmentUpload = multer({
  storage: recurringInstanceAttachmentStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedWorkAttachment(file)) return cb(null, true);
    const extension = path.extname(String(file.originalname || '')).toLowerCase();
    if (!allowedExtensionSet.has(extension)) {
      return cb(new Error('허용되지 않은 파일 확장자입니다.'));
    }
    return cb(new Error(`허용되지 않은 파일 형식입니다. (${file.mimetype || 'unknown'})`));
  },
});

router.post(
  '/boards/:boardId/recurring/instances/:instanceId/attachments',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  recurringInstanceAttachmentUpload.array('files', 10),
  uploadRecurringInstanceAttachments
);
router.delete(
  '/boards/:boardId/recurring/instances/:instanceId/attachments/:storedName',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_PROJECTS, 'can_edit'),
  deleteRecurringInstanceAttachment
);

// 업무 통계 관련 라우트
router.get('/statistics', requireMenuPermission(MENU_WORK_STATISTICS, 'can_view'), getWorkStatistics);
router.get('/statistics/:id', requireMenuPermission(MENU_WORK_STATISTICS, 'can_view'), getWorkStatistic);
router.post(
  '/statistics',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_STATISTICS, 'can_create'),
  createWorkStatistic
);
router.put(
  '/statistics/:id',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_STATISTICS, 'can_edit'),
  updateWorkStatistic
);
router.delete(
  '/statistics/:id',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_STATISTICS, 'can_delete'),
  deleteWorkStatistic
);

// 전자 결제 관련 라우트
router.get('/approvals/types', requireMenuPermission(MENU_WORK_APPROVAL, 'can_view'), getApprovalTypes);
router.post(
  '/approvals/types',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_APPROVAL, 'can_create'),
  createApprovalType
);
router.put(
  '/approvals/types/:id',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_APPROVAL, 'can_edit'),
  updateApprovalType
);
router.delete(
  '/approvals/types/:id',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_APPROVAL, 'can_delete'),
  deleteApprovalType
);
router.get('/approvals', requireMenuPermission(MENU_WORK_APPROVAL, 'can_view'), getApprovals);
router.get('/approvals/:id', requireMenuPermission(MENU_WORK_APPROVAL, 'can_view'), getApproval);
router.post(
  '/approvals/upload',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_APPROVAL, 'can_edit'),
  upload.array('files'),
  (req, res) => {
    const files = (req.files || []) as Express.Multer.File[];
    const result = files.map((file) => ({
      originalName: file.originalname,
      storedName: file.filename
    }));
    res.json({ success: true, data: { files: result } });
  }
);
router.post(
  '/approvals',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_APPROVAL, 'can_create'),
  createApproval
);
router.put(
  '/approvals/:id',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_APPROVAL, 'can_edit'),
  updateApproval
);
router.delete(
  '/approvals/:id',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_APPROVAL, 'can_delete'),
  deleteApproval
);
router.post(
  '/approvals/:id/submit',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_APPROVAL, 'can_edit'),
  submitApproval
);
router.post(
  '/approvals/:id/approve',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_APPROVAL, 'can_edit'),
  approveApproval
);
router.post(
  '/approvals/:id/reject',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_APPROVAL, 'can_edit'),
  rejectApproval
);
router.post(
  '/approvals/:id/escalate',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_APPROVAL, 'can_edit'),
  escalateApproval
);
router.post(
  '/approvals/:id/comments',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_APPROVAL, 'can_edit'),
  addComment
);

// 회의실 예약 관련 라우트
router.get('/room-bookings', requireMenuPermissionAny(MENU_ROOM_RESERVATION_ROUTES, 'can_view'), getRoomBookings);
router.get('/room-bookings/:id', requireMenuPermissionAny(MENU_ROOM_RESERVATION_ROUTES, 'can_view'), getRoomBooking);
router.post(
  '/room-bookings',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_ROOM_RESERVATION_ROUTES, 'can_create'),
  createRoomBooking
);
router.put(
  '/room-bookings/:id',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_ROOM_RESERVATION_ROUTES, 'can_edit'),
  updateRoomBooking
);
router.delete(
  '/room-bookings/:id',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_ROOM_RESERVATION_ROUTES, 'can_delete'),
  deleteRoomBooking
);
router.post(
  '/room-bookings/:id/confirm',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_ROOM_RESERVATION_ROUTES, 'can_edit'),
  confirmRoomBooking
);
router.post(
  '/room-bookings/:id/cancel',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_ROOM_RESERVATION_ROUTES, 'can_edit'),
  cancelRoomBooking
);

// 객실 유형 관련 라우트
router.get('/room-types', requireMenuPermissionAny(MENU_ROOM_RESERVATION_ROUTES, 'can_view'), getRoomTypes);
router.post(
  '/room-types',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_ROOM_RESERVATION_ROUTES, 'can_create'),
  createRoomType
);
router.put(
  '/room-types/:id',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_ROOM_RESERVATION_ROUTES, 'can_edit'),
  updateRoomType
);
router.delete(
  '/room-types/:id',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_ROOM_RESERVATION_ROUTES, 'can_delete'),
  deleteRoomType
);

// 객실 호실명 관련 라우트
router.get('/room-type-rooms', requireMenuPermissionAny(MENU_ROOM_RESERVATION_ROUTES, 'can_view'), getRoomTypeRooms);
router.put(
  '/room-type-rooms',
  restrictAuditToReadOnly,
  requireMenuPermissionAny(MENU_ROOM_RESERVATION_ROUTES, 'can_edit'),
  upsertRoomTypeRoom
);

// 업무 담당 리스트 (Minsub Ventures 전용 — 엑셀형 담당자 컬럼 + 담당 회사)
router.get('/assignee-list/my-scope', getMyAssignedClientScope);
router.get(
  '/assignee-list',
  requireRootOrMinsubEmployee,
  requireMenuPermission(MENU_WORK_ASSIGNEE_LIST, 'can_view'),
  getWorkAssigneeList
);
router.post(
  '/assignee-list/assignees',
  requireRootOrMinsubEmployee,
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_ASSIGNEE_LIST, 'can_create'),
  createWorkAssignee
);
router.put(
  '/assignee-list/assignees/:id',
  requireRootOrMinsubEmployee,
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_ASSIGNEE_LIST, 'can_edit'),
  updateWorkAssignee
);
router.delete(
  '/assignee-list/assignees/:id',
  requireRootOrMinsubEmployee,
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_ASSIGNEE_LIST, 'can_delete'),
  deleteWorkAssignee
);
router.post(
  '/assignee-list/assignees/:id/move',
  requireRootOrMinsubEmployee,
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_ASSIGNEE_LIST, 'can_edit'),
  moveWorkAssignee
);
router.post(
  '/assignee-list/assignees/:assigneeId/items',
  requireRootOrMinsubEmployee,
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_ASSIGNEE_LIST, 'can_create'),
  createWorkAssigneeItem
);
router.put(
  '/assignee-list/items/:id',
  requireRootOrMinsubEmployee,
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_ASSIGNEE_LIST, 'can_edit'),
  updateWorkAssigneeItem
);
router.delete(
  '/assignee-list/items/:id',
  requireRootOrMinsubEmployee,
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_ASSIGNEE_LIST, 'can_delete'),
  deleteWorkAssigneeItem
);
router.post(
  '/assignee-list/items/:id/move',
  requireRootOrMinsubEmployee,
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_ASSIGNEE_LIST, 'can_edit'),
  moveWorkAssigneeItem
);

// 업무 보고서 관련 라우트
router.get('/reports', requireMenuPermission(MENU_WORK_REPORTS, 'can_view'), getWorkReports);
router.get('/reports/:id', requireMenuPermission(MENU_WORK_REPORTS, 'can_view'), getWorkReport);
router.post(
  '/reports',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_REPORTS, 'can_create'),
  createWorkReport
);
router.put(
  '/reports/:id',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_REPORTS, 'can_edit'),
  updateWorkReport
);
router.delete(
  '/reports/:id',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_REPORTS, 'can_delete'),
  deleteWorkReport
);
router.post(
  '/reports/:id/submit',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_REPORTS, 'can_edit'),
  submitWorkReport
);
router.post(
  '/reports/:id/review',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_WORK_REPORTS, 'can_edit'),
  reviewWorkReport
);

export default router;


