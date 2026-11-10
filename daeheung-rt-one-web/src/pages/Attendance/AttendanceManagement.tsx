import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Button,
  Chip,
  TextField,
  MenuItem,
  Alert,
  CircularProgress,
  AlertTitle,
  Pagination,
  Tooltip,
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsKpiCardSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
  mvsTableScrollSx,
  mvsBodyPaginationSx,
} from '../../theme/daeheungLayout';
import {
  Login as CheckInIcon,
  Logout as CheckOutIcon,
  Refresh as RefreshIcon,
  RestartAlt as ResetIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useTheme, alpha, type SxProps, type Theme } from '@mui/material/styles';
import { attendanceService, officeLocationService, vacationService, heresnowIntegrationService } from '../../services/api';
import { useStore } from '../../store';
import { usePageMenuPermission } from '../../context/MenuPermissionContext';
import { useMenuActionGuard } from '../../hooks/useMenuActionGuard';

const ATTENDANCE_MENU_ROUTES = ['/hr/attendance', '/my/attendance', '/hr'] as const;

const ATTENDANCE_PER_PAGE = 15;
const ATTENDANCE_FILTER_OUTLINED = mvsOutlinedLabelProps;
const attendanceFilterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx } as const;

const attendanceTableBodyRowSx: SxProps<Theme> = (theme) => {
  const base = typeof mvsTableBodyRowSx === 'function' ? mvsTableBodyRowSx(theme) : mvsTableBodyRowSx;
  const rowBg = theme.palette.mode === 'light' ? '#FFFFFF' : theme.palette.background.paper;
  const hoverBg = theme.palette.mode === 'light' ? '#EFF6FF' : theme.palette.action.hover;
  return {
    ...(base as object),
    '& .MuiTableRow-root:nth-of-type(odd)': { bgcolor: rowBg },
    '& .MuiTableRow-root:nth-of-type(even)': { bgcolor: rowBg },
    '& .MuiTableRow-root:hover': { bgcolor: hoverBg },
  };
};

interface Attendance {
  id: number;
  user_id: number;
  date: string;
  check_in?: string;
  check_out?: string;
  check_in_local?: string;
  check_out_local?: string;
  check_in_display?: string;
  check_out_display?: string;
  check_in_client_time?: string;
  check_out_client_time?: string;
  work_hours?: number;
  status: 'normal' | 'late' | 'early' | 'overtime' | 'absent';
  notes?: string;
  user?: {
    id: number;
    username: string;
    email: string;
    department?: string;
    position?: string;
    employee_number?: string;
  };
}

const pad2ymd = (value: number) => value.toString().padStart(2, '0');

const toYmd = (dateVal: string) => {
  const s = String(dateVal || '');
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s.slice(0, 10);
};

const isWeekendYmd = (ymd: string) => {
  const matched = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return false;
  const y = parseInt(matched[1], 10);
  const mo = parseInt(matched[2], 10);
  const d = parseInt(matched[3], 10);
  const dt = new Date(`${y}-${pad2ymd(mo)}-${pad2ymd(d)}T12:00:00+05:30`);
  const day = dt.getDay();
  return day === 0 || day === 6;
};

const countVacationOverlapDaysInMonth = (
  vacations: Array<{ start_date: string; end_date: string }>,
  monthStart: string,
  monthEnd: string
) => {
  let total = 0;
  for (const v of vacations) {
    const vs = toYmd(String(v.start_date));
    const ve = toYmd(String(v.end_date));
    const start = vs > monthStart ? vs : monthStart;
    const end = ve < monthEnd ? ve : monthEnd;
    if (start > end) continue;
    const d1 = new Date(`${start}T12:00:00+05:30`);
    const d2 = new Date(`${end}T12:00:00+05:30`);
    total += Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
  }
  return total;
};

