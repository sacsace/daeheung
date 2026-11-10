import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Pagination,
  Snackbar,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsKpiCardSx,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPaginationSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsBodyListTableSx,
  mvsTableScrollSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
} from '../../theme/daeheungLayout';
import WorkStatisticsEvaluationPanel from './WorkStatisticsEvaluationPanel';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Download as DownloadIcon,
  FilterList as FilterIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ErrorBar,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Legend
} from 'recharts';
import { workBoardService } from '../../services/api';
import { useStore } from '../../store';
import { useReferenceDataStore } from '../../store/referenceDataStore';

type CompanyOption = { id: number; name: string };

const listViewModeBarSx = {
  mb: 1.25,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 0.75,
} as const;

const listViewModeBtnSx = {
  height: 32,
  minWidth: 0,
  px: 1.5,
  textTransform: 'none' as const,
  fontWeight: 600,
  fontSize: '0.75rem',
  borderRadius: '8px',
  boxShadow: 'none',
  whiteSpace: 'nowrap' as const,
};

/** 통계 표: 가로 스크롤 없이 컨테이너 너비에 균등 맞춤 */
const statsTableSx = {
  borderCollapse: 'collapse' as const,
  bgcolor: 'transparent',
  width: '100%',
  minWidth: 0,
  tableLayout: 'fixed' as const,
  '& .MuiTableCell-root': {
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    verticalAlign: 'middle',
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
    px: 0.75,
    py: 0.75,
    fontSize: '0.75rem',
  },
  '& .MuiTableCell-head': {
    whiteSpace: 'nowrap' as const,
    fontSize: '0.6875rem',
    px: 0.5,
    py: 0.75,
  },
};

/** 담당자별 카드 통계 12열 비율 */
const assigneeColWidth: Record<string, string> = {
  employeeName: '14%',
  period: '7%',
  tasksAssigned: '7%',
  tasksInProgress: '6%',
  tasksCompleted: '7%',
  avgCompletedProcessingHours: '9%',
  avgOpenElapsedHours: '9%',
  personalEfficiencyScore: '8%',
  productivity: '7%',
  onTimeRate: '8%',
  overdueCount: '7%',
  monthlyCompleted: '8%',
};

const statsEmployeeCellSx = {
  width: '14%',
};

const statsChipSx = {
  height: 22,
  maxWidth: '100%',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '0.625rem',
  border: '1px solid',
  '& .MuiChip-label': {
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    px: 0.75,
  },
};

/** 업무 목록 팝업: 가로 스크롤 없이 모달 너비에 맞춤 */
const cardListDialogTableSx = {
  borderCollapse: 'collapse' as const,
  bgcolor: 'transparent',
  width: '100%',
  tableLayout: 'fixed' as const,
  '& .MuiTableCell-root': {
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    verticalAlign: 'middle',
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
    px: 1.25,
  },
};

type ListViewMode = 'page' | 'all';

type AssigneeSortKey =
  | 'employeeName'
  | 'period'
  | 'tasksAssigned'
  | 'tasksInProgress'
  | 'tasksCompleted'
  | 'avgCompletedProcessingHours'
  | 'avgOpenElapsedHours'
  | 'personalEfficiencyScore'
  | 'productivity'
  | 'onTimeRate'
  | 'overdueCount'
  | 'monthlyCompleted';

type ProcessingTimeSortKey =
  | 'employeeName'
  | 'sampleCompleted'
  | 'medianHours'
  | 'avgHours'
  | 'minHours'
  | 'maxHours'
  | 'stdDevHours'
  | 'openElapsedHours';

type EfficiencySortKey =
  | 'employeeName'
  | 'personalEfficiencyScore'
  | 'productivity'
  | 'onTimeRate'
  | 'monthlyCompleted'
  | 'overdueCount'
  | 'avgCompletedProcessingHours';

type SortDir = 'asc' | 'desc';

const statsSortLabelSx = {
  color: 'inherit',
  maxWidth: '100%',
  overflow: 'hidden',
  '& .MuiTableSortLabel-icon': {
    color: 'inherit !important',
    opacity: 0,
    width: 0,
    margin: 0,
    flexShrink: 0,
  },
  '&.Mui-active': {
    color: 'inherit',
    '& .MuiTableSortLabel-icon': {
      opacity: 1,
      width: '0.9rem',
      marginLeft: '2px',
    },
  },
  '&:hover': {
    color: 'inherit',
    '& .MuiTableSortLabel-icon': {
      opacity: 0.55,
      width: '0.9rem',
      marginLeft: '2px',
    },
  },
} as const;

const TEAM_STATS_ROLES = new Set(['root', 'audit', 'admin', 'manager']);

const resolveCardCreatorId = (card: Record<string, unknown>): number | null => {
  const raw =
    card.created_by ??
    card.createdBy ??
    (card.cardCreator as { id?: number } | undefined)?.id ??
    (card.creator as { id?: number } | undefined)?.id;
  if (raw == null) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
};

const isCardRelevantToUser = (card: Record<string, unknown>, userId: number): boolean => {
  const assigneeId = (card.assignee as { id?: number } | undefined)?.id;
  const assigneeUserId = assigneeId != null ? Number(assigneeId) : null;
  const creatorId = resolveCardCreatorId(card);
  return assigneeUserId === userId || creatorId === userId;
};

interface ProcessingDurationStats {
  count: number;
  avgHours: number;
  medianHours: number;
  minHours: number;
  maxHours: number;
  stdDevHours: number;
}

interface WorkStatistic {
  id: number;
  employeeId: number;
  employeeName: string;
  department: string;
  position: string;
  period: string;
  totalHours: number;
  productiveHours: number;
  tasksCompleted: number;
  tasksAssigned: number;
  efficiency: number;
  productivity: number;
  attendanceRate: number;
  tasksInProgress: number;
  tasksTodo: number;
  avgCompletedProcessingHours: number;
  avgOpenElapsedHours: number;
  totalCompletedProcessingHours: number;
  onTimeRate: number;
  overdueCount: number;
  monthlyCompleted: number;
  personalEfficiencyScore: number;
  completedProcessingCount: number;
  openElapsedCount: number;
  completedDuration: ProcessingDurationStats;
  openDuration: ProcessingDurationStats;
}

const compareAssigneeSort = (
  a: WorkStatistic,
  b: WorkStatistic,
  key: AssigneeSortKey,
  dir: SortDir
): number => {
  const mul = dir === 'asc' ? 1 : -1;
  const av = a[key];
  const bv = b[key];
  if (typeof av === 'string' || typeof bv === 'string') {
    return mul * String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }
  return mul * ((Number(av) || 0) - (Number(bv) || 0));
};

const processingTimeSortValue = (stat: WorkStatistic, key: ProcessingTimeSortKey): string | number => {
  switch (key) {
    case 'employeeName':
      return stat.employeeName;
    case 'sampleCompleted':
      return stat.completedDuration.count;
    case 'medianHours':
      return stat.completedDuration.medianHours;
    case 'avgHours':
      return stat.completedDuration.avgHours;
    case 'minHours':
      return stat.completedDuration.minHours;
    case 'maxHours':
      return stat.completedDuration.maxHours;
    case 'stdDevHours':
      return stat.completedDuration.stdDevHours;
    case 'openElapsedHours':
      return stat.openDuration.medianHours;
    default:
      return 0;
  }
};

const compareProcessingTimeSort = (
  a: WorkStatistic,
  b: WorkStatistic,
  key: ProcessingTimeSortKey,
  dir: SortDir
): number => {
  const mul = dir === 'asc' ? 1 : -1;
  const av = processingTimeSortValue(a, key);
  const bv = processingTimeSortValue(b, key);
  if (typeof av === 'string' || typeof bv === 'string') {
    return mul * String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }
  return mul * ((Number(av) || 0) - (Number(bv) || 0));
};

interface UserWorkCardItem {
  id: number;
  title: string;
  boardId: number;
  boardName: string;
  listTitle: string;
  status: 'todo' | 'progress' | 'done';
  dueDate: string | null;
}

const STATUS_SORT_ORDER: Record<UserWorkCardItem['status'], number> = {
  progress: 0,
  todo: 1,
  done: 2
};

const EMPTY_DURATION_STATS: ProcessingDurationStats = {
  count: 0,
  avgHours: 0,
  medianHours: 0,
  minHours: 0,
  maxHours: 0,
  stdDevHours: 0
};

type ProcessingTimeMetric = 'median' | 'average';

type StatAccumulator = WorkStatistic & {
  completedProcessingMs: number;
  openElapsedMs: number;
  onTimeCompleted: number;
  dueDatedCompleted: number;
  completedDurationHoursSamples: number[];
  openDurationHoursSamples: number[];
};

const hoursToDays = (hours: number): number => hours / 24;

