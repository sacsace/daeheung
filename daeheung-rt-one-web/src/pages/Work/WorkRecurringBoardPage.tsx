import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  InputAdornment,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  AdminPanelSettingsOutlined as AdminIcon,
  AttachFile as AttachFileIcon,
  DeleteOutline as DeleteOutlineIcon,
  EditOutlined as EditOutlinedIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  LibraryAddOutlined as LibraryAddIcon,
  PersonAddAlt1 as PersonAddIcon,
  PhotoOutlined as PhotoOutlinedIcon,
  PlaylistAddCheck as GenerateIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { getUploadUrl } from '../../utils/uploadUrl';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { usePhotoPreviewOptional } from '../../components/Common/PhotoPreviewProvider';
import {
  getMvsDialogActionsSx,
  getMvsDialogCancelButtonSx,
  getMvsDialogPaperSx,
  getMvsDialogPrimaryConfirmButtonSx,
  getMvsDialogPromptContentSx,
  getMvsDialogTitleRowSx,
} from '../../components/Common/daeheungDialogShell';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { api, partnerService, workBoardService } from '../../services/api';
import { showErrorPopup, showSuccessToast, showWarningPopup } from '../../utils/errorHandler';
import { useStore } from '../../store';
import { filterActiveCompanyUsers, useReferenceDataStore } from '../../store/referenceDataStore';
import {
  mvsBodyCardSx,
  mvsBodyListZoneSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodySectionHeaderSx,
  mvsBodyToolbarSx,
  mvsFilterFieldHeightSx,
  mvsMainTabsSx,
  mvsOutlinedLabelProps,
  mvsPageRootFullBleedSx,
  mvsSearchFieldSx,
  mvsTableBodyRowSx,
  mvsTableHeadHighlightSx,
  mvsTableScrollSx,
  mvsBodyListTableSx,
} from '../../theme/daeheungLayout';

type BoardProp = {
  id: number;
  name?: string;
  description?: string | null;
  board_type?: string;
  company_id?: number;
};

type TemplateRow = {
  id: number;
  name: string;
  code?: string | null;
  category?: string | null;
  frequency: string;
  default_priority?: string;
  default_due_day?: number | null;
  requires_attachment?: boolean;
  requires_verification?: boolean;
  sort_order?: number;
};

type ClientRow = {
  id: number;
  customer_id: number;
  customer?: { id: number; name?: string; business_number?: string | null; status?: string };
  row_key?: string;
  assignee_user_id?: number;
  assignee_label?: string;
  assignee_names?: string[];
  /** 이 담당자 행에서 편집 가능한 템플릿 id 목록 */
  template_ids?: number[];
  assignee_by_template?: Record<string, { id: number; username: string; userid?: string | null }>;
};

type MemberRow = {
  id: number;
  user_id: number;
  role?: string;
  user?: { id: number; username?: string; userid?: string; avatar_url?: string | null };
};

type AssignmentRow = {
  id: number;
  customer_id: number;
  template_id: number;
  assigned_user_id?: number | null;
  reviewer_user_id?: number | null;
  assignee?: { id: number; username?: string; userid?: string } | null;
  reviewer?: { id: number; username?: string; userid?: string } | null;
};

type InstanceAttachment = {
  originalName: string;
  storedName: string;
  path: string;
  mimeType?: string;
  size?: number;
};

type InstanceRow = {
  id: number;
  customer_id: number;
  template_id: number;
  period: string;
  due_date?: string | null;
  status: string;
  notes?: string | null;
  is_overdue?: boolean;
  attachment_count?: number;
  attachments?: InstanceAttachment[];
  assigned_user_id?: number | null;
  reviewer_user_id?: number | null;
  can_edit?: boolean;
  can_manage?: boolean;
  can_verify?: boolean;
  assignee?: { id: number; username?: string; userid?: string } | null;
  reviewer?: { id: number; username?: string; userid?: string } | null;
  template?: {
    id: number;
    name?: string;
    requires_attachment?: boolean;
    requires_verification?: boolean;
  } | null;
  customer?: { id: number; name?: string } | null;
};

type ChecklistSummary = {
  total: number;
  completed: number;
  in_progress: number;
  pending: number;
  overdue: number;
  not_applicable: number;
  completion_rate: number;
};

type CustomerOption = {
  id: number;
  name: string;
  business_number?: string | null;
  source?: 'partner' | 'customer';
};

const normalizeClientKey = (value?: string | null) => String(value || '').trim().toLowerCase();

const INSTANCE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'NOT_APPLICABLE'] as const;

function currentPeriodValue(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function statusChipColor(
  status: string,
  overdue?: boolean
): 'default' | 'warning' | 'info' | 'success' | 'error' {
  if (overdue && status !== 'COMPLETED' && status !== 'VERIFIED' && status !== 'NOT_APPLICABLE') {
    return 'error';
  }
  if (status === 'VERIFIED') return 'success';
  if (status === 'COMPLETED') return 'success';
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'NOT_APPLICABLE') return 'default';
  return 'warning';
}

type TemplateForm = {
  name: string;
  code: string;
  category: string;
  frequency: string;
  default_priority: string;
  default_due_day: string;
  requires_attachment: boolean;
  requires_verification: boolean;
};

const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUALLY', 'CUSTOM'] as const;

const tableSx = {
  borderCollapse: 'collapse' as const,
  bgcolor: 'transparent',
  '& .MuiTableCell-root': {
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
  },
};

const emptyForm = (): TemplateForm => ({
  name: '',
  code: '',
  category: '',
  frequency: 'MONTHLY',
  default_priority: 'medium',
  default_due_day: '',
  requires_attachment: false,
  requires_verification: false,
});

function userLabel(u?: { username?: string; userid?: string } | null): string {
  if (!u) return '';
  return String(u.username || u.userid || '').trim();
}

const MEMBER_AVATAR_COLORS = ['#2563EB', '#0D9488', '#7C3AED', '#DB2777', '#EA580C', '#059669'];

/** 담당자 블록 교차: 투명(흰색) → 파스텔 붉은색 → 투명 … */
const ASSIGNEE_BAND_CLEAR = '#FFFFFF';
const ASSIGNEE_BAND_ACCENT = '#FDECEC';

function memberAvatarColor(userId: number) {
  return MEMBER_AVATAR_COLORS[Math.abs(userId) % MEMBER_AVATAR_COLORS.length];
}

function assigneeBandKey(row: {
  assignee_user_id?: number;
  assignee_label?: string;
  assignee_names?: string[];
}) {
  const uid = Number(row.assignee_user_id || 0);
  if (Number.isInteger(uid) && uid > 0) return `u:${uid}`;
  const label = String(
    row.assignee_label ||
      (Array.isArray(row.assignee_names) ? row.assignee_names[0] : '') ||
      ''
  )
    .trim()
    .toLowerCase();
  return label ? `n:${label}` : 'u:0';
}

function assigneeBandBg(bandIndex: number) {
  return bandIndex % 2 === 0 ? ASSIGNEE_BAND_CLEAR : ASSIGNEE_BAND_ACCENT;
}

function resolveMemberAvatarSrc(avatarUrl?: string | null) {
  const resolved = getUploadUrl(avatarUrl || undefined);
  return resolved || undefined;
}

