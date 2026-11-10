import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  moveProject,
  getProjectMembers,
  addProjectMembers,
  updateProjectMember,
  removeProjectMember,
} from '../controllers/projectController';
import {
  getProjectOverview,
  listProjectSchedules,
  createProjectSchedule,
  updateProjectSchedule,
  deleteProjectSchedule,
  listProjectTasks,
  getProjectTask,
  createProjectTask,
  updateProjectTask,
  moveProjectTask,
  deleteProjectTask,
  listProjectActivities,
  listProjectTaskComments,
  createProjectTaskComment,
  deleteProjectTaskComment,
  uploadProjectTaskAttachments,
  deleteProjectTaskAttachment,
} from '../controllers/projectWorkspaceController';
import { authenticateToken, restrictAuditToReadOnly } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { requireMenuPermission } from '../middleware/menuPermission';
import { ensureUploadRoot } from '../utils/uploadPath';

const router = Router();
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const MENU_PROJECT_MANAGEMENT = '/work/project-management';
const uploadRoot = ensureUploadRoot();

const taskAttachmentStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const taskId = String(req.params.taskId || 'unknown');
    const dir = path.join(uploadRoot, 'project-tasks', taskId);
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
    const taskId = String(req.params.taskId || 'unknown');
    const dir = path.join(uploadRoot, 'project-tasks', taskId);
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

const taskAttachmentUpload = multer({
  storage: taskAttachmentStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.use(authenticateToken);

router.get('/', requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_view'), getProjects);
router.post(
  '/',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_create'),
  validateBody({
    name: { required: true, type: 'string', minLength: 1, maxLength: 200 },
    start_date: { required: true, type: 'string', pattern: datePattern },
    end_date: { type: 'string', pattern: datePattern },
    project_manager: { required: true, type: 'number' },
    status: { type: 'string', maxLength: 20 },
    priority: { type: 'string', maxLength: 20 },
    description: { type: 'string', maxLength: 5000 },
    budget: { type: 'number' },
  }),
  createProject
);

router.get('/:id/members', requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_view'), getProjectMembers);
router.post(
  '/:id/members',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  addProjectMembers
);
router.put(
  '/:id/members/:memberId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  updateProjectMember
);
router.delete(
  '/:id/members/:memberId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  removeProjectMember
);

router.get('/:id/overview', requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_view'), getProjectOverview);
router.get('/:id/schedules', requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_view'), listProjectSchedules);
router.post(
  '/:id/schedules',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  createProjectSchedule
);
router.put(
  '/:id/schedules/:scheduleId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  updateProjectSchedule
);
router.delete(
  '/:id/schedules/:scheduleId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  deleteProjectSchedule
);

router.get('/:id/tasks', requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_view'), listProjectTasks);
router.post(
  '/:id/tasks',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  createProjectTask
);
router.get('/:id/tasks/:taskId', requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_view'), getProjectTask);
router.put(
  '/:id/tasks/:taskId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  updateProjectTask
);
router.post(
  '/:id/tasks/:taskId/move',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  moveProjectTask
);
router.delete(
  '/:id/tasks/:taskId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  deleteProjectTask
);

router.get(
  '/:id/tasks/:taskId/comments',
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_view'),
  listProjectTaskComments
);
router.post(
  '/:id/tasks/:taskId/comments',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  createProjectTaskComment
);
router.delete(
  '/:id/tasks/:taskId/comments/:commentId',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  deleteProjectTaskComment
);

router.post(
  '/:id/tasks/:taskId/attachments',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  taskAttachmentUpload.array('files', 10),
  uploadProjectTaskAttachments
);
router.delete(
  '/:id/tasks/:taskId/attachments/:storedName',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  deleteProjectTaskAttachment
);

router.get('/:id/activities', requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_view'), listProjectActivities);

router.post(
  '/:id/move',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  moveProject
);

router.get('/:id', requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_view'), getProject);
router.put(
  '/:id',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_edit'),
  validateBody({
    name: { type: 'string', minLength: 1, maxLength: 200 },
    start_date: { type: 'string', pattern: datePattern },
    end_date: { type: 'string', pattern: datePattern },
    project_manager: { type: 'number' },
    status: { type: 'string', maxLength: 20 },
    priority: { type: 'string', maxLength: 20 },
    description: { type: 'string', maxLength: 5000 },
    budget: { type: 'number' },
  }),
  updateProject
);
router.delete(
  '/:id',
  restrictAuditToReadOnly,
  requireMenuPermission(MENU_PROJECT_MANAGEMENT, 'can_delete'),
  deleteProject
);

export default router;