const AttendanceManagement: React.FC = () => {
  const theme = useTheme();
  const { user } = useStore();
  const { t, i18n } = useTranslation();
  const menuFlags = usePageMenuPermission(ATTENDANCE_MENU_ROUTES);
  const mutateGuard = useMenuActionGuard('mutate', ATTENDANCE_MENU_ROUTES);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [filter, setFilter] = useState({
    status: 'all'
  });
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState(false);
  const [vacationDaysInMonth, setVacationDaysInMonth] = useState(0);
  const [officeLocation, setOfficeLocation] = useState<{ latitude: number; longitude: number; radiusMeters?: number } | null>(null);
  const [heresnowManualDisabled, setHeresnowManualDisabled] = useState(false);
  const [page, setPage] = useState(1);
  /** 근태관리는 개인화 화면으로 고정: 로그인 사용자 데이터만 조회 */
  const TIME_ZONE = 'Asia/Kolkata';
  const locale = i18n.language?.toLowerCase().startsWith('en') ? 'en-US' : 'ko-KR';
  const isEnglish = locale.startsWith('en');
  const pad2 = (value: number) => value.toString().padStart(2, '0');
  const parseUtcDate = (value: string) => {
    const hasTimeZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
    return new Date(hasTimeZone ? value : `${value}Z`);
  };
  const getClientTimeParts = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const lookup = (type: string) => parts.find((part) => part.type === type)?.value || '';
    return {
      year: lookup('year'),
      month: lookup('month'),
      day: lookup('day'),
      hour: lookup('hour'),
      minute: lookup('minute'),
      second: lookup('second')
    };
  };
  const getClientDate = useCallback(() => {
    const { year, month, day } = getClientTimeParts();
    return `${year}-${month}-${day}`;
  }, []);
  const getMonthBoundsIST = useCallback(() => {
    const { year, month } = getClientTimeParts();
    const y = parseInt(year, 10);
    const mb = parseInt(month, 10);
    const lastDay = new Date(y, mb, 0).getDate();
    return {
      start_date: `${year}-${month}-01`,
      end_date: `${year}-${month}-${pad2(lastDay)}`,
      year: y,
      month: mb
    };
  }, []);
  const initialBounds = getMonthBoundsIST();
  const [startDate, setStartDate] = useState(initialBounds.start_date);
  const [endDate, setEndDate] = useState(initialBounds.end_date);
  const getClientTimeISO = () => {
    const { year, month, day, hour, minute, second } = getClientTimeParts();
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`;
  };
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const calculateDistanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const earthRadiusMeters = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
      * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMeters * c;
  };

  useEffect(() => {
    const fetchOfficeLocation = async () => {
      try {
        const response = await officeLocationService.getOfficeLocation();
        if (response.success) {
          const location = response.data?.officeLocation;
          if (location?.latitude && location?.longitude) {
            setOfficeLocation({
              latitude: typeof location.latitude === 'string' ? parseFloat(location.latitude) : location.latitude,
              longitude: typeof location.longitude === 'string' ? parseFloat(location.longitude) : location.longitude,
              radiusMeters: location.radiusMeters
            });
          } else {
            setOfficeLocation(null);
          }
        }
      } catch (locationError) {
      }
    };

    fetchOfficeLocation();
  }, []);

  useEffect(() => {
    let cancelled = false;
    heresnowIntegrationService
      .getStatus()
      .then((res) => {
        if (!cancelled) {
          setHeresnowManualDisabled(Boolean(res?.data?.manualClockDisabled ?? res?.data?.enabled));
        }
      })
      .catch(() => {
        if (!cancelled) setHeresnowManualDisabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.company_id]);

  const getCurrentPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('? ??????? ?? ??? ??? ? ????.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });

  // ??? ?? ??
  useEffect(() => {
    const fetchTodayAttendance = async () => {
      try {
      const response = await attendanceService.getTodayAttendance(getClientDate());
        if (response.success) {
          setTodayAttendance(response.data);
        }
      } catch {
      /* ignore */
    }
    };

    if (user) {
      fetchTodayAttendance();
    }
  }, [user, getClientDate]);

  useEffect(() => {
    if (!user?.id) {
      setVacationDaysInMonth(0);
      return;
    }
    let cancelled = false;
    vacationService
      .getVacations({
        user_id: user.id,
        status: 'approved',
        start_date: startDate,
        end_date: endDate
      })
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setVacationDaysInMonth(countVacationOverlapDaysInMonth(list, startDate, endDate));
      })
      .catch(() => {
        if (!cancelled) setVacationDaysInMonth(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, startDate, endDate]);

  const myMonthStats = useMemo(() => {
    if (!user?.id) {
      return { workingDays: 0, lateDays: 0 };
    }
    const myRows = attendances.filter((a) => {
      const ymd = toYmd(a.date);
      return a.user_id === user.id && ymd >= startDate && ymd <= endDate;
    });
    const workingDays = new Set(myRows.map((a) => toYmd(a.date))).size;
    const lateDays = myRows.filter(
      (a) => a.status === 'late' && !isWeekendYmd(toYmd(a.date))
    ).length;
    return { workingDays, lateDays };
  }, [attendances, user?.id, startDate, endDate]);

  // ?? ?? ??
  const fetchAttendances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        start_date: startDate,
        end_date: endDate
      };
      if (filter.status !== 'all') {
        params.status = filter.status;
      }

      const response = await attendanceService.getAttendances(params);
      if (response.success) {
        setAttendances(response.data || []);
      } else {
        setError(response.message || t('attendanceManagement.loadListFailed'));
      }
    } catch (error: any) {
      setError(error.response?.data?.message || t('attendanceManagement.loadListError'));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filter.status, t]);

  useEffect(() => {
    if (menuFlags.menusLoading || !menuFlags.canRead) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return;
    if (startDate > endDate) return;
    fetchAttendances();
  }, [fetchAttendances, startDate, endDate, menuFlags.menusLoading, menuFlags.canRead]);

  // ?? ??
  const handleCheckIn = async () => {
    if (!mutateGuard.guard()) return;
    if (heresnowManualDisabled) {
      setError(t('attendanceManagement.heresnowManualClockDisabled'));
      return;
    }
    if (todayAttendance?.check_in) {
      setError(t('attendanceManagement.alreadyCheckedIn'));
      return;
    }
    setCheckInLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const client_time = getClientTimeISO();
      const client_date = getClientDate();
      const requiresSecureContext = typeof window !== 'undefined' && !window.isSecureContext;
      const canUseGeo = !!navigator.geolocation && !requiresSecureContext;
      let skipGeo = !canUseGeo;
      let latitude: number | undefined;
      let longitude: number | undefined;
      let accuracy: number | undefined;

      if (canUseGeo) {
        try {
          const position = await getCurrentPosition();
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          accuracy = position.coords.accuracy;
        } catch (geoError) {
          skipGeo = true;
        }
      }

      if (officeLocation && !skipGeo && latitude !== undefined && longitude !== undefined) {
        const radiusMeters = officeLocation.radiusMeters ?? 200;
        const distance = calculateDistanceMeters(
          latitude,
          longitude,
          officeLocation.latitude,
          officeLocation.longitude
        );
        if (distance > radiusMeters) {
          setError(t('attendanceManagement.officeOnly'));
          return;
        }
      }
            const response = await attendanceService.checkIn({
        latitude,
        longitude,
        accuracy,
        client_time,
        client_date,
        use_server_time: skipGeo,
        skip_geo: skipGeo
      });
      if (response.success) {
        setSuccess(response.message || t('attendanceManagement.checkInSuccess'));
        setTodayAttendance(response.data);
        fetchAttendances();
      } else {
        setError(response.message || t('attendanceManagement.checkInFailed'));
      }
    } catch (error: any) {
      if (error.code === 1 || error.message?.includes('Geolocation')) {
        setError(t('attendanceManagement.locationRequired'));
      } else {
        setError(error.response?.data?.message || t('attendanceManagement.checkInError'));
      }
    } finally {
      setCheckInLoading(false);
    }
  };

  // ?? ??
  const handleCheckOut = async () => {
    if (!mutateGuard.guard()) return;
    if (heresnowManualDisabled) {
      setError(t('attendanceManagement.heresnowManualClockDisabled'));
      return;
    }
    setCheckOutLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const client_time = getClientTimeISO();
      const client_date = getClientDate();
            const response = await attendanceService.checkOut({
        client_time,
        client_date,
        use_server_time: true,
        skip_geo: true
      });
      if (response.success) {
        // ?? ???? ?? ??(i18n) ???? ?? ??
        setSuccess(t('attendanceManagement.checkOutSuccess'));
        setTodayAttendance(response.data);
        fetchAttendances();
      } else {
        setError(response.message || t('attendanceManagement.checkOutFailed'));
      }
    } catch (error: any) {
        setError(error.response?.data?.message || t('attendanceManagement.checkOutError'));
    } finally {
      setCheckOutLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'normal': return t('attendanceManagement.statusNormal');
      case 'late': return t('attendanceManagement.statusLate');
      case 'early': return t('attendanceManagement.statusEarly');
      case 'overtime': return t('attendanceManagement.statusOvertime');
      case 'absent': return t('attendanceManagement.statusAbsent');
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'success';
      case 'late': return 'warning';
      case 'early': return 'info';
      case 'overtime': return 'secondary';
      case 'absent': return 'error';
      default: return 'default';
    }
  };

  type DisplayStatus = {
    label: string;
    color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
    holiday?: boolean;
  };

  const getDisplayStatus = (attendance: Attendance): DisplayStatus => {
    const ymd = toYmd(attendance.date);
    if (isWeekendYmd(ymd)) {
      return {
        label: t('attendanceManagement.statusHolidayWork'),
        color: 'default',
        holiday: true
      };
    }
    return {
      label: getStatusLabel(attendance.status),
      color: getStatusColor(attendance.status) as DisplayStatus['color']
    };
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = parseUtcDate(dateString);
      if (Number.isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: TIME_ZONE,
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const formatHourMinute = (hours: number, minutes: string) => {
    const period = hours >= 12
      ? (isEnglish ? 'PM' : '오후')
      : (isEnglish ? 'AM' : '오전');
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${period} ${pad2(displayHour)}:${minutes}`;
  };

  const formatClientTimeString = (value?: string) => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    const offsetMatch = raw.match(/([zZ]|[+-]\d{2}:\d{2})$/);
    if (offsetMatch) {
      const offset = offsetMatch[1];
      if (/z/i.test(offset) || offset !== '+05:30') {
        return formatTime(raw);
      }
    }
    const match = raw.match(/T(\d{2}):(\d{2})/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = match[2];
    return formatHourMinute(hours, minutes);
  };

  const formatLocalClockTime = (value?: string) => {
    if (!value) return null;
    const match = String(value).match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = match[2];
    if (Number.isNaN(hours) || hours < 0 || hours > 23) return null;
    return formatHourMinute(hours, minutes);
  };

  const normalizeServerDisplayTime = (value?: string) => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    if (isEnglish) {
      return raw.replace(/^오전\s*/i, 'AM ').replace(/^오후\s*/i, 'PM ');
    }
    return raw.replace(/^AM\s*/i, '오전 ').replace(/^PM\s*/i, '오후 ');
  };

  const displayTime = (
    rawTime?: string,
    localTime?: string,
    displayTimeValue?: string,
    clientTimeValue?: string
  ) => {
    const clientDisplay = formatClientTimeString(clientTimeValue);
    if (clientDisplay) {
      return clientDisplay;
    }
    if (rawTime) {
      return formatTime(rawTime);
    }
    const localDisplay = formatLocalClockTime(localTime);
    if (localDisplay) {
      return localDisplay;
    }
    const serverDisplay = normalizeServerDisplayTime(displayTimeValue);
    if (serverDisplay) {
      return serverDisplay;
    }
    if (localTime) {
      return localTime;
    }
    return '-';
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: TIME_ZONE
      });
    } catch {
      return dateString;
    }
  };

  const filteredAttendances = attendances.filter((attendance) => {
    const ymd = toYmd(attendance.date);
    if (ymd < startDate || ymd > endDate) return false;
    if (filter.status !== 'all' && attendance.status !== filter.status) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredAttendances.length / ATTENDANCE_PER_PAGE));
  const paginatedAttendances = useMemo(
    () => filteredAttendances.slice((page - 1) * ATTENDANCE_PER_PAGE, page * ATTENDANCE_PER_PAGE),
    [filteredAttendances, page]
  );

  const hasActiveFilters = useMemo(() => {
    const bounds = getMonthBoundsIST();
    return filter.status !== 'all' || startDate !== bounds.start_date || endDate !== bounds.end_date;
  }, [filter.status, startDate, endDate, getMonthBoundsIST]);

  const handleResetFilters = () => {
    const bounds = getMonthBoundsIST();
    setStartDate(bounds.start_date);
    setEndDate(bounds.end_date);
    setFilter({ status: 'all' });
  };

  useEffect(() => {
    setPage(1);
  }, [filter.status, startDate, endDate]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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

  const todayYmd = getClientDate();
  const todayIsWeekend = isWeekendYmd(todayYmd);

  const valueColor = theme.palette.mode === 'dark' ? theme.palette.common.white : 'text.primary';

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('attendanceManagement.pageTitle')}
        description={t('attendanceManagement.description')}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {!menuFlags.menusLoading && !menuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('common.menuNoView')}
        </Alert>
      )}

      <Alert severity={heresnowManualDisabled ? 'warning' : 'info'} sx={{ mb: 2 }}>
        <AlertTitle>{t('attendanceManagement.heresnowTitle')}</AlertTitle>
        {heresnowManualDisabled
          ? t('attendanceManagement.heresnowManualClockDisabled')
          : t('attendanceManagement.personalViewNotice')}
        {heresnowManualDisabled && (
          <Box sx={{ mt: 1 }}>
            <Button
              href="https://www.heresnow.in/login"
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              variant="outlined"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {t('attendanceManagement.heresnowOpen')}
            </Button>
          </Box>
        )}
      </Alert>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2.5,
          mb: 3,
        }}
      >
        {[
          { key: 'working', label: t('attendanceManagement.statWorkingDays'), value: myMonthStats.workingDays },
          { key: 'vacation', label: t('attendanceManagement.statVacationDays'), value: vacationDaysInMonth },
          { key: 'late', label: t('attendanceManagement.statLateDays'), value: myMonthStats.lateDays, color: 'warning.dark' as const },
        ].map((item) => (
          <Card key={item.key} elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                {item.label}
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  mt: 0.75,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: item.color ?? 'text.primary',
                }}
              >
                {item.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card elevation={0} sx={{ ...mvsBodyListTableSx, mb: 2.5 }}>
        <CardContent sx={{ py: 2.5, px: { xs: 2, sm: 2.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, letterSpacing: '-0.02em', color: valueColor }}>
              {t('attendanceManagement.todayAttendance')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              <Tooltip title={mutateGuard.tooltipTitle} disableHoverListener={!mutateGuard.tooltipTitle}>
                <span>
                  <Button
                    variant="contained"
                    disableElevation
                    size="small"
                    startIcon={<CheckInIcon fontSize="small" />}
                    onClick={handleCheckIn}
                    disabled={mutateGuard.disabled || heresnowManualDisabled || checkInLoading || !!todayAttendance?.check_in}
                    sx={mvsBodyPrimaryBtnSx}
                  >
                    {checkInLoading ? <CircularProgress size={16} color="inherit" /> : t('attendanceManagement.checkIn')}
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title={mutateGuard.tooltipTitle} disableHoverListener={!mutateGuard.tooltipTitle}>
                <span>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CheckOutIcon fontSize="small" />}
                    onClick={handleCheckOut}
                    disabled={mutateGuard.disabled || heresnowManualDisabled || checkOutLoading || !todayAttendance?.check_in || !!todayAttendance?.check_out}
                    sx={mvsBodyOutlinedBtnSx}
                  >
                    {checkOutLoading ? <CircularProgress size={16} /> : t('attendanceManagement.checkOut')}
                  </Button>
                </span>
              </Tooltip>
            </Box>
          </Box>

          {todayAttendance ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                gap: 2,
                p: 2,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.06)' : 'divider',
                bgcolor: theme.palette.mode === 'light' ? alpha(theme.palette.common.black, 0.02) : alpha(theme.palette.common.white, 0.04),
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {t('attendanceManagement.checkInTime')}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, color: valueColor }}>
                  {displayTime(
                    todayAttendance.check_in,
                    todayAttendance.check_in_local,
                    todayAttendance.check_in_display,
                    todayAttendance.check_in_client_time
                  )}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {t('attendanceManagement.checkOutTime')}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, color: valueColor }}>
                  {displayTime(
                    todayAttendance.check_out,
                    todayAttendance.check_out_local,
                    todayAttendance.check_out_display,
                    todayAttendance.check_out_client_time
                  )}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {t('attendanceManagement.workHours')}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, color: valueColor }}>
                  {todayAttendance.work_hours != null ? `${todayAttendance.work_hours}${t('attendanceManagement.hoursUnit')}` : '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {t('attendanceManagement.status')}
                </Typography>
                <Chip
                  label={
                    todayIsWeekend
                      ? t('attendanceManagement.statusHolidayWork')
                      : getStatusLabel(todayAttendance.status)
                  }
                  color={(todayIsWeekend ? 'default' : getStatusColor(todayAttendance.status)) as any}
                  size="small"
                  variant={todayIsWeekend ? 'outlined' : 'filled'}
                  sx={
                    todayIsWeekend
                      ? {
                          height: 26,
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          borderColor: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.12)' : theme.palette.divider,
                        }
                      : { height: 26, fontWeight: 600, fontSize: '0.75rem' }
                  }
                />
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {heresnowManualDisabled
                ? t('attendanceManagement.noTodayAttendanceHeresnow')
                : t('attendanceManagement.noTodayAttendance')}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card elevation={0} sx={mvsBodyCardSx}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 1,
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            bgcolor: '#FFFFFF',
          }}
        >
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon fontSize="small" />}
            onClick={fetchAttendances}
            disabled={loading}
            sx={mvsBodyOutlinedBtnSx}
          >
            {t('attendanceManagement.refresh')}
          </Button>
        </Box>

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
              lg: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto',
            },
            gap: 2,
            alignItems: 'flex-end',
          }}
        >
          <TextField
            size="small"
            type="date"
            label={t('attendanceManagement.startDate')}
            {...ATTENDANCE_FILTER_OUTLINED}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            sx={attendanceFilterFieldSx}
          />
          <TextField
            size="small"
            type="date"
            label={t('attendanceManagement.endDate')}
            {...ATTENDANCE_FILTER_OUTLINED}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={attendanceFilterFieldSx}
          />
          <TextField
            fullWidth
            size="small"
            select
            label={t('attendanceManagement.status')}
            {...ATTENDANCE_FILTER_OUTLINED}
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            SelectProps={{
              displayEmpty: true,
              renderValue: (selected) =>
                selected === 'all' ? t('attendanceManagement.all') : getStatusLabel(String(selected)),
            }}
            sx={attendanceFilterFieldSx}
          >
            <MenuItem value="all">{t('attendanceManagement.all')}</MenuItem>
            <MenuItem value="normal">{t('attendanceManagement.statusNormal')}</MenuItem>
            <MenuItem value="late">{t('attendanceManagement.statusLate')}</MenuItem>
            <MenuItem value="early">{t('attendanceManagement.statusEarly')}</MenuItem>
            <MenuItem value="overtime">{t('attendanceManagement.statusOvertime')}</MenuItem>
            <MenuItem value="absent">{t('attendanceManagement.statusAbsent')}</MenuItem>
          </TextField>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ResetIcon fontSize="small" />}
            onClick={handleResetFilters}
            sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap' }}
          >
            {t('attendanceManagement.reset')}
          </Button>
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        {loading ? (
          <Box sx={listStateBoxSx}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              {t('attendanceManagement.empty.loading')}
            </Typography>
          </Box>
        ) : filteredAttendances.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <EventNoteIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
              {hasActiveFilters
                ? t('attendanceManagement.empty.noResults')
                : t('attendanceManagement.empty.noItems')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              {hasActiveFilters
                ? t('attendanceManagement.empty.noResultsHint')
                : t('attendanceManagement.empty.noItemsHint')}
            </Typography>
            {hasActiveFilters ? (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ResetIcon fontSize="small" />}
                onClick={handleResetFilters}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('attendanceManagement.reset')}
              </Button>
            ) : null}
          </Box>
        ) : (
          <>
            <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
              <Table
                size="small"
                sx={{
                  tableLayout: 'fixed',
                  width: '100%',
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
                    <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t('attendanceManagement.employeeName')}
                    </TableCell>
                    <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t('attendanceManagement.date')}
                    </TableCell>
                    <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t('attendanceManagement.checkInTimeShort')}
                    </TableCell>
                    <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t('attendanceManagement.checkOutTimeShort')}
                    </TableCell>
                    <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t('attendanceManagement.workHoursShort')}
                    </TableCell>
                    <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t('attendanceManagement.status')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={attendanceTableBodyRowSx}>
                  {paginatedAttendances.map((attendance) => {
                    const disp = getDisplayStatus(attendance);
                    return (
                      <TableRow key={attendance.id}>
                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Typography variant="body2" fontWeight={500} noWrap title={attendance.user?.username || '-'}>
                            {attendance.user?.username || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatDate(attendance.date)}
                        </TableCell>
                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {displayTime(
                            attendance.check_in,
                            attendance.check_in_local,
                            attendance.check_in_display,
                            attendance.check_in_client_time
                          )}
                        </TableCell>
                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {displayTime(
                            attendance.check_out,
                            attendance.check_out_local,
                            attendance.check_out_display,
                            attendance.check_out_client_time
                          )}
                        </TableCell>
                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {attendance.work_hours != null ? `${attendance.work_hours}${t('attendanceManagement.hoursUnit')}` : '-'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={disp.label}
                            color={disp.color as any}
                            size="small"
                            variant={disp.holiday ? 'outlined' : 'filled'}
                            sx={{
                              height: 26,
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              maxWidth: '100%',
                              ...(disp.holiday
                                ? {
                                    borderColor: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.12)' : theme.palette.divider,
                                  }
                                : {}),
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={mvsBodyPaginationSx}>
              <Pagination
                count={totalPages}
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
          </>
        )}
      </Box>
    </Box>
  );
};

export default AttendanceManagement;
