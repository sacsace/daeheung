import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Box,
  Card,
  Typography,
  IconButton,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyFilterWrapSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
  mvsTableScrollSx,
} from '../../theme/daeheungLayout';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Search as SearchIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { roomBookingService, roomTypeRoomService, roomTypeService } from '../../services/api';
import RoomBookingManagement from '../Work/RoomBookingManagement';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';

const RESERVATION_STATUS_MENU_ROUTES = [
  '/hotel/reservations',
  '/hotel/room-reservation',
  '/work/room-reservation',
] as const;

const reservationFilterFieldSx = {
  ...(mvsSearchFieldSx as Record<string, unknown>),
  ...mvsFilterFieldHeightSx,
} as const;

const reservationMonthNavSx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.25,
  px: 1,
  py: 0.25,
  borderRadius: '10px',
  bgcolor: '#F1F5F9',
  border: '1px solid #CBD5E1',
} as const;

type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';

interface RoomBooking {
  id: number;
  room_id?: number;
  room_number?: string;
  room_type?: string;
  booking_id?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  status: BookingStatus;
  check_in_date: string;
  check_out_date: string;
  check_out_time?: string;
  special_requests?: string;
}

interface RoomSummary {
  key: string;
  roomNumber: string;
  roomType?: string;
  roomTypeId?: number;
  roomName?: string;
}

const isActiveBooking = (status?: BookingStatus) =>
  status !== 'cancelled' && status !== 'no_show';

const makeRoomKey = (roomType: string | undefined, roomNumber: string) =>
  `${roomType || 'Unknown'}|${roomNumber}`;

const formatDate = (value: string | undefined, locale: string) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale);
};

const pad2 = (value: number) => value.toString().padStart(2, '0');

const formatDayLabel = (value: Date, locale: string) => {
  const day = value.getDate().toString().padStart(2, '0');
  const weekday = value.toLocaleDateString(locale, { weekday: 'short' }).toUpperCase();
  return { day, weekday };
};

const toIsoDate = (value: Date) => {
  const year = value.getFullYear();
  const month = pad2(value.getMonth() + 1);
  const day = pad2(value.getDate());
  return `${year}-${month}-${day}`;
};

const addDaysToIso = (iso: string, days: number) => {
  const base = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(base.getTime())) return iso;
  base.setDate(base.getDate() + days);
  return toIsoDate(base);
};

const diffCalendarDays = (fromIso: string, toIso: string) => {
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
};

const datesOverlapExclusive = (
  startA: string,
  endA: string,
  startB: string,
  endB: string
) => startA < endB && endA > startB;

const CHECKOUT_TIME_FALLBACK = '11:00:00';

const normalizeTimeValue = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return CHECKOUT_TIME_FALLBACK;
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  return CHECKOUT_TIME_FALLBACK;
};

const GUEST_PALETTE = [
  '#A9C4B5', // sage
  '#9EB4C7', // slate blue
  '#C3B5A4', // warm taupe
  '#B4A8C2', // muted lilac
  '#A8B69E', // soft olive
  '#C5A9AB', // dusty rose
  '#A3B7C4', // steel
  '#C2B79A', // sand
  '#A7C0BE', // teal mist
  '#B9AFA4', // stone
] as const;

const getGuestColor = (guestName?: string) => {
  const key = String(guestName || '').trim() || 'default-guest';
  let hash = 0;
  for (let idx = 0; idx < key.length; idx += 1) {
    hash = (hash * 31 + key.charCodeAt(idx)) >>> 0;
  }
  return GUEST_PALETTE[hash % GUEST_PALETTE.length];
};

