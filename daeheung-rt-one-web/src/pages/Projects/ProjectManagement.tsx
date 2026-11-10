import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { api, projectService } from '../../services/api';
import { useReferenceDataStore, filterActiveCompanyUsers } from '../../store/referenceDataStore';
import { useMenuStore, useStore } from '../../store';
import {
  companySelectListboxSlotProps,
  companySelectNowrapSx,
  shortCompanyName,
} from '../../utils/companyDisplayName';
import { showErrorPopup, showSuccessPopup } from '../../utils/errorHandler';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
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
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
  mvsPageRootSx,
  mvsSearchFieldSx,
  mvsTableBodyRowSx,
  mvsTableHeadHighlightSx,
  mvsTableScrollSx,
} from '../../theme/daeheungLayout';

const MENU_ROUTE = '/work/project-management';
const STATUS_KEYS = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const;

function normalizeStatus(status: string): string {
  if (status === 'active') return 'in_progress';
  return status || 'planning';
}

type ProjectRow = {
  id: number;
  project_code: string;
  name: string;
  description: string;
  manager: string;
  manager_id: number | null;
  members: string;
  status: string;
  priority: string;
  startDate: string;
  endDate: string;
  progress: number;
  budget: number;
};

type ProjectListSortKey =
  | 'name'
  | 'members'
  | 'startDate'
  | 'endDate'
  | 'duration'
  | 'remaining'
  | 'status'
  | 'priority'
  | 'progress';

const PROJECT_STATUS_RANK: Record<string, number> = {
  planning: 0,
  in_progress: 1,
  on_hold: 2,
  completed: 3,
  cancelled: 4,
};

const ProjectListHeadCell = ({
  sortKey,
  activeKey,
  direction,
  onSort,
  children,
  sx,
}: {
  sortKey: ProjectListSortKey;
  activeKey: ProjectListSortKey | null;
  direction: 'asc' | 'desc';
  onSort: (key: ProjectListSortKey) => void;
  children: React.ReactNode;
  sx?: object;
}) => (
  <TableCell sx={{ whiteSpace: 'nowrap', ...sx }}>
    <TableSortLabel
      active={activeKey === sortKey}
      direction={activeKey === sortKey ? direction : 'asc'}
      onClick={() => onSort(sortKey)}
      sx={{
        color: 'inherit',
        '&:hover': { color: 'inherit' },
        '&.Mui-active': { color: 'inherit' },
        '& .MuiTableSortLabel-icon': {
          color: 'inherit !important',
          fontSize: 14,
          opacity: activeKey === sortKey ? 1 : 0.35,
        },
      }}
    >
      {children}
    </TableSortLabel>
  </TableCell>
);

type FormState = {
  name: string;
  description: string;
  manager_id: string;
  status: string;
  startDate: string;
  endDate: string;
  priority: string;
  budget: number;
  inviteUserIds: number[];
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  manager_id: '',
  status: 'planning',
  startDate: '',
  endDate: '',
  priority: 'medium',
  budget: 0,
  inviteUserIds: [],
});