const WorkRecurringBoardPage: React.FC<{ board: BoardProp }> = ({ board }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const photoPreview = usePhotoPreviewOptional();

  const [tab, setTab] = useState(0);
  const [memberMenuAnchor, setMemberMenuAnchor] = useState<HTMLElement | null>(null);
  const [memberMenuTarget, setMemberMenuTarget] = useState<{
    id: number;
    name: string;
    role: 'owner' | 'member';
    avatarSrc?: string;
  } | null>(null);
  const [memberRoleSaving, setMemberRoleSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [overviewReady, setOverviewReady] = useState(false);
  const [boardCreatedById, setBoardCreatedById] = useState<number | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [checklistClients, setChecklistClients] = useState<ClientRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [companyId, setCompanyId] = useState<number | undefined>(board.company_id);

  const [period, setPeriod] = useState(currentPeriodValue);
  const [checklistTemplates, setChecklistTemplates] = useState<TemplateRow[]>([]);
  const [instances, setInstances] = useState<InstanceRow[]>([]);
  const [summary, setSummary] = useState<ChecklistSummary | null>(null);
  const [detailInstance, setDetailInstance] = useState<InstanceRow | null>(null);
  const [detailNotes, setDetailNotes] = useState('');
  const [detailDueDate, setDetailDueDate] = useState('');
  const [detailAssigneeId, setDetailAssigneeId] = useState('');
  const [detailReviewerId, setDetailReviewerId] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);

  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<CustomerOption[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCandidates, setInviteCandidates] = useState<Array<{ id: number; label: string }>>([]);
  const [inviteSelected, setInviteSelected] = useState<Array<{ id: number; label: string }>>([]);
  const [inviteLoading, setInviteLoading] = useState(false);

  const [expandedAssignClientId, setExpandedAssignClientId] = useState<number | null>(null);
  const [checklistSort, setChecklistSort] = useState<{
    key: 'client' | 'assignee' | `template:${number}`;
    dir: 'asc' | 'desc';
  }>({ key: 'assignee', dir: 'asc' });
  const [checklistSearchQuery, setChecklistSearchQuery] = useState('');
  const [assignSort, setAssignSort] = useState<{
    key: 'client' | 'assignee' | 'reviewer' | 'progress';
    dir: 'asc' | 'desc';
  }>({ key: 'assignee', dir: 'asc' });

  const currentUser = useStore((s) => s.user);

  const tr = useCallback((key: string, opts?: Record<string, unknown>) => t(`workBoards.recurring.${key}`, opts), [t]);

  const freqLabel = useCallback(
    (f: string) => {
      const key = `workBoards.recurring.frequency.${f}`;
      const translated = t(key);
      return translated === key ? f : translated;
    },
    [t]
  );

  const memberOptions = useMemo(
    () =>
      members
        .map((m) => ({
          id: Number(m.user?.id || m.user_id),
          label: userLabel(m.user) || String(m.user_id),
        }))
        .filter((m) => Number.isInteger(m.id) && m.id > 0),
    [members]
  );

  const memberDisplayList = useMemo(() => {
    const rows = [...members].sort((a, b) => {
      const ao = a.role === 'owner' ? 0 : 1;
      const bo = b.role === 'owner' ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return userLabel(a.user).localeCompare(userLabel(b.user));
    });
    return rows
      .map((m) => {
        const id = Number(m.user?.id || m.user_id);
        const name = userLabel(m.user) || String(m.user_id);
        if (!Number.isInteger(id) || id <= 0 || !name) return null;
        return {
          id,
          name,
          role: m.role === 'owner' ? 'owner' : 'member',
          avatarSrc: resolveMemberAvatarSrc(m.user?.avatar_url),
          initial: name.slice(0, 1).toUpperCase(),
        };
      })
      .filter(Boolean) as Array<{
      id: number;
      name: string;
      role: 'owner' | 'member';
      avatarSrc?: string;
      initial: string;
    }>;
  }, [members]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, AssignmentRow>();
    for (const a of assignments) {
      map.set(`${a.customer_id}:${a.template_id}`, a);
    }
    return map;
  }, [assignments]);

  const statusLabel = useCallback(
    (status: string) => {
      const key = `workBoards.recurring.status.${status}`;
      const translated = t(key);
      return translated === key ? status : translated;
    },
    [t]
  );

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setOverviewReady(false);
    try {
      const res = await workBoardService.getRecurringOverview(board.id);
      if (!res?.success) {
        showErrorPopup(res?.message || tr('errors.loadFailed'), t('workBoards.title'));
        return;
      }
      const data = res.data || {};
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
      setClients(Array.isArray(data.clients) ? data.clients : []);
      setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
      setMembers(Array.isArray(data.members) ? data.members : []);
      setCanManage(Boolean(data.can_manage));
      if (data.board?.company_id) setCompanyId(Number(data.board.company_id));
      const createdBy = Number(data.board?.created_by);
      setBoardCreatedById(Number.isInteger(createdBy) && createdBy > 0 ? createdBy : null);
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setOverviewReady(true);
      setLoading(false);
    }
  }, [board.id, t, tr]);

  const loadChecklist = useCallback(async (periodValue: string) => {
    setChecklistLoading(true);
    try {
      const res = await workBoardService.getRecurringChecklist(board.id, periodValue);
      if (!res?.success) {
        showErrorPopup(res?.message || tr('errors.checklistFailed'), t('workBoards.title'));
        return;
      }
      const data = res.data || {};
      if (typeof data.can_manage === 'boolean') setCanManage(data.can_manage);

      const myId = Number(currentUser?.id || 0);
      const myBoardRole = members.find(
        (m) => Number(m.user?.id || m.user_id) === myId
      )?.role;
      /** 보드 Admin(owner)만 전체. audit 등 시스템 역할로는 열지 않음 */
      const allowAllChecklist =
        myBoardRole === 'owner' || String(currentUser?.role || '') === 'root';

      let clientsRows: ClientRow[] = Array.isArray(data.clients) ? data.clients : [];
      let instanceRows: InstanceRow[] = Array.isArray(data.instances) ? data.instances : [];

      // 서버 스코프와 별개로 클라이언트에서 한 번 더 강제
      if (!allowAllChecklist && myId > 0) {
        clientsRows = clientsRows.filter((c) => Number(c.assignee_user_id) === myId);
        const allowed = new Set<string>();
        for (const c of clientsRows) {
          const tids = Array.isArray(c.template_ids) ? c.template_ids : [];
          for (const tid of tids) allowed.add(`${Number(c.customer_id)}:${Number(tid)}`);
        }
        // template_ids 없는 구응답 대비: 담당자 id만으로 인스턴스 필터
        instanceRows = instanceRows.filter((inst) => {
          const key = `${Number(inst.customer_id)}:${Number(inst.template_id)}`;
          if (allowed.size > 0) return allowed.has(key);
          return Number(inst.assigned_user_id) === myId;
        });
        let total = 0;
        let completed = 0;
        let inProgress = 0;
        let pending = 0;
        let overdue = 0;
        let notApplicable = 0;
        for (const inst of instanceRows) {
          if (inst.status === 'NOT_APPLICABLE') notApplicable += 1;
          else {
            total += 1;
            if (inst.status === 'COMPLETED' || inst.status === 'VERIFIED') completed += 1;
            else if (inst.status === 'IN_PROGRESS') inProgress += 1;
            else pending += 1;
            if (inst.is_overdue) overdue += 1;
          }
        }
        setSummary({
          total,
          completed,
          in_progress: inProgress,
          pending,
          overdue,
          not_applicable: notApplicable,
          completion_rate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
        });
      } else {
        setSummary(data.summary || null);
      }

      setChecklistTemplates(Array.isArray(data.templates) ? data.templates : []);
      setChecklistClients(clientsRows);
      setInstances(instanceRows);
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setChecklistLoading(false);
    }
  }, [board.id, currentUser?.id, currentUser?.role, members, t, tr]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (tab === 0) void loadChecklist(period);
  }, [tab, period, loadChecklist]);

  const instanceMap = useMemo(() => {
    const map = new Map<string, InstanceRow>();
    for (const row of instances) {
      map.set(`${row.customer_id}:${row.template_id}`, row);
    }
    return map;
  }, [instances]);

  const checklistStatusRank = (status?: string | null) => {
    switch (String(status || '')) {
      case 'VERIFIED':
        return 5;
      case 'COMPLETED':
        return 4;
      case 'IN_PROGRESS':
        return 3;
      case 'PENDING':
        return 2;
      case 'NOT_APPLICABLE':
        return 1;
      default:
        return 0;
    }
  };

  const toggleChecklistSort = (key: 'client' | 'assignee' | `template:${number}`) => {
    setChecklistSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  };

  /** 체크리스트 전체 열람: 이 보드 owner(Admin)만. audit은 보드 멤버 역할 따름 */
  const canViewAllChecklist = useMemo(() => {
    if (currentUser?.role === 'root') return true;
    const myId = Number(currentUser?.id || 0);
    if (!myId || !overviewReady) return false;
    const myMember = members.find(
      (m) => Number(m.user?.id || m.user_id) === myId
    );
    return myMember?.role === 'owner';
  }, [currentUser?.id, currentUser?.role, members, overviewReady]);

  const sortedChecklistClients = useMemo(() => {
    const myId = Number(currentUser?.id || 0);
    /** 보드 Admin만 전체. 일반 멤버는 본인 담당만. id 없으면 비움 */
    const scoped = canViewAllChecklist
      ? checklistClients
      : !myId
        ? []
        : checklistClients.filter((c) => Number(c.assignee_user_id) === myId);
    const q = checklistSearchQuery.trim().toLowerCase();
    const filtered = !q
      ? scoped
      : scoped.filter((c) => {
          const assignee = String(
            c.assignee_label ||
              (Array.isArray(c.assignee_names) ? c.assignee_names.join(' ') : '') ||
              ''
          )
            .trim()
            .toLowerCase();
          const clientName = String(c.customer?.name || c.customer_id || '')
            .trim()
            .toLowerCase();
          return assignee.includes(q) || clientName.includes(q);
        });
    const rows = [...filtered];
    const dirMul = checklistSort.dir === 'asc' ? 1 : -1;
    const textCmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

    rows.sort((ra, rb) => {
      const clientA = String(ra.customer?.name || ra.customer_id).trim();
      const clientB = String(rb.customer?.name || rb.customer_id).trim();
      const assigneeA = String(ra.assignee_label || ra.assignee_names?.[0] || '').trim();
      const assigneeB = String(rb.assignee_label || rb.assignee_names?.[0] || '').trim();

      if (checklistSort.key === 'client') {
        const c = textCmp(clientA, clientB) * dirMul;
        if (c !== 0) return c;
        return textCmp(assigneeA, assigneeB);
      }

      if (checklistSort.key === 'assignee') {
        const c = textCmp(assigneeA, assigneeB) * dirMul;
        if (c !== 0) return c;
        return textCmp(clientA, clientB);
      }

      const templateId = Number(String(checklistSort.key).replace('template:', ''));
      const ownedA = !ra.template_ids || ra.template_ids.map(Number).includes(templateId);
      const ownedB = !rb.template_ids || rb.template_ids.map(Number).includes(templateId);
      const statusA = ownedA
        ? instanceMap.get(`${ra.customer_id}:${templateId}`)?.status
        : null;
      const statusB = ownedB
        ? instanceMap.get(`${rb.customer_id}:${templateId}`)?.status
        : null;
      const rankDiff = (checklistStatusRank(statusA) - checklistStatusRank(statusB)) * dirMul;
      if (rankDiff !== 0) return rankDiff;
      const c = textCmp(clientA, clientB);
      if (c !== 0) return c;
      return textCmp(assigneeA, assigneeB);
    });

    return rows;
  }, [
    canViewAllChecklist,
    checklistSearchQuery,
    checklistClients,
    checklistSort,
    currentUser?.id,
    instanceMap,
  ]);

  /** 연속된 동일 담당자 블록마다 0,1,2… → 흰색/회색 교차 */
  const checklistAssigneeBandIndex = useMemo(() => {
    const bands: number[] = [];
    let band = 0;
    let prevKey: string | null = null;
    for (const row of sortedChecklistClients) {
      const key = assigneeBandKey(row);
      if (prevKey !== null && key !== prevKey) band += 1;
      prevKey = key;
      bands.push(band);
    }
    return bands;
  }, [sortedChecklistClients]);

  /** 연속된 동일 고객사 행에 rowSpan 적용 */
  const checklistClientRowSpan = useMemo(() => {
    const spanAt = new Map<number, number>();
    const hideClientCell = new Set<number>();
    let i = 0;
    while (i < sortedChecklistClients.length) {
      const customerId = Number(sortedChecklistClients[i].customer_id);
      let j = i + 1;
      while (
        j < sortedChecklistClients.length &&
        Number(sortedChecklistClients[j].customer_id) === customerId
      ) {
        j += 1;
      }
      spanAt.set(i, j - i);
      for (let k = i + 1; k < j; k += 1) hideClientCell.add(k);
      i = j;
    }
    return { spanAt, hideClientCell };
  }, [sortedChecklistClients]);

  const generatePeriod = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await workBoardService.generateRecurringPeriod(board.id, period);
      if (!res?.success) {
        showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
        return;
      }
      showSuccessToast(
        tr('success.periodGenerated', {
          period: res.data?.period || period,
          created: res.data?.created ?? 0,
          skipped: res.data?.skipped ?? 0,
        })
      );
      await loadChecklist(period);
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setSaving(false);
    }
  };

  const applyInstanceToState = (updated: InstanceRow) => {
    setInstances((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
    setDetailInstance((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
    if (updated.notes !== undefined) setDetailNotes(updated.notes || '');
    if (updated.due_date !== undefined) setDetailDueDate(updated.due_date || '');
    setDetailAssigneeId(updated.assigned_user_id ? String(updated.assigned_user_id) : '');
    setDetailReviewerId(updated.reviewer_user_id ? String(updated.reviewer_user_id) : '');
  };

  const resolveInstanceAssignees = useCallback(
    (instance: InstanceRow) => {
      const fromAssignment = assignmentMap.get(`${instance.customer_id}:${instance.template_id}`);
      const assigned =
        instance.assigned_user_id ||
        fromAssignment?.assigned_user_id ||
        null;
      const reviewer =
        instance.reviewer_user_id ||
        fromAssignment?.reviewer_user_id ||
        null;
      return {
        assigned_user_id: assigned ? Number(assigned) : null,
        reviewer_user_id: reviewer ? Number(reviewer) : null,
        assignee:
          instance.assignee ||
          fromAssignment?.assignee ||
          null,
        reviewer:
          instance.reviewer ||
          fromAssignment?.reviewer ||
          null,
      };
    },
    [assignmentMap]
  );

  const openInstanceDetail = async (instance: InstanceRow) => {
    const resolved = resolveInstanceAssignees(instance);
    const seeded: InstanceRow = { ...instance, ...resolved };
    setDetailInstance(seeded);
    setDetailNotes(seeded.notes || '');
    setDetailDueDate(seeded.due_date || '');
    setDetailAssigneeId(seeded.assigned_user_id ? String(seeded.assigned_user_id) : '');
    setDetailReviewerId(seeded.reviewer_user_id ? String(seeded.reviewer_user_id) : '');
    setDetailLoading(true);
    try {
      const res = await workBoardService.getRecurringInstance(board.id, instance.id);
      if (res?.success && res.data) {
        const remote = res.data as InstanceRow;
        applyInstanceToState({ ...remote, ...resolveInstanceAssignees(remote) });
      }
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setDetailLoading(false);
    }
  };

  const attachmentCountOf = (instance: InstanceRow) =>
    Array.isArray(instance.attachments)
      ? instance.attachments.length
      : Number(instance.attachment_count || 0);

  const statusBlockedReason = (instance: InstanceRow, status: string): string | null => {
    const needsAttachment = Boolean(instance.template?.requires_attachment);
    const needsVerification = Boolean(instance.template?.requires_verification);
    const hasFiles = attachmentCountOf(instance) > 0;
    if (status === 'VERIFIED' && needsVerification && instance.status !== 'COMPLETED' && instance.status !== 'VERIFIED') {
      return tr('statusDialog.needCompleteFirst');
    }
    if ((status === 'COMPLETED' || status === 'VERIFIED') && needsAttachment && !hasFiles) {
      return status === 'VERIFIED' ? tr('statusDialog.needAttachmentVerify') : tr('statusDialog.needAttachmentComplete');
    }
    return null;
  };

  const localizeRecurringError = (data?: { code?: string; message?: string }) => {
    if (data?.code === 'NOT_APPLICABLE_FORBIDDEN') return tr('errors.notApplicableForbidden');
    const message = String(data?.message || '');
    if (
      message === '해당 없음 처리는 소유자만 할 수 있습니다.' ||
      message === '해당 없음 처리는 소유자 또는 담당자만 할 수 있습니다.'
    ) {
      return tr('errors.notApplicableForbidden');
    }
    return message || tr('errors.saveFailed');
  };

  const updateInstanceStatus = async (instance: InstanceRow, status: string) => {
    if (saving) return;
    const blocked = statusBlockedReason(instance, status);
    if (blocked) {
      showWarningPopup(blocked, t('workBoards.title'));
      return;
    }
    setSaving(true);
    try {
      const res = await workBoardService.updateRecurringInstance(board.id, instance.id, { status });
      if (!res?.success) {
        showWarningPopup(localizeRecurringError(res), t('workBoards.title'));
        return;
      }
      applyInstanceToState(res.data as InstanceRow);
      showSuccessToast(tr('success.statusUpdated'));
      await loadChecklist(period);
    } catch (e: any) {
      const data = e?.response?.data;
      if (data?.code || data?.message) showWarningPopup(localizeRecurringError(data), t('workBoards.title'));
      else showErrorPopup(e, t('workBoards.title'));
    } finally {
      setSaving(false);
    }
  };

  const saveInstanceDetail = async () => {
    if (!detailInstance || saving) return;
    setSaving(true);
    try {
      const payload: {
        notes?: string | null;
        due_date?: string | null;
        assigned_user_id?: number | null;
        reviewer_user_id?: number | null;
      } = {
        notes: detailNotes.trim() || null,
      };
      if (canManage) {
        payload.due_date = detailDueDate || null;
        payload.assigned_user_id = detailAssigneeId ? Number(detailAssigneeId) : null;
        payload.reviewer_user_id = detailReviewerId ? Number(detailReviewerId) : null;
      }
      const res = await workBoardService.updateRecurringInstance(board.id, detailInstance.id, payload);
      if (!res?.success) {
        showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
        return;
      }
      applyInstanceToState(res.data as InstanceRow);
      showSuccessToast(tr('success.statusUpdated'));
      await loadChecklist(period);
      setDetailInstance(null);
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setSaving(false);
    }
  };

  const uploadDetailAttachments = async (files: FileList | null) => {
    if (!detailInstance || !files || files.length === 0 || saving) return;
    setSaving(true);
    try {
      const res = await workBoardService.uploadRecurringInstanceAttachments(
        board.id,
        detailInstance.id,
        Array.from(files)
      );
      if (!res?.success) {
        showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
        return;
      }
      applyInstanceToState(res.data as InstanceRow);
      await loadChecklist(period);
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeDetailAttachment = async (storedName: string) => {
    if (!detailInstance || saving) return;
    setSaving(true);
    try {
      const res = await workBoardService.deleteRecurringInstanceAttachment(
        board.id,
        detailInstance.id,
        storedName
      );
      if (!res?.success) {
        showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
        return;
      }
      applyInstanceToState(res.data as InstanceRow);
      await loadChecklist(period);
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setSaving(false);
    }
  };

  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setForm(emptyForm());
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (row: TemplateRow) => {
    setEditingTemplate(row);
    setForm({
      name: row.name || '',
      code: row.code || '',
      category: row.category || '',
      frequency: row.frequency || 'MONTHLY',
      default_priority: row.default_priority || 'medium',
      default_due_day: row.default_due_day != null ? String(row.default_due_day) : '',
      requires_attachment: Boolean(row.requires_attachment),
      requires_verification: Boolean(row.requires_verification),
    });
    setTemplateDialogOpen(true);
  };

  const saveTemplate = async () => {
    const name = form.name.trim();
    if (!name) {
      showErrorPopup(tr('errors.nameRequired'), t('workBoards.title'));
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        name,
        code: form.code.trim() || null,
        category: form.category.trim() || null,
        frequency: form.frequency,
        default_priority: form.default_priority,
        default_due_day: form.default_due_day ? Number(form.default_due_day) : null,
        requires_attachment: form.requires_attachment,
        requires_verification: form.requires_verification,
      };
      if (editingTemplate) {
        const res = await workBoardService.updateRecurringTemplate(board.id, editingTemplate.id, payload);
        if (!res?.success) {
          showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
          return;
        }
        setTemplates((prev) =>
          prev.map((r) => (r.id === editingTemplate.id ? { ...r, ...res.data } : r))
        );
        showSuccessToast(tr('success.templateUpdated'));
      } else {
        const res = await workBoardService.createRecurringTemplate(board.id, payload);
        if (!res?.success) {
          showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
          return;
        }
        setTemplates((prev) => [...prev, res.data]);
        showSuccessToast(tr('success.templateCreated'));
      }
      setTemplateDialogOpen(false);
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteTemplate = (row: TemplateRow) => {
    showConfirm(
      tr('dialog.deleteTemplateMsg', { name: row.name }),
      async () => {
        if (saving) return;
        setSaving(true);
        try {
          const res = await workBoardService.deleteRecurringTemplate(board.id, row.id);
          if (!res?.success) {
            showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
            return;
          }
          setTemplates((prev) => prev.filter((r) => r.id !== row.id));
          setAssignments((prev) => prev.filter((a) => a.template_id !== row.id));
          showSuccessToast(tr('success.templateDeleted'));
        } catch (e) {
          showErrorPopup(e, t('workBoards.title'));
        } finally {
          setSaving(false);
        }
      },
      {
        title: tr('dialog.deleteTemplateTitle'),
        confirmColor: 'error',
      }
    );
  };

  const seedSamples = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await workBoardService.seedRecurringSampleTemplates(board.id);
      if (!res?.success) {
        showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
        return;
      }
      const created = Array.isArray(res.data) ? res.data : [];
      if (created.length > 0) {
        setTemplates((prev) => {
          const codes = new Set(prev.map((p) => String(p.code || '').toUpperCase()).filter(Boolean));
          const next = [...prev];
          for (const row of created) {
            const code = String(row.code || '').toUpperCase();
            if (code && codes.has(code)) continue;
            next.push(row);
          }
          return next;
        });
      }
      showSuccessToast(tr('success.samplesSeeded', { count: created.length }));
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setSaving(false);
    }
  };

  const openClientDialog = async () => {
    setSelectedCustomers([]);
    setClientDialogOpen(true);
    setCustomersLoading(true);
    try {
      const params = companyId ? { company_id: companyId } : undefined;
      const linkedIds = new Set(clients.map((c) => Number(c.customer_id)));
      const linkedNames = new Set<string>();
      const linkedBiz = new Set<string>();
      for (const row of clients) {
        const nameKey = normalizeClientKey(row.customer?.name);
        const bizKey = normalizeClientKey(row.customer?.business_number);
        if (nameKey) linkedNames.add(nameKey);
        if (bizKey) linkedBiz.add(bizKey);
      }

      const [partnerRes, customerRes] = await Promise.all([
        partnerService.getPartners(companyId).catch(() => ({ data: [] })),
        api.get('/customers', { params }).catch(() => ({ data: { data: [] } })),
      ]);

      const partnersRaw = Array.isArray(partnerRes?.data)
        ? partnerRes.data
        : Array.isArray(partnerRes)
          ? partnerRes
          : [];
      const customersRaw = Array.isArray(customerRes?.data?.data)
        ? customerRes.data.data
        : Array.isArray(customerRes?.data)
          ? customerRes.data
          : [];

      const partnerRows: CustomerOption[] = partnersRaw
        .map((p: any) => ({
          id: Number(p.id),
          name: String(p.company_name || p.name || '').trim(),
          business_number: p.business_number || null,
          source: 'partner' as const,
        }))
        .filter((p: CustomerOption) => {
          if (!Number.isInteger(p.id) || p.id <= 0 || !p.name) return false;
          const nameKey = normalizeClientKey(p.name);
          const bizKey = normalizeClientKey(p.business_number);
          if (nameKey && linkedNames.has(nameKey)) return false;
          if (bizKey && linkedBiz.has(bizKey)) return false;
          return true;
        });

      const partnerNameKeys = new Set(
        partnerRows.map((p) => normalizeClientKey(p.name)).filter(Boolean)
      );
      const partnerBizKeys = new Set(
        partnerRows
          .map((p) => normalizeClientKey(p.business_number))
          .filter(Boolean)
      );

      const customerRows: CustomerOption[] = customersRaw
        .filter((c: any) => {
          if (c?.source_type && c.source_type !== 'customer') return false;
          if (typeof c?.id === 'number' && c.id >= 1000000000) return false;
          if (linkedIds.has(Number(c.id))) return false;
          return true;
        })
        .map((c: any) => ({
          id: Number(c.id),
          name: String(c.name || '').trim(),
          business_number: c.business_number || null,
          source: 'customer' as const,
        }))
        .filter((c: CustomerOption) => {
          if (!c.id || !c.name) return false;
          const nameKey = normalizeClientKey(c.name);
          const bizKey = normalizeClientKey(c.business_number);
          if (nameKey && linkedNames.has(nameKey)) return false;
          if (bizKey && linkedBiz.has(bizKey)) return false;
          // 파트너와 동일 업체면 파트너 행만 표시
          if (nameKey && partnerNameKeys.has(nameKey)) return false;
          if (bizKey && partnerBizKeys.has(bizKey)) return false;
          return true;
        });

      const merged = [...partnerRows, ...customerRows].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setCustomerOptions(merged);
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
      setCustomerOptions([]);
    } finally {
      setCustomersLoading(false);
    }
  };

  const saveClients = async () => {
    if (selectedCustomers.length === 0) {
      showErrorPopup(tr('errors.clientsRequired'), t('workBoards.title'));
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const partnerIds = selectedCustomers
        .filter((c) => c.source === 'partner')
        .map((c) => c.id);
      const customerIds = selectedCustomers
        .filter((c) => c.source !== 'partner')
        .map((c) => c.id);
      const res = await workBoardService.addRecurringClients(board.id, customerIds, partnerIds);
      if (!res?.success) {
        showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
        return;
      }
      const added = Array.isArray(res.data) ? res.data : [];
      setClients((prev) => {
        const ids = new Set(prev.map((p) => Number(p.customer_id)));
        const next = [...prev];
        for (const row of added) {
          if (ids.has(Number(row.customer_id))) continue;
          next.push(row);
        }
        return next;
      });
      setClientDialogOpen(false);
      showSuccessToast(tr('success.clientsAdded'));
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setSaving(false);
    }
  };

  const openInviteDialog = async () => {
    setInviteSelected([]);
    setInviteOpen(true);
    setInviteLoading(true);
    try {
      const boardCompanyId = companyId != null && companyId > 0 ? Number(companyId) : NaN;
      if (!Number.isInteger(boardCompanyId) || boardCompanyId <= 0) {
        setInviteCandidates([]);
        return;
      }
      const role = String(currentUser?.role || '');
      const fetchParams =
        (role === 'root' || role === 'audit') && boardCompanyId > 0
          ? { company_id: boardCompanyId }
          : undefined;
      const allUsers = await useReferenceDataStore.getState().fetchUsers(fetchParams);
      const memberIds = new Set(memberOptions.map((m) => m.id));
      const companyUsers = filterActiveCompanyUsers(allUsers, {
        companyId: boardCompanyId,
        tenantId: currentUser?.tenant_id != null ? Number(currentUser.tenant_id) : null,
      });
      const options = companyUsers
        .map((u: any) => {
          const id = Number(u.id);
          const label = String(u.username || u.userid || u.email || id).trim();
          return { id, label: label || String(id) };
        })
        .filter((u: { id: number; label: string }) => Number.isInteger(u.id) && u.id > 0 && !memberIds.has(u.id));
      setInviteCandidates(options);
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
      setInviteCandidates([]);
    } finally {
      setInviteLoading(false);
    }
  };

  const inviteMembers = async () => {
    if (inviteSelected.length === 0 || saving) return;
    setSaving(true);
    try {
      const settled = await Promise.allSettled(
        inviteSelected.map((u) => workBoardService.inviteMember(board.id, u.id))
      );
      let ok = 0;
      for (const entry of settled) {
        if (entry.status === 'fulfilled' && entry.value?.success) ok += 1;
      }
      if (ok === 0) {
        showErrorPopup(tr('invite.failed'), t('workBoards.title'));
        return;
      }
      showSuccessToast(tr('invite.success'));
      setInviteOpen(false);
      setInviteSelected([]);
      await loadOverview();
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setSaving(false);
    }
  };

  const openMemberMenu = (
    event: React.MouseEvent<HTMLElement>,
    member: { id: number; name: string; role: 'owner' | 'member'; avatarSrc?: string }
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setMemberMenuAnchor(event.currentTarget);
    setMemberMenuTarget(member);
  };

  const closeMemberMenu = () => {
    setMemberMenuAnchor(null);
    setMemberMenuTarget(null);
  };

  const viewMemberPhoto = () => {
    if (!memberMenuTarget) return;
    const { avatarSrc, name } = memberMenuTarget;
    closeMemberMenu();
    if (avatarSrc) {
      photoPreview?.openPhotoPreview(avatarSrc, name);
    } else {
      showErrorPopup(tr('memberMenu.noPhoto'), tr('memberMenu.viewPhoto'));
    }
  };

  const ownerCount = useMemo(
    () => members.filter((m) => m.role === 'owner').length,
    [members]
  );

  /** 보드 생성자(최초 관리자) 또는 root만 다른 Admin 해제 가능 */
  const isInitialAdmin = useMemo(() => {
    if (currentUser?.role === 'root') return true;
    const myId = Number(currentUser?.id || 0);
    return Boolean(myId && boardCreatedById && myId === boardCreatedById);
  }, [boardCreatedById, currentUser?.id, currentUser?.role]);

  const setMemberAsAdmin = async () => {
    if (!memberMenuTarget || memberRoleSaving) return;
    if (!canManage) {
      showWarningPopup(tr('hints.manageOnly'), t('workBoards.title'));
      closeMemberMenu();
      return;
    }
    if (memberMenuTarget.role === 'owner') {
      closeMemberMenu();
      return;
    }
    const targetId = memberMenuTarget.id;
    const targetName = memberMenuTarget.name;
    closeMemberMenu();
    setMemberRoleSaving(true);
    try {
      const res = await workBoardService.updateMemberRole(board.id, targetId, 'owner');
      if (!res?.success) {
        showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
        return;
      }
      const updated = res.data;
      setMembers((prev) =>
        prev.map((m) => {
          const uid = Number(m.user?.id || m.user_id);
          if (uid !== targetId) return m;
          return {
            ...m,
            role: 'owner',
            user: updated?.user ? { ...m.user, ...updated.user } : m.user,
          };
        })
      );
      showSuccessToast(tr('success.memberSetAdmin', { name: targetName }));
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setMemberRoleSaving(false);
    }
  };

  const removeMemberAdmin = async () => {
    if (!memberMenuTarget || memberRoleSaving) return;
    if (!canManage || !isInitialAdmin) {
      showWarningPopup(tr('hints.manageOnly'), t('workBoards.title'));
      closeMemberMenu();
      return;
    }
    if (memberMenuTarget.role !== 'owner') {
      closeMemberMenu();
      return;
    }
    if (ownerCount <= 1) {
      showWarningPopup(tr('memberMenu.lastAdmin'), t('workBoards.title'));
      closeMemberMenu();
      return;
    }
    const targetId = memberMenuTarget.id;
    const targetName = memberMenuTarget.name;
    closeMemberMenu();
    setMemberRoleSaving(true);
    try {
      const res = await workBoardService.updateMemberRole(board.id, targetId, 'member');
      if (!res?.success) {
        showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
        return;
      }
      const updated = res.data;
      setMembers((prev) =>
        prev.map((m) => {
          const uid = Number(m.user?.id || m.user_id);
          if (uid !== targetId) return m;
          return {
            ...m,
            role: 'member',
            user: updated?.user ? { ...m.user, ...updated.user } : m.user,
          };
        })
      );
      showSuccessToast(tr('success.memberRemoveAdmin', { name: targetName }));
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setMemberRoleSaving(false);
    }
  };

  const removeFromBoard = () => {
    if (!memberMenuTarget || memberRoleSaving) return;
    const myId = Number(currentUser?.id || 0);
    const targetId = memberMenuTarget.id;
    const targetName = memberMenuTarget.name;
    const isSelf = myId > 0 && targetId === myId;
    const canRemove = canManage || isSelf;
    if (!canRemove) {
      showWarningPopup(tr('hints.manageOnly'), t('workBoards.title'));
      closeMemberMenu();
      return;
    }
    if (memberMenuTarget.role === 'owner' && ownerCount <= 1) {
      showWarningPopup(tr('memberMenu.lastAdminCannotRemove'), t('workBoards.title'));
      closeMemberMenu();
      return;
    }
    closeMemberMenu();
    showConfirm(
      tr('dialog.removeMemberMsg', { name: targetName }),
      () => {
        void (async () => {
          if (memberRoleSaving) return;
          setMemberRoleSaving(true);
          try {
            const res = await workBoardService.removeMember(board.id, targetId);
            if (!res?.success) {
              showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
              return;
            }
            setMembers((prev) =>
              prev.filter((m) => Number(m.user?.id || m.user_id) !== targetId)
            );
            showSuccessToast(tr('success.memberRemoved', { name: targetName }));
            if (isSelf) {
              navigate('/work/projects', { replace: true });
            }
          } catch (e) {
            showErrorPopup(e, t('workBoards.title'));
          } finally {
            setMemberRoleSaving(false);
          }
        })();
      },
      {
        title: tr('dialog.removeMemberTitle'),
        confirmColor: 'error',
        messageTone: 'danger',
      }
    );
  };

  const confirmRemoveClient = (row: ClientRow) => {
    const name = row.customer?.name || String(row.customer_id);
    showConfirm(
      tr('dialog.removeClientMsg', { name }),
      async () => {
        if (saving) return;
        setSaving(true);
        try {
          const res = await workBoardService.removeRecurringClient(board.id, row.customer_id);
          if (!res?.success) {
            showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
            return;
          }
          setClients((prev) => prev.filter((c) => c.customer_id !== row.customer_id));
          setChecklistClients((prev) => prev.filter((c) => c.customer_id !== row.customer_id));
          setAssignments((prev) => prev.filter((a) => a.customer_id !== row.customer_id));
          setInstances((prev) => prev.filter((i) => i.customer_id !== row.customer_id));
          showSuccessToast(tr('success.clientRemoved'));
        } catch (e) {
          showErrorPopup(e, t('workBoards.title'));
        } finally {
          setSaving(false);
        }
      },
      {
        title: tr('dialog.removeClientTitle'),
        confirmColor: 'error',
      }
    );
  };

  const saveAssignment = async (
    customerId: number,
    templateId: number,
    patch: { assigned_user_id?: number | null; reviewer_user_id?: number | null }
  ) => {
    if (saving) return;
    setSaving(true);
    try {
      const existing = assignmentMap.get(`${customerId}:${templateId}`);
      const body = {
        customer_id: customerId,
        template_id: templateId,
        assigned_user_id:
          patch.assigned_user_id !== undefined
            ? patch.assigned_user_id
            : existing?.assigned_user_id ?? null,
        reviewer_user_id:
          patch.reviewer_user_id !== undefined
            ? patch.reviewer_user_id
            : existing?.reviewer_user_id ?? null,
        is_active: true,
      };
      const res = await workBoardService.upsertRecurringAssignment(board.id, body);
      if (!res?.success) {
        showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
        return;
      }
      const row = res.data as AssignmentRow | null;
      setAssignments((prev) => {
        const without = prev.filter(
          (a) => !(a.customer_id === customerId && a.template_id === templateId)
        );
        return row ? [...without, row] : without;
      });
      /** 배정 변경 후 체크리스트 인스턴스 담당도 즉시 맞춤 */
      setInstances((prev) =>
        prev.map((inst) => {
          if (inst.customer_id !== customerId || inst.template_id !== templateId) return inst;
          return {
            ...inst,
            assigned_user_id: body.assigned_user_id ?? null,
            reviewer_user_id: body.reviewer_user_id ?? null,
            assignee: row?.assignee ?? inst.assignee,
            reviewer: row?.reviewer ?? inst.reviewer,
          };
        })
      );
      showSuccessToast(tr('success.assignmentSaved'));
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setSaving(false);
    }
  };

  const summarizeRoleIds = (ids: Array<number | null | undefined>) => {
    const defined = ids.filter((id): id is number => id != null && Number(id) > 0).map(Number);
    const unique = Array.from(new Set(defined));
    const allSame = ids.length > 0 && ids.every((id) => id === ids[0]);
    const primaryId =
      allSame && ids[0] != null && Number(ids[0]) > 0
        ? String(ids[0])
        : unique.length === 1
          ? String(unique[0])
          : '';
    return {
      primaryId,
      mixed: unique.length > 1,
      count: defined.length,
      uniqueCount: unique.length,
    };
  };

  const clientAssignRows = useMemo(() => {
    return clients.map((client) => {
      const assigneeIds = templates.map(
        (tpl) => assignmentMap.get(`${client.customer_id}:${tpl.id}`)?.assigned_user_id ?? null
      );
      const reviewerIds = templates.map(
        (tpl) => assignmentMap.get(`${client.customer_id}:${tpl.id}`)?.reviewer_user_id ?? null
      );
      const assignee = summarizeRoleIds(assigneeIds);
      const reviewer = summarizeRoleIds(reviewerIds);
      return {
        client,
        primaryAssigneeId: assignee.primaryId,
        assigneeMixed: assignee.mixed,
        assigneeUniqueCount: assignee.uniqueCount,
        primaryReviewerId: reviewer.primaryId,
        reviewerMixed: reviewer.mixed,
        assignedCount: assignee.count,
        totalTemplates: templates.length,
      };
    });
  }, [clients, templates, assignmentMap]);

  const toggleAssignSort = (key: 'client' | 'assignee' | 'reviewer' | 'progress') => {
    setAssignSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
  };

  const memberLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of memberOptions) map.set(String(m.id), m.label);
    return map;
  }, [memberOptions]);

  const sortedClientAssignRows = useMemo(() => {
    const rows = [...clientAssignRows];
    const dirMul = assignSort.dir === 'asc' ? 1 : -1;
    const textCmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    const roleLabel = (
      primaryId: string,
      mixed: boolean,
      uniqueCount: number,
      mixedKey: 'multipleByTask' | 'mixed'
    ) => {
      if (mixed) {
        return mixedKey === 'multipleByTask'
          ? tr('bulkAssign.multipleByTask', { count: uniqueCount })
          : tr('bulkAssign.mixed');
      }
      if (!primaryId) return tr('fields.none');
      return memberLabelById.get(primaryId) || primaryId;
    };

    rows.sort((ra, rb) => {
      const clientA = String(ra.client.customer?.name || ra.client.customer_id || '').trim();
      const clientB = String(rb.client.customer?.name || rb.client.customer_id || '').trim();
      if (assignSort.key === 'client') {
        const c = textCmp(clientA, clientB) * dirMul;
        return c !== 0 ? c : ra.client.id - rb.client.id;
      }
      if (assignSort.key === 'assignee') {
        const a = roleLabel(
          ra.primaryAssigneeId,
          ra.assigneeMixed,
          ra.assigneeUniqueCount,
          'multipleByTask'
        );
        const b = roleLabel(
          rb.primaryAssigneeId,
          rb.assigneeMixed,
          rb.assigneeUniqueCount,
          'multipleByTask'
        );
        const c = textCmp(a, b) * dirMul;
        return c !== 0 ? c : textCmp(clientA, clientB);
      }
      if (assignSort.key === 'reviewer') {
        const a = roleLabel(ra.primaryReviewerId, ra.reviewerMixed, 0, 'mixed');
        const b = roleLabel(rb.primaryReviewerId, rb.reviewerMixed, 0, 'mixed');
        const c = textCmp(a, b) * dirMul;
        return c !== 0 ? c : textCmp(clientA, clientB);
      }
      const progressA =
        ra.totalTemplates > 0 ? ra.assignedCount / ra.totalTemplates : 0;
      const progressB =
        rb.totalTemplates > 0 ? rb.assignedCount / rb.totalTemplates : 0;
      const c = (progressA - progressB) * dirMul;
      if (c !== 0) return c;
      const byCount = (ra.assignedCount - rb.assignedCount) * dirMul;
      return byCount !== 0 ? byCount : textCmp(clientA, clientB);
    });
    return rows;
  }, [assignSort, clientAssignRows, memberLabelById, tr]);

  const mergeAssignmentResults = (rows: AssignmentRow[]) => {
    setAssignments((prev) => {
      const map = new Map(prev.map((a) => [`${a.customer_id}:${a.template_id}`, a]));
      for (const row of rows) {
        map.set(`${row.customer_id}:${row.template_id}`, row);
      }
      return Array.from(map.values());
    });
    setInstances((prev) =>
      prev.map((inst) => {
        const hit = rows.find(
          (r) => r.customer_id === inst.customer_id && r.template_id === inst.template_id
        );
        if (!hit) return inst;
        return {
          ...inst,
          assigned_user_id: hit.assigned_user_id ?? null,
          reviewer_user_id: hit.reviewer_user_id ?? inst.reviewer_user_id ?? null,
          assignee: hit.assignee ?? inst.assignee,
          reviewer: hit.reviewer ?? inst.reviewer,
        };
      })
    );
  };

  const applyClientRole = async (
    customerId: number,
    patch: { assigned_user_id?: number | null; reviewer_user_id?: number | null }
  ) => {
    if (saving || !canManage) return;
    if (templates.length === 0) return;
    const items = templates.map((tpl) => ({
      customer_id: customerId,
      template_id: Number(tpl.id),
    }));
    const setAssignee = Object.prototype.hasOwnProperty.call(patch, 'assigned_user_id');
    const setReviewer = Object.prototype.hasOwnProperty.call(patch, 'reviewer_user_id');
    setSaving(true);
    try {
      const res = await workBoardService.bulkUpsertRecurringAssignments(board.id, {
        items,
        set_assignee: setAssignee,
        assigned_user_id: setAssignee ? patch.assigned_user_id ?? null : undefined,
        set_reviewer: setReviewer,
        reviewer_user_id: setReviewer ? patch.reviewer_user_id ?? null : undefined,
      });
      if (!res?.success) {
        showErrorPopup(res?.message || tr('errors.saveFailed'), t('workBoards.title'));
        return;
      }
      const rows = Array.isArray(res.data) ? (res.data as AssignmentRow[]) : [];
      mergeAssignmentResults(rows);
      showSuccessToast(tr('success.assignmentBulkSaved', { count: rows.length }));
    } catch (e) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setSaving(false);
    }
  };

  const emptyBox = (message: string) => (
    <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );

  const assignSelectSx = {
    ...mvsSearchFieldSx,
    ...mvsFilterFieldHeightSx,
    width: '100%',
    m: 0,
    '& .MuiOutlinedInput-root': {
      height: 32,
      minHeight: 32,
      fontSize: '0.8125rem',
      borderRadius: '8px',
      bgcolor: '#FFFFFF',
      '& .MuiSelect-select': {
        py: 0,
        px: 1.25,
        display: 'flex',
        alignItems: 'center',
      },
    },
  };

  const assignTableBodySx = {
    ...mvsTableBodyRowSx,
    '& .MuiTableCell-body': {
      py: 0.75,
      px: 1.5,
      fontSize: '0.8125rem',
      borderBottom: '1px solid #E2E8F0',
      verticalAlign: 'middle',
    },
  };

  return (
    <Box sx={{ ...mvsPageRootFullBleedSx, flex: 1, border: 'none', overflow: 'visible' }}>
      <DaeheungPageHeader
        title={board.name || t('workBoards.boardTypes.recurring')}
        description={t('workBoards.boardTypes.recurring')}
        iconPath="/work/projects"
        backTo="/work/projects"
        actions={
          <Button
            variant="contained"
            startIcon={<PersonAddIcon sx={{ fontSize: 18 }} />}
            disabled={!canManage || saving}
            onClick={() => void openInviteDialog()}
            sx={mvsBodyPrimaryBtnSx}
          >
            {tr('actions.inviteMembers')}
          </Button>
        }
      />

      {!canManage ? (
        <Typography sx={{ mb: 1.5, fontSize: '0.8125rem', color: 'text.secondary' }}>
          {tr('hints.manageOnly')}
        </Typography>
      ) : null}

      <Box
        sx={{
          ...mvsBodyCardSx,
          mb: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pr: { xs: 1, sm: 1.5 },
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ ...mvsMainTabsSx, flex: 1, minWidth: 0, pr: 0 }}
        >
          <Tab label={tr('tabs.checklist')} />
          <Tab label={`${tr('tabs.templates')} (${templates.length})`} />
          <Tab label={`${tr('tabs.clients')} (${clients.length})`} />
          <Tab label={tr('tabs.assignments')} />
        </Tabs>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 0.75,
            flexShrink: 0,
            py: 0.5,
          }}
        >
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', mr: 0.25 }}>
            {tr('hints.membersCount', { count: memberDisplayList.length })}
          </Typography>
          {memberDisplayList.length === 0 ? (
            <Typography sx={{ fontSize: '0.75rem', color: '#94A3B8' }}>—</Typography>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {memberDisplayList.map((m, index) => {
                const menuOpen =
                  Boolean(memberMenuAnchor) && Number(memberMenuTarget?.id) === m.id;
                const roleLabel =
                  m.role === 'owner' ? tr('roles.admin') : tr('roles.member');
                return (
                  <Tooltip
                    key={m.id}
                    title={`${m.name} · ${roleLabel}`}
                    arrow
                    placement="top"
                    disableHoverListener={menuOpen}
                  >
                    <Avatar
                      component="button"
                      type="button"
                      data-no-photo-preview
                      src={m.avatarSrc}
                      alt={m.name}
                      aria-label={`${m.name}, ${roleLabel}`}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      onClick={(e) => openMemberMenu(e, m)}
                      sx={{
                        width: 28,
                        height: 28,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        p: 0,
                        border: menuOpen ? '2px solid #2563EB' : '2px solid #FFFFFF',
                        boxSizing: 'border-box',
                        ml: index === 0 ? 0 : '-8px',
                        zIndex: menuOpen ? memberDisplayList.length + 2 : index + 1,
                        cursor: 'pointer',
                        bgcolor: m.avatarSrc
                          ? 'transparent'
                          : m.role === 'owner'
                            ? theme.palette.primary.main
                            : memberAvatarColor(m.id),
                        color: '#FFFFFF',
                        boxShadow:
                          m.role === 'owner' ? '0 0 0 1px rgba(37, 99, 235, 0.35)' : undefined,
                        '&:hover': {
                          zIndex: memberDisplayList.length + 1,
                          boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.35)',
                        },
                        '& img': { cursor: 'pointer' },
                      }}
                    >
                      {m.initial}
                    </Avatar>
                  </Tooltip>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={mvsBodyListZoneSx}>
        <Box sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
          {tab === 0 && (
            <Box sx={{ ...mvsBodyToolbarSx, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                <TextField
                  type="month"
                  size="small"
                  label={tr('checklist.period')}
                  value={period}
                  onChange={(e) => {
                    const next = String(e.target.value || '').trim();
                    if (/^\d{4}-\d{2}$/.test(next)) setPeriod(next);
                  }}
                  {...mvsOutlinedLabelProps}
                  sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx, width: { xs: '100%', sm: 180 } }}
                />
                <TextField
                  size="small"
                  label={tr('checklist.search')}
                  placeholder={tr('checklist.searchPlaceholder')}
                  value={checklistSearchQuery}
                  onChange={(e) => setChecklistSearchQuery(e.target.value)}
                  {...mvsOutlinedLabelProps}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 18, color: '#64748B' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    ...mvsSearchFieldSx,
                    ...mvsFilterFieldHeightSx,
                    width: { xs: '100%', sm: 260 },
                  }}
                />
                <Button
                  variant="contained"
                  startIcon={<GenerateIcon sx={{ fontSize: 18 }} />}
                  disabled={!canManage || saving || clients.length === 0 || templates.length === 0}
                  onClick={() => void generatePeriod()}
                  sx={mvsBodyPrimaryBtnSx}
                >
                  {tr('actions.generatePeriod')}
                </Button>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 0.75,
                  flexShrink: 0,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    color: '#64748B',
                    textAlign: 'right',
                    lineHeight: 1.4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tr('checklist.purposeHint')}
                </Typography>
                {summary ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>
                      {tr('checklist.summaryTotal')} {summary.total}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>
                      {tr('checklist.summaryCompleted')} {summary.completed}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>
                      {tr('checklist.summaryInProgress')} {summary.in_progress}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748B' }}>
                      {tr('checklist.summaryPending')} {summary.pending}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: summary.overdue ? '#DC2626' : '#64748B' }}>
                      {tr('checklist.summaryOverdue')} {summary.overdue}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A' }}>
                      {tr('checklist.summaryRate')} {summary.completion_rate}%
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            </Box>
          )}

          {tab === 1 && (
            <Box sx={mvsBodyToolbarSx}>
              <Button
                variant="contained"
                startIcon={<AddIcon sx={{ fontSize: 18 }} />}
                disabled={!canManage || saving}
                onClick={openCreateTemplate}
                sx={mvsBodyPrimaryBtnSx}
              >
                {tr('actions.addTemplate')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<LibraryAddIcon sx={{ fontSize: 18 }} />}
                disabled={!canManage || saving}
                onClick={() => void seedSamples()}
                sx={mvsBodyOutlinedBtnSx}
              >
                {tr('actions.seedSamples')}
              </Button>
            </Box>
          )}

          {tab === 2 && (
            <Box sx={mvsBodyToolbarSx}>
              <Button
                variant="contained"
                startIcon={<AddIcon sx={{ fontSize: 18 }} />}
                disabled={!canManage || saving}
                onClick={() => void openClientDialog()}
                sx={mvsBodyPrimaryBtnSx}
              >
                {tr('actions.addClients')}
              </Button>
            </Box>
          )}

          {tab === 3 && (
            <Box sx={{ ...mvsBodyToolbarSx, alignItems: 'center' }}>
              <Typography
                sx={{
                  fontSize: '0.8125rem',
                  color: '#64748B',
                  whiteSpace: 'nowrap',
                }}
              >
                {tr('hints.assignmentHelp')}
              </Typography>
            </Box>
          )}

          {loading || (tab === 0 && checklistLoading) ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <>
              {tab === 0 &&
                (clients.length === 0 || templates.length === 0 ? (
                  emptyBox(tr('checklist.needSetup'))
                ) : sortedChecklistClients.length === 0 ? (
                  emptyBox(
                    checklistSearchQuery.trim()
                      ? tr('checklist.searchNoResults')
                      : tr('checklist.needAssignees')
                  )
                ) : instances.length === 0 ? (
                  <Box sx={{ px: 2.5, py: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {tr('checklist.empty')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {tr('checklist.generateHelp')}
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer>
                    <Table size="small" sx={{ ...tableSx, minWidth: 720 }}>
                      <TableHead sx={mvsTableHeadHighlightSx}>
                        <TableRow>
                          <TableCell
                            sortDirection={
                              checklistSort.key === 'client' ? checklistSort.dir : false
                            }
                            sx={{
                              minWidth: 160,
                              maxWidth: 220,
                              position: 'sticky',
                              left: 0,
                              zIndex: 3,
                            }}
                          >
                            <TableSortLabel
                              active={checklistSort.key === 'client'}
                              direction={
                                checklistSort.key === 'client' ? checklistSort.dir : 'asc'
                              }
                              onClick={() => toggleChecklistSort('client')}
                            >
                              {tr('fields.client')}
                            </TableSortLabel>
                          </TableCell>
                          <TableCell
                            sortDirection={
                              checklistSort.key === 'assignee' ? checklistSort.dir : false
                            }
                            sx={{
                              minWidth: 100,
                              maxWidth: 140,
                              position: 'sticky',
                              left: 160,
                              zIndex: 3,
                            }}
                          >
                            <TableSortLabel
                              active={checklistSort.key === 'assignee'}
                              direction={
                                checklistSort.key === 'assignee' ? checklistSort.dir : 'asc'
                              }
                              onClick={() => toggleChecklistSort('assignee')}
                            >
                              {tr('fields.assignee')}
                            </TableSortLabel>
                          </TableCell>
                          {checklistTemplates.map((tpl) => {
                            const sortKey = `template:${tpl.id}` as const;
                            return (
                              <TableCell
                                key={tpl.id}
                                sortDirection={
                                  checklistSort.key === sortKey ? checklistSort.dir : false
                                }
                                sx={{ minWidth: 110 }}
                                title={tpl.name}
                              >
                                <TableSortLabel
                                  active={checklistSort.key === sortKey}
                                  direction={
                                    checklistSort.key === sortKey ? checklistSort.dir : 'asc'
                                  }
                                  onClick={() => toggleChecklistSort(sortKey)}
                                >
                                  {tpl.name}
                                </TableSortLabel>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      </TableHead>
                      <TableBody
                        sx={
                          {
                            ...(typeof mvsTableBodyRowSx === 'function'
                              ? {}
                              : mvsTableBodyRowSx),
                            '& .MuiTableCell-body': {
                              py: 1.1,
                              px: 1.5,
                              fontSize: '0.75rem',
                              borderBottom: '1px solid #E2E8F0',
                            },
                            '& .MuiTableRow-root': { bgcolor: 'transparent' },
                            '& .MuiTableRow-root:hover': { bgcolor: 'transparent' },
                            '& .MuiTableRow-root:last-of-type .MuiTableCell-body': {
                              borderBottom: 'none',
                            },
                          } as const
                        }
                      >
                        {sortedChecklistClients.map((client, rowIndex) => {
                          const clientName = client.customer?.name || String(client.customer_id);
                          const assigneeLabel =
                            client.assignee_label ||
                            (Array.isArray(client.assignee_names)
                              ? client.assignee_names.join(', ')
                              : '');
                          const ownedTemplateIds = Array.isArray(client.template_ids)
                            ? new Set(client.template_ids.map(Number))
                            : null;
                          const rowKey =
                            client.row_key ||
                            `${client.customer_id}:${client.assignee_user_id || client.id}`;
                          const showClientCell = !checklistClientRowSpan.hideClientCell.has(rowIndex);
                          const clientSpan = checklistClientRowSpan.spanAt.get(rowIndex) || 1;
                          const rowBg = assigneeBandBg(
                            checklistAssigneeBandIndex[rowIndex] ?? 0
                          );
                          const isAccentBand = rowBg === ASSIGNEE_BAND_ACCENT;
                          const rowLine = isAccentBand ? '#FFFFFF' : '#E2E8F0';
                          const cellBgSx = {
                            bgcolor: `${rowBg} !important`,
                            backgroundColor: `${rowBg} !important`,
                            borderBottom: `1px solid ${rowLine} !important`,
                          };
                          return (
                            <TableRow
                              key={rowKey}
                              hover
                              data-assignee-band={checklistAssigneeBandIndex[rowIndex] ?? 0}
                              sx={{
                                bgcolor: `${rowBg} !important`,
                                '& > .MuiTableCell-root': cellBgSx,
                                '&:hover > .MuiTableCell-root': {
                                  ...cellBgSx,
                                  filter: 'brightness(0.97)',
                                },
                              }}
                            >
                              {showClientCell ? (
                                <TableCell
                                  rowSpan={clientSpan}
                                  sx={{
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 1,
                                    ...cellBgSx,
                                    fontWeight: 600,
                                    maxWidth: 220,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    verticalAlign: 'middle',
                                  }}
                                  title={clientName}
                                >
                                  {clientName}
                                </TableCell>
                              ) : null}
                              <TableCell
                                sx={{
                                  position: 'sticky',
                                  left: 160,
                                  zIndex: 1,
                                  ...cellBgSx,
                                  maxWidth: 140,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  color: assigneeLabel ? 'text.primary' : 'text.disabled',
                                  fontSize: '0.75rem',
                                }}
                                title={assigneeLabel || tr('fields.none')}
                              >
                                {assigneeLabel || tr('fields.none')}
                              </TableCell>
                              {checklistTemplates.map((tpl) => {
                                const owned =
                                  !ownedTemplateIds || ownedTemplateIds.has(Number(tpl.id));
                                if (!owned) {
                                  return (
                                    <TableCell
                                      key={tpl.id}
                                      sx={{
                                        ...cellBgSx,
                                        color: 'text.disabled',
                                        opacity: 0.72,
                                      }}
                                    >
                                      {tr('checklist.cellEmpty')}
                                    </TableCell>
                                  );
                                }
                                const cell = instanceMap.get(`${client.customer_id}:${tpl.id}`);
                                const cellAssignee =
                                  cell?.assignee?.username ||
                                  cell?.assignee?.userid ||
                                  client.assignee_by_template?.[String(tpl.id)]?.username ||
                                  assigneeLabel ||
                                  '';
                                if (!cell) {
                                  return (
                                    <TableCell
                                      key={tpl.id}
                                      sx={{
                                        ...cellBgSx,
                                        color: 'text.disabled',
                                      }}
                                    >
                                      {tr('checklist.cellEmpty')}
                                    </TableCell>
                                  );
                                }
                                const isDone =
                                  cell.status === 'COMPLETED' || cell.status === 'VERIFIED';
                                const tipParts = [
                                  cellAssignee,
                                  statusLabel(cell.status),
                                  isDone ? tr('checklist.done') : tr('checklist.notDone'),
                                ].filter(Boolean);
                                return (
                                  <TableCell key={tpl.id} sx={cellBgSx}>
                                    <Chip
                                      size="small"
                                      title={tipParts.join(' · ')}
                                      label={
                                        (cell.attachment_count || 0) > 0
                                          ? `${statusLabel(cell.status)} ·${cell.attachment_count}`
                                          : statusLabel(cell.status)
                                      }
                                      color={statusChipColor(cell.status, cell.is_overdue)}
                                      variant={
                                        cell.status === 'NOT_APPLICABLE' ? 'outlined' : 'filled'
                                      }
                                      onClick={() => void openInstanceDetail(cell)}
                                      sx={{
                                        height: 22,
                                        fontSize: '0.6875rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        maxWidth: '100%',
                                      }}
                                    />
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ))}

              {tab === 1 &&
                (templates.length === 0 ? (
                  emptyBox(tr('empty.templates'))
                ) : (
                  <TableContainer>
                    <Table size="small" sx={tableSx}>
                      <TableHead sx={mvsTableHeadHighlightSx}>
                        <TableRow>
                          <TableCell>{tr('fields.name')}</TableCell>
                          <TableCell sx={{ width: 100 }}>{tr('fields.code')}</TableCell>
                          <TableCell sx={{ width: 120 }}>{tr('fields.category')}</TableCell>
                          <TableCell sx={{ width: 110 }}>{tr('fields.frequency')}</TableCell>
                          <TableCell sx={{ width: 88 }}>{tr('fields.dueDay')}</TableCell>
                          <TableCell sx={{ width: 88 }}>{tr('fields.requiresAttachment')}</TableCell>
                          <TableCell sx={{ width: 88 }}>{tr('fields.requiresVerification')}</TableCell>
                          <TableCell sx={{ width: 96 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody sx={mvsTableBodyRowSx}>
                        {templates.map((row) => (
                          <TableRow key={row.id} hover>
                            <TableCell title={row.name}>{row.name}</TableCell>
                            <TableCell>{row.code || '—'}</TableCell>
                            <TableCell>{row.category || '—'}</TableCell>
                            <TableCell>{freqLabel(row.frequency)}</TableCell>
                            <TableCell>{row.default_due_day ?? '—'}</TableCell>
                            <TableCell>{row.requires_attachment ? 'Y' : '—'}</TableCell>
                            <TableCell>{row.requires_verification ? 'Y' : '—'}</TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                              {canManage ? (
                                <>
                                  <Tooltip title={tr('actions.edit')}>
                                    <IconButton size="small" onClick={() => openEditTemplate(row)}>
                                      <EditOutlinedIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title={tr('actions.remove')}>
                                    <IconButton size="small" onClick={() => confirmDeleteTemplate(row)}>
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ))}

              {tab === 2 &&
                (clients.length === 0 ? (
                  emptyBox(tr('empty.clients'))
                ) : (
                  <TableContainer>
                    <Table size="small" sx={tableSx}>
                      <TableHead sx={mvsTableHeadHighlightSx}>
                        <TableRow>
                          <TableCell>{tr('fields.client')}</TableCell>
                          <TableCell sx={{ width: '36%' }}>{tr('fields.businessNumber')}</TableCell>
                          <TableCell sx={{ width: 72 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody sx={mvsTableBodyRowSx}>
                        {clients.map((row) => (
                          <TableRow key={row.id} hover>
                            <TableCell>{row.customer?.name || row.customer_id}</TableCell>
                            <TableCell>{row.customer?.business_number || '—'}</TableCell>
                            <TableCell align="right">
                              {canManage ? (
                                <Tooltip title={tr('actions.remove')}>
                                  <IconButton size="small" onClick={() => confirmRemoveClient(row)}>
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ))}

              {tab === 3 &&
                (clients.length === 0 || templates.length === 0 ? (
                  emptyBox(tr('empty.assignments'))
                ) : (
                  <TableContainer>
                    <Table size="small" sx={{ ...tableSx, tableLayout: 'fixed', minWidth: 720 }}>
                      <TableHead sx={mvsTableHeadHighlightSx}>
                        <TableRow>
                          <TableCell
                            sx={{ width: '30%' }}
                            sortDirection={assignSort.key === 'client' ? assignSort.dir : false}
                          >
                            <TableSortLabel
                              active={assignSort.key === 'client'}
                              direction={assignSort.key === 'client' ? assignSort.dir : 'asc'}
                              onClick={() => toggleAssignSort('client')}
                            >
                              {tr('fields.client')}
                            </TableSortLabel>
                          </TableCell>
                          <TableCell
                            sx={{ width: '22%' }}
                            sortDirection={assignSort.key === 'assignee' ? assignSort.dir : false}
                          >
                            <TableSortLabel
                              active={assignSort.key === 'assignee'}
                              direction={assignSort.key === 'assignee' ? assignSort.dir : 'asc'}
                              onClick={() => toggleAssignSort('assignee')}
                            >
                              {tr('fields.defaultAssignee')}
                            </TableSortLabel>
                          </TableCell>
                          <TableCell
                            sx={{ width: '22%' }}
                            sortDirection={assignSort.key === 'reviewer' ? assignSort.dir : false}
                          >
                            <TableSortLabel
                              active={assignSort.key === 'reviewer'}
                              direction={assignSort.key === 'reviewer' ? assignSort.dir : 'asc'}
                              onClick={() => toggleAssignSort('reviewer')}
                            >
                              {tr('fields.defaultReviewer')}
                            </TableSortLabel>
                          </TableCell>
                          <TableCell
                            sx={{ width: '26%' }}
                            sortDirection={assignSort.key === 'progress' ? assignSort.dir : false}
                          >
                            <TableSortLabel
                              active={assignSort.key === 'progress'}
                              direction={assignSort.key === 'progress' ? assignSort.dir : 'asc'}
                              onClick={() => toggleAssignSort('progress')}
                            >
                              {tr('bulkAssign.detail')}
                            </TableSortLabel>
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody sx={assignTableBodySx}>
                        {sortedClientAssignRows.map(
                          ({
                            client,
                            primaryAssigneeId,
                            assigneeMixed,
                            assigneeUniqueCount,
                            primaryReviewerId,
                            reviewerMixed,
                            assignedCount,
                            totalTemplates,
                          }) => {
                            const assigneeMixedLabel = tr('bulkAssign.multipleByTask', {
                              count: assigneeUniqueCount,
                            });
                            const customerId = Number(client.customer_id);
                            const expanded = expandedAssignClientId === customerId;
                            const clientName = client.customer?.name || String(client.customer_id);
                            return (
                              <React.Fragment key={client.id}>
                                <TableRow hover selected={expanded}>
                                  <TableCell
                                    title={clientName}
                                    sx={{
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {clientName}
                                  </TableCell>
                                  <TableCell>
                                    <TextField
                                      select
                                      size="small"
                                      margin="none"
                                      fullWidth
                                      disabled={!canManage || saving}
                                      value={primaryAssigneeId}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        void applyClientRole(customerId, {
                                          assigned_user_id: v ? Number(v) : null,
                                        });
                                      }}
                                      SelectProps={{
                                        displayEmpty: true,
                                        renderValue: (selected) => {
                                          const v = String(selected ?? '');
                                          if (!v) {
                                            return assigneeMixed
                                              ? assigneeMixedLabel
                                              : tr('fields.none');
                                          }
                                          return (
                                            memberOptions.find((m) => String(m.id) === v)?.label ||
                                            v
                                          );
                                        },
                                      }}
                                      sx={assignSelectSx}
                                    >
                                      <MenuItem value="">
                                        <em>
                                          {assigneeMixed
                                            ? assigneeMixedLabel
                                            : tr('fields.none')}
                                        </em>
                                      </MenuItem>
                                      {memberOptions.map((m) => (
                                        <MenuItem key={m.id} value={String(m.id)}>
                                          {m.label}
                                        </MenuItem>
                                      ))}
                                    </TextField>
                                  </TableCell>
                                  <TableCell>
                                    <TextField
                                      select
                                      size="small"
                                      margin="none"
                                      fullWidth
                                      disabled={!canManage || saving}
                                      value={primaryReviewerId}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        void applyClientRole(customerId, {
                                          reviewer_user_id: v ? Number(v) : null,
                                        });
                                      }}
                                      SelectProps={{
                                        displayEmpty: true,
                                        renderValue: (selected) => {
                                          const v = String(selected ?? '');
                                          if (!v) {
                                            return reviewerMixed
                                              ? tr('bulkAssign.mixed')
                                              : tr('fields.none');
                                          }
                                          return (
                                            memberOptions.find((m) => String(m.id) === v)?.label ||
                                            v
                                          );
                                        },
                                      }}
                                      sx={assignSelectSx}
                                    >
                                      <MenuItem value="">
                                        <em>
                                          {reviewerMixed ? tr('bulkAssign.mixed') : tr('fields.none')}
                                        </em>
                                      </MenuItem>
                                      {memberOptions.map((m) => (
                                        <MenuItem key={m.id} value={String(m.id)}>
                                          {m.label}
                                        </MenuItem>
                                      ))}
                                    </TextField>
                                  </TableCell>
                                  <TableCell>
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                      }}
                                    >
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        endIcon={
                                          expanded ? (
                                            <ExpandLessIcon sx={{ fontSize: 16 }} />
                                          ) : (
                                            <ExpandMoreIcon sx={{ fontSize: 16 }} />
                                          )
                                        }
                                        onClick={() =>
                                          setExpandedAssignClientId(expanded ? null : customerId)
                                        }
                                        sx={{
                                          ...mvsBodyOutlinedBtnSx,
                                          minWidth: 0,
                                          height: 32,
                                          px: 1.25,
                                          fontSize: '0.75rem',
                                        }}
                                      >
                                        {tr('bulkAssign.detail')}
                                      </Button>
                                      <Typography
                                        component="span"
                                        sx={{
                                          fontSize: '0.75rem',
                                          color: '#64748B',
                                          whiteSpace: 'nowrap',
                                          fontVariantNumeric: 'tabular-nums',
                                        }}
                                      >
                                        {tr('bulkAssign.progress', {
                                          assigned: assignedCount,
                                          total: totalTemplates,
                                        })}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                                {expanded ? (
                                  <TableRow>
                                    <TableCell
                                      colSpan={4}
                                      sx={{
                                        py: 1.25,
                                        px: 2,
                                        bgcolor: '#F8FAFC',
                                        borderBottom: '1px solid #E2E8F0',
                                      }}
                                    >
                                      <Typography
                                        sx={{ fontSize: '0.75rem', color: '#64748B', mb: 1 }}
                                      >
                                        {tr('bulkAssign.detailHint')}
                                      </Typography>
                                      <Table size="small" sx={tableSx}>
                                        <TableHead sx={mvsTableHeadHighlightSx}>
                                          <TableRow>
                                            <TableCell sx={{ width: '36%' }}>
                                              {tr('fields.template')}
                                            </TableCell>
                                            <TableCell sx={{ width: '12%' }}>
                                              {tr('fields.frequency')}
                                            </TableCell>
                                            <TableCell sx={{ width: '26%' }}>
                                              {tr('fields.assignee')}
                                            </TableCell>
                                            <TableCell sx={{ width: '26%' }}>
                                              {tr('fields.reviewer')}
                                            </TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody sx={assignTableBodySx}>
                                          {templates.map((template) => {
                                            const key = `${customerId}:${template.id}`;
                                            const assignment = assignmentMap.get(key);
                                            const assigneeId = assignment?.assigned_user_id ?? '';
                                            const reviewerId = assignment?.reviewer_user_id ?? '';
                                            return (
                                              <TableRow key={key} hover>
                                                <TableCell
                                                  title={template.name}
                                                  sx={{
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                  }}
                                                >
                                                  {template.name}
                                                </TableCell>
                                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                                  {freqLabel(template.frequency)}
                                                </TableCell>
                                                <TableCell>
                                                  <TextField
                                                    select
                                                    size="small"
                                                    margin="none"
                                                    fullWidth
                                                    disabled={!canManage || saving}
                                                    value={
                                                      assigneeId === null ||
                                                      assigneeId === undefined
                                                        ? ''
                                                        : String(assigneeId)
                                                    }
                                                    onChange={(e) => {
                                                      const v = e.target.value;
                                                      void saveAssignment(customerId, template.id, {
                                                        assigned_user_id: v ? Number(v) : null,
                                                      });
                                                    }}
                                                    sx={assignSelectSx}
                                                  >
                                                    <MenuItem value="">
                                                      <em>{tr('fields.none')}</em>
                                                    </MenuItem>
                                                    {memberOptions.map((m) => (
                                                      <MenuItem key={m.id} value={String(m.id)}>
                                                        {m.label}
                                                      </MenuItem>
                                                    ))}
                                                  </TextField>
                                                </TableCell>
                                                <TableCell>
                                                  <TextField
                                                    select
                                                    size="small"
                                                    margin="none"
                                                    fullWidth
                                                    disabled={!canManage || saving}
                                                    value={
                                                      reviewerId === null ||
                                                      reviewerId === undefined
                                                        ? ''
                                                        : String(reviewerId)
                                                    }
                                                    onChange={(e) => {
                                                      const v = e.target.value;
                                                      void saveAssignment(customerId, template.id, {
                                                        reviewer_user_id: v ? Number(v) : null,
                                                      });
                                                    }}
                                                    sx={assignSelectSx}
                                                  >
                                                    <MenuItem value="">
                                                      <em>{tr('fields.none')}</em>
                                                    </MenuItem>
                                                    {memberOptions.map((m) => (
                                                      <MenuItem key={m.id} value={String(m.id)}>
                                                        {m.label}
                                                      </MenuItem>
                                                    ))}
                                                  </TextField>
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                    </TableCell>
                                  </TableRow>
                                ) : null}
                              </React.Fragment>
                            );
                          }
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ))}
            </>
          )}
        </Box>
      </Box>

      <Dialog
        open={templateDialogOpen}
        onClose={() => !saving && setTemplateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: getMvsDialogPaperSx(theme) }}
      >
        <DialogTitle sx={getMvsDialogTitleRowSx(theme)}>
          {editingTemplate ? tr('dialog.editTemplate') : tr('dialog.newTemplate')}
        </DialogTitle>
        <DialogContent sx={{ ...getMvsDialogPromptContentSx(theme), display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label={tr('fields.name')}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
            fullWidth
            size="small"
            {...mvsOutlinedLabelProps}
            sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx }}
          />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              label={tr('fields.code')}
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              fullWidth
              size="small"
              {...mvsOutlinedLabelProps}
              sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx }}
            />
            <TextField
              label={tr('fields.category')}
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              fullWidth
              size="small"
              {...mvsOutlinedLabelProps}
              sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              select
              label={tr('fields.frequency')}
              value={form.frequency}
              onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}
              fullWidth
              size="small"
              {...mvsOutlinedLabelProps}
              sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx }}
            >
              {FREQUENCIES.map((f) => (
                <MenuItem key={f} value={f}>
                  {freqLabel(f)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={tr('fields.dueDay')}
              value={form.default_due_day}
              onChange={(e) => setForm((p) => ({ ...p, default_due_day: e.target.value.replace(/[^\d]/g, '') }))}
              fullWidth
              size="small"
              inputProps={{ inputMode: 'numeric', maxLength: 2 }}
              {...mvsOutlinedLabelProps}
              sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.requires_attachment}
                  onChange={(e) => setForm((p) => ({ ...p, requires_attachment: e.target.checked }))}
                  size="small"
                />
              }
              label={tr('fields.requiresAttachment')}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.requires_verification}
                  onChange={(e) => setForm((p) => ({ ...p, requires_verification: e.target.checked }))}
                  size="small"
                />
              }
              label={tr('fields.requiresVerification')}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button
            variant="outlined"
            onClick={() => setTemplateDialogOpen(false)}
            disabled={saving}
            sx={getMvsDialogCancelButtonSx(theme)}
          >
            {tr('actions.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => void saveTemplate()}
            disabled={saving}
            sx={getMvsDialogPrimaryConfirmButtonSx()}
          >
            {tr('actions.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={inviteOpen}
        onClose={() => !saving && setInviteOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { ...getMvsDialogPaperSx(theme), overflow: 'visible' } }}
      >
        <DialogTitle sx={getMvsDialogTitleRowSx(theme)}>{tr('invite.title')}</DialogTitle>
        <DialogContent
          sx={{
            ...getMvsDialogPromptContentSx(theme),
            overflow: 'visible',
            pt: '28px !important',
          }}
        >
          {inviteLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box sx={{ overflow: 'visible', pt: 0.5 }}>
              <Autocomplete
                multiple
                options={inviteCandidates}
                value={inviteSelected}
                onChange={(_, v) => setInviteSelected(v)}
                getOptionLabel={(o) => o.label}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                noOptionsText={tr('invite.empty')}
                sx={{ overflow: 'visible' }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={tr('invite.search')}
                    size="small"
                    {...mvsOutlinedLabelProps}
                    sx={{
                      ...mvsSearchFieldSx,
                      overflow: 'visible',
                      '& .MuiFormLabel-root': {
                        overflow: 'visible',
                        maxWidth: 'none',
                        lineHeight: 1.2,
                      },
                      '& .MuiOutlinedInput-root': {
                        minHeight: 40,
                        height: 'auto',
                        alignItems: 'flex-start',
                        py: 0.75,
                        overflow: 'visible',
                      },
                    }}
                  />
                )}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button
            variant="outlined"
            onClick={() => setInviteOpen(false)}
            disabled={saving}
            sx={getMvsDialogCancelButtonSx(theme)}
          >
            {tr('actions.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => void inviteMembers()}
            disabled={saving || inviteLoading || inviteSelected.length === 0}
            sx={getMvsDialogPrimaryConfirmButtonSx()}
          >
            {tr('actions.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={clientDialogOpen}
        onClose={() => !saving && setClientDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { ...getMvsDialogPaperSx(theme), overflow: 'visible' } }}
      >
        <DialogTitle sx={getMvsDialogTitleRowSx(theme)}>{tr('dialog.addClients')}</DialogTitle>
        <DialogContent
          sx={{
            ...getMvsDialogPromptContentSx(theme),
            overflow: 'visible',
            pt: '28px !important',
          }}
        >
          {customersLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box sx={{ overflow: 'visible', pt: 0.5 }}>
              <Autocomplete
                multiple
                options={customerOptions}
                value={selectedCustomers}
                onChange={(_, v) => setSelectedCustomers(v)}
                getOptionLabel={(o) =>
                  o.business_number ? `${o.name} (${o.business_number})` : o.name
                }
                isOptionEqualToValue={(a, b) => a.id === b.id}
                noOptionsText={tr('empty.noCandidates')}
                sx={{ overflow: 'visible' }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={tr('fields.client')}
                    size="small"
                    {...mvsOutlinedLabelProps}
                    sx={{
                      ...mvsSearchFieldSx,
                      overflow: 'visible',
                      '& .MuiFormLabel-root': {
                        overflow: 'visible',
                        maxWidth: 'none',
                        lineHeight: 1.2,
                      },
                      '& .MuiOutlinedInput-root': {
                        minHeight: 40,
                        height: 'auto',
                        alignItems: 'flex-start',
                        py: 0.75,
                        overflow: 'visible',
                      },
                    }}
                  />
                )}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button
            variant="outlined"
            onClick={() => setClientDialogOpen(false)}
            disabled={saving}
            sx={getMvsDialogCancelButtonSx(theme)}
          >
            {tr('actions.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => void saveClients()}
            disabled={saving || customersLoading}
            sx={getMvsDialogPrimaryConfirmButtonSx()}
          >
            {tr('actions.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(detailInstance)}
        onClose={() => !saving && setDetailInstance(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: getMvsDialogPaperSx(theme) }}
      >
        <DialogTitle sx={getMvsDialogTitleRowSx(theme)}>{tr('statusDialog.title')}</DialogTitle>
        <DialogContent sx={{ ...getMvsDialogPromptContentSx(theme), display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {detailLoading && !detailInstance ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : detailInstance ? (
            <>
              <Box>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
                  {detailInstance.customer?.name || detailInstance.customer_id}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                  {detailInstance.template?.name || detailInstance.template_id}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                  {detailInstance.template?.requires_attachment ? (
                    <Chip size="small" label={tr('statusDialog.requiresAttachment')} color="warning" />
                  ) : null}
                  {detailInstance.template?.requires_verification ? (
                    <Chip size="small" label={tr('statusDialog.requiresVerification')} color="info" />
                  ) : null}
                  {detailInstance.is_overdue ? (
                    <Chip size="small" label={tr('statusDialog.overdue')} color="error" />
                  ) : null}
                </Box>
              </Box>

              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                {tr('statusDialog.period')}: {detailInstance.period}
              </Typography>

              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 0.75 }}>
                  {tr('statusDialog.changeTo')}
                </Typography>
                {(detailInstance.template?.requires_attachment ||
                  detailInstance.template?.requires_verification) && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.75 }}>
                    {detailInstance.template?.requires_attachment && attachmentCountOf(detailInstance) === 0
                      ? tr('statusDialog.needAttachmentComplete')
                      : detailInstance.template?.requires_verification &&
                          detailInstance.status !== 'COMPLETED' &&
                          detailInstance.status !== 'VERIFIED'
                        ? tr('statusDialog.needCompleteFirst')
                        : null}
                  </Typography>
                )}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {INSTANCE_STATUSES.map((st) => {
                    const blocked = statusBlockedReason(detailInstance, st);
                    const isCurrent = detailInstance.status === st;
                    return (
                      <Button
                        key={st}
                        size="small"
                        variant={isCurrent ? 'contained' : 'outlined'}
                        disabled={saving || detailLoading || (!isCurrent && Boolean(blocked))}
                        onClick={() => void updateInstanceStatus(detailInstance, st)}
                        sx={isCurrent ? mvsBodyPrimaryBtnSx : mvsBodyOutlinedBtnSx}
                      >
                        {statusLabel(st)}
                      </Button>
                    );
                  })}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <TextField
                  type="date"
                  size="small"
                  label={tr('statusDialog.due')}
                  value={detailDueDate}
                  onChange={(e) => setDetailDueDate(e.target.value)}
                  disabled={!canManage || saving}
                  {...mvsOutlinedLabelProps}
                  sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx, flex: '1 1 140px' }}
                />
                <TextField
                  select
                  size="small"
                  label={tr('statusDialog.assignee')}
                  value={detailAssigneeId}
                  onChange={(e) => setDetailAssigneeId(e.target.value)}
                  disabled={!canManage || saving}
                  {...mvsOutlinedLabelProps}
                  sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx, flex: '1 1 160px' }}
                >
                  <MenuItem value="">
                    <em>{tr('fields.none')}</em>
                  </MenuItem>
                  {detailAssigneeId &&
                  !memberOptions.some((m) => String(m.id) === detailAssigneeId) ? (
                    <MenuItem value={detailAssigneeId}>
                      {userLabel(detailInstance.assignee) || detailAssigneeId}
                    </MenuItem>
                  ) : null}
                  {memberOptions.map((m) => (
                    <MenuItem key={m.id} value={String(m.id)}>
                      {m.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label={tr('statusDialog.reviewer')}
                  value={detailReviewerId}
                  onChange={(e) => setDetailReviewerId(e.target.value)}
                  disabled={!canManage || saving}
                  {...mvsOutlinedLabelProps}
                  sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx, flex: '1 1 160px' }}
                >
                  <MenuItem value="">
                    <em>{tr('fields.none')}</em>
                  </MenuItem>
                  {detailReviewerId &&
                  !memberOptions.some((m) => String(m.id) === detailReviewerId) ? (
                    <MenuItem value={detailReviewerId}>
                      {userLabel(detailInstance.reviewer) || detailReviewerId}
                    </MenuItem>
                  ) : null}
                  {memberOptions.map((m) => (
                    <MenuItem key={m.id} value={String(m.id)}>
                      {m.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>

              <TextField
                label={tr('statusDialog.notes')}
                placeholder={tr('statusDialog.notesPlaceholder')}
                value={detailNotes}
                onChange={(e) => setDetailNotes(e.target.value)}
                multiline
                minRows={3}
                fullWidth
                size="small"
                disabled={saving}
                {...mvsOutlinedLabelProps}
                sx={mvsSearchFieldSx}
              />

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    {tr('statusDialog.attachments')}
                    {detailInstance.attachment_count ? ` (${detailInstance.attachment_count})` : ''}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AttachFileIcon sx={{ fontSize: 16 }} />}
                    disabled={saving}
                    onClick={() => fileInputRef.current?.click()}
                    sx={mvsBodyOutlinedBtnSx}
                  >
                    {tr('statusDialog.addAttachment')}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    multiple
                    onChange={(e) => void uploadDetailAttachments(e.target.files)}
                  />
                </Box>
                {(detailInstance.attachments || []).length === 0 ? (
                  <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                    {tr('statusDialog.noAttachments')}
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {(detailInstance.attachments || []).map((att) => (
                      <Box
                        key={att.storedName}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          py: 0.5,
                          borderBottom: '1px solid #E2E8F0',
                        }}
                      >
                        <Typography
                          component="a"
                          href={getUploadUrl(att.path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            fontSize: '0.8125rem',
                            color: 'primary.main',
                            textDecoration: 'none',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                          title={att.originalName}
                        >
                          {att.originalName}
                        </Typography>
                        <IconButton
                          size="small"
                          disabled={saving}
                          onClick={() => void removeDetailAttachment(att.storedName)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </>
          ) : null}
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button
            variant="outlined"
            onClick={() => setDetailInstance(null)}
            disabled={saving}
            sx={getMvsDialogCancelButtonSx(theme)}
          >
            {tr('actions.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => void saveInstanceDetail()}
            disabled={saving || !detailInstance}
            sx={getMvsDialogPrimaryConfirmButtonSx()}
          >
            {tr('statusDialog.saveNotes')}
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={memberMenuAnchor}
        open={Boolean(memberMenuAnchor && memberMenuTarget)}
        onClose={closeMemberMenu}
        disableScrollLock
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          backdrop: { sx: { backgroundColor: 'transparent' } },
          paper: {
            sx: {
              borderRadius: '8px',
              minWidth: 200,
              mt: 0.75,
              border: '1px solid #E2E8F0',
              boxShadow: '0 8px 24px rgba(9, 30, 66, 0.14)',
              overflow: 'hidden',
            },
          },
        }}
      >
        {memberMenuTarget ? (
          <Box
            sx={{
              px: 1.5,
              pt: 1.25,
              pb: 1,
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Avatar
              src={memberMenuTarget.avatarSrc}
              alt={memberMenuTarget.name}
              sx={{
                width: 32,
                height: 32,
                fontSize: '0.75rem',
                fontWeight: 700,
                bgcolor: memberMenuTarget.avatarSrc
                  ? undefined
                  : memberMenuTarget.role === 'owner'
                    ? theme.palette.primary.main
                    : memberAvatarColor(memberMenuTarget.id),
              }}
            >
              {memberMenuTarget.name.slice(0, 1).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: '0.8125rem',
                  fontWeight: 700,
                  color: '#0F172A',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {memberMenuTarget.name}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#64748B', lineHeight: 1.3 }}>
                {memberMenuTarget.role === 'owner' ? tr('roles.admin') : tr('roles.member')}
              </Typography>
            </Box>
          </Box>
        ) : null}
        <MenuItem onClick={viewMemberPhoto} sx={{ py: 1.1 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <PhotoOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={tr('memberMenu.viewPhoto')}
            primaryTypographyProps={{ fontWeight: 600, fontSize: '0.8125rem' }}
          />
        </MenuItem>
        {memberMenuTarget?.role === 'owner' ? (
          <MenuItem
            onClick={() => void removeMemberAdmin()}
            disabled={
              !canManage ||
              !isInitialAdmin ||
              memberRoleSaving ||
              ownerCount <= 1
            }
            sx={{ py: 1.1 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {memberRoleSaving ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <AdminIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                ownerCount <= 1
                  ? tr('memberMenu.lastAdmin')
                  : !isInitialAdmin
                    ? tr('memberMenu.alreadyAdmin')
                    : tr('memberMenu.removeAdmin')
              }
              primaryTypographyProps={{ fontWeight: 600, fontSize: '0.8125rem' }}
            />
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => void setMemberAsAdmin()}
            disabled={!canManage || memberRoleSaving}
            sx={{ py: 1.1 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {memberRoleSaving ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <AdminIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={tr('memberMenu.setAdmin')}
              primaryTypographyProps={{ fontWeight: 600, fontSize: '0.8125rem' }}
            />
          </MenuItem>
        )}
        <MenuItem
          onClick={removeFromBoard}
          disabled={
            memberRoleSaving ||
            (memberMenuTarget?.role === 'owner' && ownerCount <= 1) ||
            !(
              canManage ||
              Number(memberMenuTarget?.id) === Number(currentUser?.id || 0)
            )
          }
          sx={{ py: 1.1, color: 'error.main' }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>
            {memberRoleSaving ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <DeleteOutlineIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText
            primary={
              memberMenuTarget?.role === 'owner' && ownerCount <= 1
                ? tr('memberMenu.lastAdminCannotRemove')
                : tr('memberMenu.removeFromBoard')
            }
            primaryTypographyProps={{ fontWeight: 600, fontSize: '0.8125rem' }}
          />
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        titleKey={dialogState.titleKey}
        message={dialogState.message}
        messageKey={dialogState.messageKey}
        confirmText={dialogState.confirmText}
        confirmTextKey={dialogState.confirmTextKey}
        cancelText={dialogState.cancelText}
        cancelTextKey={dialogState.cancelTextKey}
        confirmColor={dialogState.confirmColor}
        messageTone={dialogState.messageTone}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Box>
  );
};

export default WorkRecurringBoardPage;