const ReservationStatus: React.FC = () => {
  const menuFlags = useMenuRoutePermissionFlags(RESERVATION_STATUS_MENU_ROUTES);
  // 페이지 등록·수정 권한이 있으면 과거 날짜 등록/수정 허용 (root/admin 포함)
  const canManagePastCheckIn = menuFlags.canMutate;
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('');
  const [roomTypeDialogOpen, setRoomTypeDialogOpen] = useState(false);
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [bookingDialogSeed, setBookingDialogSeed] = useState<{
    roomType: string;
    roomNumber: string;
    checkInDate: string;
    checkInTime?: string;
    checkOutDate: string;
  } | null>(null);
  const [bookingInfoOpen, setBookingInfoOpen] = useState(false);
  const [bookingInfo, setBookingInfo] = useState<RoomBooking | null>(null);
  const [reservationMessageBooking, setReservationMessageBooking] = useState<RoomBooking | null>(null);
  const [reservationActionConfirm, setReservationActionConfirm] = useState<'cancel' | 'delete' | null>(null);
  const [reservationActionLoading, setReservationActionLoading] = useState(false);
  const [bookingGateMessage, setBookingGateMessage] = useState('');
  const [roomTypes, setRoomTypes] = useState<Array<{ id: number; name: string; count: number }>>([]);
  const [roomNameMap, setRoomNameMap] = useState<Map<string, string>>(new Map());
  const [roomIdMap, setRoomIdMap] = useState<Map<string, number>>(new Map());
  const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null);
  const [dragMoving, setDragMoving] = useState(false);
  const dragPayloadRef = useRef<{ bookingId: number; offsetDays: number; nights: number } | null>(null);
  const suppressCellClickRef = useRef(false);
  const [roomNameDialogOpen, setRoomNameDialogOpen] = useState(false);
  const [roomNameForm, setRoomNameForm] = useState({
    roomTypeId: 0,
    roomTypeName: '',
    roomNumber: '',
    roomName: ''
  });
  const [roomTypeForm, setRoomTypeForm] = useState({
    name: '',
    count: '',
    description: '',
    nightlyRate: ''
  });

  const monthStart = useMemo(() => {
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  }, [currentMonth]);

  const monthEnd = useMemo(() => {
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  }, [currentMonth]);

  const dateRange = useMemo(() => {
    const dates: Date[] = [];
    const cursor = new Date(monthStart);
    while (cursor <= monthEnd) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [monthStart, monthEnd]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await roomBookingService.getRoomBookings({
        check_in_date: toIsoDate(monthStart),
        check_out_date: toIsoDate(monthEnd)
      });
      if (response.success) {
        setBookings(response.data || []);
      } else {
        setBookings([]);
        setError(response.message || t('reservationStatus.errors.loadFailed'));
      }
    } catch {
      setBookings([]);
      setError(t('reservationStatus.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [monthStart, monthEnd, t]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useEffect(() => {
    const loadRoomTypes = async () => {
      try {
        const response = await roomTypeService.getRoomTypes({ status: 'active' });
        if (response.success) {
          const mapped = (response.data || [])
            .map((item: any) => ({
              id: Number(item?.id),
              name: String(item?.name || '').trim(),
              count: Number(item?.room_count || 0)
            }))
            .filter((item: { name: string }) => !!item.name);
          setRoomTypes(mapped);
        }
      } catch {
      /* ignore */
    }
    };

    loadRoomTypes();
  }, []);

  useEffect(() => {
    const loadRoomNames = async () => {
      try {
        const response = await roomTypeRoomService.getRoomTypeRooms();
        if (response.success) {
          const nameMap = new Map<string, string>();
          const idMap = new Map<string, number>();
          (response.data || []).forEach((item: any) => {
            const roomTypeId = Number(item.room_type_id);
            const roomNumber = String(item.room_number ?? '').trim();
            if (!Number.isFinite(roomTypeId) || !roomNumber) return;
            const key = `${roomTypeId}|${roomNumber}`;
            nameMap.set(key, String(item.room_name || '').trim());
            const roomId = Number(item.id);
            if (Number.isFinite(roomId) && roomId > 0) {
              idMap.set(key, roomId);
            }
          });
          setRoomNameMap(nameMap);
          setRoomIdMap(idMap);
        }
      } catch {
      /* ignore */
    }
    };
    loadRoomNames();
  }, []);

  const roomSummaries = useMemo<RoomSummary[]>(() => {
    const roomMap = new Map<string, RoomSummary>();
    const typeIdMap = new Map<string, number>();
    roomTypes.forEach((roomType) => {
      typeIdMap.set(roomType.name, roomType.id);
    });

    roomTypes.forEach((roomType) => {
      const count = Math.max(0, Number(roomType.count || 0));
      for (let idx = 1; idx <= count; idx += 1) {
        const roomNumber = String(idx);
        const key = makeRoomKey(roomType.name, roomNumber);
        const nameKey = `${roomType.id}|${roomNumber}`;
        if (!roomMap.has(key)) {
          roomMap.set(key, {
            key,
            roomNumber,
            roomType: roomType.name,
            roomTypeId: roomType.id,
            roomName: roomNameMap.get(nameKey)
          });
        }
      }
    });

    bookings.forEach((booking) => {
      const roomNumber = booking.room_number || (booking.room_id ? String(booking.room_id) : 'Unknown');
      const roomType = booking.room_type || 'Unknown';
      const roomTypeId = typeIdMap.get(roomType);
      const key = makeRoomKey(roomType, roomNumber);
      if (!roomMap.has(key)) {
        const nameKey = roomTypeId ? `${roomTypeId}|${roomNumber}` : '';
        roomMap.set(key, {
          key,
          roomNumber,
          roomType,
          roomTypeId,
          roomName: nameKey ? roomNameMap.get(nameKey) : undefined
        });
      }
    });

    return Array.from(roomMap.values()).sort((a, b) => {
      const typeCompare = (a.roomType || '').localeCompare(b.roomType || '');
      if (typeCompare !== 0) return typeCompare;
      const aNum = Number(a.roomNumber);
      const bNum = Number(b.roomNumber);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return aNum - bNum;
      }
      return a.roomNumber.localeCompare(b.roomNumber);
    });
  }, [bookings, roomNameMap, roomTypes]);

  const roomTypeOptions = useMemo(() => {
    const set = new Set<string>();
    bookings.forEach((booking) => {
      if (booking.room_type) {
        set.add(booking.room_type);
      }
    });
    roomTypes.forEach((roomType) => set.add(roomType.name));
    return Array.from(set).sort();
  }, [bookings, roomTypes]);

  const filteredRooms = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return roomSummaries.filter((room) => {
      const matchesSearch =
        !keyword ||
        (room.roomName || '').toLowerCase().includes(keyword) ||
        room.roomNumber.toLowerCase().includes(keyword) ||
        (room.roomType || '').toLowerCase().includes(keyword);
      const matchesType = !roomTypeFilter || room.roomType === roomTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [roomSummaries, searchTerm, roomTypeFilter]);

  const groupedRooms = useMemo(() => {
    const groups = new Map<string, RoomSummary[]>();
    filteredRooms.forEach((room) => {
      const typeKey = room.roomType || t('reservationStatus.misc.other');
      if (!groups.has(typeKey)) {
        groups.set(typeKey, []);
      }
      groups.get(typeKey)!.push(room);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRooms, t]);

  const bookingDaysByRoom = useMemo(() => {
    const map = new Map<string, Set<string>>();
    bookings.forEach((booking) => {
      if (!isActiveBooking(booking.status)) return;
      const roomNumber = booking.room_number || (booking.room_id ? String(booking.room_id) : 'Unknown');
      const roomKey = makeRoomKey(booking.room_type || 'Unknown', roomNumber);
      const startIso = String(booking.check_in_date || '').slice(0, 10);
      const endIso = String(booking.check_out_date || '').slice(0, 10);
      if (!startIso || !endIso) return;
      if (!map.has(roomKey)) {
        map.set(roomKey, new Set());
      }
      const daySet = map.get(roomKey)!;
      if (startIso === endIso) {
        // 당일 입실/퇴실은 풀칸 1일로 표시
        daySet.add(startIso);
      } else {
        // 체크아웃일은 제외하고, 체크인일부터 전날까지 풀칸 처리
        let cursorIso = startIso;
        while (cursorIso < endIso) {
          daySet.add(cursorIso);
          cursorIso = addDaysToIso(cursorIso, 1);
        }
      }
    });
    return map;
  }, [bookings]);

  const checkoutDaysByRoom = useMemo(() => {
    const map = new Map<string, Set<string>>();
    bookings.forEach((booking) => {
      if (!isActiveBooking(booking.status)) return;
      const roomNumber = booking.room_number || (booking.room_id ? String(booking.room_id) : 'Unknown');
      const roomKey = makeRoomKey(booking.room_type || 'Unknown', roomNumber);
      const startIso = String(booking.check_in_date || '').slice(0, 10);
      const endIso = String(booking.check_out_date || '').slice(0, 10);
      if (!startIso || !endIso) return;
      // 같은 날 체크인/체크아웃인 경우는 기존 full 처리만 사용
      if (startIso === endIso) return;
      if (!map.has(roomKey)) {
        map.set(roomKey, new Set());
      }
      map.get(roomKey)!.add(endIso);
    });
    return map;
  }, [bookings]);

  const todayIso = toIsoDate(new Date());

  const nextIsoDate = (value: string) => {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    if (!year || !month || !day) return value;
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return value;
    date.setDate(date.getDate() + 1);
    return toIsoDate(date);
  };

  const findBookingForCell = (room: RoomSummary, iso: string) => {
    const roomTypeKey = room.roomType || 'Unknown';
    const roomNumber = room.roomNumber;
    const targetDate = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(targetDate.getTime())) return null;
    return bookings.find((booking) => {
      if (!isActiveBooking(booking.status)) return false;
      const bookingRoomType = booking.room_type || 'Unknown';
      const bookingRoomNumber = booking.room_number || (booking.room_id ? String(booking.room_id) : 'Unknown');
      if (bookingRoomType !== roomTypeKey || bookingRoomNumber !== roomNumber) {
        return false;
      }
      const start = new Date(`${booking.check_in_date}T00:00:00`);
      const end = new Date(`${booking.check_out_date}T00:00:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      if (start.toDateString() === end.toDateString()) {
        return targetDate.toDateString() === start.toDateString();
      }
      // 체크아웃일은 full-day 점유에서 제외(반칸 표시는 별도 처리)
      return targetDate >= start && targetDate < end;
    }) || null;
  };

  const findCheckoutBookingForCell = (room: RoomSummary, iso: string) => {
    const roomTypeKey = room.roomType || 'Unknown';
    const roomNumber = room.roomNumber;
    return bookings.find((booking) => {
      if (!isActiveBooking(booking.status)) return false;
      const bookingRoomType = booking.room_type || 'Unknown';
      const bookingRoomNumber = booking.room_number || (booking.room_id ? String(booking.room_id) : 'Unknown');
      if (bookingRoomType !== roomTypeKey || bookingRoomNumber !== roomNumber) return false;
      const start = new Date(`${booking.check_in_date}T00:00:00`);
      const end = new Date(`${booking.check_out_date}T00:00:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      return booking.check_out_date === iso && start < end;
    }) || null;
  };

  const canReserveAfterCheckout = (booking: RoomBooking) => {
    const normalizedTime = normalizeTimeValue(booking.check_out_time);
    const checkoutDateTime = new Date(`${booking.check_out_date}T${normalizedTime}`);
    if (Number.isNaN(checkoutDateTime.getTime())) return false;
    const availableAt = new Date(checkoutDateTime.getTime() + (2 * 60 * 60 * 1000));
    return new Date() >= availableAt;
  };

  const getAvailableAfterCheckout = (booking: RoomBooking) => {
    const normalizedTime = normalizeTimeValue(booking.check_out_time);
    const checkoutDateTime = new Date(`${booking.check_out_date}T${normalizedTime}`);
    if (Number.isNaN(checkoutDateTime.getTime())) return null;
    return new Date(checkoutDateTime.getTime() + (2 * 60 * 60 * 1000));
  };

  const handleCellClick = (room: RoomSummary, iso: string, isBooked: boolean, isCheckoutHalf: boolean) => {
    if (suppressCellClickRef.current) {
      suppressCellClickRef.current = false;
      return;
    }
    if (isBooked) {
      const matched = findBookingForCell(room, iso);
      if (matched) {
        setReservationMessageBooking(matched);
      }
      return;
    }
    if (!canManagePastCheckIn && iso < todayIso) {
      return;
    }
    if (isCheckoutHalf) {
      const matchedCheckoutBooking = findCheckoutBookingForCell(room, iso);
      if (matchedCheckoutBooking && !canReserveAfterCheckout(matchedCheckoutBooking)) {
        const checkoutTime = normalizeTimeValue(matchedCheckoutBooking.check_out_time);
        setBookingGateMessage(
          i18n.language === 'en'
            ? `Booking is available 2 hours after checkout (${matchedCheckoutBooking.check_out_date} ${checkoutTime}).`
            : `체크아웃(${matchedCheckoutBooking.check_out_date} ${checkoutTime}) 2시간 이후부터 예약 가능합니다.`
        );
        setBookingInfo(matchedCheckoutBooking);
        setBookingInfoOpen(true);
        return;
      }
    }
    setBookingGateMessage('');
    setBookingDialogSeed({
      roomType: room.roomType || '',
      roomNumber: room.roomNumber,
      checkInDate: iso,
      checkOutDate: nextIsoDate(iso)
    });
    setBookingDialogOpen(true);
  };

  const resolveTargetRoomId = (
    room: RoomSummary,
    options?: { sameRoomFallbackId?: number }
  ) => {
    if (room.roomTypeId) {
      const mapped = roomIdMap.get(`${room.roomTypeId}|${room.roomNumber}`);
      if (mapped) return mapped;
    }
    const sibling = bookings.find((booking) => {
      if (!isActiveBooking(booking.status) || !booking.room_id) return false;
      const bookingRoomNumber =
        booking.room_number || (booking.room_id ? String(booking.room_id) : '');
      return makeRoomKey(booking.room_type || 'Unknown', bookingRoomNumber) === room.key;
    });
    if (sibling?.room_id) return Number(sibling.room_id);
    const parsed = Number.parseInt(room.roomNumber, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    const fallback = options?.sameRoomFallbackId;
    if (fallback != null && Number.isFinite(fallback) && fallback > 0) {
      return Number(fallback);
    }
    return 0;
  };

  const hasLocalRoomConflict = (
    bookingId: number,
    room: RoomSummary,
    checkInDate: string,
    checkOutDate: string
  ) => {
    const roomTypeKey = room.roomType || 'Unknown';
    const normalizeStay = (start: string, end: string): [string, string] =>
      start === end ? [start, addDaysToIso(start, 1)] : [start, end];
    const [moveStart, moveEnd] = normalizeStay(checkInDate, checkOutDate);
    return bookings.some((booking) => {
      if (booking.id === bookingId || !isActiveBooking(booking.status)) return false;
      const bookingRoomType = booking.room_type || 'Unknown';
      const bookingRoomNumber =
        booking.room_number || (booking.room_id ? String(booking.room_id) : 'Unknown');
      if (bookingRoomType !== roomTypeKey || bookingRoomNumber !== room.roomNumber) {
        return false;
      }
      const otherIn = String(booking.check_in_date || '').slice(0, 10);
      const otherOut = String(booking.check_out_date || '').slice(0, 10);
      if (!otherIn || !otherOut) return false;
      const [otherStart, otherEnd] = normalizeStay(otherIn, otherOut);
      return datesOverlapExclusive(moveStart, moveEnd, otherStart, otherEnd);
    });
  };

  const handleBookingDragStart = (
    event: React.DragEvent,
    booking: RoomBooking,
    grabbedIso: string
  ) => {
    if (
      booking.status === 'checked_out' ||
      booking.status === 'cancelled' ||
      booking.status === 'no_show'
    ) {
      event.preventDefault();
      return;
    }
    const checkIn = String(booking.check_in_date || '').slice(0, 10);
    const checkOut = String(booking.check_out_date || '').slice(0, 10);
    if (!checkIn || !checkOut) {
      event.preventDefault();
      return;
    }
    const offsetDays = Math.max(0, diffCalendarDays(checkIn, grabbedIso));
    const nights = Math.max(0, diffCalendarDays(checkIn, checkOut));
    const payload = { bookingId: booking.id, offsetDays, nights };
    dragPayloadRef.current = payload;
    suppressCellClickRef.current = true;
    try {
      event.dataTransfer.setData('application/json', JSON.stringify(payload));
      event.dataTransfer.setData('text/plain', String(booking.id));
    } catch {
      // ignore transfer encoding errors
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleBookingDragEnd = () => {
    dragPayloadRef.current = null;
    setDragOverCellKey(null);
  };

  const handleBookingDrop = async (room: RoomSummary, dropIso: string) => {
    const payload = dragPayloadRef.current;
    setDragOverCellKey(null);
    dragPayloadRef.current = null;
    if (!payload || dragMoving) return;

    const booking = bookings.find((item) => item.id === payload.bookingId);
    if (!booking || !isActiveBooking(booking.status)) return;

    const newCheckIn = addDaysToIso(dropIso, -payload.offsetDays);
    const newCheckOut = addDaysToIso(newCheckIn, payload.nights);
    const targetRoomType = (room.roomType || '').trim();
    const targetRoomNumber = room.roomNumber.trim();
    if (!targetRoomType || !targetRoomNumber) {
      setError(t('reservationStatus.errors.moveInvalidRoom'));
      return;
    }

    const prevCheckIn = String(booking.check_in_date || '').slice(0, 10);
    const prevCheckOut = String(booking.check_out_date || '').slice(0, 10);
    const prevRoomNumber =
      booking.room_number || (booking.room_id ? String(booking.room_id) : '');
    const prevRoomType = booking.room_type || '';
    const unchanged =
      prevCheckIn === newCheckIn &&
      prevCheckOut === newCheckOut &&
      prevRoomNumber === targetRoomNumber &&
      prevRoomType === targetRoomType;
    if (unchanged) return;

    suppressCellClickRef.current = true;

    if (!canManagePastCheckIn && newCheckIn < todayIso) {
      setError(t('reservationStatus.errors.movePastNotAllowed'));
      return;
    }

    if (hasLocalRoomConflict(booking.id, room, newCheckIn, newCheckOut)) {
      setError(t('reservationStatus.errors.moveConflict'));
      return;
    }

    const roomChanged =
      prevRoomNumber !== targetRoomNumber || prevRoomType !== targetRoomType;
    const roomId = resolveTargetRoomId(room, {
      sameRoomFallbackId: roomChanged ? undefined : booking.room_id,
    });
    if (!roomId) {
      setError(t('reservationStatus.errors.moveInvalidRoom'));
      return;
    }

    try {
      setDragMoving(true);
      setError('');
      setSuccess('');
      const response = await roomBookingService.updateRoomBooking(booking.id, {
        room_id: roomId,
        room_number: targetRoomNumber,
        room_type: targetRoomType,
        check_in_date: newCheckIn,
        check_out_date: newCheckOut,
      });
      if (!response?.success) {
        setError(response?.message || t('reservationStatus.errors.moveFailed'));
        return;
      }
      setSuccess(t('reservationStatus.toast.moveSuccess'));
      await loadBookings();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || t('reservationStatus.errors.moveFailed')
      );
    } finally {
      setDragMoving(false);
    }
  };

  const handleCloseBookingDialog = () => {
    setBookingDialogOpen(false);
    setBookingDialogSeed(null);
    loadBookings();
  };

  const handleEditBooking = (booking: RoomBooking | null) => {
    if (!booking) return;
    setReservationMessageBooking(null);
    setBookingInfoOpen(false);
    setBookingInfo(null);
    setBookingGateMessage('');
    navigate('/hotel/room-reservation', {
      state: { editBookingId: booking.id }
    });
  };

  const handleReservationAction = async () => {
    if (!reservationMessageBooking || !reservationActionConfirm) return;
    try {
      setReservationActionLoading(true);
      const response = reservationActionConfirm === 'cancel'
        ? await roomBookingService.cancelRoomBooking(reservationMessageBooking.id)
        : await roomBookingService.deleteRoomBooking(reservationMessageBooking.id);
      if (!response.success) {
        setError(
          response.message ||
          t(`reservationStatus.errors.${reservationActionConfirm}Failed`)
        );
        return;
      }
      setReservationActionConfirm(null);
      setReservationMessageBooking(null);
      await loadBookings();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        t(`reservationStatus.errors.${reservationActionConfirm}Failed`)
      );
    } finally {
      setReservationActionLoading(false);
    }
  };

  const handleBookAfterCheckout = () => {
    if (!bookingInfo) return;

    const checkoutTime = normalizeTimeValue(bookingInfo.check_out_time);
    const availableAt = getAvailableAfterCheckout(bookingInfo);
    let nextCheckInDate = bookingInfo.check_out_date;
    let nextCheckInTime = '';

    if (availableAt) {
      nextCheckInDate = toIsoDate(availableAt);
      nextCheckInTime = `${pad2(availableAt.getHours())}:${pad2(availableAt.getMinutes())}`;
    }

    if (!canReserveAfterCheckout(bookingInfo)) {
      setBookingGateMessage(
        i18n.language === 'en'
          ? `Booking is available 2 hours after checkout (${bookingInfo.check_out_date} ${checkoutTime}).`
          : `체크아웃(${bookingInfo.check_out_date} ${checkoutTime}) 2시간 이후부터 예약 가능합니다.`
      );
    }

    const nextRoomNumber =
      bookingInfo.room_number || (bookingInfo.room_id ? String(bookingInfo.room_id) : '');

    setBookingInfoOpen(false);
    setBookingInfo(null);
    setBookingGateMessage('');
    setBookingDialogSeed({
      roomType: bookingInfo.room_type || '',
      roomNumber: nextRoomNumber,
      checkInDate: nextCheckInDate,
      checkInTime: nextCheckInTime,
      checkOutDate: nextIsoDate(nextCheckInDate)
    });
    setBookingDialogOpen(true);
  };

  const monthLabel = currentMonth.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'ko-KR', {
    year: 'numeric',
    month: 'long'
  });

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleOpenRoomTypeDialog = () => {
    setRoomTypeForm((prev) => ({
      ...prev,
      name: roomTypeFilter
    }));
    setRoomTypeDialogOpen(true);
  };

  const handleApplyRoomType = () => {
    setRoomTypeFilter(roomTypeForm.name.trim());
    setRoomTypeDialogOpen(false);
  };

  const handleOpenRoomNameDialog = (room: RoomSummary) => {
    if (!room.roomTypeId) return;
    setRoomNameForm({
      roomTypeId: room.roomTypeId,
      roomTypeName: room.roomType || '',
      roomNumber: room.roomNumber,
      roomName: room.roomName || ''
    });
    setRoomNameDialogOpen(true);
  };

  const handleSaveRoomName = async () => {
    if (!roomNameForm.roomTypeId || !roomNameForm.roomNumber) {
      setRoomNameDialogOpen(false);
      return;
    }
    try {
      const response = await roomTypeRoomService.upsertRoomTypeRoom({
        room_type_id: roomNameForm.roomTypeId,
        room_number: roomNameForm.roomNumber,
        room_name: roomNameForm.roomName
      });
      if (response.success) {
        const key = `${roomNameForm.roomTypeId}|${roomNameForm.roomNumber}`;
        setRoomNameMap((prev) => {
          const next = new Map(prev);
          if (roomNameForm.roomName.trim()) {
            next.set(key, roomNameForm.roomName.trim());
          } else {
            next.delete(key);
          }
          return next;
        });
      }
    } catch {
      /* ignore */
    } finally {
      setRoomNameDialogOpen(false);
    }
  };

  const gridBorder = theme.palette.mode === 'light' ? '#E2E8F0' : theme.palette.divider;
  const calendarOuterBorder = theme.palette.mode === 'light' ? '#94A3B8' : theme.palette.grey[500];
  const calendarHeaderBg = theme.palette.mode === 'light' ? '#E8EEF5' : theme.palette.grey[800];
  const pastCellBg = theme.palette.mode === 'light' ? '#F1F3F6' : alpha(theme.palette.grey[500], 0.22);
  const calendarSurfaceBg = theme.palette.mode === 'light' ? '#FFFFFF' : theme.palette.background.paper;
  const groupRowBg = theme.palette.mode === 'light' ? '#D8E1EC' : alpha(theme.palette.primary.main, 0.22);

  const calendarCellBorderSx = {
    borderRight: `1px solid ${gridBorder}`,
    borderBottom: `1px solid ${gridBorder}`,
  } as const;

  const calendarRoomRowHeight = 28;
  const calendarRoomFontSize = '0.65rem';

  const calendarHeadCellSx = {
    py: '1px !important',
    px: 0.25,
    lineHeight: 1.05,
    textAlign: 'center' as const,
  } as const;

  const calendarSideHeadCellSx = {
    ...calendarHeadCellSx,
    fontWeight: 600,
    fontSize: `${calendarRoomFontSize} !important`,
  } as const;

  const calendarGroupCellSx = {
    py: '1px !important',
    height: 30,
    minHeight: 30,
    maxHeight: 30,
    lineHeight: '30px',
    textAlign: 'center' as const,
  } as const;

  const calendarRoomCellSx = {
    py: '0 !important',
    px: '0.3rem !important',
    height: calendarRoomRowHeight,
    minHeight: calendarRoomRowHeight,
    maxHeight: calendarRoomRowHeight,
    lineHeight: `${calendarRoomRowHeight}px`,
    fontSize: calendarRoomFontSize,
    fontWeight: 600,
    textAlign: 'center' as const,
  } as const;

  const calendarDateCellSx = {
    height: calendarRoomRowHeight,
    minHeight: calendarRoomRowHeight,
    maxHeight: calendarRoomRowHeight,
    py: '0 !important',
    px: 0,
    lineHeight: `${calendarRoomRowHeight}px`,
    fontSize: '0.58rem',
  } as const;

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={t('reservationStatus.title')}
        description={t('reservationStatus.description')}
        actions={
          <>
            <Button
              variant="contained"
              disableElevation
              onClick={() => navigate('/hotel/room-reservation')}
              sx={mvsBodyPrimaryBtnSx}
            >
              {t('reservationStatus.actions.book')}
            </Button>
            <Button
              variant="outlined"
              onClick={handleOpenRoomTypeDialog}
              sx={mvsBodyOutlinedBtnSx}
            >
              {t('reservationStatus.actions.roomTypeInput')}
            </Button>
            <Box sx={reservationMonthNavSx}>
              <IconButton
                onClick={handlePrevMonth}
                size="small"
                aria-label="previous month"
                sx={{ borderRadius: '10px' }}
              >
                <ChevronLeft fontSize="small" />
              </IconButton>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, letterSpacing: '0.01em', px: 0.5, whiteSpace: 'nowrap' }}>
                {monthLabel}
              </Typography>
              <IconButton
                onClick={handleNextMonth}
                size="small"
                aria-label="next month"
                sx={{ borderRadius: '10px' }}
              >
                <ChevronRight fontSize="small" />
              </IconButton>
            </Box>
          </>
        }
      />

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Box sx={mvsBodyFilterWrapSx}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 2fr) minmax(0, 1fr)' },
              gap: 2,
              alignItems: 'flex-end',
              ...(mvsSearchFieldSx as Record<string, unknown>),
            }}
          >
            <TextField
              size="small"
              fullWidth
              label={t('reservationStatus.filters.search')}
              placeholder={t('reservationStatus.placeholders.search')}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              sx={reservationFilterFieldSx}
              {...mvsOutlinedLabelProps}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              size="small"
              fullWidth
              select
              label={t('reservationStatus.filters.roomType')}
              value={roomTypeFilter}
              onChange={(event) => setRoomTypeFilter(event.target.value)}
              sx={reservationFilterFieldSx}
              {...mvsOutlinedLabelProps}
              SelectProps={{
                displayEmpty: true,
                renderValue: (selected) => (selected ? selected : t('reservationStatus.filters.all')),
              }}
            >
              <MenuItem value="">{t('reservationStatus.filters.all')}</MenuItem>
              {roomTypeOptions.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Box>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '8px' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: '8px' }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Box sx={mvsBodyListZoneSx}>
        <TableContainer
          sx={{
            ...mvsBodyListTableSx,
            ...mvsTableScrollSx,
            width: '100%',
            maxWidth: '100%',
            bgcolor: calendarSurfaceBg,
            border: `1.5px solid ${calendarOuterBorder}`,
            borderRadius: { xs: '10px', sm: '12px' },
            boxShadow: 'none',
          }}
        >
          <Table
            size="small"
            stickyHeader
            sx={{
              width: '100%',
              minWidth: { xs: 760, md: '100%' },
              tableLayout: 'fixed',
              borderCollapse: 'separate',
              borderSpacing: 0,
              bgcolor: calendarSurfaceBg,
              '& .MuiTableCell-root': {
                borderLeft: 'none',
                borderTop: 'none',
                ...calendarCellBorderSx,
              },
              '& .MuiTableHead-root .MuiTableCell-head': {
                bgcolor: `${calendarHeaderBg} !important`,
                color: 'text.primary',
              },
              '& .MuiTableCell-sizeSmall': {
                paddingTop: '1px',
                paddingBottom: '1px',
              },
              '& .MuiTableBody-root .MuiTableRow-root': {
                height: calendarRoomRowHeight,
              },
              '& .MuiTableBody-root .MuiTableCell-root': {
                paddingTop: '1px',
                paddingBottom: '1px',
              },
            }}
          >
              <colgroup>
                <col style={{ width: 'clamp(72px, 8vw, 104px)' }} />
                {dateRange.map((date) => (
                  <col key={toIsoDate(date)} />
                ))}
                <col style={{ width: 'clamp(56px, 6vw, 76px)' }} />
                <col style={{ width: 'clamp(64px, 7vw, 92px)' }} />
              </colgroup>
              <TableHead
                sx={{
                  '& .MuiTableCell-head': {
                    py: '2px !important',
                    px: 0.25,
                    lineHeight: 1.1,
                    bgcolor: `${calendarHeaderBg} !important`,
                    color: 'text.primary',
                    fontWeight: 700,
                  },
                }}
              >
                <TableRow>
                  <TableCell
                    align="center"
                    sx={{
                      ...calendarSideHeadCellSx,
                      position: 'sticky',
                      left: 0,
                      zIndex: 3,
                      bgcolor: `${calendarHeaderBg} !important`,
                      borderRight: `2px solid ${gridBorder}`,
                      color: 'text.primary',
                      width: 104,
                    }}
                  >
                    {t('reservationStatus.columns.room')}
                  </TableCell>
                  {dateRange.map((date) => {
                    const { day, weekday } = formatDayLabel(date, i18n.language === 'en' ? 'en-US' : 'ko-KR');
                    return (
                      <TableCell
                        key={toIsoDate(date)}
                        align="center"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          lineHeight: 1.1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          px: 0.25,
                          bgcolor: `${calendarHeaderBg} !important`,
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.1, fontSize: '0.65rem' }}>
                            {day}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1, fontSize: '0.6rem' }}>
                            {weekday}
                          </Typography>
                        </Box>
                      </TableCell>
                    );
                  })}
                  <TableCell
                    align="center"
                    sx={{
                      ...calendarSideHeadCellSx,
                      width: 76,
                      bgcolor: `${calendarHeaderBg} !important`,
                    }}
                  >
                    {t('reservationStatus.columns.booked')}
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      ...calendarSideHeadCellSx,
                      width: 92,
                      bgcolor: `${calendarHeaderBg} !important`,
                    }}
                  >
                    {t('reservationStatus.columns.remaining')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow sx={{ height: 'auto !important' }}>
                    <TableCell colSpan={dateRange.length + 3} align="center">
                      <Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2" color="text.secondary">{t('common.loading')}</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filteredRooms.length === 0 && (
                  <TableRow sx={{ height: 'auto !important' }}>
                    <TableCell colSpan={dateRange.length + 3} align="center">
                      <Typography variant="body2" color="text.secondary">
                        {t('reservationStatus.empty.noData')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {!loading && groupedRooms.map(([roomType, rooms]) => (
                  <React.Fragment key={roomType}>
                    <TableRow>
                    <TableCell
                        align="center"
                        colSpan={dateRange.length + 3}
                        sx={{
                          ...calendarGroupCellSx,
                          position: 'sticky',
                          left: 0,
                          bgcolor: `${groupRowBg} !important`,
                          backgroundColor: `${groupRowBg} !important`,
                          fontWeight: 700,
                          color: 'text.primary',
                          borderRight: `2px solid ${gridBorder}`,
                          fontSize: '0.7rem',
                          letterSpacing: '0.01em',
                        }}
                      >
                        {roomType} ({rooms.length})
                      </TableCell>
                    </TableRow>
                    {rooms.map((room) => {
                      const bookingDays = bookingDaysByRoom.get(room.key) || new Set<string>();
                      const checkoutDays = checkoutDaysByRoom.get(room.key) || new Set<string>();
                      const bookedCount = bookingDays.size;
                      const availableCount = Math.max(dateRange.length - bookedCount, 0);

                      return (
                        <TableRow
                          key={room.key}
                          hover
                          sx={{
                            '&:hover td': {
                              backgroundColor: 'action.hover'
                            },
                            '&:hover td:first-of-type': {
                              backgroundColor: 'action.hover'
                            }
                          }}
                        >
                          <TableCell
                            align="center"
                            sx={{
                              ...calendarRoomCellSx,
                              position: 'sticky',
                              left: 0,
                              backgroundColor: `${calendarSurfaceBg} !important`,
                              borderRight: `2px solid ${gridBorder}`,
                              fontWeight: 600,
                              zIndex: 2,
                              color: 'text.primary',
                              boxShadow: `4px 0 12px ${alpha('#0f172a', 0.04)}`,
                            }}
                          >
                            <Box
                              component="span"
                              sx={{
                                cursor: room.roomTypeId ? 'pointer' : 'default',
                                display: 'block',
                                width: '100%',
                                textAlign: 'center',
                                fontWeight: 600,
                                color: 'text.primary',
                                lineHeight: `${calendarRoomRowHeight}px`,
                                fontSize: calendarRoomFontSize,
                              }}
                              onClick={() => room.roomTypeId && handleOpenRoomNameDialog(room)}
                            >
                              {room.roomName || room.roomNumber}
                            </Box>
                          </TableCell>
                          {dateRange.map((date) => {
                            const iso = toIsoDate(date);
                            const isBooked = bookingDays.has(iso);
                            const hasCheckoutHalf = checkoutDays.has(iso);
                            const isCheckoutHalf = !isBooked && hasCheckoutHalf;
                            const hasReservationMark = isBooked || hasCheckoutHalf;
                            const matchedBooking = isBooked
                              ? findBookingForCell(room, iso)
                              : null;
                            const matchedCheckoutBooking = hasCheckoutHalf
                                ? findCheckoutBookingForCell(room, iso)
                                : null;
                            const bookedGuestColor = matchedBooking ? getGuestColor(matchedBooking.guest_name) : GUEST_PALETTE[0];
                            const checkoutGuestColor = matchedCheckoutBooking
                              ? getGuestColor(matchedCheckoutBooking.guest_name)
                              : GUEST_PALETTE[0];
                            const isElapsedDay = iso <= todayIso;
                            const reservationFill =
                              isBooked && hasCheckoutHalf
                                ? `linear-gradient(90deg, ${checkoutGuestColor} 0 50%, ${bookedGuestColor} 50% 100%)`
                                : isBooked
                                  ? bookedGuestColor
                                  : hasCheckoutHalf
                                    ? `linear-gradient(90deg, ${checkoutGuestColor} 0 50%, ${isElapsedDay ? pastCellBg : calendarSurfaceBg} 50% 100%)`
                                    : undefined;
                            const cellKey = `${room.key}|${iso}`;
                            const isDragOver = dragOverCellKey === cellKey;
                            const canDragBooking = Boolean(
                              isBooked &&
                              matchedBooking &&
                              !dragMoving &&
                              matchedBooking.status !== 'checked_out' &&
                              matchedBooking.status !== 'cancelled' &&
                              matchedBooking.status !== 'no_show'
                            );
                            return (
                              <TableCell
                                key={cellKey}
                                align="center"
                                draggable={canDragBooking}
                                onDragStart={(event) => {
                                  if (!matchedBooking) return;
                                  handleBookingDragStart(event, matchedBooking, iso);
                                }}
                                onDragEnd={handleBookingDragEnd}
                                onDragOver={(event) => {
                                  if (!dragPayloadRef.current || dragMoving) return;
                                  event.preventDefault();
                                  event.dataTransfer.dropEffect = 'move';
                                  if (dragOverCellKey !== cellKey) {
                                    setDragOverCellKey(cellKey);
                                  }
                                }}
                                onDragLeave={() => {
                                  if (dragOverCellKey === cellKey) {
                                    setDragOverCellKey(null);
                                  }
                                }}
                                onDrop={(event) => {
                                  event.preventDefault();
                                  void handleBookingDrop(room, iso);
                                }}
                                sx={{
                                  bgcolor: reservationFill
                                    ? 'transparent'
                                    : isElapsedDay
                                      ? `${pastCellBg} !important`
                                      : `${calendarSurfaceBg} !important`,
                                  background: reservationFill
                                    || (isElapsedDay ? pastCellBg : calendarSurfaceBg),
                                  cursor: canDragBooking
                                    ? 'grab'
                                    : isBooked || canManagePastCheckIn || iso >= todayIso
                                      ? 'pointer'
                                      : 'not-allowed',
                                  color: hasReservationMark ? '#334155' : 'text.secondary',
                                  outline: isDragOver ? `2px solid ${theme.palette.primary.main}` : 'none',
                                  outlineOffset: -2,
                                  opacity: dragMoving && matchedBooking && dragPayloadRef.current?.bookingId === matchedBooking.id
                                    ? 0.55
                                    : 1,
                                  ...calendarDateCellSx,
                                  '&:active': canDragBooking ? { cursor: 'grabbing' } : undefined,
                                }}
                                onClick={() => handleCellClick(room, iso, isBooked, isCheckoutHalf)}
                              >
                                {hasReservationMark ? 'B' : ''}
                              </TableCell>
                            );
                          })}
                          <TableCell
                            align="center"
                            sx={{
                              whiteSpace: 'nowrap',
                              ...calendarRoomCellSx,
                            }}
                          >
                            <Box
                              component="span"
                              sx={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'center',
                                fontWeight: 600,
                                lineHeight: `${calendarRoomRowHeight}px`,
                                fontSize: calendarRoomFontSize,
                              }}
                            >
                              {bookedCount}
                            </Box>
                          </TableCell>
                          <TableCell
                            align="center"
                            sx={{
                              whiteSpace: 'nowrap',
                              ...calendarRoomCellSx,
                            }}
                          >
                            <Box
                              component="span"
                              sx={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'center',
                                fontWeight: 600,
                                lineHeight: `${calendarRoomRowHeight}px`,
                                fontSize: calendarRoomFontSize,
                              }}
                            >
                              {availableCount}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
      </Box>

      <Dialog open={roomTypeDialogOpen} onClose={() => setRoomTypeDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('reservationStatus.dialog.roomTypeTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                {t('reservationStatus.dialog.roomName')}
              </Typography>
              <TextField
                autoFocus
                fullWidth
                size="small"
                placeholder={t('reservationStatus.placeholders.roomTypeName')}
                value={roomTypeForm.name}
                onChange={(event) =>
                  setRoomTypeForm((prev) => ({ ...prev, name: event.target.value }))
                }
                sx={mvsSearchFieldSx}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                {t('reservationStatus.dialog.roomCount')}
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 0 }}
                placeholder={t('reservationStatus.placeholders.roomCount')}
                value={roomTypeForm.count}
                onChange={(event) =>
                  setRoomTypeForm((prev) => ({ ...prev, count: event.target.value }))
                }
                sx={mvsSearchFieldSx}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                {t('reservationStatus.dialog.nightlyRate')}
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 0 }}
                placeholder={t('reservationStatus.placeholders.nightlyRate')}
                value={roomTypeForm.nightlyRate}
                onChange={(event) =>
                  setRoomTypeForm((prev) => ({ ...prev, nightlyRate: event.target.value }))
                }
                sx={mvsSearchFieldSx}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                {t('reservationStatus.dialog.description')}
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder={t('reservationStatus.placeholders.roomTypeDesc')}
                multiline
                minRows={3}
                value={roomTypeForm.description}
                onChange={(event) =>
                  setRoomTypeForm((prev) => ({ ...prev, description: event.target.value }))
                }
                sx={mvsSearchFieldSx}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoomTypeDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" disableElevation onClick={handleApplyRoomType} sx={mvsBodyPrimaryBtnSx}>
            {t('reservationStatus.actions.apply')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={roomNameDialogOpen} onClose={() => setRoomNameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('reservationStatus.dialog.roomLabelTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                {t('reservationStatus.filters.roomType')}
              </Typography>
              <TextField
                size="small"
                value={roomNameForm.roomTypeName}
                InputProps={{ readOnly: true }}
                fullWidth
                sx={mvsSearchFieldSx}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                {t('reservationStatus.dialog.roomNo')}
              </Typography>
              <TextField
                size="small"
                value={roomNameForm.roomNumber}
                InputProps={{ readOnly: true }}
                fullWidth
                sx={mvsSearchFieldSx}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5 }}>
                {t('reservationStatus.dialog.roomLabel')}
              </Typography>
              <TextField
                size="small"
                placeholder={t('reservationStatus.placeholders.roomLabel')}
                value={roomNameForm.roomName}
                onChange={(event) =>
                  setRoomNameForm((prev) => ({ ...prev, roomName: event.target.value }))
                }
                fullWidth
                sx={mvsSearchFieldSx}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoomNameDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" disableElevation onClick={handleSaveRoomName} sx={mvsBodyPrimaryBtnSx}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {bookingDialogOpen && bookingDialogSeed && (
        <RoomBookingManagement
          dialogOnly
          initialFormState={{
            roomType: bookingDialogSeed.roomType,
            roomNumber: bookingDialogSeed.roomNumber,
            checkInDate: bookingDialogSeed.checkInDate,
            checkInTime: bookingDialogSeed.checkInTime,
            checkOutDate: bookingDialogSeed.checkOutDate
          }}
          onCloseDialog={handleCloseBookingDialog}
        />
      )}

      <Dialog
        open={Boolean(reservationMessageBooking)}
        onClose={() => {
          if (!reservationActionLoading) setReservationMessageBooking(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('reservationStatus.dialog.bookingActionTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              {(reservationMessageBooking?.room_number ||
                reservationMessageBooking?.room_id ||
                '-') +
                ' · ' +
                (reservationMessageBooking?.guest_name || '-')}
            </Typography>
            <Box
              sx={{
                p: 1.5,
                borderRadius: '10px',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'action.hover',
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {t('reservationStatus.columns.memo')}
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {reservationMessageBooking?.special_requests?.trim() ||
                  t('reservationStatus.info.noReservationMessage')}
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={() => handleEditBooking(reservationMessageBooking)}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('reservationStatus.actions.editBooking')}
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  if (reservationMessageBooking) {
                    navigate('/hotel/room-reservation', {
                      state: { viewBookingId: reservationMessageBooking.id }
                    });
                  }
                  setReservationMessageBooking(null);
                }}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('reservationStatus.actions.invoice')}
              </Button>
              <Button
                variant="outlined"
                color="error"
                disabled={
                  reservationMessageBooking?.status === 'cancelled' ||
                  reservationMessageBooking?.status === 'checked_out'
                }
                onClick={() => setReservationActionConfirm('cancel')}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('reservationStatus.actions.cancel')}
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => setReservationActionConfirm('delete')}
                sx={mvsBodyOutlinedBtnSx}
              >
                {t('reservationStatus.actions.delete')}
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReservationMessageBooking(null)}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(reservationActionConfirm)}
        onClose={() => {
          if (!reservationActionLoading) setReservationActionConfirm(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {t(`reservationStatus.dialog.${reservationActionConfirm}Title`)}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t(`reservationStatus.dialog.${reservationActionConfirm}Message`)}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={reservationActionLoading}
            onClick={() => setReservationActionConfirm(null)}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={reservationActionLoading}
            onClick={handleReservationAction}
          >
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={bookingInfoOpen}
        onClose={() => {
          setBookingInfoOpen(false);
          setBookingInfo(null);
          setBookingGateMessage('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('reservationStatus.dialog.bookingInfoTitle')}</DialogTitle>
        <DialogContent>
          {bookingGateMessage && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              {bookingGateMessage}
            </Alert>
          )}
          {bookingInfo ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">{t('reservationStatus.info.bookingNo')}</Typography>
                <Typography variant="body2">{bookingInfo.booking_id || bookingInfo.id}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">{t('reservationStatus.info.guest')}</Typography>
                <Typography variant="body2">{bookingInfo.guest_name || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">{t('reservationStatus.info.contact')}</Typography>
                <Typography variant="body2">{bookingInfo.guest_phone || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">{t('reservationStatus.info.email')}</Typography>
                <Typography variant="body2">{bookingInfo.guest_email || '-'}</Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('reservationStatus.columns.checkin')}</Typography>
                  <Typography variant="body2">{formatDate(bookingInfo.check_in_date, i18n.language === 'en' ? 'en-US' : 'ko-KR')}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{t('reservationStatus.columns.checkout')}</Typography>
                  <Typography variant="body2">{formatDate(bookingInfo.check_out_date, i18n.language === 'en' ? 'en-US' : 'ko-KR')}</Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">{t('reservationStatus.columns.memo')}</Typography>
                <Typography variant="body2">{bookingInfo.special_requests || '-'}</Typography>
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('reservationStatus.empty.bookingNotFound')}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          {bookingInfo && (
            <Button
              variant="outlined"
              onClick={() => handleEditBooking(bookingInfo)}
            >
              {t('reservationStatus.actions.editBooking')}
            </Button>
          )}
          {bookingGateMessage && bookingInfo && (
            <Button
              variant="contained"
              onClick={handleBookAfterCheckout}
            >
              {t('reservationStatus.actions.bookAfterCheckout')}
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={() => {
              if (bookingInfo) {
                navigate('/hotel/room-reservation', {
                  state: { viewBookingId: bookingInfo.id }
                });
              }
              setBookingInfoOpen(false);
              setBookingInfo(null);
              setBookingGateMessage('');
            }}
          >
            {t('reservationStatus.actions.invoice')}
          </Button>
          <Button
            onClick={() => {
              setBookingInfoOpen(false);
              setBookingInfo(null);
              setBookingGateMessage('');
            }}
          >
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReservationStatus;
