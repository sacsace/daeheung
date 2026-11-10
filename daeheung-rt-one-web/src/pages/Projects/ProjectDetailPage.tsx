import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  AttachFile as AttachFileIcon,
  Block as BlockIcon,
  CancelOutlined as CancelOutlinedIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  CircleOutlined as CircleOutlinedIcon,
  DeleteOutline as DeleteIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  PersonAddOutlined as PersonAddIcon,
  Refresh as RefreshIcon,
  Reply as ReplyIcon,
  Timelapse as TimelapseIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import { projectService } from '../../services/api';
import { useReferenceDataStore, filterActiveCompanyUsers } from '../../store/referenceDataStore';
import { useStore } from '../../store';
import { showErrorPopup, showSuccessPopup } from '../../utils/errorHandler';
import { getUploadUrl } from '../../utils/uploadUrl';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';
import {
  getMvsDialogActionsSx,
  getMvsDialogPaperSx,
  getMvsDialogTitleRowSx,
} from '../../components/Common/daeheungDialogShell';
import {
  mvsBodyCardSx,
  mvsBodyListTableSx,
  mvsBodyListZoneSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodySectionHeaderSx,
  mvsPageRootFullBleedSx,
  mvsSearchFieldSx,
} from '../../theme/daeheungLayout';

const MENU_ROUTE = '/work/project-management';
const LABEL_W = 220;
const MIN_DAY_W = 32;
const ROW_H = 80;
const HEADER_H = 52;
const GRID = '#B4B4B4';
const HEAD_BG = '#C6EFCE';
const HEAD_BG_DEEP = '#A9D08E';
const HEAD_FG = '#0F172A';
const TASK_HEAD_BG = HEAD_BG_DEEP;
const TASK_HEAD_FG = '#0F172A';
const TASK_HEAD_ACCENT = '#548235';
const WEEKEND_BG = '#E2EFDA';
const ROW_HOVER = '#F8FAFC';

const TASK_COLOR_PALETTE = [
  '#5B9BD5',
  '#70AD47',
  '#ED7D31',
  '#00B0F0',
  '#FFC000',
  '#C55A11',
  '#548235',
  '#2F5496',
  '#00B050',
  '#C00000',
  '#7F7F7F',
  '#385723',
  '#833C0C',
  '#1F4E79',
  '#9C5700',
] as const;

const DEFAULT_BAR = { bg: '#5B9BD5', border: '#2F6FAD' };

const TASK_STATUS_HIGHLIGHT: Record<string, { bg: string; fg: string; border: string }> = {
  todo: { bg: '#F2F2F2', fg: '#595959', border: '#B4B4B4' },
  in_progress: { bg: '#DDEBF7', fg: '#2F5496', border: '#5B9BD5' },
  blocked: { bg: '#FCE4D6', fg: '#C65911', border: '#ED7D31' },
  completed: { bg: '#C6EFCE', fg: '#006100', border: '#70AD47' },
  cancelled: { bg: '#E7E6E6', fg: '#7F7F7F', border: '#A6A6A6' },
};

function taskStatusHighlight(status: string) {
  return TASK_STATUS_HIGHLIGHT[status] || TASK_STATUS_HIGHLIGHT.todo;
}

function TaskStatusIcon({
  status,
  fontSize = 16,
  sx,
}: {
  status: string;
  fontSize?: number;
  sx?: object;
}) {
  const hl = taskStatusHighlight(status);
  const iconSx = { fontSize, color: hl.fg, flexShrink: 0, ...sx };
  switch (status) {
    case 'in_progress':
      return <TimelapseIcon sx={iconSx} />;
    case 'blocked':
      return <BlockIcon sx={iconSx} />;
    case 'completed':
      return <CheckCircleOutlineIcon sx={iconSx} />;
    case 'cancelled':
      return <CancelOutlinedIcon sx={iconSx} />;
    case 'todo':
    default:
      return <CircleOutlinedIcon sx={iconSx} />;
  }
}

function barColors(hex?: string | null): { bg: string; border: string } {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return DEFAULT_BAR;
  return { bg: hex.toUpperCase(), border: hex.toUpperCase() };
}

function pickUnusedColor(used: Set<string>): string {
  for (const c of TASK_COLOR_PALETTE) {
    if (!used.has(c.toUpperCase())) return c;
  }
  return TASK_COLOR_PALETTE[used.size % TASK_COLOR_PALETTE.length];
}

type MemberRow = {
  id: number;
  user_id: number;
  role: string;
  user?: { id: number; username?: string; email?: string; avatar_url?: string | null };
};

type TaskRow = {
  id: number;
  title: string;
  description?: string | null;
  progress_note?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  status: string;
  priority: string;
  color?: string | null;
  attachments?: Array<{
    originalName: string;
    storedName: string;
    path: string;
    size?: number;
  }>;
  assignees?: Array<{ user_id: number; user?: { id: number; username?: string } }>;
  comments?: Array<{
    id: number;
    content: string;
    created_at: string;
    user_id?: number;
    parent_id?: number | null;
    user?: { id: number; username?: string };
  }>;
};

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(value?: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  const ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86400000);
}

function monthLabel(d: Date, locale: string): string {
  return d.toLocaleDateString(locale.startsWith('ko') ? 'ko-KR' : 'en-US', { month: 'short', year: 'numeric' });
}

const ProjectDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useStore();
  const menuFlags = useMenuRoutePermissionFlags([MENU_ROUTE]);
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUsers, setInviteUsers] = useState<any[]>([]);
  const [inviteRole, setInviteRole] = useState('member');
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [savingInvite, setSavingInvite] = useState(false);
  const [completingProject, setCompletingProject] = useState(false);
  const [changingManagerId, setChangingManagerId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    start_date: '',
    due_date: '',
    status: 'todo',
    priority: 'medium',
    color: '',
  });
  const [savingCreate, setSavingCreate] = useState(false);

  const [popupOpen, setPopupOpen] = useState(false);
  const [popupTask, setPopupTask] = useState<TaskRow | null>(null);
  const [popupForm, setPopupForm] = useState({
    title: '',
    start_date: '',
    due_date: '',
    status: 'todo',
    priority: 'medium',
    color: '',
    progress_note: '',
    description: '',
    assignee_ids: [] as number[],
  });
  const [commentText, setCommentText] = useState('');
  const [replyParentId, setReplyParentId] = useState<number | null>(null);
  const [savingPopup, setSavingPopup] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dragRef = useRef<{
    taskId: number;
    edge: 'start' | 'end';
    originX: number;
    startDate: string;
    dueDate: string;
  } | null>(null);
  const dragPreviewRef = useRef<{ taskId: number; start: string; due: string } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ taskId: number; start: string; due: string } | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const dayWRef = useRef(MIN_DAY_W);
  const [timelineViewportW, setTimelineViewportW] = useState(0);
  const pointerGestureRef = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const suppressTimelineClickRef = useRef(false);

  const id = Number(projectId);

  const statusLabel = useCallback(
    (status: string) => t(`projectManagement.taskStatus.${status}`, { defaultValue: status }),
    [t]
  );
  const priorityLabel = useCallback(
    (priority: string) => t(`projectManagement.priority.${priority}`, { defaultValue: priority }),
    [t]
  );
  const roleLabel = useCallback(
    (role: string) => t(`projectManagement.roles.${role}`, { defaultValue: role }),
    [t]
  );

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) return;
    setLoading(true);
    try {
      const [detailRes, taskRes] = await Promise.all([
        projectService.getProject(id),
        projectService.getTasks(id),
      ]);
      if (!detailRes.success) {
        showErrorPopup(
          detailRes.message || t('projectManagement.errors.loadDetail'),
          t('projectManagement.errors.loadDetailTitle')
        );
        setProject(null);
        return;
      }
      setProject(detailRes.data);
      setTasks(Array.isArray(taskRes.data) ? taskRes.data : []);
    } catch (e: any) {
      showErrorPopup(e, t('projectManagement.errors.loadDetailTitle'));
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const params: { company_id?: number } = {};
        if (user?.company_id) params.company_id = user.company_id;
        const rows = await useReferenceDataStore.getState().fetchUsers(params);
        setCompanyUsers(
          filterActiveCompanyUsers(rows, {
            companyId: user?.company_id,
            tenantId: user?.tenant_id,
          })
        );
      } catch {
        setCompanyUsers([]);
      }
    })();
  }, [user?.company_id, user?.tenant_id]);

  const members: MemberRow[] = useMemo(
    () => (Array.isArray(project?.members) ? project.members : []),
    [project]
  );
  const memberUserIds = useMemo(() => new Set(members.map((m) => Number(m.user_id))), [members]);
  const inviteOptions = useMemo(
    () => companyUsers.filter((u) => !memberUserIds.has(Number(u.id))),
    [companyUsers, memberUserIds]
  );
  const memberOptions = useMemo(
    () =>
      members
        .map((m) => ({ id: Number(m.user_id), username: m.user?.username || String(m.user_id) }))
        .filter((m) => m.id > 0),
    [members]
  );

  const canManageMembers =
    menuFlags.canEdit &&
    (project?.my_role === 'owner' || project?.my_role === 'manager' || project?.my_role === 'admin');
  const canEditProjectMeta = canManageMembers;
  const canEditWorkspace =
    menuFlags.canEdit &&
    (project?.my_role === 'owner' ||
      project?.my_role === 'manager' ||
      project?.my_role === 'member' ||
      project?.my_role === 'admin');

  const projectStatus = String(project?.status || '').toLowerCase();
  const canCompleteProject =
    canEditProjectMeta && projectStatus !== 'completed' && projectStatus !== 'cancelled';
  const currentManagerId = Number(project?.project_manager || project?.manager?.id || 0);

  const runCompleteProject = async () => {
    if (!canCompleteProject || completingProject) return;
    setCompletingProject(true);
    try {
      const res = await projectService.updateProject(id, { status: 'completed' });
      if (!res.success) {
        showErrorPopup(
          res.message || t('projectManagement.errors.updateFailed'),
          t('projectManagement.errors.saveTitle')
        );
        return;
      }
      setProject((prev: any) =>
        prev
          ? {
              ...prev,
              ...(res.data || {}),
              status: 'completed',
              members: prev.members,
              my_role: prev.my_role,
              manager: prev.manager,
            }
          : prev
      );
      showSuccessPopup(t('projectManagement.messages.completed'));
    } catch (e: any) {
      showErrorPopup(e, t('projectManagement.errors.saveTitle'));
    } finally {
      setCompletingProject(false);
    }
  };

  const completeProject = () => {
    if (!canCompleteProject || completingProject) return;
    showConfirm(t('projectManagement.confirm.completeMessage'), () => {
      void runCompleteProject();
    }, {
      title: t('projectManagement.confirm.completeTitle'),
      confirmText: t('projectManagement.actions.complete'),
    });
  };

  const runSetMemberAsManager = async (member: MemberRow) => {
    const userId = Number(member.user_id);
    if (!canEditProjectMeta || !userId || userId === currentManagerId || changingManagerId != null) {
      return;
    }
    const name = member.user?.username || `#${userId}`;
    setChangingManagerId(userId);
    try {
      const res = await projectService.updateProject(id, { project_manager: userId });
      if (!res.success) {
        showErrorPopup(
          res.message || t('projectManagement.errors.updateFailed'),
          t('projectManagement.errors.saveTitle')
        );
        return;
      }
      showSuccessPopup(t('projectManagement.messages.managerChanged', { name }));
      await load();
    } catch (e: any) {
      showErrorPopup(e, t('projectManagement.errors.saveTitle'));
    } finally {
      setChangingManagerId(null);
    }
  };

  const setMemberAsManager = (member: MemberRow) => {
    const userId = Number(member.user_id);
    if (!canEditProjectMeta || !userId || userId === currentManagerId || changingManagerId != null) {
      return;
    }
    const name = member.user?.username || `#${userId}`;
    showConfirm(t('projectManagement.confirm.setManagerMessage', { name }), () => {
      void runSetMemberAsManager(member);
    }, {
      title: t('projectManagement.confirm.setManagerTitle'),
    });
  };

  const range = useMemo(() => {
    let start = parseYmd(project?.start_date) || new Date();
    let end = parseYmd(project?.end_date) || addDays(start, 60);
    for (const task of tasks) {
      const s = parseYmd(task.start_date);
      const d = parseYmd(task.due_date);
      if (s && s < start) start = s;
      if (d && d > end) end = d;
      if (s && !d && s > end) end = addDays(s, 7);
    }
    if (dragPreview) {
      const s = parseYmd(dragPreview.start);
      const d = parseYmd(dragPreview.due);
      if (s && s < start) start = s;
      if (d && d > end) end = d;
    }
    if (daysBetween(start, end) < 14) end = addDays(start, 14);
    if (daysBetween(start, end) > 366) end = addDays(start, 366);
    const days: Date[] = [];
    const total = daysBetween(start, end) + 1;
    for (let i = 0; i < total; i += 1) days.push(addDays(start, i));
    return { start, end, days };
  }, [project, tasks, dragPreview]);

  const dayW = useMemo(() => {
    const n = Math.max(1, range.days.length);
    const avail = Math.max(0, timelineViewportW - LABEL_W);
    if (avail <= 0) return MIN_DAY_W;
    return Math.max(MIN_DAY_W, Math.floor(avail / n));
  }, [timelineViewportW, range.days.length]);
  dayWRef.current = dayW;

  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return undefined;
    const measure = () => setTimelineViewportW(el.clientWidth);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [loading, project?.id]);

  const monthSpans = useMemo(() => {
    const spans: Array<{ key: string; label: string; count: number }> = [];
    for (const day of range.days) {
      const key = `${day.getFullYear()}-${day.getMonth()}`;
      const last = spans[spans.length - 1];
      if (last && last.key === key) last.count += 1;
      else spans.push({ key, label: monthLabel(day, i18n.language), count: 1 });
    }
    return spans;
  }, [range.days, i18n.language]);

  const openTaskPopup = async (task: TaskRow) => {
    try {
      const res = await projectService.getTask(id, task.id);
      const full: TaskRow = res.success && res.data ? res.data : task;
      setPopupTask(full);
      setPopupForm({
        title: full.title || '',
        start_date: full.start_date || '',
        due_date: full.due_date || '',
        status: full.status || 'todo',
        priority: full.priority || 'medium',
        color: full.color || '',
        progress_note: full.progress_note || '',
        description: full.description || '',
        assignee_ids: (full.assignees || []).map((a) => Number(a.user_id)).filter((n) => n > 0),
      });
      setCommentText('');
      setReplyParentId(null);
      setPopupOpen(true);
    } catch (e: any) {
      showErrorPopup(e, t('projectManagement.errors.taskTitle'));
    }
  };

  const beginTimelineGesture = (clientX: number, clientY: number) => {
    const el = timelineScrollRef.current;
    pointerGestureRef.current = {
      x: clientX,
      y: clientY,
      scrollLeft: el?.scrollLeft ?? 0,
      scrollTop: el?.scrollTop ?? 0,
    };
    suppressTimelineClickRef.current = false;
  };

  const markTimelinePan = (clientX?: number, clientY?: number) => {
    const g = pointerGestureRef.current;
    if (!g) return;
    const el = timelineScrollRef.current;
    const moved =
      clientX != null &&
      clientY != null &&
      (Math.abs(clientX - g.x) > 6 || Math.abs(clientY - g.y) > 6);
    const scrolled =
      el != null &&
      (Math.abs(el.scrollLeft - g.scrollLeft) > 2 || Math.abs(el.scrollTop - g.scrollTop) > 2);
    if (moved || scrolled) suppressTimelineClickRef.current = true;
  };

  const allowTimelineClick = () => {
    if (suppressTimelineClickRef.current) return false;
    markTimelinePan();
    return !suppressTimelineClickRef.current;
  };

  const openTaskFromTimeline = (task: TaskRow) => {
    if (!allowTimelineClick()) return;
    void openTaskPopup(task);
  };

  const savePopup = async () => {
    if (!popupTask || !canEditWorkspace) return;
    if (!popupForm.title.trim()) {
      showErrorPopup(t('projectManagement.errors.titleRequired'), t('projectManagement.errors.taskTitle'));
      return;
    }
    setSavingPopup(true);
    try {
      const res = await projectService.updateTask(id, popupTask.id, {
        title: popupForm.title.trim(),
        start_date: popupForm.start_date || null,
        due_date: popupForm.due_date || null,
        status: popupForm.status,
        priority: popupForm.priority,
        color: popupForm.color || null,
        progress_note: popupForm.progress_note || null,
        description: popupForm.description || null,
        assignee_ids: popupForm.assignee_ids,
      });
      if (!res.success) {
        showErrorPopup(res.message || t('projectManagement.errors.taskTitle'), t('projectManagement.errors.taskTitle'));
        return;
      }
      showSuccessPopup(t('projectManagement.messages.taskSaved'));
      setPopupOpen(false);
      void load();
    } catch (e: any) {
      showErrorPopup(e, t('projectManagement.errors.taskTitle'));
    } finally {
      setSavingPopup(false);
    }
  };

  const postComment = async () => {
    if (!popupTask || !commentText.trim() || !canEditWorkspace) return;
    setPostingComment(true);
    try {
      const res = await projectService.createTaskComment(
        id,
        popupTask.id,
        commentText.trim(),
        replyParentId
      );
      if (!res.success) {
        showErrorPopup(res.message || t('projectManagement.errors.taskTitle'), t('projectManagement.errors.taskTitle'));
        return;
      }
      setCommentText('');
      setReplyParentId(null);
      const refreshed = await projectService.getTask(id, popupTask.id);
      if (refreshed.success) setPopupTask(refreshed.data);
    } catch (e: any) {
      showErrorPopup(e, t('projectManagement.errors.taskTitle'));
    } finally {
      setPostingComment(false);
    }
  };

  const removeComment = async (commentId: number) => {
    if (!popupTask || !canEditWorkspace) return;
    try {
      const res = await projectService.deleteTaskComment(id, popupTask.id, commentId);
      if (!res.success) {
        showErrorPopup(res.message || t('projectManagement.errors.taskTitle'), t('projectManagement.errors.taskTitle'));
        return;
      }
      setPopupTask((prev) =>
        prev
          ? {
              ...prev,
              comments: (prev.comments || []).filter(
                (c) => c.id !== commentId && Number(c.parent_id) !== commentId
              ),
            }
          : prev
      );
      if (replyParentId === commentId) setReplyParentId(null);
    } catch (e: any) {
      showErrorPopup(e, t('projectManagement.errors.taskTitle'));
    }
  };

  const commentThreads = useMemo(() => {
    const all = popupTask?.comments || [];
    const roots = all.filter((c) => c.parent_id == null || !Number(c.parent_id));
    const repliesByParent = new Map<number, typeof all>();
    all.forEach((c) => {
      const pid = c.parent_id != null ? Number(c.parent_id) : NaN;
      if (!Number.isFinite(pid) || pid <= 0) return;
      const list = repliesByParent.get(pid) || [];
      list.push(c);
      repliesByParent.set(pid, list);
    });
    return { roots, repliesByParent };
  }, [popupTask?.comments]);

  const replyParentComment = useMemo(
    () =>
      replyParentId != null
        ? (popupTask?.comments || []).find((c) => c.id === replyParentId) || null
        : null,
    [popupTask?.comments, replyParentId]
  );

  const uploadFiles = async (files: FileList | null) => {
    if (!popupTask || !files?.length || !canEditWorkspace) return;
    try {
      const res = await projectService.uploadTaskAttachments(id, popupTask.id, Array.from(files));
      if (!res.success) {
        showErrorPopup(res.message || t('projectManagement.errors.taskTitle'), t('projectManagement.errors.taskTitle'));
        return;
      }
      setPopupTask((prev) => (prev ? { ...prev, attachments: res.data?.attachments || [] } : prev));
      showSuccessPopup(t('projectManagement.messages.attachmentUploaded'));
    } catch (e: any) {
      showErrorPopup(e, t('projectManagement.errors.taskTitle'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = async (storedName: string) => {
    if (!popupTask || !canEditWorkspace) return;
    try {
      const res = await projectService.deleteTaskAttachment(id, popupTask.id, storedName);
      if (!res.success) {
        showErrorPopup(res.message || t('projectManagement.errors.taskTitle'), t('projectManagement.errors.taskTitle'));
        return;
      }
      setPopupTask((prev) => (prev ? { ...prev, attachments: res.data?.attachments || [] } : prev));
    } catch (e: any) {
      showErrorPopup(e, t('projectManagement.errors.taskTitle'));
    }
  };

  const moveTask = async (task: TaskRow, direction: 'up' | 'down') => {
    if (!canEditWorkspace) return;
    try {
      const res = await projectService.moveTask(id, task.id, direction);
      if (!res.success) {
        showErrorPopup(res.message || t('projectManagement.errors.taskTitle'), t('projectManagement.errors.taskTitle'));
        return;
      }
      if (Array.isArray(res.data)) setTasks(res.data);
      else void load();
    } catch (e: any) {
      showErrorPopup(e, t('projectManagement.errors.taskTitle'));
    }
  };

  const createTask = async () => {
    if (!canEditWorkspace || !createForm.title.trim()) return;
    setSavingCreate(true);
    try {
      const res = await projectService.createTask(id, {
        title: createForm.title.trim(),
        start_date: createForm.start_date || project?.start_date || toYmd(new Date()),
        due_date: createForm.due_date || createForm.start_date || project?.start_date || toYmd(new Date()),
        status: createForm.status,
        priority: createForm.priority,
        ...(createForm.color ? { color: createForm.color } : {}),
      });
      if (!res.success) {
        showErrorPopup(res.message || t('projectManagement.errors.taskTitle'), t('projectManagement.errors.taskTitle'));
        return;
      }
      showSuccessPopup(t('projectManagement.messages.taskSaved'));
      setCreateOpen(false);
      setCreateForm({ title: '', start_date: '', due_date: '', status: 'todo', priority: 'medium', color: '' });
      void load();
    } catch (e: any) {
      showErrorPopup(e, t('projectManagement.errors.taskTitle'));
    } finally {
      setSavingCreate(false);
    }
  };

  const handleInvite = async () => {
    if (!canManageMembers || inviteUsers.length === 0) return;
    setSavingInvite(true);
    try {
      const res = await projectService.addMembers(id, {
        user_ids: inviteUsers.map((u) => Number(u.id)),
        role: inviteRole,
      });
      if (!res.success) {
        showErrorPopup(
          res.message || t('projectManagement.errors.inviteFailed'),
          t('projectManagement.errors.inviteTitle')
        );
        return;
      }
      showSuccessPopup(t('projectManagement.messages.invited'));
      setInviteOpen(false);
      setInviteUsers([]);
      void load();
    } catch (e: any) {
      showErrorPopup(e, t('projectManagement.errors.inviteTitle'));
    } finally {
      setSavingInvite(false);
    }
  };

  const applyDateToCell = async (task: TaskRow, day: Date) => {
    if (!canEditWorkspace) return;
    const ymd = toYmd(day);
    const start = task.start_date || ymd;
    const due = task.due_date || ymd;
    let nextStart = start;
    let nextDue = due;
    if (!task.start_date && !task.due_date) {
      nextStart = ymd;
      nextDue = ymd;
    } else if (ymd < start) {
      nextStart = ymd;
    } else {
      nextDue = ymd;
    }
    try {
      const res = await projectService.updateTask(id, task.id, {
        start_date: nextStart,
        due_date: nextDue,
      });
      if (!res.success) {
        showErrorPopup(res.message || t('projectManagement.errors.taskTitle'), t('projectManagement.errors.taskTitle'));
        return;
      }
      void load();
    } catch (e: any) {
      showErrorPopup(e, t('projectManagement.errors.taskTitle'));
    }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      markTimelinePan(e.clientX, e.clientY);
      const drag = dragRef.current;
      if (!drag) return;
      suppressTimelineClickRef.current = true;
      const deltaDays = Math.round((e.clientX - drag.originX) / dayWRef.current);
      let start = parseYmd(drag.startDate)!;
      let due = parseYmd(drag.dueDate)!;
      if (drag.edge === 'end') {
        due = addDays(parseYmd(drag.dueDate)!, deltaDays);
        if (due < start) due = start;
      } else {
        start = addDays(parseYmd(drag.startDate)!, deltaDays);
        if (start > due) start = due;
      }
      const next = { taskId: drag.taskId, start: toYmd(start), due: toYmd(due) };
      dragPreviewRef.current = next;
      setDragPreview(next);
    };
    const onUp = async () => {
      const drag = dragRef.current;
      const preview = dragPreviewRef.current;
      if (drag) suppressTimelineClickRef.current = true;
      dragRef.current = null;
      dragPreviewRef.current = null;
      setDragPreview(null);
      pointerGestureRef.current = null;
      if (!drag || !preview) return;
      if (preview.start === drag.startDate && preview.due === drag.dueDate) return;
      try {
        const res = await projectService.updateTask(id, drag.taskId, {
          start_date: preview.start,
          due_date: preview.due,
        });
        if (!res.success) {
          showErrorPopup(res.message || t('projectManagement.errors.taskTitle'), t('projectManagement.errors.taskTitle'));
          return;
        }
        void load();
      } catch (err: any) {
        showErrorPopup(err, t('projectManagement.errors.taskTitle'));
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [id, load, t]);

  if (loading) {
    return (
      <Box sx={{ ...mvsPageRootFullBleedSx, display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={mvsPageRootFullBleedSx}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/work/project-management')}
          sx={mvsBodyOutlinedBtnSx}
        >
          {t('projectManagement.detail.backToList')}
        </Button>
        <Typography sx={{ mt: 2 }} color="text.secondary">
          {t('projectManagement.errors.notFound')}
        </Typography>
      </Box>
    );
  }

  const progress = Number(project.progress || 0);
  const gridW = range.days.length * dayW;
  const popupStatusHl = taskStatusHighlight(popupForm.status);

  return (
    <Box sx={mvsPageRootFullBleedSx}>
      <DaeheungPageHeader
        title={project.name}
        description={`${project.project_code} · ${t(`projectManagement.status.${project.status}`, {
          defaultValue: project.status,
        })}`}
        iconPath={MENU_ROUTE}
        backTo="/work/project-management"
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon sx={{ fontSize: 18 }} />}
              onClick={() => void load()}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('projectManagement.actions.refresh')}
            </Button>
            {canCompleteProject && (
              <Button
                variant="outlined"
                startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 18 }} />}
                onClick={() => void completeProject()}
                disabled={completingProject}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('projectManagement.actions.complete')}
              </Button>
            )}
            {canEditWorkspace && (
              <Button
                variant="contained"
                disableElevation
                startIcon={<AddIcon sx={{ fontSize: 18 }} />}
                onClick={() => {
                  const used = new Set(
                    tasks.map((t) => String(t.color || '').toUpperCase()).filter(Boolean)
                  );
                  setCreateForm({
                    title: '',
                    start_date: project.start_date || toYmd(new Date()),
                    due_date: project.start_date || toYmd(new Date()),
                    status: 'todo',
                    priority: 'medium',
                    color: pickUnusedColor(used),
                  });
                  setCreateOpen(true);
                }}
                sx={mvsBodyPrimaryBtnSx}
              >
                {t('projectManagement.detail.addTask')}
              </Button>
            )}
            {canManageMembers && (
              <Button
                variant="outlined"
                startIcon={<PersonAddIcon sx={{ fontSize: 18 }} />}
                onClick={() => setInviteOpen(true)}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('projectManagement.detail.addMember')}
              </Button>
            )}
          </>
        }
      />

      <Box sx={{ ...mvsBodyCardSx, mb: 0 }}>
        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1.5,
            borderBottom: '1px solid #E2E8F0',
          }}
        >
          <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 0.75,
                rowGap: 0.5,
                minWidth: 0,
              }}
            >
              <Typography sx={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.2 }}>
                {project.start_date || '-'} → {project.end_date || '-'}
              </Typography>
              {project.manager?.username ? (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    minWidth: 0,
                    maxWidth: '100%',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      color: '#64748B',
                      lineHeight: 1.2,
                      flexShrink: 0,
                    }}
                  >
                    {t('projectManagement.detail.managerLabel')}
                  </Typography>
                  {(() => {
                    const managerName = project.manager.username;
                    const managerAvatarSrc = getUploadUrl(project.manager.avatar_url) || undefined;
                    return (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                        <Avatar
                          src={managerAvatarSrc}
                          alt={managerName}
                          sx={{
                            width: 22,
                            height: 22,
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            bgcolor: managerAvatarSrc ? 'transparent' : '#E2E8F0',
                            color: '#475569',
                            flexShrink: 0,
                          }}
                        >
                          {managerName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#0F172A',
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {managerName}
                        </Typography>
                      </Box>
                    );
                  })()}
                </Box>
              ) : null}
            </Box>
            <Box
              sx={{
                mt: 0.75,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 0.75,
                rowGap: 0.5,
                minWidth: 0,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  color: '#64748B',
                  lineHeight: 1.2,
                  flexShrink: 0,
                }}
              >
                {t('projectManagement.detail.membersTitle', { count: members.length })}
              </Typography>
              {members.length === 0 ? (
                <Typography sx={{ fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.2 }}>
                  {t('projectManagement.detail.noMembersShort', {
                    defaultValue: t('projectManagement.detail.noMembers'),
                  })}
                </Typography>
              ) : (
                members.map((m) => {
                  const name = m.user?.username || `#${m.user_id}`;
                  const roleLabel = t(`projectManagement.roles.${m.role}`, {
                    defaultValue: m.role,
                  });
                  const avatarSrc = getUploadUrl(m.user?.avatar_url) || undefined;
                  const isCurrentManager = Number(m.user_id) === currentManagerId;
                  const canSetAsManager =
                    canEditProjectMeta && !isCurrentManager && Number(m.user_id) > 0;
                  const tip = canSetAsManager
                    ? t('projectManagement.detail.setAsManagerHint', { name })
                    : isCurrentManager
                      ? `${roleLabel} · ${t('projectManagement.detail.managerLabel')}`
                      : roleLabel;
                  return (
                    <Tooltip key={m.id} title={tip} placement="top" enterDelay={400}>
                      <Box
                        role={canSetAsManager ? 'button' : undefined}
                        tabIndex={canSetAsManager ? 0 : undefined}
                        onClick={
                          canSetAsManager
                            ? (e: React.MouseEvent) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (changingManagerId != null) return;
                                void setMemberAsManager(m);
                              }
                            : undefined
                        }
                        onKeyDown={
                          canSetAsManager
                            ? (e: React.KeyboardEvent) => {
                                if (e.key !== 'Enter' && e.key !== ' ') return;
                                e.preventDefault();
                                if (changingManagerId != null) return;
                                void setMemberAsManager(m);
                              }
                            : undefined
                        }
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          minWidth: 0,
                          maxWidth: '100%',
                          cursor: canSetAsManager ? 'pointer' : 'default',
                          opacity: changingManagerId === Number(m.user_id) ? 0.55 : 1,
                          '&:hover': canSetAsManager
                            ? { textDecoration: 'underline', textUnderlineOffset: '2px' }
                            : undefined,
                        }}
                      >
                        <Avatar
                          src={avatarSrc}
                          alt={name}
                          sx={{
                            width: 22,
                            height: 22,
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            bgcolor: avatarSrc ? 'transparent' : '#E2E8F0',
                            color: '#475569',
                            flexShrink: 0,
                          }}
                        >
                          {name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: isCurrentManager ? '#006100' : '#0F172A',
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {name}
                        </Typography>
                      </Box>
                    </Tooltip>
                  );
                })
              )}
            </Box>
          </Box>
          <Box sx={{ minWidth: 160, flex: '0 1 200px' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748B', mb: 0.5 }}>
              {t('projectManagement.columns.progress')} {progress}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, progress))}
              sx={{
                height: 6,
                borderRadius: 0,
                bgcolor: '#E2E8F0',
                '& .MuiLinearProgress-bar': { borderRadius: 0, bgcolor: 'primary.main' },
              }}
            />
          </Box>
        </Box>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 1, bgcolor: '#F8FAFC' }}>
          <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>
            {t('projectManagement.detail.timelineHint')}
          </Typography>
        </Box>
      </Box>

      <Box sx={mvsBodyListZoneSx}>
        <Box
          ref={timelineScrollRef}
          sx={{ ...mvsBodyListTableSx, maxHeight: 'calc(100vh - 260px)', overflow: 'auto' }}
          onMouseDown={(e) => beginTimelineGesture(e.clientX, e.clientY)}
          onMouseMove={(e) => {
            if (e.buttons === 0) return;
            markTimelinePan(e.clientX, e.clientY);
          }}
          onScroll={() => markTimelinePan()}
        >
          <Box sx={mvsBodySectionHeaderSx}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0F172A' }}>
              {t('projectManagement.tabs.schedule')} / Task
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'inline-flex',
              width: LABEL_W + gridW,
              minWidth: LABEL_W + gridW,
              borderTop: `1px solid ${GRID}`,
              verticalAlign: 'top',
            }}
          >
            <Box
              sx={{
                width: LABEL_W,
                flexShrink: 0,
                position: 'sticky',
                left: 0,
                zIndex: 3,
                bgcolor: '#FFFFFF',
                borderRight: `1px solid ${GRID}`,
              }}
            >
              <Box
                sx={{
                  height: HEADER_H,
                  borderBottom: `1px solid ${GRID}`,
                  borderTop: `1px solid ${GRID}`,
                  boxShadow: `inset 0 -2px 0 0 ${TASK_HEAD_ACCENT}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  px: 1.25,
                  bgcolor: TASK_HEAD_BG,
                  color: TASK_HEAD_FG,
                  boxSizing: 'border-box',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('projectManagement.detail.timelineTaskAxis')}
                </Typography>
                <Box
                  sx={{
                    minWidth: 28,
                    height: 22,
                    px: 0.75,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: HEAD_BG,
                    border: `1px solid ${GRID}`,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: TASK_HEAD_FG,
                    lineHeight: 1,
                  }}
                >
                  {tasks.length}
                </Box>
              </Box>
              {tasks.length === 0 ? (
                <Box
                  sx={{
                    height: ROW_H,
                    display: 'flex',
                    alignItems: 'center',
                    px: 1.25,
                    fontSize: '0.8125rem',
                    color: '#64748B',
                    borderBottom: `1px solid ${GRID}`,
                  }}
                >
                  {t('projectManagement.detail.noTasks')}
                </Box>
              ) : (
                tasks.map((task, taskIndex) => (
                  <Box
                    key={task.id}
                    sx={{
                      height: ROW_H,
                      borderBottom: `1px solid ${GRID}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 0.5,
                      bgcolor: '#FFFFFF',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: ROW_HOVER },
                    }}
                    onClick={() => openTaskFromTimeline(task)}
                  >
                    {canEditWorkspace && (
                      <Stack
                        spacing={0}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ flexShrink: 0 }}
                      >
                        <IconButton
                          size="small"
                          disabled={taskIndex === 0}
                          onClick={() => void moveTask(task, 'up')}
                          sx={{ p: 0, width: 18, height: 14 }}
                          title={t('projectManagement.detail.moveUp')}
                        >
                          <ArrowUpIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={taskIndex === tasks.length - 1}
                          onClick={() => void moveTask(task, 'down')}
                          sx={{ p: 0, width: 18, height: 14 }}
                          title={t('projectManagement.detail.moveDown')}
                        >
                          <ArrowDownIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Stack>
                    )}
                    <Box
                      sx={{
                        width: 4,
                        alignSelf: 'stretch',
                        my: 0.5,
                        bgcolor: barColors(task.color).bg,
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Tooltip title={statusLabel(task.status)} placement="top" enterDelay={400}>
                        <Box sx={{ display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}>
                          <TaskStatusIcon status={task.status} fontSize={18} />
                        </Box>
                      </Tooltip>
                      <Typography
                        sx={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: '#0F172A',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.2,
                          minWidth: 0,
                        }}
                      >
                        {task.title}
                      </Typography>
                    </Box>
                  </Box>
                ))
              )}
            </Box>

            <Box sx={{ width: gridW, flexShrink: 0 }}>
              <Box sx={{ height: HEADER_H / 2, display: 'flex', borderBottom: `1px solid ${GRID}` }}>
                {monthSpans.map((m) => (
                  <Box
                    key={m.key}
                    sx={{
                      width: m.count * dayW,
                      bgcolor: HEAD_BG_DEEP,
                      color: HEAD_FG,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      borderRight: `1px solid ${GRID}`,
                      boxSizing: 'border-box',
                    }}
                  >
                    {m.label}
                  </Box>
                ))}
              </Box>
              <Box sx={{ height: HEADER_H / 2, display: 'flex', borderBottom: `1px solid ${GRID}` }}>
                {range.days.map((day) => {
                  const weekend = day.getDay() === 0 || day.getDay() === 6;
                  return (
                    <Box
                      key={toYmd(day)}
                      sx={{
                        width: dayW,
                        bgcolor: weekend ? WEEKEND_BG : HEAD_BG,
                        color: HEAD_FG,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        borderRight: `1px solid ${GRID}`,
                        boxSizing: 'border-box',
                      }}
                    >
                      {day.getDate()}
                    </Box>
                  );
                })}
              </Box>

              {tasks.length === 0 ? (
                <Box sx={{ width: gridW, height: ROW_H, borderBottom: `1px solid ${GRID}` }} />
              ) : (
                tasks.map((task) => {
                  const preview = dragPreview?.taskId === task.id ? dragPreview : null;
                  const startStr = preview?.start || task.start_date;
                  const dueStr = preview?.due || task.due_date;
                  const start = parseYmd(startStr);
                  const due = parseYmd(dueStr || startStr);
                  let left = 0;
                  let width = 0;
                  if (start && due) {
                    const sIdx = Math.max(0, daysBetween(range.start, start));
                    const eIdx = Math.min(range.days.length - 1, daysBetween(range.start, due));
                    left = sIdx * dayW;
                    width = Math.max(dayW, (eIdx - sIdx + 1) * dayW);
                  }
                  const colors = barColors(task.color);
                  return (
                    <Box
                      key={task.id}
                      sx={{
                        position: 'relative',
                        width: gridW,
                        height: ROW_H,
                        borderBottom: `1px solid ${GRID}`,
                        bgcolor: '#FFFFFF',
                        backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${dayW - 1}px, ${GRID} ${dayW - 1}px, ${GRID} ${dayW}px)`,
                        '&:hover': { bgcolor: ROW_HOVER },
                      }}
                    >
                      {range.days.map((day) => (
                        <Box
                          key={`${task.id}-${toYmd(day)}`}
                          onClick={() => {
                            if (!allowTimelineClick()) return;
                            if (!task.start_date && !task.due_date) {
                              void applyDateToCell(task, day);
                              return;
                            }
                            openTaskFromTimeline(task);
                          }}
                          onDoubleClick={() => {
                            if (!allowTimelineClick()) return;
                            void applyDateToCell(task, day);
                          }}
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: daysBetween(range.start, day) * dayW,
                            width: dayW,
                            height: '100%',
                            cursor: 'pointer',
                          }}
                          title={toYmd(day)}
                        />
                      ))}
                      {start && due && (
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            openTaskFromTimeline(task);
                          }}
                          sx={{
                            position: 'absolute',
                            top: 14,
                            left: left + 1,
                            width: Math.max(20, width - 2),
                            height: ROW_H - 28,
                            bgcolor: colors.bg,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 0,
                            color: '#fff',
                            px: 0.75,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            cursor: 'pointer',
                            zIndex: 1,
                            overflow: 'hidden',
                            userSelect: 'none',
                          }}
                        >
                          {canEditWorkspace && (
                            <Box
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!task.start_date || !task.due_date) return;
                                suppressTimelineClickRef.current = true;
                                dragRef.current = {
                                  taskId: task.id,
                                  edge: 'start',
                                  originX: e.clientX,
                                  startDate: task.start_date,
                                  dueDate: task.due_date,
                                };
                              }}
                              sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: 6,
                                height: '100%',
                                cursor: 'ew-resize',
                                bgcolor: 'rgba(0,0,0,0.18)',
                              }}
                            />
                          )}
                          <TaskStatusIcon
                            status={task.status}
                            fontSize={14}
                            sx={{ opacity: task.status === 'completed' ? 1 : 0.9 }}
                          />
                          <Typography
                            sx={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: 1,
                            }}
                          >
                            {task.title}
                          </Typography>
                          {canEditWorkspace && (
                            <Box
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!task.start_date || !task.due_date) return;
                                suppressTimelineClickRef.current = true;
                                dragRef.current = {
                                  taskId: task.id,
                                  edge: 'end',
                                  originX: e.clientX,
                                  startDate: task.start_date,
                                  dueDate: task.due_date,
                                };
                              }}
                              sx={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                width: 6,
                                height: '100%',
                                cursor: 'ew-resize',
                                bgcolor: 'rgba(0,0,0,0.18)',
                              }}
                            />
                          )}
                        </Box>
                      )}
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Invite */}
      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: getMvsDialogPaperSx(theme) }}
      >
        <DialogTitle sx={getMvsDialogTitleRowSx(theme)}>
          {t('projectManagement.detail.addMember')}
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 2.5, pb: 1 }}>
          <Autocomplete
            multiple
            options={inviteOptions}
            value={inviteUsers}
            onChange={(_, v) => setInviteUsers(v)}
            getOptionLabel={(o) => o.username || String(o.id)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('projectManagement.detail.searchUsers')}
                size="small"
                sx={{ ...mvsSearchFieldSx, mb: 2 }}
              />
            )}
          />
          <FormControl fullWidth size="small" sx={mvsSearchFieldSx}>
            <InputLabel shrink>{t('projectManagement.fields.role')}</InputLabel>
            <Select
              label={t('projectManagement.fields.role')}
              value={inviteRole}
              onChange={(e) => setInviteRole(String(e.target.value))}
            >
              {['manager', 'member', 'viewer'].map((r) => (
                <MenuItem key={r} value={r}>
                  {roleLabel(r)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button onClick={() => setInviteOpen(false)} sx={mvsBodyOutlinedBtnSx}>
            {t('projectManagement.actions.cancel')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            disabled={savingInvite || inviteUsers.length === 0}
            onClick={() => void handleInvite()}
            sx={mvsBodyPrimaryBtnSx}
          >
            {t('projectManagement.detail.invite')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create task */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: getMvsDialogPaperSx(theme) }}
      >
        <DialogTitle sx={getMvsDialogTitleRowSx(theme)}>
          {t('projectManagement.detail.addTask')}
        </DialogTitle>
        <DialogContent
          sx={{
            px: 2.5,
            // MUI는 DialogTitle 다음에 pt를 0으로 덮어써서 아웃라인 라벨이 잘림
            pt: '28px !important',
            pb: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <TextField
            size="small"
            label={t('projectManagement.fields.name')}
            value={createForm.title}
            onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ ...mvsSearchFieldSx, mt: 0.5 }}
          />
          <Stack direction="row" spacing={1.5} sx={{ mt: 0.25 }}>
            <TextField
              size="small"
              type="date"
              label={t('projectManagement.fields.startDate')}
              InputLabelProps={{ shrink: true }}
              value={createForm.start_date}
              onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))}
              sx={{ ...mvsSearchFieldSx, flex: 1 }}
            />
            <TextField
              size="small"
              type="date"
              label={t('projectManagement.detail.dueDate')}
              InputLabelProps={{ shrink: true }}
              value={createForm.due_date}
              onChange={(e) => setCreateForm((f) => ({ ...f, due_date: e.target.value }))}
              sx={{ ...mvsSearchFieldSx, flex: 1 }}
            />
          </Stack>
          <Box sx={{ pt: 0.25 }}>
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, mb: 0.75 }}>
              {t('projectManagement.detail.taskColor')}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1 }}>
              {t('projectManagement.detail.taskColorHint')}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {TASK_COLOR_PALETTE.map((c) => {
                const selected = createForm.color.toUpperCase() === c.toUpperCase();
                return (
                  <Box
                    key={c}
                    onClick={() => setCreateForm((f) => ({ ...f, color: c }))}
                    sx={{
                      width: 28,
                      height: 28,
                      bgcolor: c,
                      border: selected ? '2px solid #0F172A' : '1px solid #B4B4B4',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                    title={c}
                  />
                );
              })}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button onClick={() => setCreateOpen(false)} sx={mvsBodyOutlinedBtnSx}>
            {t('projectManagement.actions.cancel')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            disabled={savingCreate || !createForm.title.trim()}
            onClick={() => void createTask()}
            sx={mvsBodyPrimaryBtnSx}
          >
            {t('projectManagement.actions.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Task popup: progress / comments / attachments */}
      <Dialog
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            ...getMvsDialogPaperSx(theme),
            width: 'min(1170px, 96vw)',
            maxWidth: '1170px',
            maxHeight: '92vh',
          },
        }}
      >
        <DialogTitle sx={getMvsDialogTitleRowSx(theme)}>
          {popupTask?.title || t('projectManagement.detail.editTask')}
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pt: 2, pb: 1, maxHeight: 'calc(92vh - 140px)', overflow: 'auto' }}>
          <Stack spacing={1.5}>
            <TextField
              size="small"
              label={t('projectManagement.fields.name')}
              value={popupForm.title}
              disabled={!canEditWorkspace}
              onChange={(e) => setPopupForm((f) => ({ ...f, title: e.target.value }))}
              sx={mvsSearchFieldSx}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                size="small"
                type="date"
                label={t('projectManagement.fields.startDate')}
                InputLabelProps={{ shrink: true }}
                value={popupForm.start_date}
                disabled={!canEditWorkspace}
                onChange={(e) => setPopupForm((f) => ({ ...f, start_date: e.target.value }))}
                sx={{ ...mvsSearchFieldSx, flex: 1 }}
              />
              <TextField
                size="small"
                type="date"
                label={t('projectManagement.detail.dueDate')}
                InputLabelProps={{ shrink: true }}
                value={popupForm.due_date}
                disabled={!canEditWorkspace}
                onChange={(e) => setPopupForm((f) => ({ ...f, due_date: e.target.value }))}
                sx={{ ...mvsSearchFieldSx, flex: 1 }}
              />
              <FormControl size="small" sx={{ ...mvsSearchFieldSx, flex: 1 }}>
                <InputLabel shrink>{t('projectManagement.detail.taskStatus')}</InputLabel>
                <Select
                  label={t('projectManagement.detail.taskStatus')}
                  value={popupForm.status}
                  disabled={!canEditWorkspace}
                  onChange={(e) => setPopupForm((f) => ({ ...f, status: String(e.target.value) }))}
                  sx={{
                    bgcolor: popupStatusHl.bg,
                    color: popupStatusHl.fg,
                    fontWeight: 700,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: popupStatusHl.border },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: popupStatusHl.border },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: popupStatusHl.border },
                    '& .MuiSelect-icon': { color: popupStatusHl.fg },
                  }}
                >
                  {['todo', 'in_progress', 'blocked', 'completed', 'cancelled'].map((s) => {
                    const hl = taskStatusHighlight(s);
                    return (
                      <MenuItem
                        key={s}
                        value={s}
                        sx={{
                          bgcolor: hl.bg,
                          color: hl.fg,
                          fontWeight: 600,
                          my: 0.25,
                          mx: 0.5,
                          borderLeft: `3px solid ${hl.border}`,
                          '&.Mui-selected': {
                            bgcolor: hl.bg,
                            color: hl.fg,
                          },
                          '&.Mui-selected:hover': {
                            bgcolor: hl.bg,
                          },
                          '&:hover': {
                            bgcolor: hl.bg,
                            filter: 'brightness(0.97)',
                          },
                        }}
                      >
                        {statusLabel(s)}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Stack>

            {canEditWorkspace && (
              <Box>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, mb: 0.75 }}>
                  {t('projectManagement.detail.taskColor')}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  {TASK_COLOR_PALETTE.map((c) => {
                    const selected = popupForm.color.toUpperCase() === c.toUpperCase();
                    return (
                      <Box
                        key={c}
                        onClick={() => setPopupForm((f) => ({ ...f, color: c }))}
                        sx={{
                          width: 28,
                          height: 28,
                          bgcolor: c,
                          border: selected ? '2px solid #0F172A' : '1px solid #B4B4B4',
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                        }}
                      />
                    );
                  })}
                </Stack>
              </Box>
            )}

            <Autocomplete
              multiple
              options={memberOptions}
              value={memberOptions.filter((m) => popupForm.assignee_ids.includes(m.id))}
              disabled={!canEditWorkspace}
              onChange={(_, v) => setPopupForm((f) => ({ ...f, assignee_ids: v.map((x) => x.id) }))}
              getOptionLabel={(o) => o.username}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip size="small" label={option.username} {...getTagProps({ index })} key={option.id} />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label={t('projectManagement.detail.selectAssignees')}
                  sx={mvsSearchFieldSx}
                />
              )}
            />

            <TextField
              size="small"
              multiline
              minRows={3}
              label={t('projectManagement.detail.progressNote')}
              value={popupForm.progress_note}
              disabled={!canEditWorkspace}
              onChange={(e) => setPopupForm((f) => ({ ...f, progress_note: e.target.value }))}
              sx={mvsSearchFieldSx}
            />

            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700 }}>
                  {t('projectManagement.detail.attachments')}
                </Typography>
                {canEditWorkspace && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      hidden
                      onChange={(e) => void uploadFiles(e.target.files)}
                    />
                    <Button
                      size="small"
                      startIcon={<AttachFileIcon sx={{ fontSize: 16 }} />}
                      onClick={() => fileInputRef.current?.click()}
                      sx={mvsBodyOutlinedBtnSx}
                    >
                      {t('projectManagement.detail.uploadFile')}
                    </Button>
                  </>
                )}
              </Stack>
              {(popupTask?.attachments || []).length === 0 ? (
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                  {t('projectManagement.detail.noAttachments')}
                </Typography>
              ) : (
                (popupTask?.attachments || []).map((file) => (
                  <Stack
                    key={file.storedName}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ py: 0.5, borderBottom: '1px solid #E0E0E0' }}
                  >
                    <Typography
                      component="a"
                      href={getUploadUrl(file.path)}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ fontSize: '0.8125rem', color: 'primary.main', textDecoration: 'none' }}
                    >
                      {file.originalName}
                    </Typography>
                    {canEditWorkspace && (
                      <IconButton size="small" onClick={() => void removeAttachment(file.storedName)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                ))
              )}
            </Box>

            <Box>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, mb: 0.75 }}>
                {t('projectManagement.detail.comments')}
              </Typography>
              <Box
                sx={{
                  maxHeight: 220,
                  overflow: 'auto',
                  border: '1px solid #B4B4B4',
                  mb: 1,
                  px: 1,
                }}
              >
                {commentThreads.roots.length === 0 ? (
                  <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', py: 1 }}>
                    {t('projectManagement.detail.noComments')}
                  </Typography>
                ) : (
                  commentThreads.roots.map((c) => {
                    const replies = commentThreads.repliesByParent.get(c.id) || [];
                    return (
                      <Box key={c.id} sx={{ py: 0.75, borderBottom: '1px solid #E8E8E8' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            {c.user?.username || '-'} ·{' '}
                            {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                          </Typography>
                          <Stack direction="row" spacing={0.25}>
                            {canEditWorkspace && (
                              <Tooltip title={t('projectManagement.detail.reply')}>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setReplyParentId(c.id);
                                    setCommentText('');
                                  }}
                                >
                                  <ReplyIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {canEditWorkspace && (
                              <IconButton size="small" onClick={() => void removeComment(c.id)}>
                                <DeleteIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            )}
                          </Stack>
                        </Stack>
                        <Typography sx={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap' }}>
                          {c.content}
                        </Typography>
                        {replies.map((r) => (
                          <Box
                            key={r.id}
                            sx={{
                              mt: 0.75,
                              ml: 1.5,
                              pl: 1,
                              borderLeft: '2px solid #CBD5E1',
                            }}
                          >
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                {r.user?.username || '-'} ·{' '}
                                {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                              </Typography>
                              {canEditWorkspace && (
                                <IconButton size="small" onClick={() => void removeComment(r.id)}>
                                  <DeleteIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              )}
                            </Stack>
                            <Typography sx={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap' }}>
                              {r.content}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    );
                  })
                )}
              </Box>
              {canEditWorkspace && (
                <Stack spacing={0.75}>
                  {replyParentComment ? (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography sx={{ fontSize: '0.75rem', color: 'primary.main' }}>
                        {t('projectManagement.detail.replyingTo', {
                          name: replyParentComment.user?.username || '-',
                        })}
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => setReplyParentId(null)}
                        sx={{ ...mvsBodyOutlinedBtnSx, minWidth: 0, px: 1, py: 0.25, fontSize: '0.75rem' }}
                      >
                        {t('projectManagement.detail.cancelReply')}
                      </Button>
                    </Stack>
                  ) : null}
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder={
                        replyParentId
                          ? t('projectManagement.detail.replyPlaceholder')
                          : t('projectManagement.detail.commentPlaceholder')
                      }
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          if (!postingComment && commentText.trim()) void postComment();
                        }
                      }}
                      sx={mvsSearchFieldSx}
                    />
                    <Button
                      variant="contained"
                      disableElevation
                      disabled={postingComment || !commentText.trim()}
                      onClick={() => void postComment()}
                      sx={mvsBodyPrimaryBtnSx}
                    >
                      {replyParentId
                        ? t('projectManagement.detail.reply')
                        : t('projectManagement.detail.postComment')}
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button onClick={() => setPopupOpen(false)} sx={mvsBodyOutlinedBtnSx}>
            {t('projectManagement.actions.cancel')}
          </Button>
          {canEditWorkspace && (
            <Button
              variant="contained"
              disableElevation
              disabled={savingPopup}
              onClick={() => void savePopup()}
              sx={mvsBodyPrimaryBtnSx}
            >
              {t('projectManagement.actions.save')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        confirmColor={dialogState.confirmColor}
        messageTone={dialogState.messageTone}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Box>
  );
};

export default ProjectDetailPage;
