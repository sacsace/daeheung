import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  TableSortLabel,
  Chip,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  TextField,
  Stack,
  Autocomplete,
  InputAdornment,
  Tooltip,
  Pagination,
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsKpiCardSx,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodySectionHeaderSx,
  mvsBodyFilterWrapSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsBodyPaginationSx,
  mvsTableScrollSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
} from '../../theme/daeheungLayout';
import {
  Search as SearchIcon,
  MoreHoriz as MoreHorizIcon,
  Login as CheckInIcon,
  Logout as CheckOutIcon,
  EventBusy as NoShowIcon,
  Cancel as CancelIcon,
  MeetingRoom as AssignRoomIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { roomBookingService, roomTypeRoomService, roomTypeService } from '../../services/api';
import { generateWalkInBookingId } from '../../utils/bookingId';
import { useStore } from '../../store';

const formatDate = (value: string | undefined, locale: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(locale);
};

type RoomTypeMaster = { id: number; name: string; nightlyRate?: number };
type RoomTypeRoomRow = { id: number; roomTypeId: number; roomNumber: string; roomName: string };

/** 호실 번호 숫자 오름차순 (문자열 정렬 시 11이 2보다 앞서는 문제 방지) */
const sortRoomsByRoomNumberAsc = (rooms: RoomTypeRoomRow[]) =>
  [...rooms].sort((a, b) =>
    String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true })
  );

const parseCurrencyInput = (value: string) => value.replace(/[^\d]/g, '');

const calculateTotalNights = (checkInDate: string, checkOutDate: string) => {
  if (!checkInDate || !checkOutDate) return 1;
  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  return Math.max(Math.ceil((end.getTime() - start.getTime()) / 86400000), 1);
};

const toIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** 체크인일 기준 다음 날 (워크인은 1박 고정) */
const addOneDayIso = (isoDate: string) => {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setDate(d.getDate() + 1);
  return toIsoDate(d);
};

const getDefaultWalkInForm = () => {
  const t = new Date();
  const tomorrow = new Date(t);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    roomType: '',
    roomDbId: '' as number | '',
    roomNumber: '',
    checkInDate: toIsoDate(t),
    checkOutDate: toIsoDate(tomorrow),
    checkInTime: '15:00',
    checkOutTime: '11:00',
    numberOfGuests: 1,
    nightlyRate: '',
    specialRequests: ''
  };
};

type FrontDeskBookingSortKey = 'bookingNo' | 'guestName' | 'checkIn' | 'checkOut' | 'status';

const STATUS_SORT_ORDER: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  checked_in: 2,
  checked_out: 3,
  cancelled: 4,
  no_show: 5
};

/** 예약자 표시·검색 공통 (API snake/camel 혼용 대응, 표시 우선순위와 동일) */
const getBookingGuestSearchable = (b: any) =>
  String(b?.guest_name ?? b?.guestName ?? b?.user?.username ?? b?.user?.name ?? '').trim();

const frontDeskSearchFieldSx = {
  ...(mvsSearchFieldSx as Record<string, unknown>),
  ...mvsFilterFieldHeightSx,
} as const;

const frontDeskTableSx = {
  width: '100%',
  maxWidth: '100%',
  tableLayout: 'auto' as const,
  borderCollapse: 'collapse',
  bgcolor: 'transparent',
  '& .MuiTableCell-root': {
    borderLeft: 'none',
    borderRight: 'none',
    borderTop: 'none',
  },
  '& .MuiTableSortLabel-root': {
    color: 'inherit',
  },
  '& .MuiTableSortLabel-root.Mui-active': {
    color: 'text.primary',
  },
} as const;

const frontDeskCellBaseSx = {
  fontSize: { xs: '0.75rem', sm: '0.8125rem' },
  py: 0.75,
  px: { xs: 0.5, sm: 1 },
  verticalAlign: 'middle' as const,
} as const;

const frontDeskCellEllipsisSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 0,
} as const;

const chipSx = { fontWeight: 600, borderRadius: '8px' } as const;

const renderEllipsisText = (text: string, fontWeight?: number) => (
  <Tooltip title={text} placement="top-start" enterDelay={400}>
    <Box
      component="span"
      sx={{
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight,
      }}
    >
      {text}
    </Box>
  </Tooltip>
);