function daysBetween(start: string, end: string): number | null {
  if (!start || !end) return null;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

function remainingDays(end: string): number | null {
  if (!end) return null;
  const e = new Date(`${end}T00:00:00`);
  if (Number.isNaN(e.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((e.getTime() - today.getTime()) / 86400000);
}

const ProjectManagement: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useStore();
  const { loading: menusLoading } = useMenuStore();
  const menuFlags = useMenuRoutePermissionFlags([MENU_ROUTE]);
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  /** root/audit: 로그인 소속 회사를 기본 선택 */
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>(() => {
    const u = useStore.getState().user;
    if (
      (u?.role === 'root' || u?.role === 'audit') &&
      u.company_id != null &&
      Number(u.company_id) > 0
    ) {
      return Number(u.company_id);
    }
    return '';
  });
  const [formData, setFormData] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<ProjectListSortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const isRootOrAudit = user?.role === 'root' || user?.role === 'audit';
  const canReorder =
    menuFlags.canEdit &&
    !searchTerm.trim() &&
    statusFilter === 'all' &&
    managerFilter === 'all' &&
    sortKey == null &&
    !(isRootOrAudit && selectedCompanyId === '');

  const handleListSort = useCallback((key: ProjectListSortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const statusLabel = useCallback(
    (status: string) => {
      const key = normalizeStatus(status);
      return t(`projectManagement.status.${key}`, { defaultValue: key });
    },
    [t]
  );

  const priorityLabel = useCallback(
    (priority: string) => t(`projectManagement.priority.${priority}`, { defaultValue: priority }),
    [t]
  );

  const loadProjects = useCallback(async () => {
    if (!menuFlags.canRead) {
      setProjects([]);
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: 1, limit: 1000 };
      if (isRootOrAudit && selectedCompanyId) {
        params.company_id = selectedCompanyId;
      }
      if (statusFilter !== 'all') params.status = statusFilter;
      if (managerFilter !== 'all') params.manager_id = managerFilter;

      const response = await projectService.getProjects(params);
      if (response.success) {
        setProjects(
          (response.data || []).map((p: any) => {
            const memberNames = Array.isArray(p.members)
              ? p.members
                  .map((m: any) => String(m?.user?.username || '').trim())
                  .filter(Boolean)
              : [];
            return {
              id: p.id,
              name: p.name,
              description: p.description || '',
              manager: p.manager?.username || '-',
              manager_id: p.project_manager ?? null,
              members: memberNames.length > 0 ? memberNames.join(', ') : '-',
              status: normalizeStatus(p.status),
              progress: Number(p.progress) || 0,
              startDate: p.start_date || '',
              endDate: p.end_date || '',
              priority: p.priority || 'medium',
              project_code: p.project_code || '',
              budget: parseFloat(String(p.budget || 0)) || 0,
            };
          })
        );
      } else {
        showErrorPopup(response.message || t('projectManagement.errors.loadList'), t('projectManagement.errors.loadListTitle'));
      }
    } catch (error: any) {
      showErrorPopup(error, t('projectManagement.errors.loadListTitle'));
    } finally {
      setLoading(false);
    }
  }, [isRootOrAudit, managerFilter, menuFlags.canRead, selectedCompanyId, statusFilter, t]);

  const loadCompanies = useCallback(async () => {
    try {
      const response = await api.get('/companies');
      if (response.data.success) {
        const list = Array.isArray(response.data.data) ? response.data.data : [];
        setCompanies(list);
        setSelectedCompanyId((prev) => {
          const ids = list
            .map((c: any) => Number(c.id))
            .filter((id: number) => Number.isFinite(id) && id > 0);
          if (typeof prev === 'number' && ids.includes(prev)) return prev;
          const loginId = Number(user?.company_id);
          if (Number.isFinite(loginId) && loginId > 0 && ids.includes(loginId)) {
            return loginId;
          }
          return prev === '' ? '' : prev;
        });
      }
    } catch {
      /* ignore */
    }
  }, [user?.company_id]);

  const companyFilterOptions = useMemo(() => {
    const list = companies
      .map((c: any) => ({
        id: Number(c.id),
        name: shortCompanyName(c.name || c.company_name),
      }))
      .filter((c) => Number.isFinite(c.id) && c.id > 0 && c.name)
      .sort((a, b) => a.name.localeCompare(b.name));
    return [{ id: '' as number | '', name: t('projectManagement.filters.allCompanies') }, ...list];
  }, [companies, t]);

  const selectedCompanyOption = useMemo(() => {
    if (selectedCompanyId === '') {
      return companyFilterOptions.find((o) => o.id === '') ?? null;
    }
    return companyFilterOptions.find((o) => o.id === selectedCompanyId) ?? null;
  }, [companyFilterOptions, selectedCompanyId]);

  const loadUsers = useCallback(async () => {
    try {
      const params: { company_id?: number } = {};
      if (user?.company_id) params.company_id = user.company_id;
      const usersData = await useReferenceDataStore.getState().fetchUsers(params);
      setUsers(
        filterActiveCompanyUsers(usersData, {
          companyId: user?.company_id,
          tenantId: user?.tenant_id,
        })
      );
    } catch {
      /* ignore */
    }
  }, [user?.company_id]);

  useEffect(() => {
    void loadUsers();
    if (isRootOrAudit) void loadCompanies();
  }, [isRootOrAudit, loadCompanies, loadUsers]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.project_code.toLowerCase().includes(q) ||
        p.members.toLowerCase().includes(q) ||
        p.manager.toLowerCase().includes(q)
    );
  }, [projects, searchTerm]);

  const displayedProjects = useMemo(() => {
    const priorityRank: Record<string, number> = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    // 기본: 기획 → 진행중 → 보류 → 완료 → 취소 (동일 상태 내 API/수동 순서 유지)
    if (!sortKey) {
      return [...filteredProjects].sort((a, b) => {
        const ra = PROJECT_STATUS_RANK[a.status] ?? 99;
        const rb = PROJECT_STATUS_RANK[b.status] ?? 99;
        return ra - rb;
      });
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const valueOf = (p: ProjectRow): string | number => {
      switch (sortKey) {
        case 'name':
          return p.name.toLowerCase();
        case 'members':
          return p.members.toLowerCase();
        case 'startDate':
          return p.startDate || '';
        case 'endDate':
          return p.endDate || '';
        case 'duration':
          return daysBetween(p.startDate, p.endDate) ?? -1;
        case 'remaining':
          return remainingDays(p.endDate) ?? Number.NEGATIVE_INFINITY;
        case 'status':
          return PROJECT_STATUS_RANK[p.status] ?? 99;
        case 'priority':
          return priorityRank[p.priority] ?? 0;
        case 'progress':
          return Number(p.progress) || 0;
        default:
          return '';
      }
    };
    return [...filteredProjects].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        if (av === bv) return (a.id - b.id) * dir;
        return (av - bv) * dir;
      }
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      if (cmp === 0) return (a.id - b.id) * dir;
      return cmp * dir;
    });
  }, [filteredProjects, sortDir, sortKey]);

  const moveProject = async (project: ProjectRow, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canReorder || movingId != null) return;
    const index = projects.findIndex((p) => p.id === project.id);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= projects.length) return;

    const previous = projects;
    const next = [...projects];
    const tmp = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = tmp;
    setProjects(next);
    setMovingId(project.id);
    try {
      const res = await projectService.moveProject(project.id, direction);
      if (!res.success) {
        setProjects(previous);
        showErrorPopup(
          res.message || t('projectManagement.errors.reorderFailed'),
          t('projectManagement.errors.reorderTitle')
        );
        return;
      }
      if (Array.isArray(res.data) && res.data.length > 0) {
        const orderMap = new Map<number, number>(
          res.data.map((row: { id: number; sort_order: number }, i: number) => [
            Number(row.id),
            Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : i,
          ])
        );
        setProjects((curr) =>
          [...curr].sort((a, b) => {
            const ao = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
            const bo = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
            return ao - bo || a.id - b.id;
          })
        );
      }
    } catch (error: any) {
      setProjects(previous);
      showErrorPopup(error, t('projectManagement.errors.reorderTitle'));
    } finally {
      setMovingId(null);
    }
  };

  const handleOpenDialog = (project?: ProjectRow, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (project) {
      setSelectedProject(project);
      setFormData({
        name: project.name,
        description: project.description,
        manager_id: project.manager_id != null ? String(project.manager_id) : '',
        status: normalizeStatus(project.status),
        startDate: project.startDate,
        endDate: project.endDate,
        priority: project.priority === 'normal' ? 'medium' : project.priority,
        budget: project.budget,
        inviteUserIds: [],
      });
    } else {
      setSelectedProject(null);
      const form = emptyForm();
      if (user?.id) form.manager_id = String(user.id);
      setFormData(form);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedProject(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showErrorPopup(t('projectManagement.errors.nameRequired'), t('projectManagement.errors.saveTitle'));
      return;
    }
    if (!formData.startDate) {
      showErrorPopup(t('projectManagement.errors.startRequired'), t('projectManagement.errors.saveTitle'));
      return;
    }
    if (!formData.manager_id) {
      showErrorPopup(t('projectManagement.errors.managerRequired'), t('projectManagement.errors.saveTitle'));
      return;
    }
    if (formData.endDate && formData.endDate < formData.startDate) {
      showErrorPopup(t('projectManagement.errors.endBeforeStart'), t('projectManagement.errors.saveTitle'));
      return;
    }

    setSaving(true);
    try {
      const projectData: Record<string, unknown> = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        project_manager: parseInt(formData.manager_id, 10),
        status: formData.status,
        start_date: formData.startDate,
        end_date: formData.endDate || undefined,
        priority: formData.priority,
        budget: formData.budget || 0,
      };

      if (selectedProject) {
        if (!menuFlags.canEdit) return;
        const response = await projectService.updateProject(selectedProject.id, projectData);
        if (response.success) {
          showSuccessPopup(t('projectManagement.messages.updated'));
          handleCloseDialog();
          void loadProjects();
        } else {
          showErrorPopup(response.message || t('projectManagement.errors.updateFailed'), t('projectManagement.errors.saveTitle'));
        }
      } else {
        if (!menuFlags.canCreate) return;
        projectData.member_user_ids = formData.inviteUserIds;
        const response = await projectService.createProject(projectData);
        if (response.success) {
          showSuccessPopup(t('projectManagement.messages.created'));
          handleCloseDialog();
          void loadProjects();
          const newId = Number(response.data?.id);
          if (Number.isInteger(newId) && newId > 0) {
            navigate(`/work/project-management/${newId}`);
          }
        } else {
          showErrorPopup(response.message || t('projectManagement.errors.createFailed'), t('projectManagement.errors.saveTitle'));
        }
      }
    } catch (error: any) {
      showErrorPopup(error, t('projectManagement.errors.saveTitle'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!menuFlags.canDelete) return;
    showConfirm(
      t('projectManagement.confirm.deleteMessage'),
      async () => {
        try {
          const response = await projectService.deleteProject(id);
          if (response.success) {
            showSuccessPopup(t('projectManagement.messages.deleted'));
            void loadProjects();
          } else {
            showErrorPopup(response.message || t('projectManagement.errors.deleteFailed'), t('projectManagement.errors.deleteTitle'));
          }
        } catch (error: any) {
          showErrorPopup(error, t('projectManagement.errors.deleteTitle'));
        }
      },
      { confirmColor: 'error', title: t('projectManagement.confirm.deleteTitle') }
    );
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setManagerFilter('all');
    const loginId = Number(user?.company_id);
    setSelectedCompanyId(
      isRootOrAudit && Number.isFinite(loginId) && loginId > 0 ? loginId : ''
    );
  };

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('projectManagement.title')}
        description={t('projectManagement.description')}
        iconPath={MENU_ROUTE}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon sx={{ fontSize: 18 }} />}
              onClick={() => void loadProjects()}
              disabled={loading || menusLoading || !menuFlags.canRead}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('projectManagement.actions.refresh')}
            </Button>
            <Tooltip title={!menuFlags.canCreate && !menusLoading ? t('projectManagement.noCreatePermission') : ''}>
              <span>
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<AddIcon sx={{ fontSize: 20 }} />}
                  onClick={() => handleOpenDialog()}
                  disabled={menusLoading || !menuFlags.canCreate}
                  sx={mvsBodyPrimaryBtnSx}
                >
                  {t('projectManagement.actions.create')}
                </Button>
              </span>
            </Tooltip>
          </>
        }
      />

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 0 }}>
        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 2,
            bgcolor: '#FFFFFF',
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              md: isRootOrAudit ? 'minmax(200px, 2fr) repeat(3, minmax(120px, 1fr)) auto' : 'minmax(200px, 2fr) repeat(2, minmax(120px, 1fr)) auto',
            },
            gap: 2,
            alignItems: 'flex-end',
          }}
        >
          <TextField
            fullWidth
            size="small"
            label={t('common.search')}
            placeholder={t('projectManagement.filters.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            {...mvsOutlinedLabelProps}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx }}
          />
          {isRootOrAudit && (
            <Autocomplete
              options={companyFilterOptions}
              value={selectedCompanyOption}
              onChange={(_, next) => {
                if (!next || next.id === '') setSelectedCompanyId('');
                else setSelectedCompanyId(Number(next.id));
              }}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              disableClearable={Boolean(selectedCompanyOption)}
              slotProps={companySelectListboxSlotProps}
              sx={companySelectNowrapSx}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label={t('projectManagement.filters.company')}
                  placeholder={t('projectManagement.filters.searchCompany')}
                  {...mvsOutlinedLabelProps}
                  sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx, ...companySelectNowrapSx }}
                />
              )}
            />
          )}
          <FormControl fullWidth size="small" sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx }}>
            <InputLabel shrink>{t('projectManagement.filters.status')}</InputLabel>
            <Select
              value={statusFilter}
              label={t('projectManagement.filters.status')}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">{t('projectManagement.filters.allStatuses')}</MenuItem>
              {STATUS_KEYS.map((s) => (
                <MenuItem key={s} value={s}>
                  {statusLabel(s)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small" sx={{ ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx }}>
            <InputLabel shrink>{t('projectManagement.filters.manager')}</InputLabel>
            <Select
              value={managerFilter}
              label={t('projectManagement.filters.manager')}
              onChange={(e) => setManagerFilter(e.target.value)}
            >
              <MenuItem value="all">{t('projectManagement.filters.allManagers')}</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id} value={String(u.id)}>
                  {u.username}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={resetFilters} sx={mvsBodyOutlinedBtnSx}>
            {t('projectManagement.actions.reset')}
          </Button>
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        <Box sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
          <Box sx={mvsBodySectionHeaderSx}>
            <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0F172A' }}>
              {t('projectManagement.listTitle', { count: filteredProjects.length })}
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : filteredProjects.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body2" color="text.secondary">
                {projects.length === 0 ? t('projectManagement.empty') : t('projectManagement.noResults')}
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table
                size="small"
                sx={{
                  borderCollapse: 'collapse',
                  bgcolor: 'transparent',
                  '& .MuiTableCell-root': {
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                  },
                }}
              >
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    {menuFlags.canEdit && (
                      <TableCell sx={{ width: 44, px: 0.5 }}>
                        {t('projectManagement.columns.order')}
                      </TableCell>
                    )}
                    <ProjectListHeadCell sortKey="name" activeKey={sortKey} direction={sortDir} onSort={handleListSort}>
                      {t('projectManagement.columns.name')}
                    </ProjectListHeadCell>
                    <ProjectListHeadCell sortKey="members" activeKey={sortKey} direction={sortDir} onSort={handleListSort}>
                      {t('projectManagement.columns.members')}
                    </ProjectListHeadCell>
                    <ProjectListHeadCell sortKey="startDate" activeKey={sortKey} direction={sortDir} onSort={handleListSort}>
                      {t('projectManagement.columns.startDate')}
                    </ProjectListHeadCell>
                    <ProjectListHeadCell sortKey="endDate" activeKey={sortKey} direction={sortDir} onSort={handleListSort}>
                      {t('projectManagement.columns.endDate')}
                    </ProjectListHeadCell>
                    <ProjectListHeadCell sortKey="duration" activeKey={sortKey} direction={sortDir} onSort={handleListSort}>
                      {t('projectManagement.columns.duration')}
                    </ProjectListHeadCell>
                    <ProjectListHeadCell sortKey="remaining" activeKey={sortKey} direction={sortDir} onSort={handleListSort}>
                      {t('projectManagement.columns.remaining')}
                    </ProjectListHeadCell>
                    <ProjectListHeadCell sortKey="status" activeKey={sortKey} direction={sortDir} onSort={handleListSort}>
                      {t('projectManagement.columns.status')}
                    </ProjectListHeadCell>
                    <ProjectListHeadCell sortKey="priority" activeKey={sortKey} direction={sortDir} onSort={handleListSort}>
                      {t('projectManagement.columns.priority')}
                    </ProjectListHeadCell>
                    <ProjectListHeadCell sortKey="progress" activeKey={sortKey} direction={sortDir} onSort={handleListSort}>
                      {t('projectManagement.columns.progress')}
                    </ProjectListHeadCell>
                    <TableCell sx={{ textAlign: 'center' }}>{t('projectManagement.columns.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={mvsTableBodyRowSx}>
                  {displayedProjects.map((project, projectIndex) => {
                    const duration = daysBetween(project.startDate, project.endDate);
                    const remain = remainingDays(project.endDate);
                    const overdue =
                      remain != null &&
                      remain < 0 &&
                      project.status !== 'completed' &&
                      project.status !== 'cancelled';
                    const reorderDisabledReason = !menuFlags.canEdit
                      ? t('projectManagement.noEditPermission')
                      : isRootOrAudit && selectedCompanyId === ''
                        ? t('projectManagement.reorderNeedCompany')
                        : sortKey != null
                          ? t('projectManagement.reorderHint')
                          : !canReorder
                            ? t('projectManagement.reorderHint')
                            : '';
                    return (
                      <TableRow
                        key={project.id}
                        hover
                        onClick={() => navigate(`/work/project-management/${project.id}`)}
                        sx={{ cursor: 'pointer' }}
                      >
                        {menuFlags.canEdit && (
                          <TableCell
                            sx={{ width: 44, px: 0.5, verticalAlign: 'middle' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Tooltip title={reorderDisabledReason}>
                              <Box sx={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 0 }}>
                                <IconButton
                                  size="small"
                                  disabled={
                                    !canReorder ||
                                    movingId != null ||
                                    projectIndex === 0
                                  }
                                  onClick={(e) => void moveProject(project, 'up', e)}
                                  sx={{ p: 0, width: 18, height: 14 }}
                                  title={t('projectManagement.detail.moveUp')}
                                >
                                  <ArrowUpIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  disabled={
                                    !canReorder ||
                                    movingId != null ||
                                    projectIndex === displayedProjects.length - 1
                                  }
                                  onClick={(e) => void moveProject(project, 'down', e)}
                                  sx={{ p: 0, width: 18, height: 14 }}
                                  title={t('projectManagement.detail.moveDown')}
                                >
                                  <ArrowDownIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Box>
                            </Tooltip>
                          </TableCell>
                        )}
                        <TableCell>
                          <Typography
                            component="span"
                            sx={{
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              color: '#0F172A',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 260,
                            }}
                            title={project.name}
                          >
                            {project.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            component="span"
                            sx={{
                              fontSize: '0.8125rem',
                              color: '#0F172A',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 260,
                            }}
                            title={project.members}
                          >
                            {project.members}
                          </Typography>
                        </TableCell>
                        <TableCell>{project.startDate || '-'}</TableCell>
                        <TableCell>{project.endDate || '-'}</TableCell>
                        <TableCell>
                          {duration != null ? t('projectManagement.days', { count: duration }) : '-'}
                        </TableCell>
                        <TableCell
                          sx={{
                            color: overdue ? '#DC2626' : 'inherit',
                            fontWeight: overdue ? 600 : 400,
                          }}
                        >
                          {remain == null
                            ? '-'
                            : remain < 0
                              ? t('projectManagement.daysOverdue', { count: Math.abs(remain) })
                              : t('projectManagement.daysLeft', { count: remain })}
                        </TableCell>
                        <TableCell>{statusLabel(project.status)}</TableCell>
                        <TableCell>{priorityLabel(project.priority)}</TableCell>
                        <TableCell>{project.progress}%</TableCell>
                        <TableCell sx={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <Tooltip title={!menuFlags.canEdit ? t('projectManagement.noEditPermission') : ''}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={(e) => handleOpenDialog(project, e)}
                                disabled={!menuFlags.canEdit}
                              >
                                <EditIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={!menuFlags.canDelete ? t('projectManagement.noDeletePermission') : ''}>
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => handleDelete(project.id, e)}
                                disabled={!menuFlags.canDelete}
                              >
                                <DeleteIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Box>

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: getMvsDialogPaperSx(theme) }}
      >
        <DialogTitle sx={getMvsDialogTitleRowSx(theme)}>
          {selectedProject ? t('projectManagement.dialog.editTitle') : t('projectManagement.dialog.createTitle')}
        </DialogTitle>
        <DialogContent
          sx={{
            px: 2.5,
            // MUI는 DialogTitle 다음에 pt를 0으로 덮어써서 아웃라인 라벨이 제목에 붙음
            pt: '28px !important',
            pb: 1.5,
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 2.5,
              mt: 0.5,
            }}
          >
            <Box sx={{ gridColumn: '1 / -1', pt: 0.5 }}>
              <TextField
                fullWidth
                size="small"
                label={`${t('projectManagement.fields.name')} *`}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                {...mvsOutlinedLabelProps}
                sx={mvsSearchFieldSx}
              />
            </Box>
            <FormControl fullWidth size="small" sx={mvsSearchFieldSx}>
              <InputLabel shrink>{`${t('projectManagement.fields.manager')} *`}</InputLabel>
              <Select
                value={formData.manager_id}
                displayEmpty
                label={`${t('projectManagement.fields.manager')} *`}
                onChange={(e) => setFormData({ ...formData, manager_id: String(e.target.value) })}
              >
                <MenuItem value="">{t('projectManagement.fields.selectManager')}</MenuItem>
                {users.map((u) => (
                  <MenuItem key={u.id} value={String(u.id)}>
                    {u.username}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" sx={mvsSearchFieldSx}>
              <InputLabel shrink>{t('projectManagement.fields.priority')}</InputLabel>
              <Select
                value={formData.priority}
                label={t('projectManagement.fields.priority')}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                {['urgent', 'high', 'medium', 'low'].map((p) => (
                  <MenuItem key={p} value={p}>
                    {priorityLabel(p)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ gridColumn: '1 / -1', pt: 0.25 }}>
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={2}
                label={t('projectManagement.fields.description')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                {...mvsOutlinedLabelProps}
                sx={mvsSearchFieldSx}
              />
            </Box>
            <TextField
              fullWidth
              size="small"
              type="date"
              label={`${t('projectManagement.fields.startDate')} *`}
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              {...mvsOutlinedLabelProps}
              sx={mvsSearchFieldSx}
            />
            <TextField
              fullWidth
              size="small"
              type="date"
              label={t('projectManagement.fields.endDate')}
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              {...mvsOutlinedLabelProps}
              sx={mvsSearchFieldSx}
            />
            <FormControl fullWidth size="small" sx={mvsSearchFieldSx}>
              <InputLabel shrink>{t('projectManagement.fields.status')}</InputLabel>
              <Select
                value={normalizeStatus(formData.status)}
                label={t('projectManagement.fields.status')}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {STATUS_KEYS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {statusLabel(s)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              size="small"
              type="number"
              label={t('projectManagement.fields.budget')}
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
              inputProps={{ min: 0 }}
              {...mvsOutlinedLabelProps}
              sx={mvsSearchFieldSx}
            />
            {!selectedProject && (
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Autocomplete
                  multiple
                  options={users.filter((u) => String(u.id) !== formData.manager_id)}
                  value={users.filter((u) => formData.inviteUserIds.includes(Number(u.id)))}
                  onChange={(_, selected) =>
                    setFormData({
                      ...formData,
                      inviteUserIds: selected.map((u) => Number(u.id)),
                    })
                  }
                  getOptionLabel={(o) => o.username || String(o.id)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      label={t('projectManagement.fields.inviteMembers')}
                      {...mvsOutlinedLabelProps}
                      sx={mvsSearchFieldSx}
                    />
                  )}
                />
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={getMvsDialogActionsSx(theme)}>
          <Button onClick={handleCloseDialog} sx={mvsBodyOutlinedBtnSx}>
            {t('projectManagement.actions.cancel')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={() => void handleSave()}
            disabled={saving}
            sx={mvsBodyPrimaryBtnSx}
          >
            {t('projectManagement.actions.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        confirmColor={dialogState.confirmColor}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Box>
  );
};

export default ProjectManagement;
