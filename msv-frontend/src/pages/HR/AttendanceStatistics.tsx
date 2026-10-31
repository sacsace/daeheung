import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
  Chip,
  Switch,
  FormControlLabel,
  Slider,
  Pagination,
  Tooltip,
} from '@mui/material';
import MvsPageHeader from '../../components/Common/MvsPageHeader';
import {
  mvsPageRootSx,
  mvsKpiCardSx,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsTableHeadHighlightSx,
  mvsBodyPaginationSx,
  mvsInnerCardSx,
} from '../../theme/mvsLayout';
import { Refresh as RefreshIcon, RestartAlt as ResetIcon, Schedule as ScheduleIcon } from '@mui/icons-material';
import {
  Sync as SyncIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha, type SxProps, type Theme } from '@mui/material/styles';
import { attendanceService } from '../../services/api';
import { heresnowIntegrationService } from '../../services/api';
import { useStore } from '../../store';
import { useNavigate } from 'react-router-dom';

interface AttendanceRow {
  id: number;
  user_id: number;
  date: string;
  work_hours?: number;
  status: string;
  check_in?: string | null;
  check_out?: string | null;
  check_in_local?: string | null;
  check_out_local?: string | null;
  check_in_display?: string | null;
  check_out_display?: string | null;
  user?: {
    id: number;
    username: string;
    email?: string;
    department?: string;
    position?: string;
    employee_number?: string;
  };
}

interface UserAggregate {
  userId: number;
  name: string;
  department: string;
  recordCount: number;
  totalHours: number;
  lateCount: number;
  absentCount: number;
  normalCount: number;
}