const computeSampleStats = (samples: number[]): ProcessingDurationStats => {
  if (samples.length === 0) return { ...EMPTY_DURATION_STATS };

  const sorted = [...samples].sort((a, b) => a - b);
  const count = sorted.length;
  const avgHours = sorted.reduce((sum, value) => sum + value, 0) / count;
  const mid = Math.floor(count / 2);
  const medianHours =
    count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const minHours = sorted[0];
  const maxHours = sorted[count - 1];
  const variance = sorted.reduce((sum, value) => sum + (value - avgHours) ** 2, 0) / count;
  const stdDevHours = Math.sqrt(variance);

  return {
    count,
    avgHours: Number(avgHours.toFixed(2)),
    medianHours: Number(medianHours.toFixed(2)),
    minHours: Number(minHours.toFixed(2)),
    maxHours: Number(maxHours.toFixed(2)),
    stdDevHours: Number(stdDevHours.toFixed(2))
  };
};

const buildCompletedDurationDistribution = (
  samples: number[],
  labels: {
    under1Day: string;
    days1to3: string;
    days3to7: string;
    days7to14: string;
    over14Days: string;
  }
) => {
  const buckets = [
    { name: labels.under1Day, min: 0, max: 24, color: '#16A34A' },
    { name: labels.days1to3, min: 24, max: 72, color: '#1D4E7C' },
    { name: labels.days3to7, min: 72, max: 168, color: '#F59E0B' },
    { name: labels.days7to14, min: 168, max: 336, color: '#F97316' },
    { name: labels.over14Days, min: 336, max: Infinity, color: '#DC2626' }
  ];

  return buckets.map((bucket) => ({
    name: bucket.name,
    value: samples.filter((hours) => hours >= bucket.min && hours < bucket.max).length,
    color: bucket.color
  }));
};

const resolveCardTimestamp = (
  card: Record<string, unknown>,
  field: 'created' | 'completed' | 'updated'
): Date | null => {
  const raw =
    field === 'created'
      ? card.created_at ?? card.createdAt
      : field === 'completed'
        ? card.completed_at ?? card.completedAt
        : card.updated_at ?? card.updatedAt;
  if (!raw) {
    return field === 'completed' ? resolveCardTimestamp(card, 'updated') : null;
  }
  const date = new Date(raw as string | Date);
  return Number.isFinite(date.getTime()) ? date : null;
};

const matchesPeriod = (date: Date, period: string): boolean => {
  const [year, month] = period.split('-').map(Number);
  return date.getFullYear() === year && date.getMonth() + 1 === month;
};

const isOverdueCard = (dueDate: string | null | undefined, now: Date): boolean => {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  return now > due;
};

const isOnTimeCompletion = (dueDate: string | null | undefined, completedAt: Date): boolean => {
  if (!dueDate) return true;
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  return completedAt <= due;
};

const computePersonalEfficiencyScore = (
  completionRate: number,
  onTimeRate: number,
  monthlyCompleted: number,
  overdueCount: number,
  tasksAssigned: number
): number => {
  if (tasksAssigned <= 0) return 0;
  const velocityScore = Math.min(100, monthlyCompleted * 25);
  const overduePenalty = Math.min(40, overdueCount * 10);
  const weighted =
    completionRate * 0.4 +
    onTimeRate * 0.25 +
    velocityScore * 0.2 +
    Math.max(0, 100 - overduePenalty) * 0.15;
  return Number(weighted.toFixed(1));
};

const msBetweenTimestamps = (start?: string | Date | null, end?: string | Date | null): number => {
  if (!start || !end) return 0;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  return endMs - startMs;
};

const createEmptyAccumulator = (
  assigneeId: number,
  meta: { name: string; department: string; position: string } | undefined,
  fallbackName: string,
  period: string
): StatAccumulator => ({
  id: assigneeId,
  employeeId: assigneeId,
  employeeName: meta?.name || fallbackName,
  department: meta?.department || '-',
  position: meta?.position || '-',
  period,
  totalHours: 0,
  productiveHours: 0,
  tasksCompleted: 0,
  tasksAssigned: 0,
  efficiency: 0,
  productivity: 0,
  attendanceRate: 0,
  tasksInProgress: 0,
  tasksTodo: 0,
  avgCompletedProcessingHours: 0,
  avgOpenElapsedHours: 0,
  totalCompletedProcessingHours: 0,
  onTimeRate: 0,
  overdueCount: 0,
  monthlyCompleted: 0,
  personalEfficiencyScore: 0,
  completedProcessingCount: 0,
  openElapsedCount: 0,
  completedDuration: { ...EMPTY_DURATION_STATS },
  openDuration: { ...EMPTY_DURATION_STATS },
  completedProcessingMs: 0,
  openElapsedMs: 0,
  onTimeCompleted: 0,
  dueDatedCompleted: 0,
  completedDurationHoursSamples: [],
  openDurationHoursSamples: []
});

const finalizeStatistic = (stat: StatAccumulator): WorkStatistic => {
  const avgCompletedProcessingHours =
    stat.completedProcessingCount > 0
      ? stat.completedProcessingMs / stat.completedProcessingCount / 3_600_000
      : 0;
  const avgOpenElapsedHours =
    stat.openElapsedCount > 0 ? stat.openElapsedMs / stat.openElapsedCount / 3_600_000 : 0;
  const totalCompletedProcessingHours = stat.completedProcessingMs / 3_600_000;
  // 기한 준수율: (기한 내 완료) / (기한 있는 완료 + 현재 지연 중인 미완료)
  // 완료만 보면 미완료 지연이 있어도 100%가 나와 오해를 줌. 분모에 현재 지연을 포함.
  const deadlineDenom = stat.dueDatedCompleted + stat.overdueCount;
  const onTimeRate =
    deadlineDenom > 0
      ? Number(((stat.onTimeCompleted / deadlineDenom) * 100).toFixed(1))
      : 100;
  const completionRate =
    stat.tasksAssigned > 0 ? (stat.tasksCompleted / stat.tasksAssigned) * 100 : 0;
  const personalEfficiencyScore = computePersonalEfficiencyScore(
    completionRate,
    onTimeRate,
    stat.monthlyCompleted,
    stat.overdueCount,
    stat.tasksAssigned
  );
  const completedDuration = computeSampleStats(stat.completedDurationHoursSamples);
  const openDuration = computeSampleStats(stat.openDurationHoursSamples);

  return {
    id: stat.id,
    employeeId: stat.employeeId,
    employeeName: stat.employeeName,
    department: stat.department,
    position: stat.position,
    period: stat.period,
    totalHours: stat.totalHours,
    productiveHours: stat.productiveHours,
    tasksCompleted: stat.tasksCompleted,
    tasksAssigned: stat.tasksAssigned,
    efficiency: personalEfficiencyScore,
    productivity: Number(completionRate.toFixed(1)),
    attendanceRate: stat.attendanceRate,
    tasksInProgress: stat.tasksInProgress,
    tasksTodo: stat.tasksTodo,
    avgCompletedProcessingHours: Number(avgCompletedProcessingHours.toFixed(2)),
    avgOpenElapsedHours: Number(avgOpenElapsedHours.toFixed(2)),
    totalCompletedProcessingHours: Number(totalCompletedProcessingHours.toFixed(1)),
    onTimeRate,
    overdueCount: stat.overdueCount,
    monthlyCompleted: stat.monthlyCompleted,
    personalEfficiencyScore,
    completedProcessingCount: stat.completedProcessingCount,
    openElapsedCount: stat.openElapsedCount,
    completedDuration,
    openDuration
  };
};

interface StatusSummary {
  todo: number;
  progress: number;
  done: number;
  unassigned: number;
}

/** WorkBoardDetailPage·백엔드와 동일한 “업무 완료” 열 규칙 (완료 시 이동하는 열과 집계 일치) */
const isCompletedListTitle = (title: string): boolean => {
  const normalized = String(title || '').trim().toLowerCase();
  if (!normalized) return false;
  const keywords = ['업무 완료', '완료', '종료', 'done', 'completed', 'closed', 'work completed'];
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
};

const resolveCompletedListId = (
  lists: { id: number; title: string; position: number }[]
): number | null => {
  const sorted = [...lists].sort((a, b) => a.position - b.position);
  const preferred = sorted.find((list) => {
    const title = String(list.title || '').trim().toLowerCase();
    return title === '업무 완료' || title.includes('업무 완료') || title.includes('work completed');
  });
  if (preferred) return preferred.id;
  const byTitle = sorted.find((l) => isCompletedListTitle(l.title));
  if (byTitle) return byTitle.id;
  if (sorted.length >= 2) return sorted[sorted.length - 1].id;
  return null;
};

const listStatusForStats = (
  list: { id: number; title: string; position: number },
  completedListId: number | null
): 'done' | 'progress' | 'todo' => {
  if (completedListId != null && list.id === completedListId) return 'done';
  const normalized = (list.title || '').replace(/\s+/g, '').toLowerCase();
  if (normalized.includes('진행') || normalized.includes('doing') || normalized.includes('progress')) {
    return 'progress';
  }
  return 'todo';
};