const FrontDesk: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useStore();
  const canManagePastCheckIn = user?.role === 'root' || user?.role === 'admin';

  const statusLabel = useCallback((status: string) => {
    switch (status) {
      case 'pending':
        return t('frontDesk.status.pending');
      case 'confirmed':
        return t('frontDesk.status.confirmed');
      case 'checked_in':
        return t('frontDesk.status.checkedIn');
      case 'checked_out':
        return t('frontDesk.status.checkedOut');
      case 'cancelled':
        return t('frontDesk.status.cancelled');
      case 'no_show':
        return t('frontDesk.status.noShow');
      default:
        return status;
    }
  }, [t]);

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info'
  });
  const [dialog, setDialog] = useState<{
    open: boolean;
    mode: 'checkin' | 'checkout' | 'no_show' | 'cancel' | null;
  }>({
    open: false,
    mode: null
  });
  const [selectedBookingId, setSelectedBookingId] = useState<number | ''>('');
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [checkoutBooking, setCheckoutBooking] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  /** 노쇼 확인 — 네이티브 confirm 대신 테마 맞춤 Dialog */
  const [noShowConfirmOpen, setNoShowConfirmOpen] = useState(false);
  const [noShowTargetId, setNoShowTargetId] = useState<number | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);

  /** 워크인(무예약 즉시 체크인) */
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInSaving, setWalkInSaving] = useState(false);
  const [walkInForm, setWalkInForm] = useState(() => getDefaultWalkInForm());
  const [roomTypeMaster, setRoomTypeMaster] = useState<RoomTypeMaster[]>([]);
  const [roomTypeRooms, setRoomTypeRooms] = useState<RoomTypeRoomRow[]>([]);

  /** 기존 예약의 호실만 변경 */
  const [assignRoomOpen, setAssignRoomOpen] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignBookingId, setAssignBookingId] = useState<number | ''>('');
  const [assignNewRoom, setAssignNewRoom] = useState<RoomTypeRoomRow | null>(null);

  const [bookingSortBy, setBookingSortBy] = useState<FrontDeskBookingSortKey | null>(null);
  const [bookingSortDir, setBookingSortDir] = useState<'asc' | 'desc'>('asc');
  const [bookingListSearch, setBookingListSearch] = useState('');
  const [bookingPage, setBookingPage] = useState(1);
  const [showAllBookings, setShowAllBookings] = useState(false);
  const [rowActionMenu, setRowActionMenu] = useState<{
    mouseX: number;
    mouseY: number;
    booking: any;
  } | null>(null);
  const bookingsPerPage = 10;

  const today = new Date().toISOString().split('T')[0];
  const todayCheckins = bookings.filter((b) => b.check_in_date === today).length;
  const todayCheckouts = bookings.filter((b) => b.check_out_date === today).length;
  const pendingRequests = bookings.filter((b) => b.status === 'pending').length;
  const occupancyRate = useMemo(() => {
    const checkedIn = bookings.filter((b) => b.status === 'checked_in').length;
    return bookings.length > 0 ? `${Math.round((checkedIn / bookings.length) * 100)}%` : '0%';
  }, [bookings]);

  const summaryCards = [
    { label: t('frontDesk.summary.todayCheckin'), value: String(todayCheckins) },
    { label: t('frontDesk.summary.todayCheckout'), value: String(todayCheckouts) },
    { label: t('frontDesk.summary.occupancyRate'), value: occupancyRate },
    { label: t('frontDesk.summary.pendingRequests'), value: String(pendingRequests) }
  ];

  const availableForCheckin = bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending');
  const availableForCheckout = bookings.filter((b) => b.status === 'checked_in');
  const availableForNoShow = bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending');
  const availableForCancel = useMemo(
    () => bookings.filter((b) => b.status === 'pending' || b.status === 'confirmed'),
    [bookings]
  );

  const walkInRoomTypeOptions = useMemo(() => {
    const types = new Set<string>();
    roomTypeMaster.forEach((item) => types.add(item.name));
    return Array.from(types).filter(Boolean).sort();
  }, [roomTypeMaster]);

  const availableWalkInRooms = useMemo(() => {
    const selectedType = walkInForm.roomType.trim();
    if (!selectedType) return [];
    const typeInfo = roomTypeMaster.find((item) => item.name === selectedType);
    const typeId = typeInfo?.id;
    if (!typeId) return [];
    const roomsForType = roomTypeRooms.filter((room) => room.roomTypeId === typeId);

    if (!walkInForm.checkInDate || !walkInForm.checkOutDate) {
      return [];
    }

    const start = new Date(`${walkInForm.checkInDate}T00:00:00`);
    const end = new Date(`${walkInForm.checkOutDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return [];
    }

    const toDateStr = (v: unknown) => {
      if (!v) return '';
      if (typeof v === 'string') return v.slice(0, 10);
      try {
        return new Date(v as string).toISOString().slice(0, 10);
      } catch {
        return '';
      }
    };

    const blockedIds = new Set<number>();
    const blockedNumbers = new Set<string>();
    const typeNorm = selectedType.trim();
    bookings.forEach((booking) => {
      if (booking.status === 'cancelled' || booking.status === 'no_show') {
        return;
      }
      if (String(booking.room_type || '').trim() !== typeNorm) {
        return;
      }
      const ci = toDateStr(booking.check_in_date);
      const co = toDateStr(booking.check_out_date);
      if (!ci || !co) {
        return;
      }
      const bookingStart = new Date(`${ci}T00:00:00`);
      const bookingEnd = new Date(`${co}T00:00:00`);
      if (Number.isNaN(bookingStart.getTime()) || Number.isNaN(bookingEnd.getTime())) {
        return;
      }
      const overlaps = start < bookingEnd && end > bookingStart;
      if (overlaps) {
        const rid = Number(booking.room_id);
        if (Number.isFinite(rid)) {
          blockedIds.add(rid);
        }
        const rn = String(booking.room_number || '').trim();
        if (rn) {
          blockedNumbers.add(rn);
        }
      }
    });

    return sortRoomsByRoomNumberAsc(
      roomsForType.filter((room) => !blockedIds.has(room.id) && !blockedNumbers.has(room.roomNumber))
    );
  }, [
    bookings,
    roomTypeMaster,
    roomTypeRooms,
    walkInForm.checkInDate,
    walkInForm.checkOutDate,
    walkInForm.roomType
  ]);

  const walkInEstimatedTotal = useMemo(() => {
    const normalized = parseCurrencyInput(walkInForm.nightlyRate);
    const nightly = Number(normalized);
    if (!normalized || Number.isNaN(nightly)) {
      return 0;
    }
    const nights = calculateTotalNights(walkInForm.checkInDate, walkInForm.checkOutDate);
    return Math.round(nightly * nights);
  }, [walkInForm.nightlyRate, walkInForm.checkInDate, walkInForm.checkOutDate]);

  const eligibleForAssignRoom = useMemo(
    () => bookings.filter((b) => ['pending', 'confirmed', 'checked_in'].includes(String(b.status || ''))),
    [bookings]
  );

  const filteredBookings = useMemo(() => {
    const raw = bookingListSearch.trim();
    if (!raw) return bookings;

    const q = raw.normalize('NFC').toLowerCase();

    const buildGuestBlob = (b: any) =>
      [
        getBookingGuestSearchable(b),
        b.guest_email ?? b.guestEmail,
        b.guest_phone ?? b.guestPhone,
        b.company_name ?? b.companyName,
        b.user?.email,
        b.user?.name
      ]
        .filter((x) => x != null && String(x).trim() !== '')
        .map((x) => String(x).normalize('NFC').toLowerCase())
        .join(' ');

    const buildMetaBlob = (b: any, includeRoomType: boolean) => {
      const ci = b.check_in_date ? String(b.check_in_date).slice(0, 10) : '';
      const co = b.check_out_date ? String(b.check_out_date).slice(0, 10) : '';
      const parts = [
        String(b.booking_id ?? b.bookingId ?? ''),
        String(b.id ?? ''),
        String(b.room_number ?? b.roomNumber ?? ''),
        String(b.status ?? ''),
        statusLabel(String(b.status ?? '')),
        ci,
        co
      ];
      if (includeRoomType) {
        parts.push(String(b.room_type ?? b.roomType ?? ''));
      }
      return parts.join(' ').normalize('NFC').toLowerCase();
    };

    const rowMatches = (b: any, includeRoomType: boolean) => {
      const guestBlob = buildGuestBlob(b);
      const metaBlob = buildMetaBlob(b, includeRoomType);
      return guestBlob.includes(q) || metaBlob.includes(q);
    };

    /**
     * room_type에 호텔명이 들어가면(예: Minsub Deluxe) 한 단어 검색이 모든 행에 걸리는 문제가 있어,
     * 1차는 게스트·예약번호·호실·날짜·상태만 매칭하고, 0건일 때만 객실유형까지 포함해 재검색합니다.
     */
    const primary = bookings.filter((b) => rowMatches(b, false));
    if (primary.length > 0) return primary;
    return bookings.filter((b) => rowMatches(b, true));
  }, [bookings, bookingListSearch, statusLabel]);

  const sortedBookings = useMemo(() => {
    if (!bookingSortBy) return filteredBookings;
    const dir = bookingSortDir === 'asc' ? 1 : -1;
    const loc = i18n.language === 'en' ? 'en' : 'ko';
    return [...filteredBookings].sort((a, b) => {
      switch (bookingSortBy) {
        case 'bookingNo': {
          const sa = String(a.booking_id ?? a.id ?? '');
          const sb = String(b.booking_id ?? b.id ?? '');
          return dir * sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
        }
        case 'guestName': {
          const sa = getBookingGuestSearchable(a);
          const sb = getBookingGuestSearchable(b);
          return dir * sa.localeCompare(sb, loc, { sensitivity: 'base' });
        }
        case 'checkIn': {
          const ta = new Date(a.check_in_date).getTime();
          const tb = new Date(b.check_in_date).getTime();
          const va = Number.isNaN(ta) ? 0 : ta;
          const vb = Number.isNaN(tb) ? 0 : tb;
          return dir * (va - vb);
        }
        case 'checkOut': {
          const ta = new Date(a.check_out_date).getTime();
          const tb = new Date(b.check_out_date).getTime();
          const va = Number.isNaN(ta) ? 0 : ta;
          const vb = Number.isNaN(tb) ? 0 : tb;
          return dir * (va - vb);
        }
        case 'status': {
          const oa = STATUS_SORT_ORDER[String(a.status)] ?? 99;
          const ob = STATUS_SORT_ORDER[String(b.status)] ?? 99;
          if (oa !== ob) return dir * (oa - ob);
          return dir * String(a.status || '').localeCompare(String(b.status || ''));
        }
        default:
          return 0;
      }
    });
  }, [filteredBookings, bookingSortBy, bookingSortDir, i18n.language]);

  const paginatedBookings = useMemo(
    () => sortedBookings.slice(
      (bookingPage - 1) * bookingsPerPage,
      bookingPage * bookingsPerPage
    ),
    [bookingPage, sortedBookings]
  );
  const visibleBookings = showAllBookings ? sortedBookings : paginatedBookings;

  const handleBookingSort = (key: FrontDeskBookingSortKey) => {
    setBookingPage(1);
    if (bookingSortBy === key) {
      setBookingSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setBookingSortBy(key);
      setBookingSortDir('asc');
    }
  };

  const selectedAssignBooking = useMemo(() => {
    if (assignBookingId === '') return null;
    return bookings.find((b) => b.id === assignBookingId) ?? null;
  }, [bookings, assignBookingId]);

  const availableAssignRooms = useMemo(() => {
    if (!selectedAssignBooking) return [];
    const selectedType = String(selectedAssignBooking.room_type || '').trim();
    if (!selectedType) return [];
    const typeInfo = roomTypeMaster.find((item) => item.name === selectedType);
    const typeId = typeInfo?.id;
    if (!typeId) return [];
    const roomsForType = roomTypeRooms.filter((room) => room.roomTypeId === typeId);

    const toDateStr = (v: unknown) => {
      if (!v) return '';
      if (typeof v === 'string') return v.slice(0, 10);
      try {
        return new Date(v as string).toISOString().slice(0, 10);
      } catch {
        return '';
      }
    };

    const ci = toDateStr(selectedAssignBooking.check_in_date);
    const co = toDateStr(selectedAssignBooking.check_out_date);
    if (!ci || !co) return [];

    const start = new Date(`${ci}T00:00:00`);
    const end = new Date(`${co}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return [];
    }

    const blocked = new Set<string>();
    bookings.forEach((booking) => {
      if (booking.id === selectedAssignBooking.id) return;
      if (booking.status === 'cancelled' || booking.status === 'no_show') {
        return;
      }
      if ((booking.room_type || '') !== selectedType) {
        return;
      }
      const c1 = toDateStr(booking.check_in_date);
      const c2 = toDateStr(booking.check_out_date);
      if (!c1 || !c2) return;
      const bookingStart = new Date(`${c1}T00:00:00`);
      const bookingEnd = new Date(`${c2}T00:00:00`);
      if (Number.isNaN(bookingStart.getTime()) || Number.isNaN(bookingEnd.getTime())) {
        return;
      }
      const overlaps = start < bookingEnd && end > bookingStart;
      if (overlaps) {
        blocked.add(String(booking.room_number || '').trim());
      }
    });

    const available = roomsForType.filter((room) => !blocked.has(room.roomNumber));

    const curNum = String(selectedAssignBooking.room_number || '').trim();
    if (curNum) {
      const already = available.some((r) => r.roomNumber === curNum);
      if (!already) {
        const fromMaster = roomsForType.find((r) => r.roomNumber === curNum);
        if (fromMaster) {
          available.push(fromMaster);
        } else {
          available.push({
            id: Number(selectedAssignBooking.room_id),
            roomTypeId: typeId,
            roomNumber: curNum,
            roomName: ''
          });
        }
      }
    }
    return sortRoomsByRoomNumberAsc(available);
  }, [bookings, roomTypeMaster, roomTypeRooms, selectedAssignBooking]);

  useEffect(() => {
    if (!walkInOpen) return;
    setWalkInForm(getDefaultWalkInForm());
  }, [walkInOpen]);

  useEffect(() => {
    if (assignRoomOpen) return;
    setAssignBookingId('');
    setAssignNewRoom(null);
  }, [assignRoomOpen]);

  useEffect(() => {
    if (!assignRoomOpen || assignBookingId === '') return;
    const b = bookings.find((x) => x.id === assignBookingId);
    if (!b) return;
    const rid = Number(b.room_id);
    const rnum = String(b.room_number || '').trim();
    let row = roomTypeRooms.find((r) => r.id === rid);
    if (!row) row = roomTypeRooms.find((r) => r.roomNumber === rnum);
    if (row) {
      setAssignNewRoom(row);
    } else {
      const tid = roomTypeMaster.find((m) => m.name === b.room_type)?.id;
      setAssignNewRoom({
        id: rid,
        roomTypeId: Number.isFinite(tid as number) ? (tid as number) : 0,
        roomNumber: rnum,
        roomName: ''
      });
    }
  }, [assignRoomOpen, assignBookingId, bookings, roomTypeRooms, roomTypeMaster]);

  useEffect(() => {
    if (!walkInOpen && !assignRoomOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const [rtRes, rrRes] = await Promise.all([
          roomTypeService.getRoomTypes({ status: 'active' }),
          roomTypeRoomService.getRoomTypeRooms()
        ]);
        if (cancelled) return;
        if (rtRes.success) {
          const mapped = (rtRes.data || [])
            .map((item: any) => {
              const rawRate = item?.nightly_rate ?? item?.nightlyRate;
              const parsedRate =
                rawRate === null || rawRate === undefined || rawRate === ''
                  ? undefined
                  : Number(rawRate);
              return {
                id: Number(item?.id),
                name: String(item?.name || '').trim(),
                nightlyRate: Number.isNaN(parsedRate) ? undefined : parsedRate
              };
            })
            .filter((item: RoomTypeMaster) => Number.isFinite(item.id) && !!item.name);
          const unique = new Map<string, RoomTypeMaster>();
          mapped.forEach((item: RoomTypeMaster) => {
            if (!unique.has(item.name)) {
              unique.set(item.name, item);
            }
          });
          setRoomTypeMaster(Array.from(unique.values()));
        }
        if (rrRes.success) {
          const mapped = (rrRes.data || [])
            .map((item: any) => ({
              id: Number(item?.id),
              roomTypeId: Number(item?.room_type_id),
              roomNumber: String(item?.room_number || '').trim(),
              roomName: item?.room_name ? String(item.room_name).trim() : ''
            }))
            .filter(
              (item: RoomTypeRoomRow) => Number.isFinite(item.id) && Number.isFinite(item.roomTypeId) && !!item.roomNumber
            );
          setRoomTypeRooms(mapped);
        }
      } catch {
      /* ignore */
    }
    })();
    return () => {
      cancelled = true;
    };
  }, [walkInOpen, assignRoomOpen]);

  useEffect(() => {
    if (!walkInOpen) return;
    if (!walkInForm.roomType) return;
    if (walkInForm.nightlyRate) return;
    const matched = roomTypeMaster.find((item) => item.name === walkInForm.roomType);
    if (!matched || typeof matched.nightlyRate !== 'number' || !Number.isFinite(matched.nightlyRate)) {
      return;
    }
    setWalkInForm((prev) => ({
      ...prev,
      nightlyRate: String(matched.nightlyRate)
    }));
  }, [walkInForm.roomType, walkInForm.nightlyRate, roomTypeMaster, walkInOpen]);

  useEffect(() => {
    if (!walkInForm.roomNumber) return;
    if (!walkInForm.checkInDate || !walkInForm.checkOutDate) return;
    if (roomTypeRooms.length === 0) return;
    const exists = availableWalkInRooms.some((room) => room.roomNumber === walkInForm.roomNumber);
    if (!exists) {
      setWalkInForm((prev) => ({ ...prev, roomNumber: '', roomDbId: '' }));
    }
  }, [availableWalkInRooms, walkInForm.roomNumber, walkInForm.checkInDate, walkInForm.checkOutDate, roomTypeRooms.length]);

  const normalizeBookingStatus = (status: unknown) => String(status ?? '').trim().toLowerCase();

  const canCheckIn = (status: string) => {
    const s = normalizeBookingStatus(status);
    return s === 'pending' || s === 'confirmed';
  };

  const canMarkNoShow = (status: string) => {
    const s = normalizeBookingStatus(status);
    return s === 'pending' || s === 'confirmed';
  };

  const canCancelBooking = (status: string) => {
    const s = normalizeBookingStatus(status);
    return s === 'pending' || s === 'confirmed';
  };

  const canAssignRoom = (status: string) =>
    ['pending', 'confirmed', 'checked_in'].includes(normalizeBookingStatus(status));

  const canCheckout = (status: string) => normalizeBookingStatus(status) === 'checked_in';

  const closeRowActionMenu = () => setRowActionMenu(null);

  const openRowActionMenu = (event: React.MouseEvent, booking: any) => {
    event.preventDefault();
    event.stopPropagation();
    setRowActionMenu({
      mouseX: event.clientX + 2,
      mouseY: event.clientY - 6,
      booking,
    });
  };

  /** 빠른 작업: 예약 선택 다이얼로그 — 대상 없으면 안내만 */
  const openQuickActionDialog = (mode: 'checkin' | 'checkout' | 'no_show' | 'cancel') => {
    const list =
      mode === 'checkin'
        ? availableForCheckin
        : mode === 'no_show'
          ? availableForNoShow
          : mode === 'cancel'
            ? availableForCancel
            : availableForCheckout;
    if (list.length === 0) {
      setSnackbar({
        open: true,
        message: t('frontDesk.messages.noEligibleBookings'),
        severity: 'warning'
      });
      return;
    }
    setSelectedBookingId('');
    setDialog({ open: true, mode });
  };

  const openAssignRoomDialog = (preselectBookingId?: number) => {
    if (eligibleForAssignRoom.length === 0) {
      setSnackbar({
        open: true,
        message: t('frontDesk.assignRoom.noEligible'),
        severity: 'warning'
      });
      return;
    }
    setAssignNewRoom(null);
    setAssignBookingId(
      preselectBookingId != null &&
        eligibleForAssignRoom.some((b) => b.id === preselectBookingId)
        ? preselectBookingId
        : ''
    );
    setAssignRoomOpen(true);
  };

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await roomBookingService.getRoomBookings({});
      if (response.success) {
        setBookings(response.data || []);
      } else {
        setBookings([]);
      }
    } catch {
      setSnackbar({ open: true, message: t('frontDesk.errors.loadBookingsFailed'), severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const updateStatus = async (id: number, status: 'checked_in' | 'checked_out' | 'no_show') => {
    try {
      setLoading(true);
      const response = await roomBookingService.updateRoomBooking(id, { status });
      if (response.success) {
        const msg =
          status === 'checked_in'
            ? t('frontDesk.messages.checkinDone')
            : status === 'checked_out'
              ? t('frontDesk.messages.checkoutDone')
              : t('frontDesk.messages.noShowDone');
        setSnackbar({
          open: true,
          message: msg,
          severity: 'success'
        });
        await loadBookings();
      } else {
        setSnackbar({ open: true, message: response.message || t('frontDesk.errors.processFailed'), severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: t('frontDesk.errors.processFailed'), severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const openNoShowConfirm = (bookingId: number) => {
    setNoShowTargetId(bookingId);
    setNoShowConfirmOpen(true);
  };

  const closeNoShowConfirm = () => {
    setNoShowConfirmOpen(false);
    setNoShowTargetId(null);
  };

  const submitNoShowConfirm = () => {
    if (noShowTargetId == null) return;
    void updateStatus(noShowTargetId, 'no_show');
    closeNoShowConfirm();
  };

  const openCancelConfirm = (bookingId: number) => {
    setCancelTargetId(bookingId);
    setCancelConfirmOpen(true);
  };

  const closeCancelConfirm = () => {
    setCancelConfirmOpen(false);
    setCancelTargetId(null);
  };

  const submitCancelConfirm = async () => {
    if (cancelTargetId == null) return;
    try {
      setLoading(true);
      const res = await roomBookingService.cancelRoomBooking(cancelTargetId);
      if (res.success) {
        setSnackbar({ open: true, message: t('frontDesk.messages.cancelDone'), severity: 'success' });
        await loadBookings();
      } else {
        setSnackbar({
          open: true,
          message: res.message || t('frontDesk.errors.cancelFailed'),
          severity: 'error'
        });
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || t('frontDesk.errors.cancelFailed'),
        severity: 'error'
      });
    } finally {
      setLoading(false);
      closeCancelConfirm();
    }
  };

  const submitWalkIn = async () => {
    const trimmedType = walkInForm.roomType.trim();
    if (!walkInForm.guestName.trim()) {
      setSnackbar({ open: true, message: t('frontDesk.walkIn.errors.required'), severity: 'warning' });
      return;
    }
    if (!trimmedType) {
      setSnackbar({ open: true, message: t('frontDesk.walkIn.errors.roomType'), severity: 'warning' });
      return;
    }
    if (!walkInRoomTypeOptions.includes(trimmedType)) {
      setSnackbar({ open: true, message: t('frontDesk.walkIn.errors.roomType'), severity: 'warning' });
      return;
    }
    if (!walkInForm.roomNumber.trim() || typeof walkInForm.roomDbId !== 'number' || !Number.isFinite(walkInForm.roomDbId)) {
      setSnackbar({ open: true, message: t('frontDesk.walkIn.errors.room'), severity: 'warning' });
      return;
    }
    if (walkInForm.checkOutDate <= walkInForm.checkInDate) {
      setSnackbar({ open: true, message: t('frontDesk.walkIn.errors.dates'), severity: 'warning' });
      return;
    }
    if (!canManagePastCheckIn && walkInForm.checkInDate < today) {
      setSnackbar({ open: true, message: t('frontDesk.walkIn.errors.pastCheckin'), severity: 'warning' });
      return;
    }
    const normalizedNightly = parseCurrencyInput(walkInForm.nightlyRate);
    const nightlyNum = Number(normalizedNightly);
    const computedTotal =
      normalizedNightly && !Number.isNaN(nightlyNum)
        ? nightlyNum * calculateTotalNights(walkInForm.checkInDate, walkInForm.checkOutDate)
        : 0;
    if (!computedTotal || computedTotal <= 0) {
      setSnackbar({ open: true, message: t('frontDesk.walkIn.errors.amount'), severity: 'warning' });
      return;
    }

    const special =
      [walkInForm.specialRequests.trim() ? walkInForm.specialRequests.trim() : null, 'Walk-in']
        .filter(Boolean)
        .join(' · ') || 'Walk-in';

    try {
      setWalkInSaving(true);
      const createRes = await roomBookingService.createRoomBooking({
        booking_id: generateWalkInBookingId(),
        room_id: walkInForm.roomDbId,
        room_number: walkInForm.roomNumber.trim(),
        room_type: trimmedType,
        guest_name: walkInForm.guestName.trim(),
        guest_email: walkInForm.guestEmail.trim() || null,
        guest_phone: walkInForm.guestPhone.trim() || null,
        check_in_date: walkInForm.checkInDate,
        check_in_time: walkInForm.checkInTime || null,
        check_out_date: walkInForm.checkOutDate,
        check_out_time: walkInForm.checkOutTime || null,
        number_of_guests: Number(walkInForm.numberOfGuests) || 1,
        total_amount: Math.round(computedTotal),
        special_requests: special
      });
      if (!createRes.success) {
        setSnackbar({
          open: true,
          message: createRes.message || t('frontDesk.walkIn.errors.createFailed'),
          severity: 'error'
        });
        return;
      }
      const newId = createRes.data?.id;
      if (newId) {
        const upd = await roomBookingService.updateRoomBooking(newId, { status: 'checked_in' });
        if (!upd.success) {
          setSnackbar({
            open: true,
            message: t('frontDesk.walkIn.errors.checkinFailed'),
            severity: 'warning'
          });
          await loadBookings();
          setWalkInOpen(false);
          return;
        }
      }
      setSnackbar({ open: true, message: t('frontDesk.walkIn.success'), severity: 'success' });
      setWalkInOpen(false);
      await loadBookings();
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || t('frontDesk.walkIn.errors.createFailed'),
        severity: 'error'
      });
    } finally {
      setWalkInSaving(false);
    }
  };

  const submitAssignRoom = async () => {
    if (!selectedAssignBooking || !assignNewRoom) {
      if (!selectedAssignBooking) {
        setSnackbar({ open: true, message: t('frontDesk.assignRoom.errors.selectBooking'), severity: 'warning' });
      } else {
        setSnackbar({ open: true, message: t('frontDesk.assignRoom.errors.selectRoom'), severity: 'warning' });
      }
      return;
    }
    const same =
      Number(selectedAssignBooking.room_id) === assignNewRoom.id &&
      String(selectedAssignBooking.room_number || '').trim() === assignNewRoom.roomNumber.trim();
    if (same) {
      setSnackbar({ open: true, message: t('frontDesk.assignRoom.sameRoom'), severity: 'info' });
      return;
    }
    try {
      setAssignSaving(true);
      const res = await roomBookingService.updateRoomBooking(selectedAssignBooking.id, {
        room_id: assignNewRoom.id,
        room_number: assignNewRoom.roomNumber.trim(),
        room_type: String(selectedAssignBooking.room_type || '').trim()
      });
      if (!res.success) {
        setSnackbar({
          open: true,
          message: res.message || t('frontDesk.assignRoom.errors.failed'),
          severity: 'error'
        });
        return;
      }
      setSnackbar({ open: true, message: t('frontDesk.assignRoom.success'), severity: 'success' });
      setAssignRoomOpen(false);
      await loadBookings();
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error?.response?.data?.message || t('frontDesk.assignRoom.errors.failed'),
        severity: 'error'
      });
    } finally {
      setAssignSaving(false);
    }
  };

  const handleQuickAction = () => {
    if (!dialog.mode || !selectedBookingId) return;
    if (dialog.mode === 'checkin') {
      void updateStatus(Number(selectedBookingId), 'checked_in');
      setDialog({ open: false, mode: null });
      setSelectedBookingId('');
      return;
    }
    if (dialog.mode === 'no_show') {
      const id = Number(selectedBookingId);
      setDialog({ open: false, mode: null });
      setSelectedBookingId('');
      openNoShowConfirm(id);
      return;
    }
    if (dialog.mode === 'cancel') {
      const id = Number(selectedBookingId);
      setDialog({ open: false, mode: null });
      setSelectedBookingId('');
      openCancelConfirm(id);
      return;
    }
    const b = bookings.find((x) => x.id === Number(selectedBookingId));
    setDialog({ open: false, mode: null });
    setSelectedBookingId('');
    if (b) {
      setCheckoutBooking(b);
      setPaymentMethod('card');
      setInvoiceOpen(true);
    }
  };

  /** 총액을 GST 18% 포함가로 보고 과세표준·세액 분해 (표시용) */
  const gstBreakdown = (totalIncl: number) => {
    const total = Math.max(0, Number(totalIncl) || 0);
    if (total === 0) return { taxable: 0, gst: 0, total };
    const taxable = Math.round((total / 1.18) * 100) / 100;
    const gst = Math.round((total - taxable) * 100) / 100;
    return { taxable, gst, total };
  };

  const confirmCheckoutWithPayment = async () => {
    if (!checkoutBooking?.id) return;
    setLoading(true);
    try {
      const response = await roomBookingService.updateRoomBooking(checkoutBooking.id, {
        status: 'checked_out',
        payment_status: 'paid',
        payment_method: paymentMethod
      });
      if (response.success) {
        setSnackbar({
          open: true,
          message: t('frontDesk.messages.checkoutDone'),
          severity: 'success'
        });
        setInvoiceOpen(false);
        setCheckoutBooking(null);
        await loadBookings();
      } else {
        setSnackbar({
          open: true,
          message: response.message || t('frontDesk.errors.processFailed'),
          severity: 'error'
        });
      }
    } catch (error) {
      setSnackbar({ open: true, message: t('frontDesk.errors.processFailed'), severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const noShowTargetBooking =
    noShowTargetId != null ? bookings.find((b) => b.id === noShowTargetId) : null;

  const cancelTargetBooking =
    cancelTargetId != null ? bookings.find((b) => b.id === cancelTargetId) : null;

  const statusColor = (status: string) => {
    switch (status) {
      case 'checked_in': return 'success';
      case 'checked_out': return 'default';
      case 'confirmed': return 'info';
      case 'pending': return 'warning';
      case 'cancelled': return 'error';
      case 'no_show': return 'warning';
      default: return 'default';
    }
  };

  const quickActionBtnSx = {
    ...mvsBodyOutlinedBtnSx,
    flex: { sm: '1 1 140px' },
    minWidth: { sm: 120 },
    minHeight: 42,
    py: 1,
    lineHeight: 1.25,
  };

  const listStateBoxSx = {
    ...mvsBodyListTableSx,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    py: 6,
    px: 2,
  } as const;

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('frontDesk.title')}
        description={t('frontDesk.description')}
      />

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Box sx={mvsBodySectionHeaderSx}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            {t('frontDesk.quickActionsTitle')}
          </Typography>
        </Box>
        <Box sx={mvsBodyFilterWrapSx}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              flexWrap: 'wrap',
              gap: 1.25,
              alignItems: 'stretch',
              width: '100%',
            }}
          >
            <Button variant="outlined" onClick={() => setWalkInOpen(true)} sx={quickActionBtnSx}>
              {t('frontDesk.actions.newCheckin')}
            </Button>
            <Button variant="outlined" onClick={() => openQuickActionDialog('checkin')} sx={quickActionBtnSx}>
              {t('frontDesk.walkIn.openExistingCheckin')}
            </Button>
            <Button variant="outlined" onClick={() => openQuickActionDialog('checkout')} sx={quickActionBtnSx}>
              {t('frontDesk.actions.processCheckout')}
            </Button>
            <Button
              variant="outlined"
              color="warning"
              onClick={() => openQuickActionDialog('no_show')}
              sx={quickActionBtnSx}
            >
              {t('frontDesk.actions.processNoShow')}
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => openQuickActionDialog('cancel')}
              sx={quickActionBtnSx}
            >
              {t('frontDesk.actions.cancelBooking')}
            </Button>
            <Button variant="outlined" onClick={() => openAssignRoomDialog()} sx={quickActionBtnSx}>
              {t('frontDesk.actions.assignRoom')}
            </Button>
          </Box>
        </Box>
      </Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2.5, mb: 3 }}>
        {summaryCards.map((item) => (
          <Card key={item.label} elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                {item.label}
              </Typography>
              <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}>
                {item.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 0 }}>
        <Box sx={mvsBodySectionHeaderSx}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
            {t('frontDesk.bookingListTitle')}
          </Typography>
        </Box>
        <Box sx={mvsBodyFilterWrapSx}>
          <TextField
            size="small"
            label={t('frontDesk.searchLabel', { defaultValue: '검색' })}
            placeholder={t('frontDesk.searchPlaceholder')}
            value={bookingListSearch}
            onChange={(e) => {
              setBookingListSearch(e.target.value);
              setBookingPage(1);
            }}
            fullWidth
            sx={frontDeskSearchFieldSx}
            {...mvsOutlinedLabelProps}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Card>

      <Box sx={mvsBodyListZoneSx}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            mb: 1.25,
          }}
        >
          <Button
            size="small"
            variant={showAllBookings ? 'contained' : 'outlined'}
            onClick={() => setShowAllBookings(true)}
            sx={{ minWidth: 76, boxShadow: 'none' }}
          >
            {t('frontDesk.viewAll')}
          </Button>
          <Button
            size="small"
            variant={!showAllBookings ? 'contained' : 'outlined'}
            onClick={() => {
              setShowAllBookings(false);
              setBookingPage(1);
            }}
            sx={{ minWidth: 96, boxShadow: 'none' }}
          >
            {t('frontDesk.viewByPage')}
          </Button>
        </Box>
        {bookings.length === 0 || filteredBookings.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <Typography variant="body2" color="text.secondary">
              {bookings.length === 0
                ? t('frontDesk.empty.noData')
                : t('frontDesk.searchNoResults')}
            </Typography>
          </Box>
        ) : (
          <TableContainer
            sx={{
              ...mvsBodyListTableSx,
              ...mvsTableScrollSx,
            }}
          >
            <Table size="small" sx={frontDeskTableSx}>
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  {[
                    { key: null, label: t('frontDesk.columns.sequence'), width: 48, align: 'center' as const },
                    { key: 'bookingNo' as const, label: t('frontDesk.columns.bookingNo'), width: 130, ellipsis: true },
                    { key: 'guestName' as const, label: t('frontDesk.columns.guestName'), width: 120, ellipsis: true },
                    { key: 'checkIn' as const, label: t('frontDesk.columns.checkin'), width: 100 },
                    { key: 'checkOut' as const, label: t('frontDesk.columns.checkout'), width: 100 },
                    { key: 'status' as const, label: t('frontDesk.columns.status'), width: 110 },
                    { key: null, label: t('frontDesk.columns.actions'), width: '1%', align: 'right' as const },
                  ].map((col) => (
                    <TableCell
                      key={col.label}
                      align={col.align || 'left'}
                      width={col.width}
                      sortDirection={col.key && bookingSortBy === col.key ? bookingSortDir : false}
                      sx={{
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle',
                        ...(col.ellipsis ? frontDeskCellEllipsisSx : {}),
                      }}
                    >
                      {col.key ? (
                        <TableSortLabel
                          active={bookingSortBy === col.key}
                          direction={bookingSortBy === col.key ? bookingSortDir : 'asc'}
                          onClick={() => handleBookingSort(col.key!)}
                          sx={{
                            color: 'inherit',
                            '& .MuiTableSortLabel-icon': { color: 'inherit' },
                          }}
                        >
                          {col.label}
                        </TableSortLabel>
                      ) : (
                        col.label
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody sx={mvsTableBodyRowSx}>
                {visibleBookings.map((booking, rowIndex) => (
                  <TableRow
                    key={booking.id}
                    hover
                    onClick={(e) => openRowActionMenu(e, booking)}
                    sx={{
                      cursor: 'pointer',
                      ...(rowActionMenu?.booking?.id === booking.id
                        ? { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) }
                        : {}),
                    }}
                  >
                    <TableCell
                      align="center"
                      sx={{ ...frontDeskCellBaseSx, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {(showAllBookings ? 0 : (bookingPage - 1) * bookingsPerPage) + rowIndex + 1}
                    </TableCell>
                    <TableCell
                      sx={{ ...frontDeskCellBaseSx, ...frontDeskCellEllipsisSx, width: 130, maxWidth: 130 }}
                    >
                      {renderEllipsisText(String(booking.booking_id || booking.id), 600)}
                    </TableCell>
                    <TableCell
                      sx={{ ...frontDeskCellBaseSx, ...frontDeskCellEllipsisSx, width: 120, maxWidth: 120 }}
                    >
                      {renderEllipsisText(getBookingGuestSearchable(booking) || '-')}
                    </TableCell>
                    <TableCell sx={{ ...frontDeskCellBaseSx, whiteSpace: 'nowrap' }}>
                      {formatDate(booking.check_in_date, i18n.language === 'en' ? 'en-US' : 'ko-KR')}
                    </TableCell>
                    <TableCell sx={{ ...frontDeskCellBaseSx, whiteSpace: 'nowrap' }}>
                      {formatDate(booking.check_out_date, i18n.language === 'en' ? 'en-US' : 'ko-KR')}
                    </TableCell>
                    <TableCell sx={frontDeskCellBaseSx}>
                      <Chip
                        label={statusLabel(booking.status)}
                        size="small"
                        variant="outlined"
                        color={statusColor(booking.status)}
                        sx={{
                          ...chipSx,
                          maxWidth: '100%',
                          '& .MuiChip-label': {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        ...frontDeskCellBaseSx,
                        whiteSpace: 'nowrap',
                        width: 56,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconButton
                        size="small"
                        aria-label={t('frontDesk.columns.actions')}
                        onClick={(e) => openRowActionMenu(e, booking)}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': { color: 'primary.main', bgcolor: alpha('#1D4E7C', 0.08) },
                        }}
                      >
                        <MoreHorizIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {!showAllBookings && filteredBookings.length > 0 && (
          <Box sx={mvsBodyPaginationSx}>
            <Pagination
              count={Math.ceil(filteredBookings.length / bookingsPerPage)}
              page={bookingPage}
              onChange={(_, value) => setBookingPage(value)}
              color="primary"
            />
          </Box>
        )}
      </Box>

      <Dialog
        open={walkInOpen}
        onClose={() => {
          if (!walkInSaving) setWalkInOpen(false);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>{t('frontDesk.walkIn.title')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('frontDesk.walkIn.subtitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            {t('frontDesk.walkIn.hintExisting')}
          </Typography>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t('frontDesk.walkIn.guestName')}
                  value={walkInForm.guestName}
                  onChange={(e) => setWalkInForm((p) => ({ ...p, guestName: e.target.value }))}
                  fullWidth
                  required
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t('frontDesk.walkIn.guestPhone')}
                  value={walkInForm.guestPhone}
                  onChange={(e) => setWalkInForm((p) => ({ ...p, guestPhone: e.target.value }))}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }} sx={{ alignSelf: 'flex-start' }}>
                <TextField
                  label={t('frontDesk.walkIn.guestEmail')}
                  value={walkInForm.guestEmail}
                  onChange={(e) => setWalkInForm((p) => ({ ...p, guestEmail: e.target.value }))}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }} sx={{ alignSelf: 'flex-start' }}>
                <FormControl fullWidth size="small" variant="outlined">
                  <InputLabel id="walkin-room-type-label" shrink>
                    {t('frontDesk.walkIn.roomType')}
                  </InputLabel>
                  <Select
                    labelId="walkin-room-type-label"
                    displayEmpty
                    label={t('frontDesk.walkIn.roomType')}
                    value={walkInForm.roomType}
                    onChange={(e) =>
                      setWalkInForm((p) => ({
                        ...p,
                        roomType: String(e.target.value),
                        roomNumber: '',
                        roomDbId: ''
                      }))
                    }
                  >
                    <MenuItem value="">
                      <em>{t('common.selectPlaceholder')}</em>
                    </MenuItem>
                    {walkInRoomTypeOptions.map((name) => (
                      <MenuItem key={name} value={name}>
                        {name}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText sx={{ mx: 0 }}>
                    {t('frontDesk.walkIn.roomTypeHint')}
                  </FormHelperText>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  type="date"
                  label={t('frontDesk.walkIn.checkIn')}
                  value={walkInForm.checkInDate}
                  onChange={(e) => {
                    const nextIn = e.target.value;
                    setWalkInForm((p) => ({
                      ...p,
                      checkInDate: nextIn,
                      checkOutDate: nextIn ? addOneDayIso(nextIn) : p.checkOutDate,
                      roomNumber: '',
                      roomDbId: ''
                    }));
                  }}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ min: canManagePastCheckIn ? undefined : today }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  type="date"
                  label={t('frontDesk.walkIn.checkOut')}
                  value={walkInForm.checkOutDate}
                  onChange={(e) => {
                    const nextOut = e.target.value;
                    setWalkInForm((p) => ({
                      ...p,
                      checkOutDate: nextOut,
                      roomNumber: '',
                      roomDbId: ''
                    }));
                  }}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{
                    min: walkInForm.checkInDate
                      ? addOneDayIso(walkInForm.checkInDate)
                      : canManagePastCheckIn
                        ? undefined
                        : today
                  }}
                  helperText={t('frontDesk.walkIn.checkOutAutoHint')}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  type="time"
                  label={t('frontDesk.walkIn.checkInTime')}
                  value={walkInForm.checkInTime}
                  onChange={(e) => setWalkInForm((p) => ({ ...p, checkInTime: e.target.value }))}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  type="time"
                  label={t('frontDesk.walkIn.checkOutTime')}
                  value={walkInForm.checkOutTime}
                  onChange={(e) => setWalkInForm((p) => ({ ...p, checkOutTime: e.target.value }))}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  type="number"
                  label={t('frontDesk.walkIn.guests')}
                  value={walkInForm.numberOfGuests}
                  onChange={(e) =>
                    setWalkInForm((p) => ({ ...p, numberOfGuests: Math.max(1, Number(e.target.value) || 1) }))
                  }
                  fullWidth
                  size="small"
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label={t('frontDesk.walkIn.nightlyRate')}
                  value={walkInForm.nightlyRate}
                  onChange={(e) => setWalkInForm((p) => ({ ...p, nightlyRate: e.target.value }))}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('frontDesk.walkIn.totalHint')}: {walkInEstimatedTotal.toLocaleString()}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Autocomplete
                  options={availableWalkInRooms}
                  value={availableWalkInRooms.find((r) => r.roomNumber === walkInForm.roomNumber) ?? null}
                  isOptionEqualToValue={(a, b) => a.roomNumber === b.roomNumber}
                  getOptionLabel={(o) => (o.roomName ? `${o.roomNumber} (${o.roomName})` : o.roomNumber)}
                  onChange={(_, v) =>
                    setWalkInForm((p) => ({
                      ...p,
                      roomNumber: v ? v.roomNumber : '',
                      roomDbId: v ? v.id : ''
                    }))
                  }
                  disabled={
                    !walkInForm.roomType || !walkInForm.checkInDate || !walkInForm.checkOutDate
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('frontDesk.walkIn.roomNumber')}
                      required
                      size="small"
                      helperText={
                        walkInForm.roomType &&
                        walkInForm.checkInDate &&
                        walkInForm.checkOutDate &&
                        availableWalkInRooms.length === 0
                          ? t('roomBookingManagement.help.noAvailableRoom')
                          : ''
                      }
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label={t('frontDesk.walkIn.specialRequests')}
                  value={walkInForm.specialRequests}
                  onChange={(e) => setWalkInForm((p) => ({ ...p, specialRequests: e.target.value }))}
                  fullWidth
                  size="small"
                  multiline
                  minRows={2}
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setWalkInOpen(false)} disabled={walkInSaving}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={() => void submitWalkIn()} disabled={walkInSaving || loading}>
            {t('frontDesk.walkIn.submit')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={assignRoomOpen}
        onClose={() => {
          if (!assignSaving) setAssignRoomOpen(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>{t('frontDesk.assignRoom.title')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('frontDesk.assignRoom.subtitle')}
          </Typography>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>{t('frontDesk.assignRoom.selectBooking')}</InputLabel>
              <Select
                label={t('frontDesk.assignRoom.selectBooking')}
                value={assignBookingId === '' ? '' : assignBookingId}
                onChange={(e) => {
                  const v = e.target.value;
                  const s = String(v);
                  setAssignBookingId(s === '' ? '' : Number(s));
                }}
              >
                <MenuItem value="">
                  <em>{t('common.selectPlaceholder')}</em>
                </MenuItem>
                {eligibleForAssignRoom.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.booking_id || b.id} · {b.guest_name || b.user?.username || '—'} · {b.room_type}{' '}
                    {b.room_number}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedAssignBooking ? (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {t('frontDesk.assignRoom.guest')}
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {selectedAssignBooking.guest_name || selectedAssignBooking.user?.username || '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  {t('frontDesk.assignRoom.currentRoom')}
                </Typography>
                <Typography variant="body2">
                  {selectedAssignBooking.room_type} · {selectedAssignBooking.room_number}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  {t('frontDesk.assignRoom.stayPeriod')}
                </Typography>
                <Typography variant="body2">
                  {formatDate(selectedAssignBooking.check_in_date, i18n.language === 'en' ? 'en-US' : 'ko-KR')} –{' '}
                  {formatDate(selectedAssignBooking.check_out_date, i18n.language === 'en' ? 'en-US' : 'ko-KR')}
                </Typography>
              </Box>
            ) : null}
            <Autocomplete
              options={availableAssignRooms}
              value={
                assignNewRoom
                  ? availableAssignRooms.find(
                      (r) => r.id === assignNewRoom.id && r.roomNumber === assignNewRoom.roomNumber
                    ) ?? null
                  : null
              }
              onChange={(_, v) => setAssignNewRoom(v)}
              disabled={!selectedAssignBooking}
              isOptionEqualToValue={(a, b) => a.roomNumber === b.roomNumber && a.id === b.id}
              getOptionLabel={(o) => (o.roomName ? `${o.roomNumber} (${o.roomName})` : o.roomNumber)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('frontDesk.assignRoom.newRoom')}
                  required
                  size="small"
                  helperText={
                    selectedAssignBooking &&
                    availableAssignRooms.length === 0 &&
                    roomTypeRooms.length > 0
                      ? t('roomBookingManagement.help.noAvailableRoom')
                      : ''
                  }
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAssignRoomOpen(false)} disabled={assignSaving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => void submitAssignRoom()}
            disabled={assignSaving || loading || !selectedAssignBooking || !assignNewRoom}
          >
            {t('frontDesk.assignRoom.submit')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={invoiceOpen}
        onClose={() => {
          if (!loading) {
            setInvoiceOpen(false);
            setCheckoutBooking(null);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('frontDesk.invoice.title')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('frontDesk.invoice.subtitle')}
          </Typography>
          {checkoutBooking && (() => {
            const { taxable, gst, total } = gstBreakdown(checkoutBooking.total_amount);
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">{t('frontDesk.invoice.bookingRef')}</Typography>
                  <Typography variant="body2" fontWeight={600}>{checkoutBooking.booking_id || checkoutBooking.id}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">{t('frontDesk.invoice.guest')}</Typography>
                  <Typography variant="body2">{checkoutBooking.guest_name || checkoutBooking.user?.username || '—'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">{t('frontDesk.invoice.room')}</Typography>
                  <Typography variant="body2">
                    {checkoutBooking.room_number} · {checkoutBooking.room_type} · {checkoutBooking.total_nights}{' '}
                    {t('frontDesk.invoice.nights')}
                  </Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">{t('frontDesk.invoice.lineAccommodation')}</Typography>
                  <Typography variant="body2">
                    {t('frontDesk.invoice.currency')} {taxable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">{t('frontDesk.invoice.gstLabel')}</Typography>
                  <Typography variant="body2">
                    {t('frontDesk.invoice.currency')} {gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle1" fontWeight={700}>{t('frontDesk.invoice.grandTotal')}</Typography>
                  <Typography variant="h6" fontWeight={700} color="primary">
                    {t('frontDesk.invoice.currency')} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <FormControl fullWidth sx={{ mt: 1 }}>
                  <InputLabel>{t('frontDesk.invoice.paymentMethod')}</InputLabel>
                  <Select
                    label={t('frontDesk.invoice.paymentMethod')}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <MenuItem value="cash">{t('frontDesk.invoice.cash')}</MenuItem>
                    <MenuItem value="card">{t('frontDesk.invoice.card')}</MenuItem>
                    <MenuItem value="upi">{t('frontDesk.invoice.upi')}</MenuItem>
                    <MenuItem value="bank_transfer">{t('frontDesk.invoice.bank')}</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setInvoiceOpen(false);
              setCheckoutBooking(null);
            }}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={confirmCheckoutWithPayment} disabled={loading || !checkoutBooking}>
            {t('frontDesk.invoice.confirmPay')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={noShowConfirmOpen}
        onClose={closeNoShowConfirm}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: 'hidden'
          }
        }}
        slotProps={{
          backdrop: {
            sx: { backgroundColor: 'rgba(15, 23, 42, 0.45)' }
          }
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            fontSize: '1.0625rem',
            pb: 1,
            borderBottom: '2px solid',
            borderColor: 'primary.main',
            bgcolor: 'background.paper'
          }}
        >
          {t('frontDesk.dialog.noShowTitle')}
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography variant="body1" color="text.primary" sx={{ lineHeight: 1.6 }}>
            {t('frontDesk.confirmNoShow')}
          </Typography>
          {noShowTargetBooking ? (
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block">
                {t('frontDesk.columns.bookingNo')} · {t('frontDesk.columns.guestName')}
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>
                {noShowTargetBooking.booking_id || noShowTargetBooking.id} ·{' '}
                {noShowTargetBooking.guest_name || noShowTargetBooking.user?.username || '—'}
              </Typography>
            </Box>
          ) : null}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {t('frontDesk.dialog.noShowHint')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 0, gap: 1 }}>
          <Button variant="outlined" onClick={closeNoShowConfirm} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" color="warning" onClick={submitNoShowConfirm} disabled={loading}>
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={cancelConfirmOpen}
        onClose={closeCancelConfirm}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: 'hidden'
          }
        }}
        slotProps={{
          backdrop: {
            sx: { backgroundColor: 'rgba(15, 23, 42, 0.45)' }
          }
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            fontSize: '1.0625rem',
            pb: 1,
            borderBottom: '2px solid',
            borderColor: 'error.main',
            bgcolor: 'background.paper'
          }}
        >
          {t('frontDesk.dialog.cancelTitle')}
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Typography variant="body1" color="text.primary" sx={{ lineHeight: 1.6 }}>
            {t('frontDesk.dialog.confirmCancel')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {t('frontDesk.dialog.cancelHint')}
          </Typography>
          {cancelTargetBooking ? (
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block">
                {t('frontDesk.columns.bookingNo')} · {t('frontDesk.columns.guestName')}
              </Typography>
              <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>
                {cancelTargetBooking.booking_id || cancelTargetBooking.id} ·{' '}
                {cancelTargetBooking.guest_name || cancelTargetBooking.user?.username || '—'}
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, pt: 0, gap: 1 }}>
          <Button variant="outlined" onClick={closeCancelConfirm} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" color="error" onClick={() => void submitCancelConfirm()} disabled={loading}>
            {t('frontDesk.actions.cancelBooking')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dialog.open}
        onClose={() => {
          setDialog({ open: false, mode: null });
          setSelectedBookingId('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialog.mode === 'checkin'
            ? t('frontDesk.dialog.checkinTitle')
            : dialog.mode === 'no_show'
              ? t('frontDesk.dialog.noShowTitle')
              : dialog.mode === 'cancel'
                ? t('frontDesk.dialog.cancelTitle')
                : t('frontDesk.dialog.checkoutTitle')}
        </DialogTitle>
        <DialogContent>
          {dialog.mode === 'no_show' ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
              {t('frontDesk.dialog.noShowHint')}
            </Typography>
          ) : null}
          {dialog.mode === 'cancel' ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
              {t('frontDesk.dialog.cancelHint')}
            </Typography>
          ) : null}
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>{t('frontDesk.dialog.selectBooking')}</InputLabel>
            <Select
              label={t('frontDesk.dialog.selectBooking')}
              value={selectedBookingId}
              onChange={(e) => setSelectedBookingId(e.target.value as number)}
            >
              {(dialog.mode === 'checkin'
                ? availableForCheckin
                : dialog.mode === 'no_show'
                  ? availableForNoShow
                  : dialog.mode === 'cancel'
                    ? availableForCancel
                    : availableForCheckout
              ).map((booking) => (
                <MenuItem key={booking.id} value={booking.id}>
                  {booking.booking_id || booking.id} - {booking.guest_name || booking.user?.username || '-'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDialog({ open: false, mode: null });
              setSelectedBookingId('');
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleQuickAction}
            disabled={!selectedBookingId || loading}
          >
            {t('frontDesk.actions.process')}
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        open={rowActionMenu !== null}
        onClose={closeRowActionMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          rowActionMenu !== null
            ? { top: rowActionMenu.mouseY, left: rowActionMenu.mouseX }
            : undefined
        }
        slotProps={{
          paper: {
            sx: {
              minWidth: 180,
              borderRadius: 2,
              boxShadow: '0 8px 24px rgba(45, 70, 95, 0.12)',
            },
          },
        }}
      >
        {rowActionMenu?.booking && (
          <>
            {(() => {
              const status = rowActionMenu.booking.status;
              const hasAnyAction =
                canCheckIn(status) ||
                canCheckout(status) ||
                canMarkNoShow(status) ||
                canAssignRoom(status) ||
                canCancelBooking(status);
              if (hasAnyAction) return null;
              return (
                <Box sx={{ px: 2, py: 1.25, maxWidth: 240 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4, display: 'block' }}>
                    {t('frontDesk.messages.noActionsForStatus', {
                      status: statusLabel(normalizeBookingStatus(status)),
                    })}
                  </Typography>
                </Box>
              );
            })()}
            <MenuItem
              disabled={!canCheckIn(rowActionMenu.booking.status)}
              onClick={() => {
                const id = rowActionMenu.booking.id;
                closeRowActionMenu();
                void updateStatus(id, 'checked_in');
              }}
            >
              <ListItemIcon>
                <CheckInIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('frontDesk.actions.checkin')}</ListItemText>
            </MenuItem>
            <MenuItem
              disabled={!canCheckout(rowActionMenu.booking.status)}
              onClick={() => {
                const booking = rowActionMenu.booking;
                closeRowActionMenu();
                setCheckoutBooking(booking);
                setPaymentMethod('card');
                setInvoiceOpen(true);
              }}
            >
              <ListItemIcon>
                <CheckOutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('frontDesk.actions.checkout')}</ListItemText>
            </MenuItem>
            <MenuItem
              disabled={!canMarkNoShow(rowActionMenu.booking.status)}
              onClick={() => {
                const id = rowActionMenu.booking.id;
                closeRowActionMenu();
                openNoShowConfirm(id);
              }}
            >
              <ListItemIcon>
                <NoShowIcon fontSize="small" color="warning" />
              </ListItemIcon>
              <ListItemText>{t('frontDesk.actions.noShow')}</ListItemText>
            </MenuItem>
            <MenuItem
              disabled={!canAssignRoom(rowActionMenu.booking.status)}
              onClick={() => {
                const id = rowActionMenu.booking.id;
                closeRowActionMenu();
                openAssignRoomDialog(id);
              }}
            >
              <ListItemIcon>
                <AssignRoomIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('frontDesk.actions.assignRoom')}</ListItemText>
            </MenuItem>
            <MenuItem
              disabled={!canCancelBooking(rowActionMenu.booking.status)}
              onClick={() => {
                const id = rowActionMenu.booking.id;
                closeRowActionMenu();
                openCancelConfirm(id);
              }}
            >
              <ListItemIcon>
                <CancelIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>{t('frontDesk.actions.cancel')}</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FrontDesk;