type MatrixCellType = 'complete' | 'partial' | 'absent' | 'empty';
type MatrixUserRow = {
  key: string;
  userId: number | null;
  name: string;
  department: string;
  isUnregistered: boolean;
  prefillEmail?: string;
};
type MatrixCellRow = {
  status?: string;
  check_in?: string | null;
  check_out?: string | null;
};
type UnregisteredAttendanceRecord = {
  email?: string;
  name?: string;
  externalEmployeeId?: string;
  date?: string;
  checkIn?: string;
  checkOut?: string;
  status?: string;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function formatYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatYm(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getCurrentMonthInputValue() {
  return formatYm(new Date());
}

function monthRangeFromYm(ym: string): { start: string; end: string } | null {
  const match = String(ym || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start: formatYmd(start), end: formatYmd(end) };
}

function deriveYmFromRange(start: string, end: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return '';
  if (!start.endsWith('-01')) return '';
  const d = new Date(`${start}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const monthEnd = formatYmd(endOfMonth(d));
  if (end !== monthEnd) return '';
  return start.slice(0, 7);
}

function rowDateYmd(dateVal: string) {
  const s = String(dateVal || '');
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s.slice(0, 10);
}

const STANDARD_WORK_DAY_HOURS = 8;
const STANDARD_CHECK_IN_HOUR_IST = 9;
const IST_OFFSET = '+05:30';

function parseAttendanceCheckInMs(row: AttendanceRow): number | null {
  if (row.check_in) {
    const d = new Date(row.check_in);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }

  const local = row.check_in_local || row.check_in_display;
  if (!local) return null;

  const ymd = rowDateYmd(row.date);
  const ko = local.match(/(오전|오후)\s*(\d{1,2}):(\d{2})/);
  if (ko) {
    let hour = parseInt(ko[2], 10);
    const minute = parseInt(ko[3], 10);
    if (ko[1] === '오후' && hour !== 12) hour += 12;
    if (ko[1] === '오전' && hour === 12) hour = 0;
    const d = new Date(
      `${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${IST_OFFSET}`
    );
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  const en = local.match(/(AM|PM)\s*(\d{1,2}):(\d{2})/i);
  if (en) {
    let hour = parseInt(en[2], 10);
    const minute = parseInt(en[3], 10);
    const period = en[1].toUpperCase();
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    const d = new Date(
      `${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${IST_OFFSET}`
    );
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  const plain = local.match(/(\d{1,2}):(\d{2})/);
  if (plain) {
    const hour = parseInt(plain[1], 10);
    const minute = parseInt(plain[2], 10);
    const d = new Date(
      `${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${IST_OFFSET}`
    );
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  return null;
}

function computeLateHours(row: AttendanceRow): number {
  const checkInMs = parseAttendanceCheckInMs(row);
  if (checkInMs == null) return 0;
  const ymd = rowDateYmd(row.date);
  const standardMs = new Date(`${ymd}T${String(STANDARD_CHECK_IN_HOUR_IST).padStart(2, '0')}:00:00${IST_OFFSET}`).getTime();
  if (checkInMs <= standardMs) return 0;
  return roundHours((checkInMs - standardMs) / (1000 * 60 * 60));
}

function isWeekendYmd(ymd: string) {
  const matched = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return false;
  const y = parseInt(matched[1], 10);
  const mo = parseInt(matched[2], 10);
  const d = parseInt(matched[3], 10);
  const dt = new Date(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00+05:30`);
  const day = dt.getDay();
  return day === 0 || day === 6;
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100;
}

function formatHoursDisplay(value: number) {
  return `${roundHours(value).toFixed(2)} h`;
}

type AttendanceDetailSummary = {
  otHours: number;
  absentHours: number;
  holidayWorkHours: number;
  totalWorkHours: number;
  recordCount: number;
  absentDays: number;
};

function computeAttendanceDetailSummary(rows: AttendanceRow[]): AttendanceDetailSummary {
  let otHours = 0;
  let absentHours = 0;
  let holidayWorkHours = 0;
  let totalWorkHours = 0;
  let absentDays = 0;

  for (const row of rows) {
    const ymd = rowDateYmd(row.date);
    const workHours = Number(row.work_hours) || 0;

    if (row.status === 'absent') {
      absentDays += 1;
      absentHours += STANDARD_WORK_DAY_HOURS;
      continue;
    }

    totalWorkHours += workHours;

    if (isWeekendYmd(ymd) && workHours > 0) {
      holidayWorkHours += workHours;
      continue;
    }

    const lateHours = computeLateHours(row);
    const dayOt = Math.max(0, workHours - STANDARD_WORK_DAY_HOURS - lateHours);
    otHours += dayOt;
  }

  return {
    otHours: roundHours(otHours),
    absentHours: roundHours(absentHours),
    holidayWorkHours: roundHours(holidayWorkHours),
    totalWorkHours: roundHours(totalWorkHours),
    recordCount: rows.length,
    absentDays
  };
}

function enumerateYmdRange(start: string, end: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return [];
  const cursor = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const out: string[] = [];
  while (cursor <= endDate) {
    out.push(formatYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function displayClockCell(
  display?: string | null,
  local?: string | null,
  iso?: string | null
): string {
  if (display) return display;
  if (local) return local;
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

const ATTENDANCE_USERS_PER_PAGE = 15;
const ATTENDANCE_FILTER_OUTLINED = mvsOutlinedLabelProps;
const attendanceFilterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx } as const;
const matrixNoColWidth = 36;
/** 출근 매트릭스 — 급여 리스트(엑셀형)와 동일 톤: 얇은 격자·슬레이트 헤더·균등 분배 */
const MATRIX_LINE = '#D4D4D4';
const MATRIX_HEADER_BG = '#F1F5F9';
const MATRIX_HEADER_FG = '#475569';
const MATRIX_HEADER_BORDER = '#A8B4C0';
const MATRIX_HOVER_BG = '#EAF4FC';
/** 휴일(주말) 영역 — 아주 연한 하이라이트 + 세로 라인 */
const MATRIX_HOLIDAY_LINE = '#E2C8C8';
const MATRIX_HOLIDAY_BG = '#FFF8F8';
const MATRIX_HOLIDAY_HEADER_BG = '#F5EDED';
/** 상세 목록 — 미출근일 하이라이트 */
const DETAIL_MISSING_BG = '#FFF2F2';
/** 상태 표시 — 솔리드 원 + 흰 마크 */
const MATRIX_STATUS = {
  complete: { fill: '#217346', glyph: '✓' },
  partial: { fill: '#C2410C', glyph: '◑' },
  absent: { fill: '#B91C1C', glyph: '✕' },
  empty: { fill: 'transparent', glyph: '' },
} as const;

function matrixHolidayColSx(dayColumns: string[], index: number) {
  const ymd = dayColumns[index];
  if (!ymd || !isWeekendYmd(ymd)) return {};
  const prevWeekend = index > 0 && isWeekendYmd(dayColumns[index - 1]!);
  const nextWeekend = index < dayColumns.length - 1 && isWeekendYmd(dayColumns[index + 1]!);
  return {
    borderLeft: prevWeekend ? 'none' : `1px solid ${MATRIX_HOLIDAY_LINE}`,
    borderRight: nextWeekend ? 'none' : `1px solid ${MATRIX_HOLIDAY_LINE}`,
    bgcolor: MATRIX_HOLIDAY_BG,
  } as const;
}
const thEllipsisSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'block',
  minWidth: 0,
} as const;

type ListViewMode = 'page' | 'all';

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
  borderRadius: '4px',
  boxShadow: 'none',
  whiteSpace: 'nowrap' as const,
};

const detailDialogTableBodySx: SxProps<Theme> = (theme) => {
  const border = theme.palette.mode === 'light' ? '#D1DAE4' : theme.palette.divider;
  const rowBg = theme.palette.mode === 'light' ? '#FFFFFF' : theme.palette.background.paper;
  const hoverBg = theme.palette.mode === 'light' ? '#F8FAFC' : theme.palette.action.hover;
  return {
    '& .MuiTableCell-body': {
      py: 0.45,
      px: 1.25,
      fontSize: '0.8125rem',
      lineHeight: 1.3,
      borderBottom: `1px solid ${border}`,
    },
    '& .MuiTableRow-root:not([data-missing="1"]):not([data-holiday-empty="1"])': {
      bgcolor: rowBg,
    },
    '& .MuiTableRow-root:not([data-missing="1"]):not([data-holiday-empty="1"]):hover': {
      bgcolor: hoverBg,
    },
    '& .MuiTableRow-root[data-missing="1"]': { bgcolor: DETAIL_MISSING_BG },
    '& .MuiTableRow-root[data-missing="1"] .MuiTableCell-body': { bgcolor: DETAIL_MISSING_BG },
    '& .MuiTableRow-root[data-missing="1"]:hover': { bgcolor: '#FFECEC' },
    '& .MuiTableRow-root[data-missing="1"]:hover .MuiTableCell-body': { bgcolor: '#FFECEC' },
    '& .MuiTableRow-root[data-holiday-empty="1"]': { bgcolor: MATRIX_HOLIDAY_BG },
    '& .MuiTableRow-root[data-holiday-empty="1"] .MuiTableCell-body': { bgcolor: MATRIX_HOLIDAY_BG },
    '& .MuiTableRow-root[data-holiday-empty="1"]:hover': { bgcolor: '#FFECEC' },
    '& .MuiTableRow-root[data-holiday-empty="1"]:hover .MuiTableCell-body': { bgcolor: '#FFECEC' },
    '& .MuiTableRow-root:last-of-type .MuiTableCell-body': {
      borderBottom: 'none',
    },
  };
};

const detailDialogTableSx = {
  tableLayout: 'fixed',
  width: '100%',
  borderCollapse: 'collapse',
  '& .MuiTableCell-root': {
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
  },
  '& .MuiTableHead-root .MuiTableCell-root': {
    py: 0.65,
    px: 1.25,
    fontSize: '0.78rem',
    lineHeight: 1.25,
  },
} as const;

const AttendanceStatistics: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { t } = useTranslation();
  const { user } = useStore();
  const inkFg = theme.palette.mode === 'dark' ? theme.palette.common.white : theme.palette.common.black;
  const labelColor = theme.palette.mode === 'dark' ? inkFg : 'text.secondary';
  const valueColor = theme.palette.mode === 'dark' ? inkFg : 'text.primary';
  const canSeeCompanyAttendance = ['admin', 'root', 'audit'].includes(String(user?.role || ''));
  const now = new Date();
  const [startDate, setStartDate] = useState(formatYmd(startOfMonth(now)));
  const [endDate, setEndDate] = useState(formatYmd(endOfMonth(now)));
  const [selectedMonth, setSelectedMonth] = useState(formatYm(now));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUserId, setDetailUserId] = useState<number | null>(null);
  const [detailUserName, setDetailUserName] = useState('');
  const [heresnowStatus, setHeresnowStatus] = useState<any>(null);
  const [heresnowSyncLoading, setHeresnowSyncLoading] = useState(false);
  const [heresnowSyncMonth, setHeresnowSyncMonth] = useState(getCurrentMonthInputValue());
  const [heresnowTestLoading, setHeresnowTestLoading] = useState(false);
  const [heresnowSettingsLoading, setHeresnowSettingsLoading] = useState(false);
  const [heresnowCompanyId, setHeresnowCompanyId] = useState('');
  const [heresnowApiKey, setHeresnowApiKey] = useState('');
  const [heresnowMessage, setHeresnowMessage] = useState<string | null>(null);
  const [heresnowError, setHeresnowError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [listViewMode, setListViewMode] = useState<ListViewMode>('page');
  const [nameColumnWidth, setNameColumnWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 100;
    const saved = Number(window.localStorage.getItem('attendanceStats.nameColumnWidth') || 100);
    if (!Number.isFinite(saved)) return 100;
    return Math.min(160, Math.max(80, saved));
  });

  const detailRows = useMemo(() => {
    if (detailUserId == null) return [];
    return rows
      .filter((r) => r.user_id === detailUserId)
      .sort((a, b) => rowDateYmd(b.date).localeCompare(rowDateYmd(a.date)));
  }, [rows, detailUserId]);

  /** 조회 시작일~오늘(또는 endDate 중 더 이른 날)까지 채움 — 미래일 제외, 미출근 하이라이트 */
  const detailCalendarRows = useMemo(() => {
    if (detailUserId == null) return [];
    const byDate = new Map<string, AttendanceRow>();
    for (const r of detailRows) {
      const ymd = rowDateYmd(r.date);
      if (!ymd || byDate.has(ymd)) continue;
      byDate.set(ymd, r);
    }
    const todayYmd = formatYmd(new Date());
    const calendarEnd = endDate < todayYmd ? endDate : todayYmd;
    if (startDate > calendarEnd) return [];
    const days = enumerateYmdRange(startDate, calendarEnd);
    return [...days].reverse().map((ymd) => {
      const row = byDate.get(ymd) ?? null;
      const holiday = isWeekendYmd(ymd);
      return {
        key: ymd,
        ymd,
        row,
        holiday,
        /** 평일인데 기록 없음 → 미출근 하이라이트 (휴일은 별도) */
        missing: row == null && !holiday,
      };
    });
  }, [detailRows, detailUserId, startDate, endDate]);

  const detailSummary = useMemo(() => computeAttendanceDetailSummary(detailRows), [detailRows]);

  const statusLabel = useCallback(
    (status: string) => {
      switch (status) {
        case 'normal':
          return t('attendanceManagement.statusNormal');
        case 'late':
          return t('attendanceManagement.statusLate');
        case 'early':
          return t('attendanceManagement.statusEarly');
        case 'overtime':
          return t('attendanceManagement.statusOvertime');
        case 'absent':
          return t('attendanceManagement.statusAbsent');
        default:
          return status || '—';
      }
    },
    [t]
  );

  const detailStatusLabel = useCallback(
    (row: AttendanceRow) => {
      const ymd = rowDateYmd(row.date);
      if (row.status !== 'absent' && isWeekendYmd(ymd)) {
        return t('attendanceManagement.statusHolidayWork');
      }
      return statusLabel(row.status);
    },
    [statusLabel, t]
  );

  const detailSummaryItems = useMemo(
    () => [
      {
        key: 'otHours',
        label: t('attendanceStatistics.detail.summary.otHours'),
        value: formatHoursDisplay(detailSummary.otHours),
        color: 'primary.main' as const
      },
      {
        key: 'absentHours',
        label: t('attendanceStatistics.detail.summary.absentHours'),
        value: formatHoursDisplay(detailSummary.absentHours),
        color: 'error.main' as const
      },
      {
        key: 'holidayWorkHours',
        label: t('attendanceStatistics.detail.summary.holidayWorkHours'),
        value: formatHoursDisplay(detailSummary.holidayWorkHours),
        color: 'warning.dark' as const
      },
      {
        key: 'totalWorkHours',
        label: t('attendanceStatistics.detail.summary.totalWorkHours'),
        value: formatHoursDisplay(detailSummary.totalWorkHours),
        color: valueColor
      },
      {
        key: 'recordCount',
        label: t('attendanceStatistics.detail.summary.recordCount'),
        value: String(detailSummary.recordCount),
        color: valueColor
      }
    ],
    [detailSummary, t, valueColor]
  );

  const openDetail = (agg: UserAggregate) => {
    setDetailUserId(agg.userId);
    setDetailUserName(agg.name);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailUserId(null);
    setDetailUserName('');
  };

  const canManageHeresnow = ['admin', 'root'].includes(String(user?.role || ''));
  const normalizedCompanyId = String(heresnowCompanyId || heresnowStatus?.companyId || '').trim();

  const applyMonth = (ym: string) => {
    const range = monthRangeFromYm(ym);
    if (!range) return;
    setSelectedMonth(ym);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { start_date: startDate, end_date: endDate };
      const res = canSeeCompanyAttendance
        ? await attendanceService.getCompanyAttendances(params)
        : await attendanceService.getAttendances(params);
      if (res?.success && Array.isArray(res.data)) {
        setRows(res.data as AttendanceRow[]);
      } else {
        setRows([]);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || t('attendanceStatistics.loadError'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, t, canSeeCompanyAttendance]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    heresnowIntegrationService
      .getStatus()
      .then((res) => {
        if (cancelled || !res?.success) return;
        setHeresnowStatus(res.data);
        const companyId = String(res.data?.companyId || res.data?.externalCompanyId || '');
        setHeresnowCompanyId(companyId);
      })
      .catch(() => {
        if (!cancelled) setHeresnowStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('attendanceStats.nameColumnWidth', String(nameColumnWidth));
  }, [nameColumnWidth]);

  const handleHeresnowToggle = async (enabled: boolean) => {
    if (!canManageHeresnow) return;
    try {
      setHeresnowError(null);
      const res = await heresnowIntegrationService.updateSettings({ enabled });
      if (res.success) {
        setHeresnowStatus(res.data);
        setHeresnowCompanyId(String(res.data?.companyId || res.data?.externalCompanyId || heresnowCompanyId || ''));
        setHeresnowMessage(enabled ? t('attendanceManagement.heresnowActive') : t('attendanceManagement.heresnowInactive'));
      }
    } catch (e: any) {
      setHeresnowError(e?.response?.data?.message || t('attendanceManagement.heresnowSyncFailed'));
    }
  };

  /** HeresNow CUID는 대소문자 구분 — 입력/저장 전 소문자로 맞춤 */
  const normalizeHeresnowCompanyIdInput = (value: string) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    if (/^\d+$/.test(trimmed)) return trimmed;
    return trimmed.toLowerCase();
  };

  const persistHeresnowSettingsIfNeeded = async () => {
    if (!canManageHeresnow) return true;
    const companyId = normalizeHeresnowCompanyIdInput(heresnowCompanyId);
    const apiKey = heresnowApiKey.trim();
    const savedId = normalizeHeresnowCompanyIdInput(
      String(heresnowStatus?.companyId || heresnowStatus?.externalCompanyId || '')
    );
    const needsSave =
      (companyId && companyId !== savedId) || Boolean(apiKey);
    if (!needsSave) {
      if (companyId && companyId !== heresnowCompanyId) setHeresnowCompanyId(companyId);
      return true;
    }
    const payload: { companyId?: string; externalCompanyId?: string; apiKey?: string } = {};
    if (companyId) {
      payload.companyId = companyId;
      payload.externalCompanyId = companyId;
    }
    if (apiKey) payload.apiKey = apiKey;
    const res = await heresnowIntegrationService.updateSettings(payload);
    if (!res.success) {
      setHeresnowError(res.message || t('attendanceManagement.heresnowSyncFailed'));
      return false;
    }
    setHeresnowStatus(res.data);
    setHeresnowCompanyId(
      normalizeHeresnowCompanyIdInput(
        String(res.data?.companyId || res.data?.externalCompanyId || companyId || '')
      )
    );
    setHeresnowApiKey('');
    return true;
  };

  const handleSaveHeresnowSettings = async () => {
    if (!canManageHeresnow) return;
    setHeresnowSettingsLoading(true);
    setHeresnowError(null);
    setHeresnowMessage(null);
    try {
      const payload: { companyId?: string; externalCompanyId?: string; apiKey?: string } = {};
      const companyId = normalizeHeresnowCompanyIdInput(heresnowCompanyId);
      if (companyId) payload.companyId = companyId;
      if (companyId) payload.externalCompanyId = companyId;
      if (heresnowApiKey.trim()) payload.apiKey = heresnowApiKey.trim();
      const res = await heresnowIntegrationService.updateSettings(payload);
      if (res.success) {
        setHeresnowStatus(res.data);
        setHeresnowCompanyId(
          normalizeHeresnowCompanyIdInput(
            String(res.data?.companyId || res.data?.externalCompanyId || companyId || '')
          )
        );
        setHeresnowApiKey('');
        setHeresnowMessage(t('attendanceManagement.heresnowSettingsSaved'));
      } else {
        setHeresnowError(res.message || t('attendanceManagement.heresnowSyncFailed'));
      }
    } catch (e: any) {
      setHeresnowError(e?.response?.data?.message || t('attendanceManagement.heresnowSyncFailed'));
    } finally {
      setHeresnowSettingsLoading(false);
    }
  };

  const handleHeresnowTest = async () => {
    setHeresnowTestLoading(true);
    setHeresnowError(null);
    setHeresnowMessage(null);
    try {
      const saved = await persistHeresnowSettingsIfNeeded();
      if (!saved) return;
      const res = await heresnowIntegrationService.testConnection();
      if (res.success) {
        const count = Number(res?.data?.previewCount ?? 0);
        setHeresnowMessage(
          count > 0
            ? res.message || t('attendanceManagement.heresnowTestSuccess', { count })
            : t('attendanceManagement.heresnowTestEmpty')
        );
      } else {
        setHeresnowError(res.message || t('attendanceManagement.heresnowTestFailed'));
      }
    } catch (e: any) {
      setHeresnowError(e?.response?.data?.message || t('attendanceManagement.heresnowTestFailed'));
    } finally {
      setHeresnowTestLoading(false);
    }
  };

  const handleHeresnowSync = async () => {
    setHeresnowSyncLoading(true);
    setHeresnowError(null);
    setHeresnowMessage(null);
    try {
      const saved = await persistHeresnowSettingsIfNeeded();
      if (!saved) return;
      const syncPayload: { since?: string } = {};
      if (/^\d{4}-\d{2}$/.test(heresnowSyncMonth)) {
        syncPayload.since = `${heresnowSyncMonth}-01`;
      }
      const res = await heresnowIntegrationService.sync(syncPayload);
      if (res.success) {
        const total = Number(res?.data?.total || 0);
        const applied = Number(res?.data?.applied || 0);
        const debug = res?.data?.debug;
        const noStatusAccepted = Number(debug?.fetch?.NO_STATUS?.acceptedRows || 0);
        const pendingAccepted = Number(debug?.fetch?.PENDING?.acceptedRows || 0);
        const deliveredAccepted = Number(debug?.fetch?.DELIVERED?.acceptedRows || 0);
        const debugSuffix = ` (NO_STATUS=${noStatusAccepted}, PENDING=${pendingAccepted}, DELIVERED=${deliveredAccepted}, total=${total}, applied=${applied})`;
        setHeresnowMessage(
          total > 0
            ? `${t('attendanceManagement.heresnowSyncResult', { total, applied })}${debugSuffix}`
            : `${t('attendanceManagement.heresnowSyncNoData')}${debugSuffix}`
        );
        const statusRes = await heresnowIntegrationService.getStatus();
        if (statusRes.success) setHeresnowStatus(statusRes.data);
        await load();
      } else {
        setHeresnowError(res.message || t('attendanceManagement.heresnowSyncFailed'));
      }
    } catch (e: any) {
      setHeresnowError(e?.response?.data?.message || t('attendanceManagement.heresnowSyncFailed'));
    } finally {
      setHeresnowSyncLoading(false);
    }
  };

  useEffect(() => {
    const derived = deriveYmFromRange(startDate, endDate);
    setSelectedMonth((prev) => (prev === derived ? prev : derived));
  }, [startDate, endDate]);

  const aggregates = useMemo(() => {
    const map = new Map<number, UserAggregate>();
    for (const a of rows) {
      const uid = a.user_id;
      const u = a.user;
      if (!map.has(uid)) {
        map.set(uid, {
          userId: uid,
          name: u?.username || `User #${uid}`,
          department: u?.department || '—',
          recordCount: 0,
          totalHours: 0,
          lateCount: 0,
          absentCount: 0,
          normalCount: 0
        });
      }
      const s = map.get(uid)!;
      s.recordCount += 1;
      s.totalHours += Number(a.work_hours) || 0;
      if (a.status === 'late') s.lateCount += 1;
      else if (a.status === 'absent') s.absentCount += 1;
      else if (a.status === 'normal' || a.status === 'early' || a.status === 'overtime') s.normalCount += 1;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const totals = useMemo(() => {
    let hours = 0;
    let late = 0;
    let absent = 0;
    for (const a of aggregates) {
      hours += a.totalHours;
      late += a.lateCount;
      absent += a.absentCount;
    }
    return {
      people: aggregates.length,
      records: rows.length,
      totalHours: hours,
      late,
      absent
    };
  }, [aggregates, rows.length]);

  const handleResetFilters = () => {
    const nowDate = new Date();
    const ym = formatYm(nowDate);
    applyMonth(ym);
  };

  const listStateBoxSx = {
    ...mvsBodyListTableSx,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    py: { xs: 6, sm: 8 },
    px: 3,
    gap: 1.5,
  } as const;

  const kpiCards = [
    { key: 'people', label: t('attendanceStatistics.cards.people'), value: totals.people, valueSx: { color: valueColor } },
    { key: 'records', label: t('attendanceStatistics.cards.records'), value: totals.records, valueSx: { color: valueColor } },
    {
      key: 'hours',
      label: t('attendanceStatistics.cards.totalHours'),
      value: totals.totalHours.toFixed(1),
      valueSx: { color: valueColor },
    },
    {
      key: 'late',
      label: t('attendanceStatistics.cards.late'),
      value: totals.late,
      valueSx: { color: 'warning.dark' },
    },
    {
      key: 'absent',
      label: t('attendanceStatistics.cards.absent'),
      value: totals.absent,
      valueSx: { color: 'error.dark' },
    },
  ] as const;

  const dayColumns = useMemo(() => enumerateYmdRange(startDate, endDate), [startDate, endDate]);

  /** 남은 너비를 일자 열에 균등 분배 (가로 스크롤 방지) */
  const matrixDayColSx = useMemo(
    () => ({
      width: 'auto',
      minWidth: 0,
      maxWidth: 'none',
      overflow: 'hidden',
      px: 0,
      boxSizing: 'border-box' as const,
    }),
    []
  );

  const unregisteredAttendanceRows = useMemo(() => {
    const records = Array.isArray(heresnowStatus?.unregisteredAttendanceRecords)
      ? heresnowStatus.unregisteredAttendanceRecords as UnregisteredAttendanceRecord[]
      : [];
    return records
      .map((record) => {
        const date = String(record?.date || '').slice(0, 10);
        const email = String(record?.email || '').trim().toLowerCase();
        const externalEmployeeId = String(record?.externalEmployeeId || '').trim();
        const displayName = email || externalEmployeeId || String(record?.name || '').trim();
        const identity = email || externalEmployeeId || displayName;
        if (!identity || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
        if (date < startDate || date > endDate) return null;
        return {
          personKey: `unregistered:${identity}`,
          date,
          name: email || displayName,
          email,
          externalEmployeeId,
          status: String(record?.status || '').trim().toLowerCase() || undefined,
          check_in: record?.checkIn || null,
          check_out: record?.checkOut || null
        };
      })
      .filter(Boolean) as Array<{
      personKey: string;
      date: string;
      name: string;
      email: string;
      externalEmployeeId: string;
      status?: string;
      check_in?: string | null;
      check_out?: string | null;
    }>;
  }, [heresnowStatus?.unregisteredAttendanceRecords, startDate, endDate]);

  const matrixUsers = useMemo(() => {
    const users: MatrixUserRow[] = aggregates.map((a) => ({
      key: `user:${a.userId}`,
      userId: a.userId,
      name: a.name,
      department: a.department,
      isUnregistered: false
    }));
    const unregisteredMap = new Map<string, MatrixUserRow>();
    for (const row of unregisteredAttendanceRows) {
      if (!unregisteredMap.has(row.personKey)) {
        unregisteredMap.set(row.personKey, {
          key: row.personKey,
          userId: null,
          name: row.name || row.email || row.externalEmployeeId || '-',
          department: '—',
          isUnregistered: true,
          prefillEmail: row.email || undefined
        });
      }
    }
    return [...users, ...Array.from(unregisteredMap.values())]
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [aggregates, unregisteredAttendanceRows]);

  const matrixMap = useMemo(() => {
    const map = new Map<string, MatrixCellRow>();
    for (const row of rows) {
      const key = `user:${row.user_id}:${rowDateYmd(row.date)}`;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { status: row.status, check_in: row.check_in, check_out: row.check_out });
        continue;
      }
      const prevScore = (prev.check_out ? 2 : 0) + (prev.check_in ? 1 : 0);
      const nextScore = (row.check_out ? 2 : 0) + (row.check_in ? 1 : 0);
      if (nextScore >= prevScore) {
        map.set(key, { status: row.status, check_in: row.check_in, check_out: row.check_out });
      }
    }
    for (const row of unregisteredAttendanceRows) {
      const key = `${row.personKey}:${row.date}`;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { status: row.status, check_in: row.check_in, check_out: row.check_out });
        continue;
      }
      const prevScore = (prev.check_out ? 2 : 0) + (prev.check_in ? 1 : 0);
      const nextScore = (row.check_out ? 2 : 0) + (row.check_in ? 1 : 0);
      if (nextScore >= prevScore) {
        map.set(key, { status: row.status, check_in: row.check_in, check_out: row.check_out });
      }
    }
    return map;
  }, [rows, unregisteredAttendanceRows]);

  const getMatrixCellType = (row?: MatrixCellRow): MatrixCellType => {
    if (!row) return 'empty';
    if (row.status === 'absent') return 'absent';
    if (!row.check_in) return 'absent';
    if (row.check_out) return 'complete';
    return 'partial';
  };

  const matrixLegend = useMemo(() => {
    let complete = 0;
    let partial = 0;
    let absent = 0;
    for (const row of Array.from(matrixMap.values())) {
      const type = getMatrixCellType(row);
      if (type === 'complete') complete += 1;
      else if (type === 'partial') partial += 1;
      else if (type === 'absent') absent += 1;
    }
    return { complete, partial, absent };
  }, [matrixMap]);

  const totalMatrixPages = Math.max(1, Math.ceil(matrixUsers.length / ATTENDANCE_USERS_PER_PAGE));
  const showAllUsers = listViewMode === 'all';

  const visibleMatrixUsers = useMemo(
    () =>
      showAllUsers
        ? matrixUsers
        : matrixUsers.slice((page - 1) * ATTENDANCE_USERS_PER_PAGE, page * ATTENDANCE_USERS_PER_PAGE),
    [matrixUsers, page, showAllUsers]
  );

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate]);

  useEffect(() => {
    if (page > totalMatrixPages) {
      setPage(totalMatrixPages);
    }
  }, [page, totalMatrixPages]);

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <MvsPageHeader
        title={t('attendanceStatistics.title')}
        description={t('attendanceStatistics.description')}
      />

      {heresnowError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setHeresnowError(null)}>
          {heresnowError}
        </Alert>
      )}
      {heresnowMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setHeresnowMessage(null)}>
          {heresnowMessage}
        </Alert>
      )}

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3, p: { xs: 1.75, sm: 2.5 } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color: valueColor }}>
                {t('attendanceManagement.heresnowTitle')}
              </Typography>
              <Chip
                size="small"
                label={heresnowStatus?.enabled ? t('attendanceManagement.heresnowActive') : t('attendanceManagement.heresnowInactive')}
                color={heresnowStatus?.enabled ? 'success' : 'default'}
                sx={{ height: 24, fontWeight: 600 }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25, lineHeight: 1.55 }}>
              {t('attendanceManagement.heresnowDescription')}
            </Typography>
            <Box
              sx={{
                mt: 0.5,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              <Box
                sx={{
                  px: 1.2,
                  py: 1,
                  borderRadius: 1.5,
                  border: (themeArg) => `1px solid ${alpha(themeArg.palette.divider, 0.8)}`,
                  bgcolor: theme.palette.mode === 'dark'
                    ? alpha(theme.palette.common.white, 0.02)
                    : alpha(theme.palette.common.white, 0.75),
                  gridColumn: { xs: '1 / -1', md: '1 / -1' }
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  {t('attendanceManagement.heresnowLastSync')}
                </Typography>
                <Typography sx={{ mt: 0.15, color: 'text.primary', fontWeight: 600, fontSize: '0.84rem' }}>
                  {heresnowStatus?.lastSyncAt ? new Date(heresnowStatus.lastSyncAt).toLocaleString() : '-'}
                </Typography>
              </Box>
            </Box>

            {canManageHeresnow && (
              <Box
                sx={{
                  mt: 1.5,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr auto' },
                  alignItems: { xs: 'stretch', lg: 'center' },
                  gap: 1,
                  p: { xs: 1.2, sm: 1.5 },
                  border: (themeArg) => `1px solid ${alpha(themeArg.palette.divider, 0.65)}`,
                  borderRadius: 2.5,
                  bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.02) : alpha(theme.palette.grey[100], 0.6),
                }}
              >
                <TextField
                  size="small"
                  label={t('attendanceManagement.heresnowCompanyId')}
                  value={normalizedCompanyId}
                  onChange={(e) => setHeresnowCompanyId(e.target.value)}
                  onBlur={() => {
                    const normalized = normalizeHeresnowCompanyIdInput(heresnowCompanyId);
                    if (normalized && normalized !== heresnowCompanyId) {
                      setHeresnowCompanyId(normalized);
                    }
                  }}
                  helperText={t('attendanceManagement.heresnowCompanyIdHint')}
                  FormHelperTextProps={{ sx: { mx: 0, mt: 0.5 } }}
                  sx={{ minWidth: 0 }}
                />
                <TextField
                  size="small"
                  label={t('attendanceManagement.heresnowApiKeyLabel')}
                  placeholder={t('attendanceManagement.heresnowApiKeyPlaceholder')}
                  type="text"
                  inputProps={{ autoComplete: 'off' }}
                  value={heresnowApiKey || String(heresnowStatus?.apiKeyMasked || '')}
                  onFocus={() => {
                    if (!heresnowApiKey && heresnowStatus?.apiKeyMasked) {
                      setHeresnowApiKey('');
                    }
                  }}
                  onChange={(e) => setHeresnowApiKey(e.target.value)}
                  sx={{ minWidth: 0 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSaveHeresnowSettings}
                  disabled={heresnowSettingsLoading}
                  sx={{ textTransform: 'none', fontWeight: 600, minWidth: { xs: '100%', lg: 128 }, height: 40 }}
                >
                  {heresnowSettingsLoading ? <CircularProgress size={16} color="inherit" /> : t('attendanceManagement.heresnowSettingsSave')}
                </Button>
              </Box>
            )}
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 0.9,
              flexWrap: 'wrap',
              pt: 1.35,
              mt: 0.4,
              borderTop: (themeArg) => `1px dashed ${alpha(themeArg.palette.divider, 0.75)}`,
            }}
          >
            {canManageHeresnow && (
              <FormControlLabel
                control={<Switch size="small" checked={Boolean(heresnowStatus?.enabled)} onChange={(e) => handleHeresnowToggle(e.target.checked)} />}
                label={t('attendanceManagement.heresnowActive')}
                sx={{ mr: 0, '& .MuiFormControlLabel-label': { fontWeight: 600, fontSize: '0.9rem' } }}
              />
            )}
            {canManageHeresnow && (
              <TextField
                type="month"
                size="small"
                label={t('attendanceManagement.heresnowSyncMonthLabel')}
                value={heresnowSyncMonth}
                onChange={(e) => setHeresnowSyncMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 170, '& .MuiInputBase-root': { height: 38 } }}
              />
            )}
            {canManageHeresnow && (
              <Button
                variant="outlined"
                size="small"
                startIcon={heresnowTestLoading ? <CircularProgress size={16} /> : <SyncIcon />}
                disabled={heresnowTestLoading || !heresnowStatus?.enabled}
                onClick={handleHeresnowTest}
                sx={{ textTransform: 'none', fontWeight: 600, height: 38 }}
              >
                {t('attendanceManagement.heresnowTest')}
              </Button>
            )}
            {canManageHeresnow && (
              <Button
                variant="contained"
                size="small"
                startIcon={heresnowSyncLoading ? <CircularProgress size={16} /> : <SyncIcon />}
                disabled={heresnowSyncLoading || !heresnowStatus?.enabled}
                onClick={handleHeresnowSync}
                sx={{ textTransform: 'none', fontWeight: 700, height: 38 }}
              >
                {t('attendanceManagement.heresnowSync')}
              </Button>
            )}
            <Button
              href={
                String(heresnowStatus?.heresnowLoginUrl || '').trim()
                || (String(heresnowStatus?.heresnowUrl || '').replace(/\/+$/, '')
                  ? `${String(heresnowStatus.heresnowUrl).replace(/\/+$/, '')}/login`
                  : 'https://www.heresnow.in/login')
              }
              target="_blank"
              rel="noopener noreferrer"
              variant="text"
              size="small"
              endIcon={<OpenInNewIcon sx={{ fontSize: '1rem !important' }} />}
              sx={{ textTransform: 'none', fontWeight: 600, height: 38, px: 1.2 }}
            >
              {t('attendanceManagement.heresnowOpen')}
            </Button>
          </Box>
        </Box>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
          gap: 2.5,
          mb: 3,
        }}
      >
        {kpiCards.map((item) => (
          <Card key={item.key} elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                {item.label}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', ...item.valueSx }}>
                {item.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 2,
            bgcolor: '#FFFFFF',
            ...(mvsSearchFieldSx as Record<string, unknown>),
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto auto',
            },
            gap: 2,
            alignItems: 'flex-end',
          }}
        >
          <TextField
            fullWidth
            size="small"
            type="month"
            label={t('attendanceStatistics.monthLabel')}
            {...ATTENDANCE_FILTER_OUTLINED}
            value={selectedMonth}
            onChange={(e) => {
              const ym = e.target.value;
              setSelectedMonth(ym);
              const range = monthRangeFromYm(ym);
              if (range) {
                setStartDate(range.start);
                setEndDate(range.end);
              }
            }}
            sx={attendanceFilterFieldSx}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={() => applyMonth(formatYm(new Date()))}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('attendanceStatistics.thisMonth')}
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={() => {
                const d = new Date();
                d.setMonth(d.getMonth() - 1);
                applyMonth(formatYm(d));
              }}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('attendanceStatistics.lastMonth')}
            </Button>
          </Box>
          <TextField
            fullWidth
            size="small"
            type="date"
            label={t('attendanceStatistics.startDate')}
            {...ATTENDANCE_FILTER_OUTLINED}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={attendanceFilterFieldSx}
          />
          <TextField
            fullWidth
            size="small"
            type="date"
            label={t('attendanceStatistics.endDate')}
            {...ATTENDANCE_FILTER_OUTLINED}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={attendanceFilterFieldSx}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<ResetIcon fontSize="small" />}
            onClick={handleResetFilters}
            sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap' }}
          >
            {t('attendanceStatistics.reset')}
          </Button>
          <Button
            variant="contained"
            disableElevation
            size="small"
            startIcon={<RefreshIcon fontSize="small" />}
            onClick={load}
            disabled={loading}
            sx={{ ...mvsBodyPrimaryBtnSx, height: 40, whiteSpace: 'nowrap' }}
          >
            {t('attendanceStatistics.refresh')}
          </Button>
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        {loading ? (
          <Box sx={listStateBoxSx}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              {t('attendanceStatistics.empty.loading')}
            </Typography>
          </Box>
        ) : matrixUsers.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <ScheduleIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
              {t('attendanceStatistics.empty.noItems')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              {t('attendanceStatistics.empty.noItemsHint')}
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon fontSize="small" />}
              onClick={load}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('attendanceStatistics.refresh')}
            </Button>
          </Box>
        ) : (
          <Box
            sx={{
              ...mvsBodyListTableSx,
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              overflow: 'hidden',
              overflowX: 'hidden',
              overflowY: 'hidden',
              borderRadius: 0,
              border: `1px solid ${MATRIX_HEADER_BORDER}`,
              boxShadow: 'none',
              WebkitOverflowScrolling: 'auto',
            }}
          >
            <Box
              sx={{
                px: { xs: 1.25, sm: 1.5 },
                pt: 1.25,
                pb: 1,
                bgcolor: '#FFFFFF',
                borderBottom: `1px solid ${MATRIX_LINE}`,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 1.25,
                  rowGap: 1,
                }}
              >
                <Box sx={{ ...listViewModeBarSx, mb: 0 }}>
                  <Button
                    size="small"
                    disableElevation
                    variant={listViewMode === 'all' ? 'contained' : 'outlined'}
                    onClick={() => setListViewMode('all')}
                    sx={{
                      ...listViewModeBtnSx,
                      ...(listViewMode === 'all'
                        ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
                        : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
                    }}
                  >
                    {t('attendanceStatistics.listView.viewAll')}
                  </Button>
                  <Button
                    size="small"
                    disableElevation
                    variant={listViewMode === 'page' ? 'contained' : 'outlined'}
                    onClick={() => setListViewMode('page')}
                    sx={{
                      ...listViewModeBtnSx,
                      ...(listViewMode === 'page'
                        ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
                        : { borderColor: '#CBD5E1', color: 'text.secondary', bgcolor: '#FFFFFF' }),
                    }}
                  >
                    {t('attendanceStatistics.listView.viewPages')}
                  </Button>
                </Box>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: { xs: 1.25, sm: 1.75 },
                    ml: { sm: 0.5 },
                  }}
                >
                  {(
                    [
                      ['complete', matrixLegend.complete],
                      ['partial', matrixLegend.partial],
                      ['absent', matrixLegend.absent],
                    ] as const
                  ).map(([key, count]) => {
                    const st = MATRIX_STATUS[key];
                    return (
                      <Box
                        key={key}
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.55 }}
                      >
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: st.fill,
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          component="span"
                          sx={{
                            color: '#334155',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t(`attendanceStatistics.matrix.${key}`)}
                        </Typography>
                        <Typography
                          component="span"
                          sx={{ color: '#64748B', fontWeight: 600, fontSize: '0.75rem' }}
                        >
                          {count}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                  <Typography
                    variant="caption"
                    sx={{ color: '#64748B', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.75rem' }}
                  >
                    {t('attendanceStatistics.matrix.nameColumnWidth')}
                  </Typography>
                  <Slider
                    size="small"
                    min={80}
                    max={160}
                    step={2}
                    value={nameColumnWidth}
                    onChange={(_, v) => setNameColumnWidth(Number(v))}
                    sx={{
                      width: 100,
                      color: 'primary.main',
                      '& .MuiSlider-thumb': { width: 12, height: 12 },
                      '& .MuiSlider-rail': { opacity: 0.35 },
                    }}
                  />
                </Box>
              </Box>
            </Box>
            <TableContainer
              sx={{
                width: '100%',
                maxWidth: '100%',
                overflow: 'hidden',
                overflowX: 'hidden',
                overflowY: 'hidden',
              }}
            >
              <Table
                size="small"
                sx={{
                  tableLayout: 'fixed',
                  width: '100%',
                  maxWidth: '100%',
                  borderCollapse: 'collapse',
                  borderSpacing: 0,
                  bgcolor: '#FFFFFF',
                  fontSize: '0.8125rem',
                  '& .MuiTableCell-root': {
                    borderBottom: `1px solid ${MATRIX_LINE}`,
                    borderRight: `1px solid ${MATRIX_LINE}`,
                    borderTop: 'none',
                    borderLeft: 'none',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  },
                  '& .MuiTableCell-root:last-of-type': {
                    borderRight: 'none',
                  },
                }}
              >
                <colgroup>
                  <col style={{ width: matrixNoColWidth }} />
                  <col style={{ width: nameColumnWidth }} />
                  {dayColumns.map((ymd) => (
                    <col
                      key={`col-${ymd}`}
                      style={{
                        width: `calc((100% - ${matrixNoColWidth + nameColumnWidth}px) / ${dayColumns.length || 1})`,
                      }}
                    />
                  ))}
                </colgroup>
                <TableHead>
                  <TableRow>
                    <TableCell
                      align="center"
                      sx={{
                        width: matrixNoColWidth,
                        px: 0.25,
                        py: 0.75,
                        bgcolor: MATRIX_HEADER_BG,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        color: MATRIX_HEADER_FG,
                        borderBottom: `1px solid ${MATRIX_HEADER_BORDER}`,
                        overflow: 'hidden',
                      }}
                    >
                      <Box component="span" sx={thEllipsisSx} title="No.">
                        No.
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{
                        width: nameColumnWidth,
                        px: 1,
                        py: 0.75,
                        bgcolor: MATRIX_HEADER_BG,
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        color: MATRIX_HEADER_FG,
                        borderBottom: `1px solid ${MATRIX_HEADER_BORDER}`,
                        overflow: 'hidden',
                      }}
                    >
                      <Box component="span" sx={thEllipsisSx} title={t('attendanceStatistics.table.name')}>
                        {t('attendanceStatistics.table.name')}
                      </Box>
                    </TableCell>
                    {dayColumns.map((ymd, dayIndex) => {
                      const weekend = isWeekendYmd(ymd);
                      return (
                        <TableCell
                          key={ymd}
                          align="center"
                          data-holiday={weekend ? '1' : undefined}
                          sx={{
                            ...matrixDayColSx,
                            ...matrixHolidayColSx(dayColumns, dayIndex),
                            py: 0.75,
                            px: 0,
                            bgcolor: weekend ? MATRIX_HOLIDAY_HEADER_BG : MATRIX_HEADER_BG,
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            color: weekend ? '#9A4A4A' : MATRIX_HEADER_FG,
                            borderBottom: `1px solid ${MATRIX_HEADER_BORDER}`,
                          }}
                        >
                          <Box component="span" sx={thEllipsisSx} title={ymd}>
                            {Number(ymd.slice(8, 10))}
                          </Box>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleMatrixUsers.map((u, index) => (
                    <TableRow
                      key={u.key}
                      hover={false}
                      sx={{
                        '&:hover .MuiTableCell-root:not([data-holiday="1"])': {
                          bgcolor: `${MATRIX_HOVER_BG} !important`,
                        },
                        '&:hover .MuiTableCell-root[data-holiday="1"]': {
                          bgcolor: '#F5E8E8 !important',
                        },
                      }}
                    >
                      <TableCell
                        align="center"
                        sx={{
                          py: 0.25,
                          px: 0.25,
                          width: matrixNoColWidth,
                          color: '#64748B',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          overflow: 'hidden',
                          bgcolor: '#FFFFFF',
                        }}
                      >
                        {(showAllUsers ? 0 : (page - 1) * ATTENDANCE_USERS_PER_PAGE) + index + 1}
                      </TableCell>
                      <TableCell
                        sx={{
                          py: 0.25,
                          px: 1,
                          width: nameColumnWidth,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          bgcolor: '#FFFFFF',
                        }}
                      >
                        {u.isUnregistered ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                            <Link
                              component="button"
                              type="button"
                              variant="body2"
                              onClick={() => {
                                if (!u.prefillEmail) return;
                                navigate(`/hr/users?prefill_email=${encodeURIComponent(u.prefillEmail)}`);
                              }}
                              sx={{
                                fontWeight: 500,
                                color: '#111827',
                                fontSize: '0.8125rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                textDecoration: 'none',
                                cursor: u.prefillEmail ? 'pointer' : 'default',
                                '&:hover': u.prefillEmail ? { color: 'primary.main' } : undefined,
                              }}
                            >
                              {u.name}
                            </Link>
                            <Chip
                              size="small"
                              label={t('attendanceStatistics.matrix.unregistered')}
                              sx={{
                                height: 18,
                                borderRadius: '2px',
                                bgcolor: '#FEF3C7',
                                color: '#92400E',
                                border: '1px solid #FCD34D',
                                '& .MuiChip-label': {
                                  px: 0.6,
                                  fontSize: '0.625rem',
                                  fontWeight: 600,
                                },
                              }}
                            />
                          </Box>
                        ) : (
                          <Link
                            component="button"
                            type="button"
                            variant="body2"
                            onClick={() =>
                              openDetail({
                                userId: Number(u.userId),
                                name: u.name,
                                department: u.department,
                                recordCount: 0,
                                totalHours: 0,
                                lateCount: 0,
                                absentCount: 0,
                                normalCount: 0,
                              })
                            }
                            sx={{
                              cursor: 'pointer',
                              fontWeight: 500,
                              fontSize: '0.8125rem',
                              color: '#111827',
                              textDecoration: 'none',
                              '&:hover': { color: 'primary.main' },
                            }}
                          >
                            {u.name}
                          </Link>
                        )}
                      </TableCell>
                      {dayColumns.map((ymd, dayIndex) => {
                        const row = matrixMap.get(`${u.key}:${ymd}`);
                        const type = getMatrixCellType(row);
                        const weekend = isWeekendYmd(ymd);
                        const st = type === 'empty' ? MATRIX_STATUS.empty : MATRIX_STATUS[type];
                        const statusLabel =
                          type === 'complete'
                            ? t('attendanceStatistics.matrix.complete')
                            : type === 'partial'
                              ? t('attendanceStatistics.matrix.partial')
                              : type === 'absent'
                                ? t('attendanceStatistics.matrix.absent')
                                : '—';
                        const tip =
                          weekend && type !== 'empty'
                            ? `${ymd} · ${statusLabel} · ${t('attendanceStatistics.matrix.holidayWork')}`
                            : `${ymd} · ${statusLabel}`;
                        return (
                          <Tooltip key={`${u.key}-${ymd}`} title={tip} enterDelay={350}>
                            <TableCell
                              align="center"
                              data-holiday={weekend ? '1' : undefined}
                              sx={{
                                ...matrixDayColSx,
                                ...matrixHolidayColSx(dayColumns, dayIndex),
                                py: 0.15,
                                height: 28,
                                bgcolor: weekend ? MATRIX_HOLIDAY_BG : '#FFFFFF',
                                userSelect: 'none',
                              }}
                            >
                              {type === 'empty' ? null : (
                                <Box
                                  sx={{
                                    width: 13,
                                    height: 13,
                                    mx: 'auto',
                                    borderRadius: '50%',
                                    bgcolor: st.fill,
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: type === 'complete' ? '0.58rem' : '0.52rem',
                                    fontWeight: 700,
                                    lineHeight: 1,
                                    boxShadow:
                                      type === 'complete'
                                        ? 'inset 0 0 0 1px rgba(0,0,0,0.06)'
                                        : 'none',
                                  }}
                                >
                                  {st.glyph}
                                </Box>
                              )}
                            </TableCell>
                          </Tooltip>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {!showAllUsers && matrixUsers.length > ATTENDANCE_USERS_PER_PAGE ? (
              <Box sx={mvsBodyPaginationSx}>
                <Pagination
                  count={totalMatrixPages}
                  page={page}
                  onChange={(_, value) => setPage(value)}
                  color="primary"
                  shape="rounded"
                  sx={{
                    '& .MuiPaginationItem-root': {
                      borderRadius: '10px',
                      fontWeight: 500,
                    },
                  }}
                />
              </Box>
            ) : null}
          </Box>
        )}
      </Box>

      <Dialog open={detailOpen} onClose={closeDetail} maxWidth="md" fullWidth scroll="paper">
        <DialogTitle sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          {t('attendanceStatistics.detail.dialogTitle', { name: detailUserName || '—' })}
        </DialogTitle>
        <DialogContent dividers>
          {detailCalendarRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('attendanceStatistics.detail.empty')}
            </Typography>
          ) : (
            <>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
                  gap: 1.25,
                  mb: 2.5
                }}
              >
                {detailSummaryItems.map((item) => (
                  <Box
                    key={item.key}
                    sx={{
                      ...mvsInnerCardSx,
                      py: 1.25,
                      px: 1.5,
                      borderRadius: '8px'
                    }}
                  >
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', fontWeight: 600, mb: 0.35 }}
                    >
                      {item.label}
                    </Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: item.color, lineHeight: 1.2 }}>
                      {item.value}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <TableContainer sx={{ ...mvsBodyListTableSx, boxShadow: 'none', border: 'none' }}>
              <Table size="small" sx={detailDialogTableSx}>
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell>
                      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t('attendanceStatistics.detail.date')}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t('attendanceStatistics.detail.checkIn')}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t('attendanceStatistics.detail.checkOut')}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t('attendanceStatistics.detail.workHours')}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t('attendanceStatistics.detail.status')}
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={detailDialogTableBodySx}>
                  {detailCalendarRows.map((day) => {
                    const row = day.row;
                    const emptyStatus = day.holiday
                      ? t('attendanceStatistics.detail.holiday')
                      : t('attendanceStatistics.detail.noAttendance');
                    return (
                      <TableRow
                        key={day.key}
                        data-missing={day.missing ? '1' : undefined}
                        data-holiday-empty={row == null && day.holiday ? '1' : undefined}
                      >
                        <TableCell>{day.ymd}</TableCell>
                        <TableCell>
                          {row
                            ? displayClockCell(row.check_in_display, row.check_in_local, row.check_in ?? null)
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {row
                            ? displayClockCell(row.check_out_display, row.check_out_local, row.check_out ?? null)
                            : '—'}
                        </TableCell>
                        <TableCell align="right">
                          {row && row.work_hours != null ? Number(row.work_hours).toFixed(2) : '—'}
                        </TableCell>
                        <TableCell>{row ? detailStatusLabel(row) : emptyStatus}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeDetail} variant="outlined" sx={mvsBodyOutlinedBtnSx}>
            {t('attendanceStatistics.detail.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AttendanceStatistics;