const WorkStatistics: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useStore();
  const isRoot = user?.role === 'root';
  const isPersonalStatsView = !user?.role || !TEAM_STATS_ROLES.has(user.role);
  const currentUserId = user?.id != null ? Number(user.id) : null;
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | ''>('');
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [ownCompanyName, setOwnCompanyName] = useState('');
  const effectiveCompanyId = useMemo(() => {
    if (isRoot) {
      return selectedCompanyId !== '' ? Number(selectedCompanyId) : null;
    }
    return user?.company_id != null ? Number(user.company_id) : null;
  }, [isRoot, selectedCompanyId, user?.company_id]);
  const [statistics, setStatistics] = useState<WorkStatistic[]>([]);
  const [filteredStatistics, setFilteredStatistics] = useState<WorkStatistic[]>([]);
  const [statusSummary, setStatusSummary] = useState<StatusSummary>({ todo: 0, progress: 0, done: 0, unassigned: 0 });
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [listViewMode, setListViewMode] = useState<ListViewMode>('page');
  const [assigneeSortBy, setAssigneeSortBy] = useState<AssigneeSortKey>('employeeName');
  const [assigneeSortDir, setAssigneeSortDir] = useState<SortDir>('asc');
  const [processingSortBy, setProcessingSortBy] = useState<ProcessingTimeSortKey>('medianHours');
  const [processingSortDir, setProcessingSortDir] = useState<SortDir>('desc');
  const [efficiencySortBy, setEfficiencySortBy] = useState<EfficiencySortKey>('personalEfficiencyScore');
  const [efficiencySortDir, setEfficiencySortDir] = useState<SortDir>('desc');
  const [tabValue, setTabValue] = useState(0);
  const [processingTimeMetric, setProcessingTimeMetric] = useState<ProcessingTimeMetric>('median');
  const [completedDurationSamples, setCompletedDurationSamples] = useState<number[]>([]);
  const [cardsByEmployeeId, setCardsByEmployeeId] = useState<Record<number, UserWorkCardItem[]>>({});
  const [cardListEmployee, setCardListEmployee] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const currentPeriod = useMemo(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  }, []);

  const loadCompanies = useCallback(async () => {
    if (!isRoot) {
      const companyId = Number(user?.company_id || 0);
      if (!Number.isFinite(companyId) || companyId <= 0) {
        setOwnCompanyName('');
        return;
      }
      try {
        const company = await useReferenceDataStore.getState().fetchCompanyById(companyId);
        setOwnCompanyName(String(company?.name || '').trim());
      } catch {
        setOwnCompanyName('');
      }
      return;
    }
    try {
      const rows = await useReferenceDataStore.getState().fetchCompanies();
      const mapped = rows.map((c: any) => ({
        id: Number(c.id),
        name: String(c.name || `Company ${c.id}`),
      }));
      setCompanies(mapped);
      if (selectedCompanyId === '' && mapped.length > 0) {
        const loginCompanyId = Number(user?.company_id || 0);
        const matched = mapped.find((c) => c.id === loginCompanyId);
        setSelectedCompanyId(matched ? matched.id : mapped[0].id);
      }
    } catch {
      setError(t('workStatistics.errors.loadCompaniesFailed'));
    }
  }, [isRoot, selectedCompanyId, t, user?.company_id]);

  const loadStatisticsData = useCallback(async () => {
    setError('');
    try {
      if (
        effectiveCompanyId == null ||
        !Number.isFinite(effectiveCompanyId) ||
        effectiveCompanyId <= 0
      ) {
        setStatistics([]);
        setStatusSummary({ todo: 0, progress: 0, done: 0, unassigned: 0 });
        setCompletedDurationSamples([]);
        setCardsByEmployeeId({});
        return;
      }

      const boardsRes = await workBoardService.getBoards({ company_id: effectiveCompanyId });
      if (!boardsRes?.success) {
        throw new Error(boardsRes?.message || t('workStatistics.errors.loadBoardsFailed'));
      }

      const boardIds: number[] = (boardsRes.data || [])
        .filter((b: any) => Number(b.company_id) === effectiveCompanyId)
        .map((b: any) => b.id)
        .filter(Boolean);
      if (boardIds.length === 0) {
        setStatistics([]);
        setStatusSummary({ todo: 0, progress: 0, done: 0, unassigned: 0 });
        setCardsByEmployeeId({});
        return;
      }

      const details = await Promise.all(
        boardIds.map(async (id) => {
          try {
            const r = await workBoardService.getBoard(id);
            return r?.success ? r.data : null;
          } catch {
            return null;
          }
        })
      );

      const validBoards = (details.filter(Boolean) as any[]).filter(
        (board) => Number(board.company_id) === effectiveCompanyId
      );
      const memberMeta = new Map<number, { name: string; department: string; position: string }>();
      const statMap = new Map<number, StatAccumulator>();
      const cardsMap = new Map<number, UserWorkCardItem[]>();
      const now = new Date();
      const globalCompletedSamples: number[] = [];

      const summary: StatusSummary = { todo: 0, progress: 0, done: 0, unassigned: 0 };

      for (const board of validBoards) {
        const boardId = Number(board.id);
        const boardName = String(board.name || '');
        for (const m of board.members || []) {
          const uid = m?.user?.id;
          if (!uid) continue;
          if (!memberMeta.has(uid)) {
            memberMeta.set(uid, {
              name: m.user.username || t('workStatistics.userFallback', { id: uid }),
              department: m.user.department || '-',
              position: m.user.position || '-'
            });
          }
        }

        const listsForResolve = (board.lists || []).map((l: any) => ({
          id: Number(l.id),
          title: String(l.title || ''),
          position: Number(l.position) || 0
        }));
        const completedListId = resolveCompletedListId(listsForResolve);

        for (const list of board.lists || []) {
          const listTitle = String(list.title || '');
          const status = listStatusForStats(
            {
              id: Number(list.id),
              title: listTitle,
              position: Number(list.position) || 0
            },
            completedListId
          );
          for (const card of list.cards || []) {
            if (isPersonalStatsView && currentUserId != null && !isCardRelevantToUser(card, currentUserId)) {
              continue;
            }

            if (status === 'done') summary.done += 1;
            else if (status === 'progress') summary.progress += 1;
            else summary.todo += 1;

            const assigneeId = card.assignee?.id != null ? Number(card.assignee.id) : null;
            const statUserId = isPersonalStatsView && currentUserId != null
              ? currentUserId
              : assigneeId;

            if (!statUserId) {
              summary.unassigned += 1;
              continue;
            }

            const cardItem: UserWorkCardItem = {
              id: Number(card.id),
              title: String(card.title || '').trim() || `#${card.id}`,
              boardId,
              boardName,
              listTitle,
              status,
              dueDate: card.due_date ? String(card.due_date).slice(0, 10) : null
            };
            const existingCards = cardsMap.get(statUserId) || [];
            existingCards.push(cardItem);
            cardsMap.set(statUserId, existingCards);

            if (!statMap.has(statUserId)) {
              const meta = memberMeta.get(statUserId);
              const fallbackName = isPersonalStatsView && currentUserId === statUserId
                ? (user?.username || t('workStatistics.userFallback', { id: statUserId }))
                : (card.assignee?.username || t('workStatistics.userFallback', { id: statUserId }));
              statMap.set(
                statUserId,
                createEmptyAccumulator(
                  statUserId,
                  meta ?? (isPersonalStatsView && currentUserId === statUserId
                    ? {
                        name: user?.username || fallbackName,
                        department: (user as { department?: string })?.department || '-',
                        position: (user as { position?: string })?.position || '-',
                      }
                    : undefined),
                  fallbackName,
                  currentPeriod
                )
              );
            }

            const item = statMap.get(statUserId)!;
            item.tasksAssigned += 1;
            if (status === 'done') item.tasksCompleted += 1;
            else if (status === 'progress') item.tasksInProgress += 1;
            else item.tasksTodo += 1;

            const createdAt = resolveCardTimestamp(card, 'created');
            const completedAt = resolveCardTimestamp(card, 'completed');
            if (createdAt) {
              if (status === 'done') {
                const endAt = completedAt ?? now;
                const durationMs = msBetweenTimestamps(createdAt, endAt);
                const durationHours = (durationMs > 0 ? durationMs : 60_000) / 3_600_000;
                item.completedProcessingMs += durationMs > 0 ? durationMs : 60_000;
                item.completedProcessingCount += 1;
                item.completedDurationHoursSamples.push(durationHours);
                globalCompletedSamples.push(durationHours);
                if (matchesPeriod(endAt, currentPeriod)) {
                  item.monthlyCompleted += 1;
                }
                if (card.due_date) {
                  item.dueDatedCompleted += 1;
                  if (isOnTimeCompletion(card.due_date, endAt)) {
                    item.onTimeCompleted += 1;
                  }
                }
              } else {
                const durationMs = msBetweenTimestamps(createdAt, now);
                if (durationMs > 0) {
                  const durationHours = durationMs / 3_600_000;
                  item.openElapsedMs += durationMs;
                  item.openElapsedCount += 1;
                  item.openDurationHoursSamples.push(durationHours);
                }
                if (isOverdueCard(card.due_date, now)) {
                  item.overdueCount += 1;
                }
              }
            }
          }
        }
      }

      const rows = Array.from(statMap.values())
        .filter((s) => s.tasksAssigned > 0)
        .map((s) => {
        const totalHours = s.tasksAssigned * 2;
        const productiveHours = s.tasksCompleted * 2 + s.tasksInProgress * 1.2;
        const finalized = finalizeStatistic(s);
        const doneRate = finalized.productivity;
        return {
          ...finalized,
          totalHours: Number(totalHours.toFixed(1)),
          productiveHours: Number(productiveHours.toFixed(1)),
          attendanceRate: Number(Math.min(100, 85 + doneRate * 0.15).toFixed(1))
        };
      });

      rows.sort(
        (a, b) =>
          b.personalEfficiencyScore - a.personalEfficiencyScore ||
          b.tasksAssigned - a.tasksAssigned ||
          b.tasksCompleted - a.tasksCompleted
      );

      const cardsRecord: Record<number, UserWorkCardItem[]> = {};
      cardsMap.forEach((cards, uid) => {
        cardsRecord[uid] = [...cards].sort(
          (a, b) =>
            STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status] ||
            a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
        );
      });

      setStatistics(rows);
      setStatusSummary(summary);
      setCompletedDurationSamples(globalCompletedSamples);
      setCardsByEmployeeId(cardsRecord);
    } catch (err: any) {
      setError(err?.message || t('workStatistics.errors.loadStatsFailed'));
      setStatistics([]);
      setStatusSummary({ todo: 0, progress: 0, done: 0, unassigned: 0 });
      setCompletedDurationSamples([]);
      setCardsByEmployeeId({});
    }
  }, [currentPeriod, currentUserId, effectiveCompanyId, isPersonalStatsView, t, user]);

  const openEmployeeCardList = useCallback((employeeId: number, employeeName: string) => {
    setCardListEmployee({ id: employeeId, name: employeeName });
  }, []);

  const closeEmployeeCardList = useCallback(() => {
    setCardListEmployee(null);
  }, []);

  const selectedEmployeeCards = useMemo(() => {
    if (!cardListEmployee) return [];
    return cardsByEmployeeId[cardListEmployee.id] || [];
  }, [cardListEmployee, cardsByEmployeeId]);

  const statusLabel = useCallback(
    (status: UserWorkCardItem['status']) => {
      if (status === 'done') return t('workStatistics.status.done');
      if (status === 'progress') return t('workStatistics.status.inProgress');
      return t('workStatistics.status.todo');
    },
    [t]
  );

  const statusChipColor = (status: UserWorkCardItem['status']) => {
    if (status === 'done') return 'success' as const;
    if (status === 'progress') return 'warning' as const;
    return 'default' as const;
  };

  const filterStatistics = useCallback(() => {
    let filtered = statistics;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter((stat) =>
        stat.employeeName.toLowerCase().includes(q) ||
        stat.department.toLowerCase().includes(q) ||
        stat.position.toLowerCase().includes(q)
      );
    }

    if (departmentFilter) {
      filtered = filtered.filter((stat) => stat.department === departmentFilter);
    }

    if (periodFilter) {
      filtered = filtered.filter((stat) => stat.period === periodFilter);
    }

    setFilteredStatistics(filtered);
    setPage(1);
  }, [statistics, searchTerm, departmentFilter, periodFilter]);

  const handleListViewModeChange = (mode: ListViewMode) => {
    if (mode === listViewMode) return;
    setListViewMode(mode);
    setPage(1);
  };

  const handleAssigneeSort = (key: AssigneeSortKey) => {
    setPage(1);
    if (assigneeSortBy === key) {
      setAssigneeSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setAssigneeSortBy(key);
    setAssigneeSortDir(key === 'employeeName' || key === 'period' ? 'asc' : 'desc');
  };

  const handleProcessingSort = (key: ProcessingTimeSortKey) => {
    if (processingSortBy === key) {
      setProcessingSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setProcessingSortBy(key);
    setProcessingSortDir(key === 'employeeName' ? 'asc' : 'desc');
  };

  const handleEfficiencySort = (key: EfficiencySortKey) => {
    if (efficiencySortBy === key) {
      setEfficiencySortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setEfficiencySortBy(key);
    setEfficiencySortDir(key === 'employeeName' ? 'asc' : 'desc');
  };

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    loadStatisticsData();
  }, [loadStatisticsData]);

  useEffect(() => {
    filterStatistics();
  }, [filterStatistics]);

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90) return 'success';
    if (efficiency >= 70) return 'warning';
    return 'error';
  };

  const getProductivityColor = (productivity: number) => {
    if (productivity >= 90) return 'success';
    if (productivity >= 70) return 'warning';
    return 'error';
  };

  const formatProcessingDuration = useCallback(
    (hours: number, hasData = false) => {
      if (hours <= 0) {
        return hasData
          ? t('workStatistics.duration.lessThanMinute')
          : t('workStatistics.duration.none');
      }
      if (hours >= 24) {
        return t('workStatistics.duration.days', { value: (hours / 24).toFixed(1) });
      }
      if (hours >= 1) {
        return t('workStatistics.duration.hours', { value: Math.round(hours) });
      }
      return t('workStatistics.duration.minutes', { value: Math.max(1, Math.round(hours * 60)) });
    },
    [t]
  );

  const formatDaysLabel = useCallback(
    (days: number, hasData = false) => {
      if (days <= 0) {
        return hasData
          ? t('workStatistics.duration.lessThanMinute')
          : t('workStatistics.duration.none');
      }
      if (days >= 1) {
        return t('workStatistics.duration.days', { value: days.toFixed(1) });
      }
      return t('workStatistics.duration.hours', { value: Math.max(1, Math.round(days * 24)) });
    },
    [t]
  );

  const softMetricColor = (kind: 'success' | 'warning' | 'error') =>
    kind === 'success'
      ? '#15803D'
      : kind === 'warning'
        ? '#B45309'
        : '#DC2626';

  const safeAvg = (arr: number[]) => {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, n) => sum + n, 0) / arr.length;
  };

  const averageEfficiency = safeAvg(
    statistics.filter((s) => s.tasksAssigned > 0).map((s) => s.personalEfficiencyScore)
  );
  const averageOnTimeRate = safeAvg(
    statistics.filter((s) => s.tasksAssigned > 0).map((s) => s.onTimeRate)
  );
  const averageProductivity = safeAvg(
    statistics.filter((s) => s.tasksAssigned > 0).map((s) => s.productivity)
  );
  const totalAssigned = statistics.reduce((sum, s) => sum + s.tasksAssigned, 0);
  const totalTasksCompleted = statistics.reduce((sum, s) => sum + s.tasksCompleted, 0);
  const totalCompletedProcessingHours = statistics.reduce(
    (sum, s) => sum + s.totalCompletedProcessingHours,
    0
  );
  const averageProcessingTime =
    totalTasksCompleted > 0 ? totalCompletedProcessingHours / totalTasksCompleted : 0;
  const completionRate = totalAssigned > 0 ? (totalTasksCompleted / totalAssigned) * 100 : 0;

  const sortedFilteredStatistics = useMemo(() => {
    const next = [...filteredStatistics];
    next.sort((a, b) => compareAssigneeSort(a, b, assigneeSortBy, assigneeSortDir));
    return next;
  }, [filteredStatistics, assigneeSortBy, assigneeSortDir]);

  const displayedStatistics =
    listViewMode === 'all'
      ? sortedFilteredStatistics
      : sortedFilteredStatistics.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const departments = Array.from(new Set(statistics.map((stat) => stat.department))).filter(Boolean);
  const periods = Array.from(new Set(statistics.map((stat) => stat.period))).filter(Boolean);

  const productivityData = statistics.slice(0, 8).map((s) => ({
    name: s.employeeName,
    productivity: s.productivity,
    efficiency: s.efficiency
  }));

  const timeDistributionData = [
    { name: t('workStatistics.status.todo'), value: statusSummary.todo, color: '#94A3B8' },
    { name: t('workStatistics.status.inProgress'), value: statusSummary.progress, color: '#1D4E7C' },
    { name: t('workStatistics.status.done'), value: statusSummary.done, color: '#16A34A' },
    { name: t('workStatistics.status.unassigned'), value: statusSummary.unassigned, color: '#F59E0B' }
  ];

  const efficiencyTrendData = statistics
    .filter((s) => s.tasksAssigned > 0)
    .sort((a, b) => b.personalEfficiencyScore - a.personalEfficiencyScore)
    .slice(0, 10)
    .map((s) => ({
      name: s.employeeName,
      personalEfficiency: s.personalEfficiencyScore,
      completionRate: s.productivity,
      onTimeRate: s.onTimeRate
    }));

  const teamCompletedStats = useMemo(
    () => computeSampleStats(completedDurationSamples),
    [completedDurationSamples]
  );

  const completedDurationDistribution = useMemo(
    () =>
      buildCompletedDurationDistribution(completedDurationSamples, {
        under1Day: t('workStatistics.processingTime.buckets.under1Day'),
        days1to3: t('workStatistics.processingTime.buckets.days1to3'),
        days3to7: t('workStatistics.processingTime.buckets.days3to7'),
        days7to14: t('workStatistics.processingTime.buckets.days7to14'),
        over14Days: t('workStatistics.processingTime.buckets.over14Days')
      }).filter((bucket) => bucket.value > 0),
    [completedDurationSamples, t]
  );

  const teamCompletedMedianDays = hoursToDays(teamCompletedStats.medianHours);
  const teamCompletedAvgDays = hoursToDays(teamCompletedStats.avgHours);

  const processingTimeChartData = useMemo(() => {
    const pickCompletedHours = (stats: ProcessingDurationStats) =>
      processingTimeMetric === 'median' ? stats.medianHours : stats.avgHours;
    const pickOpenHours = (stats: ProcessingDurationStats) =>
      processingTimeMetric === 'median' ? stats.medianHours : stats.avgHours;

    return statistics
      .filter((s) => s.completedDuration.count > 0 || s.openDuration.count > 0)
      .sort(
        (a, b) =>
          pickCompletedHours(b.completedDuration) - pickCompletedHours(a.completedDuration) ||
          pickOpenHours(b.openDuration) - pickOpenHours(a.openDuration)
      )
      .slice(0, 10)
      .map((s) => ({
        name: s.employeeName,
        completedDays: Number(hoursToDays(pickCompletedHours(s.completedDuration)).toFixed(1)),
        openDays: Number(hoursToDays(pickOpenHours(s.openDuration)).toFixed(1)),
        completedRange: [
          Number(hoursToDays(s.completedDuration.minHours).toFixed(1)),
          Number(hoursToDays(s.completedDuration.maxHours).toFixed(1))
        ] as [number, number],
        openRange: [
          Number(hoursToDays(s.openDuration.minHours).toFixed(1)),
          Number(hoursToDays(s.openDuration.maxHours).toFixed(1))
        ] as [number, number],
        completedCount: s.completedDuration.count,
        openCount: s.openDuration.count
      }));
  }, [statistics, processingTimeMetric]);

  const processingTimeDetailRows = useMemo(() => {
    const rows = statistics.filter(
      (s) => s.completedDuration.count > 0 || s.openDuration.count > 0
    );
    rows.sort((a, b) => compareProcessingTimeSort(a, b, processingSortBy, processingSortDir));
    return rows;
  }, [statistics, processingSortBy, processingSortDir]);

  const personalEfficiencyRows = useMemo(() => {
    const rows = statistics.filter((s) => s.tasksAssigned > 0);
    rows.sort((a, b) => compareAssigneeSort(a, b, efficiencySortBy, efficiencySortDir));
    return rows;
  }, [statistics, efficiencySortBy, efficiencySortDir]);

  const TabPanel = ({ children, value, index, ...other }: any) => (
    <div role="tabpanel" hidden={value !== index} id={`tabpanel-${index}`} aria-labelledby={`tab-${index}`} {...other}>
      {value === index && <Box sx={{ pt: 2, px: { xs: 2, sm: 2.5, md: 3 } }}>{children}</Box>}
    </div>
  );

  const statsFilterFieldSx = {
    ...mvsSearchFieldSx,
    ...mvsFilterFieldHeightSx,
  } as const;

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('workStatistics.title')}
        actions={
          <>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon sx={{ fontSize: 18 }} />}
            onClick={loadStatisticsData}
            sx={mvsBodyOutlinedBtnSx}
          >
            {t('workStatistics.actions.refresh')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon sx={{ fontSize: 18 }} />}
            sx={mvsBodyOutlinedBtnSx}
          >
            {t('workStatistics.actions.export')}
          </Button>
          </>
        }
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', xl: 'repeat(7, 1fr)' }, gap: 2.5, mb: 3 }}>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.02em' }}>
              {t('workStatistics.summary.avgPersonalEfficiency')}
            </Typography>
            <Typography variant="kpiNumber" sx={{ fontWeight: 600, color: softMetricColor(getEfficiencyColor(averageEfficiency) as 'success' | 'warning' | 'error') }}>
              {averageEfficiency.toFixed(1)}%
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.02em' }}>
              {t('workStatistics.summary.avgOnTimeRate')}
            </Typography>
            <Typography variant="kpiNumber" sx={{ fontWeight: 600, color: softMetricColor(getProductivityColor(averageOnTimeRate) as 'success' | 'warning' | 'error') }}>
              {averageOnTimeRate.toFixed(1)}%
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.02em' }}>
              {t('workStatistics.summary.avgCompletionRate')}
            </Typography>
            <Typography variant="kpiNumber" sx={{ fontWeight: 600, color: softMetricColor(getProductivityColor(averageProductivity) as 'success' | 'warning' | 'error') }}>
              {averageProductivity.toFixed(1)}%
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.02em' }}>
              {t('workStatistics.summary.totalAssignedCards')}
            </Typography>
            <Typography variant="kpiNumber" sx={{ fontWeight: 600, color: 'text.primary' }}>{totalAssigned}</Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.02em' }}>
              {t('workStatistics.summary.completedCards')}
            </Typography>
            <Typography variant="kpiNumber" sx={{ fontWeight: 600, color: 'text.primary' }}>{totalTasksCompleted}</Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.02em' }}>
              {t('workStatistics.summary.overallCompletionRate')}
            </Typography>
            <Typography variant="kpiNumber" sx={{ fontWeight: 600, color: softMetricColor('success') }}>{completionRate.toFixed(1)}%</Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={mvsKpiCardSx}>
          <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.02em' }}>
              {t('workStatistics.summary.avgProcessingTime')}
            </Typography>
            <Typography variant="kpiNumber" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {formatProcessingDuration(averageProcessingTime, totalTasksCompleted > 0)}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 2,
            bgcolor: '#FFFFFF',
            ...statsFilterFieldSx,
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: isRoot ? '2fr 1fr 1fr 1fr auto' : '2fr 1fr 1fr auto',
            },
            gap: 2,
            alignItems: 'flex-end',
          }}
        >
            <TextField
              fullWidth
              size="small"
              label={t('common.search')}
              placeholder={t('workStatistics.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                )
              }}
              sx={statsFilterFieldSx}
            />
            {isRoot && (
              <TextField
                fullWidth
                size="small"
                select
                label={t('workStatistics.filters.company')}
                value={selectedCompanyId}
                onChange={(e) => {
                  const value = String(e.target.value);
                  if (value === '') {
                    setSelectedCompanyId('');
                  } else {
                    const num = Number(value);
                    setSelectedCompanyId(Number.isFinite(num) ? num : '');
                  }
                }}
                InputLabelProps={{ shrink: true }}
                SelectProps={{ displayEmpty: true }}
                sx={statsFilterFieldSx}
              >
                {companies.map((company) => (
                  <MenuItem key={company.id} value={company.id}>
                    {company.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              fullWidth
              size="small"
              select
              label={t('workStatistics.filters.department')}
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
              sx={statsFilterFieldSx}
            >
              <MenuItem value="">{t('workStatistics.filters.all')}</MenuItem>
              {departments.map((dept) => (
                <MenuItem key={dept} value={dept}>{dept}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              size="small"
              select
              label={t('workStatistics.filters.period')}
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              InputLabelProps={{ shrink: true }}
              SelectProps={{ displayEmpty: true }}
              sx={statsFilterFieldSx}
            >
              <MenuItem value="">{t('workStatistics.filters.all')}</MenuItem>
              {periods.map((period) => (
                <MenuItem key={period} value={period}>{period}</MenuItem>
              ))}
            </TextField>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FilterIcon sx={{ fontSize: 18 }} />}
              onClick={() => {
                setSearchTerm('');
                setDepartmentFilter('');
                setPeriodFilter('');
              }}
              sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap' }}
            >
              {t('workStatistics.actions.reset')}
            </Button>
        </Box>
      </Card>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: '#E2E8F0' }}>
          <Tabs
            value={tabValue}
            onChange={(_e, newValue) => setTabValue(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 40,
              px: { xs: 1, sm: 1.5 },
              bgcolor: '#FFFFFF',
              '& .MuiTabs-indicator': {
                height: 3,
                borderRadius: '3px 3px 0 0',
              },
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.8125rem',
                minHeight: 40,
                py: 0.75,
                letterSpacing: '-0.01em',
                color: 'text.secondary',
              },
              '& .MuiTab-root.Mui-selected': {
                color: 'primary.main',
                fontWeight: 700,
              },
            }}
          >
            <Tab label={t('workStatistics.tabs.assigneeStats')} />
            <Tab label={t('workStatistics.tabs.completionComparison')} />
            <Tab label={t('workStatistics.tabs.cardStatusDistribution')} />
            <Tab label={t('workStatistics.tabs.efficiencyAnalysis')} />
            <Tab label={t('workStatistics.tabs.processingTimeAnalysis')} />
            <Tab label={t('workStatistics.tabs.evaluation')} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box sx={listViewModeBarSx}>
            <Button
              size="small"
              disableElevation
              variant={listViewMode === 'all' ? 'contained' : 'outlined'}
              onClick={() => handleListViewModeChange('all')}
              sx={{
                ...listViewModeBtnSx,
                ...(listViewMode === 'all'
                  ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
                  : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
              }}
            >
              {t('workStatistics.listView.viewAll')}
            </Button>
            <Button
              size="small"
              disableElevation
              variant={listViewMode === 'page' ? 'contained' : 'outlined'}
              onClick={() => handleListViewModeChange('page')}
              sx={{
                ...listViewModeBtnSx,
                ...(listViewMode === 'page'
                  ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
                  : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
              }}
            >
              {t('workStatistics.listView.viewPages')}
            </Button>
          </Box>
          <TableContainer
            sx={{
              ...mvsBodyListTableSx,
              width: '100%',
              maxWidth: '100%',
              overflowX: 'hidden',
              // 전체보기: 표 하단 선과 카드 외곽선이 붙지 않도록 여백
              mb: listViewMode === 'all' ? 2.5 : 0,
            }}
          >
            <Table size="small" sx={statsTableSx}>
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  {(
                    [
                      ['employeeName', t('workStatistics.columns.employeeInfo')],
                      ['period', t('workStatistics.columns.period')],
                      ['tasksAssigned', t('workStatistics.columns.totalAssignedCards')],
                      ['tasksInProgress', t('workStatistics.columns.inProgress')],
                      ['tasksCompleted', t('workStatistics.columns.completedCards')],
                      ['avgCompletedProcessingHours', t('workStatistics.columns.avgProcessingTime')],
                      ['avgOpenElapsedHours', t('workStatistics.columns.avgElapsedTime')],
                      ['personalEfficiencyScore', t('workStatistics.columns.personalEfficiency')],
                      ['productivity', t('workStatistics.columns.completionRate')],
                      ['onTimeRate', t('workStatistics.columns.onTimeRate')],
                      ['overdueCount', t('workStatistics.columns.overdueCards')],
                      ['monthlyCompleted', t('workStatistics.columns.monthlyCompleted')],
                    ] as Array<[AssigneeSortKey, string]>
                  ).map(([key, label]) => (
                    <TableCell
                      key={key}
                      sx={{
                        width: assigneeColWidth[key],
                        ...(key === 'employeeName' ? statsEmployeeCellSx : null),
                      }}
                      sortDirection={assigneeSortBy === key ? assigneeSortDir : false}
                    >
                      <TableSortLabel
                        active={assigneeSortBy === key}
                        direction={assigneeSortBy === key ? assigneeSortDir : 'asc'}
                        onClick={() => handleAssigneeSort(key)}
                        sx={statsSortLabelSx}
                        title={
                          key === 'onTimeRate'
                            ? t('workStatistics.tooltips.onTimeRate')
                            : label
                        }
                      >
                        <Box
                          component="span"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                          }}
                        >
                          {label}
                        </Box>
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody sx={mvsTableBodyRowSx}>
                {displayedStatistics.map((stat) => (
                  <TableRow key={stat.id}>
                    <TableCell sx={statsEmployeeCellSx}>
                      <Box
                        component="button"
                        type="button"
                        onClick={() => openEmployeeCardList(stat.employeeId, stat.employeeName)}
                        title={stat.employeeName}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          minWidth: 0,
                          maxWidth: '100%',
                          p: 0,
                          m: 0,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          '&:hover .employee-name': {
                            color: 'primary.main',
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        <Avatar
                          sx={{
                            mr: 0.75,
                            width: 28,
                            height: 28,
                            flexShrink: 0,
                            bgcolor: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.08)' : alpha(theme.palette.common.white, 0.12),
                            color: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.55)' : theme.palette.grey[300],
                          }}
                        >
                          <PersonIcon sx={{ fontSize: 17 }} />
                        </Avatar>
                        <Typography
                          className="employee-name"
                          variant="body2"
                          fontWeight={600}
                          noWrap
                          sx={{ color: 'text.primary', minWidth: 0 }}
                        >
                          {stat.employeeName}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'text.primary', opacity: 0.88, fontWeight: 500 }}>{stat.period}</TableCell>
                    <TableCell sx={{ color: 'text.primary', opacity: 0.88, fontWeight: 500 }}>{stat.tasksAssigned}</TableCell>
                    <TableCell sx={{ color: 'text.primary', opacity: 0.88, fontWeight: 500 }}>{stat.tasksInProgress}</TableCell>
                    <TableCell sx={{ color: 'text.primary', opacity: 0.88, fontWeight: 500 }}>{stat.tasksCompleted}</TableCell>
                    <TableCell sx={{ color: 'text.primary', opacity: 0.88, fontWeight: 500 }}>
                      {formatProcessingDuration(stat.avgCompletedProcessingHours, stat.completedProcessingCount > 0)}
                    </TableCell>
                    <TableCell sx={{ color: 'text.primary', opacity: 0.88, fontWeight: 500 }}>
                      {formatProcessingDuration(stat.avgOpenElapsedHours, stat.openElapsedCount > 0)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${stat.personalEfficiencyScore.toFixed(1)}%`}
                        size="small"
                        sx={{
                          ...statsChipSx,
                          borderColor:
                            getEfficiencyColor(stat.personalEfficiencyScore) === 'success'
                              ? alpha(theme.palette.success.main, 0.35)
                              : getEfficiencyColor(stat.personalEfficiencyScore) === 'warning'
                                ? alpha(theme.palette.warning.main, 0.4)
                                : alpha(theme.palette.error.main, 0.35),
                          bgcolor:
                            getEfficiencyColor(stat.personalEfficiencyScore) === 'success'
                              ? alpha(theme.palette.success.main, 0.08)
                              : getEfficiencyColor(stat.personalEfficiencyScore) === 'warning'
                                ? alpha(theme.palette.warning.main, 0.1)
                                : alpha(theme.palette.error.main, 0.08),
                          color: softMetricColor(getEfficiencyColor(stat.personalEfficiencyScore) as 'success' | 'warning' | 'error'),
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${stat.productivity.toFixed(1)}%`}
                        size="small"
                        sx={{
                          ...statsChipSx,
                          borderColor:
                            getProductivityColor(stat.productivity) === 'success'
                              ? alpha(theme.palette.success.main, 0.35)
                              : getProductivityColor(stat.productivity) === 'warning'
                                ? alpha(theme.palette.warning.main, 0.4)
                                : alpha(theme.palette.error.main, 0.35),
                          bgcolor:
                            getProductivityColor(stat.productivity) === 'success'
                              ? alpha(theme.palette.success.main, 0.08)
                              : getProductivityColor(stat.productivity) === 'warning'
                                ? alpha(theme.palette.warning.main, 0.1)
                                : alpha(theme.palette.error.main, 0.08),
                          color: softMetricColor(getProductivityColor(stat.productivity) as 'success' | 'warning' | 'error'),
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${stat.onTimeRate.toFixed(1)}%`}
                        size="small"
                        sx={{
                          ...statsChipSx,
                          borderColor:
                            getProductivityColor(stat.onTimeRate) === 'success'
                              ? alpha(theme.palette.success.main, 0.35)
                              : getProductivityColor(stat.onTimeRate) === 'warning'
                                ? alpha(theme.palette.warning.main, 0.4)
                                : alpha(theme.palette.error.main, 0.35),
                          bgcolor:
                            getProductivityColor(stat.onTimeRate) === 'success'
                              ? alpha(theme.palette.success.main, 0.08)
                              : getProductivityColor(stat.onTimeRate) === 'warning'
                                ? alpha(theme.palette.warning.main, 0.1)
                                : alpha(theme.palette.error.main, 0.08),
                          color: softMetricColor(getProductivityColor(stat.onTimeRate) as 'success' | 'warning' | 'error'),
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: stat.overdueCount > 0 ? 'error.main' : 'text.primary', opacity: 0.88, fontWeight: 600 }}>
                      {stat.overdueCount}
                    </TableCell>
                    <TableCell sx={{ color: 'text.primary', opacity: 0.88, fontWeight: 500 }}>
                      {stat.monthlyCompleted}
                    </TableCell>
                  </TableRow>
                ))}
                {displayedStatistics.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12}>
                      <Typography sx={{ py: 2, textAlign: 'center', color: 'text.primary', opacity: 0.65 }}>
                        {t('workStatistics.empty.noAssigneeStats')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {listViewMode === 'page' && (
            <Box sx={mvsBodyPaginationSx}>
              <Pagination
                count={Math.max(1, Math.ceil(sortedFilteredStatistics.length / itemsPerPage))}
                page={page}
                onChange={(_, value) => setPage(value)}
                shape="rounded"
                siblingCount={1}
              />
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', fontWeight: 600 }}>
            {t('workStatistics.charts.completionByAssignee')}
          </Typography>
          <Box sx={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={productivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Line type="monotone" dataKey="productivity" name={t('workStatistics.columns.completionRate')} stroke="#1D4E7C" strokeWidth={2} />
                <Line type="monotone" dataKey="efficiency" name={t('workStatistics.columns.efficiency')} stroke="#1D4E7C" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', fontWeight: 600 }}>
            {t('workStatistics.charts.cardStatusDistribution')}
          </Typography>
          <Box sx={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={timeDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {timeDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', fontWeight: 600 }}>
            {t('workStatistics.charts.personalEfficiencyByAssignee')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {t('workStatistics.tooltips.personalEfficiencyChart')}
          </Typography>
          <Box sx={{ height: 400, mb: 3 }}>
            {efficiencyTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={efficiencyTrendData} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar
                    dataKey="personalEfficiency"
                    name={t('workStatistics.columns.personalEfficiency')}
                    fill="#1D4E7C"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="completionRate"
                    name={t('workStatistics.columns.completionRate')}
                    fill="#1D4E7C"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="onTimeRate"
                    name={t('workStatistics.columns.onTimeRate')}
                    fill="#16A34A"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography sx={{ color: 'text.secondary' }}>
                  {t('workStatistics.empty.noPersonalEfficiencyData')}
                </Typography>
              </Box>
            )}
          </Box>

          <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 600, mb: 1.5 }}>
            {t('workStatistics.sections.personalEfficiencyDetail')}
          </Typography>
          <TableContainer sx={{ ...mvsBodyListTableSx, width: '100%', maxWidth: '100%', overflowX: 'hidden', mb: 2 }}>
            <Table size="small" sx={statsTableSx}>
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  {(
                    [
                      ['employeeName', t('workStatistics.columns.employeeInfo'), '22%'],
                      ['personalEfficiencyScore', t('workStatistics.columns.personalEfficiency'), '13%'],
                      ['productivity', t('workStatistics.columns.completionRate'), '12%'],
                      ['onTimeRate', t('workStatistics.columns.onTimeRate'), '13%'],
                      ['monthlyCompleted', t('workStatistics.columns.monthlyCompleted'), '12%'],
                      ['overdueCount', t('workStatistics.columns.overdueCards'), '12%'],
                      ['avgCompletedProcessingHours', t('workStatistics.columns.avgProcessingTime'), '16%'],
                    ] as Array<[EfficiencySortKey, string, string]>
                  ).map(([key, label, width]) => (
                    <TableCell
                      key={key}
                      sx={{ width, ...(key === 'employeeName' ? statsEmployeeCellSx : null) }}
                      sortDirection={efficiencySortBy === key ? efficiencySortDir : false}
                    >
                      <TableSortLabel
                        active={efficiencySortBy === key}
                        direction={efficiencySortBy === key ? efficiencySortDir : 'asc'}
                        onClick={() => handleEfficiencySort(key)}
                        sx={statsSortLabelSx}
                        title={label}
                      >
                        <Box
                          component="span"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            minWidth: 0,
                          }}
                        >
                          {label}
                        </Box>
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody sx={mvsTableBodyRowSx}>
                {personalEfficiencyRows.slice(0, 15).map((stat) => (
                  <TableRow key={`efficiency-${stat.id}`}>
                    <TableCell sx={statsEmployeeCellSx}>
                      <Typography
                        component="button"
                        type="button"
                        noWrap
                        title={stat.employeeName}
                        onClick={() => openEmployeeCardList(stat.employeeId, stat.employeeName)}
                        sx={{
                          p: 0,
                          m: 0,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          font: 'inherit',
                          fontWeight: 600,
                          color: 'text.primary',
                          maxWidth: '100%',
                          textAlign: 'left',
                          '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                        }}
                      >
                        {stat.employeeName}
                      </Typography>
                    </TableCell>
                    <TableCell>{stat.personalEfficiencyScore.toFixed(1)}%</TableCell>
                    <TableCell>{stat.productivity.toFixed(1)}%</TableCell>
                    <TableCell>{stat.onTimeRate.toFixed(1)}%</TableCell>
                    <TableCell>{stat.monthlyCompleted}</TableCell>
                    <TableCell sx={{ color: stat.overdueCount > 0 ? 'error.main' : 'inherit', fontWeight: stat.overdueCount > 0 ? 600 : 400 }}>
                      {stat.overdueCount}
                    </TableCell>
                    <TableCell>
                      {formatProcessingDuration(stat.avgCompletedProcessingHours, stat.completedProcessingCount > 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {personalEfficiencyRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography sx={{ py: 2, textAlign: 'center', color: 'text.secondary' }}>
                        {t('workStatistics.empty.noPersonalEfficiencyData')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: 'text.primary', fontWeight: 600, mb: 0.5 }}>
                {t('workStatistics.charts.processingTimeByAssignee')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('workStatistics.tooltips.processingTimeChart')}
              </Typography>
            </Box>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={processingTimeMetric}
              onChange={(_e, value: ProcessingTimeMetric | null) => {
                if (value) setProcessingTimeMetric(value);
              }}
              sx={{ borderRadius: '10px' }}
            >
              <ToggleButton value="median" sx={{ textTransform: 'none', px: 2 }}>
                {t('workStatistics.processingTime.median')}
              </ToggleButton>
              <ToggleButton value="average" sx={{ textTransform: 'none', px: 2 }}>
                {t('workStatistics.processingTime.average')}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
            <Card elevation={0} sx={mvsKpiCardSx}>
              <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {t('workStatistics.processingTime.teamMedian')}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {formatDaysLabel(teamCompletedMedianDays, teamCompletedStats.count > 0)}
                </Typography>
              </CardContent>
            </Card>
            <Card elevation={0} sx={mvsKpiCardSx}>
              <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {t('workStatistics.processingTime.teamAverage')}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {formatDaysLabel(teamCompletedAvgDays, teamCompletedStats.count > 0)}
                </Typography>
              </CardContent>
            </Card>
            <Card elevation={0} sx={mvsKpiCardSx}>
              <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {t('workStatistics.processingTime.fastest')}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5, color: 'success.main' }}>
                  {formatDaysLabel(hoursToDays(teamCompletedStats.minHours), teamCompletedStats.count > 0)}
                </Typography>
              </CardContent>
            </Card>
            <Card elevation={0} sx={mvsKpiCardSx}>
              <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {t('workStatistics.processingTime.slowest')}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 600, mt: 0.5, color: 'warning.main' }}>
                  {formatDaysLabel(hoursToDays(teamCompletedStats.maxHours), teamCompletedStats.count > 0)}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.6fr 1fr' }, gap: 3, mb: 3 }}>
            <Box sx={{ height: 420 }}>
              {processingTimeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={processingTimeChartData} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis
                      tickFormatter={(value) => `${value}${t('workStatistics.processingTime.dayUnit')}`}
                      label={{
                        value: t('workStatistics.processingTime.yAxisDays'),
                        angle: -90,
                        position: 'insideLeft',
                        style: { textAnchor: 'middle', fill: theme.palette.text.secondary, fontSize: 12 }
                      }}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        const label =
                          name === 'completedDays'
                            ? t('workStatistics.charts.avgCompletedProcessing')
                            : t('workStatistics.charts.avgOpenElapsed');
                        return [formatDaysLabel(Number(value), true), label];
                      }}
                      labelFormatter={(label, payload) => {
                        const row = payload?.[0]?.payload;
                        if (!row) return label;
                        return `${label} (${t('workStatistics.processingTime.sampleCount', {
                          completed: row.completedCount,
                          open: row.openCount
                        })})`;
                      }}
                    />
                    <Legend />
                    <ReferenceLine
                      y={teamCompletedMedianDays}
                      stroke="#1D4E7C"
                      strokeDasharray="6 4"
                      label={{
                        value: t('workStatistics.processingTime.teamMedianLine'),
                        position: 'insideTopRight',
                        fill: '#1D4E7C',
                        fontSize: 12
                      }}
                    />
                    <Bar
                      dataKey="completedDays"
                      name={t('workStatistics.charts.avgCompletedProcessing')}
                      fill="#1D4E7C"
                      radius={[6, 6, 0, 0]}
                      barSize={28}
                    >
                      <ErrorBar dataKey="completedRange" width={8} strokeWidth={2} stroke="#64748B" />
                    </Bar>
                    <Bar
                      dataKey="openDays"
                      name={t('workStatistics.charts.avgOpenElapsed')}
                      fill="#F59E0B"
                      radius={[6, 6, 0, 0]}
                      barSize={28}
                    >
                      <ErrorBar dataKey="openRange" width={8} strokeWidth={2} stroke="#94A3B8" />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography sx={{ color: 'text.secondary' }}>
                    {t('workStatistics.empty.noProcessingTimeData')}
                  </Typography>
                </Box>
              )}
            </Box>

            <Box>
              <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 600, mb: 1.5 }}>
                {t('workStatistics.charts.completedDurationDistribution')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                {t('workStatistics.tooltips.durationDistribution')}
              </Typography>
              <Box sx={{ height: 360 }}>
                {completedDurationDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={completedDurationDistribution} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 12 }} />
                      <RechartsTooltip
                        formatter={(value: number) => [
                          t('workStatistics.processingTime.cardsCount', { count: value }),
                          t('workStatistics.charts.completedDurationDistribution')
                        ]}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                        {completedDurationDistribution.map((entry, index) => (
                          <Cell key={`duration-bucket-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Typography sx={{ color: 'text.secondary' }}>
                      {t('workStatistics.empty.noProcessingTimeData')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>

          <Typography variant="subtitle1" sx={{ color: 'text.primary', fontWeight: 600, mb: 1.5 }}>
            {t('workStatistics.sections.processingTimeDetail')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            {t('workStatistics.tooltips.processingTimeDetail')}
          </Typography>
          <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx, mb: 2 }}>
            <Table size="small" sx={statsTableSx}>
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  {(
                    [
                      ['employeeName', t('workStatistics.columns.employeeInfo'), statsEmployeeCellSx],
                      ['sampleCompleted', t('workStatistics.processingTime.sampleSize'), undefined],
                      ['medianHours', t('workStatistics.processingTime.median'), undefined],
                      ['avgHours', t('workStatistics.processingTime.average'), undefined],
                      ['minHours', t('workStatistics.processingTime.min'), undefined],
                      ['maxHours', t('workStatistics.processingTime.max'), undefined],
                      ['stdDevHours', t('workStatistics.processingTime.stdDev'), undefined],
                      ['openElapsedHours', t('workStatistics.columns.avgElapsedTime'), undefined],
                    ] as Array<[ProcessingTimeSortKey, string, object | undefined]>
                  ).map(([key, label, cellSx]) => (
                    <TableCell
                      key={key}
                      sx={cellSx}
                      sortDirection={processingSortBy === key ? processingSortDir : false}
                    >
                      <TableSortLabel
                        active={processingSortBy === key}
                        direction={processingSortBy === key ? processingSortDir : 'asc'}
                        onClick={() => handleProcessingSort(key)}
                        sx={statsSortLabelSx}
                      >
                        {label}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody sx={mvsTableBodyRowSx}>
                {processingTimeDetailRows.map((stat) => (
                  <TableRow key={`processing-${stat.id}`}>
                    <TableCell sx={statsEmployeeCellSx}>
                      <Typography
                        component="button"
                        type="button"
                        noWrap
                        title={stat.employeeName}
                        onClick={() => openEmployeeCardList(stat.employeeId, stat.employeeName)}
                        sx={{
                          p: 0,
                          m: 0,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          font: 'inherit',
                          fontWeight: 600,
                          color: 'text.primary',
                          maxWidth: '100%',
                          textAlign: 'left',
                          '&:hover': { color: 'primary.main', textDecoration: 'underline' },
                        }}
                      >
                        {stat.employeeName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {t('workStatistics.processingTime.sampleCount', {
                        completed: stat.completedDuration.count,
                        open: stat.openDuration.count
                      })}
                    </TableCell>
                    <TableCell>
                      {formatProcessingDuration(stat.completedDuration.medianHours, stat.completedDuration.count > 0)}
                    </TableCell>
                    <TableCell>
                      {formatProcessingDuration(stat.completedDuration.avgHours, stat.completedDuration.count > 0)}
                    </TableCell>
                    <TableCell>
                      {formatProcessingDuration(stat.completedDuration.minHours, stat.completedDuration.count > 0)}
                    </TableCell>
                    <TableCell>
                      {formatProcessingDuration(stat.completedDuration.maxHours, stat.completedDuration.count > 0)}
                    </TableCell>
                    <TableCell>
                      {formatProcessingDuration(stat.completedDuration.stdDevHours, stat.completedDuration.count > 1)}
                    </TableCell>
                    <TableCell>
                      {formatProcessingDuration(stat.openDuration.medianHours, stat.openDuration.count > 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {processingTimeDetailRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography sx={{ py: 2, textAlign: 'center', color: 'text.secondary' }}>
                        {t('workStatistics.empty.noProcessingTimeData')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <WorkStatisticsEvaluationPanel
            statistics={filteredStatistics}
            statusSummary={statusSummary}
            completedDurationDistribution={completedDurationDistribution}
            teamCompletedStats={teamCompletedStats}
            averageEfficiency={averageEfficiency}
            averageOnTimeRate={averageOnTimeRate}
            averageProductivity={averageProductivity}
            totalAssigned={totalAssigned}
            totalCompleted={totalTasksCompleted}
            overallCompletionRate={completionRate}
            averageProcessingDays={hoursToDays(averageProcessingTime)}
            periodLabel={periodFilter || t('workStatistics.filters.all')}
            companyLabel={
              isRoot
                ? companies.find((c) => Number(c.id) === Number(selectedCompanyId))?.name ||
                  t('workStatistics.filters.all')
                : ownCompanyName || '-'
            }
            departmentLabel={departmentFilter || t('workStatistics.filters.all')}
            formatDays={formatDaysLabel}
          />
        </TabPanel>
      </Card>

      <Dialog
        open={Boolean(cardListEmployee)}
        onClose={closeEmployeeCardList}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '8px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pr: 2 }}>
          {cardListEmployee
            ? t('workStatistics.cardList.title', { name: cardListEmployee.name })
            : ''}
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, fontWeight: 600 }}>
            {t('workStatistics.cardList.count', { count: selectedEmployeeCards.length })}
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ px: 0, py: 0, overflowX: 'hidden' }}>
          {selectedEmployeeCards.length === 0 ? (
            <Box sx={{ py: 5, px: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">{t('workStatistics.empty.noUserCards')}</Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 480, overflowX: 'hidden' }}>
              <Table size="small" stickyHeader sx={cardListDialogTableSx}>
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell sx={{ width: '28%' }}>{t('workStatistics.cardList.columns.title')}</TableCell>
                    <TableCell sx={{ width: '18%' }}>{t('workStatistics.cardList.columns.board')}</TableCell>
                    <TableCell sx={{ width: '16%' }}>{t('workStatistics.cardList.columns.list')}</TableCell>
                    <TableCell sx={{ width: '14%' }}>{t('workStatistics.cardList.columns.status')}</TableCell>
                    <TableCell sx={{ width: '12%' }}>{t('workStatistics.cardList.columns.dueDate')}</TableCell>
                    <TableCell align="right" sx={{ width: '12%' }} />
                  </TableRow>
                </TableHead>
                <TableBody sx={mvsTableBodyRowSx}>
                  {selectedEmployeeCards.map((card) => (
                    <TableRow
                      key={`${card.boardId}-${card.id}`}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/work/projects/${card.boardId}?card=${card.id}`)}
                    >
                      <TableCell title={card.title}>{card.title}</TableCell>
                      <TableCell title={card.boardName}>{card.boardName || '-'}</TableCell>
                      <TableCell title={card.listTitle}>{card.listTitle || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={statusLabel(card.status)}
                          color={statusChipColor(card.status)}
                          variant={card.status === 'todo' ? 'outlined' : 'filled'}
                          sx={{
                            height: 24,
                            maxWidth: '100%',
                            fontWeight: 600,
                            fontSize: '0.6875rem',
                            '& .MuiChip-label': {
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              px: 0.75,
                            },
                          }}
                        />
                      </TableCell>
                      <TableCell>{card.dueDate || '-'}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="text"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/work/projects/${card.boardId}?card=${card.id}`);
                          }}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            minWidth: 0,
                            px: 0.5,
                            fontSize: '0.75rem',
                          }}
                        >
                          {t('workStatistics.cardList.openCard')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button onClick={closeEmployeeCardList} sx={{ textTransform: 'none', fontWeight: 600 }}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert onClose={() => setError('')} severity="error">{error}</Alert>
      </Snackbar>
    </Box>
  );
};

export default WorkStatistics;
