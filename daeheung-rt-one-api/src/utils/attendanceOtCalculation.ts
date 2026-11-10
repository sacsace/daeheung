const STANDARD_WORK_DAY_HOURS = 8;
const STANDARD_CHECK_IN_HOUR_IST = 9;
const STANDARD_END_HOUR_IST = 18;
/** 정규 퇴근(18:00) 후 30분까지는 OT 미적용 */
const OT_END_GRACE_MINUTES = 30;
const OT_END_GRACE_HOURS = OT_END_GRACE_MINUTES / 60;
const IST_OFFSET = '+05:30';

export type AttendanceOtRow = {
  date: unknown;
  work_hours?: number | string | null;
  status?: string | null;
  check_in?: Date | string | null;
  check_out?: Date | string | null;
  check_in_client_time?: string | null;
  check_out_client_time?: string | null;
};

export type AttendanceOtSummary = {
  daysWorked: number;
  absentDays: number;
  recordCount: number;
  overtimeHours: number;
  dayOtHours: number;
  nightOtHours: number;
  holidayWorkHours: number;
  /** 지각으로 OT에서 차감된 총 시간(h) */
  lateHoursDeducted: number;
};

export function attendanceDateYmd(dateVal: unknown): string {
  if (dateVal instanceof Date && !Number.isNaN(dateVal.getTime())) {
    return dateVal.toISOString().slice(0, 10);
  }
  const s = String(dateVal || '');
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s.slice(0, 10);
}

export function isWeekendYmd(ymd: string): boolean {
  const matched = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return false;
  const y = parseInt(matched[1], 10);
  const mo = parseInt(matched[2], 10);
  const d = parseInt(matched[3], 10);
  const dt = new Date(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00${IST_OFFSET}`);
  const day = dt.getDay();
  return day === 0 || day === 6;
}

export function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseClientClockMs(ymd: string, clientTime?: string | null): number | null {
  if (!clientTime) return null;
  const iso = clientTime.match(/T(\d{2}):(\d{2})/);
  if (iso) {
    const d = new Date(`${ymd}T${iso[1]}:${iso[2]}:00${IST_OFFSET}`);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  const plain = clientTime.match(/(\d{1,2}):(\d{2})/);
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

function parseCheckInMs(row: AttendanceOtRow): number | null {
  const ymd = attendanceDateYmd(row.date);
  // 급여·OT 지각 산정은 IST 벽시계(client_time)를 우선 — DB UTC/DATE 왜곡 시 지각 0이 되는 문제 방지
  const fromClient = parseClientClockMs(ymd, row.check_in_client_time);
  if (fromClient != null) return fromClient;
  if (row.check_in) {
    const d = new Date(row.check_in);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  return null;
}

function parseCheckOutMs(row: AttendanceOtRow): number | null {
  const ymd = attendanceDateYmd(row.date);
  const fromClient = parseClientClockMs(ymd, row.check_out_client_time);
  if (fromClient != null) return fromClient;
  if (row.check_out) {
    const d = new Date(row.check_out);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  return null;
}

/** 출근 시각이 IST 09:00 이후인 경우 지각 시간(h) — OT에서 차감 */
export function computeLateHours(row: AttendanceOtRow): number {
  const checkInMs = parseCheckInMs(row);
  if (checkInMs == null) return 0;
  const ymd = attendanceDateYmd(row.date);
  const standardMs = new Date(
    `${ymd}T${String(STANDARD_CHECK_IN_HOUR_IST).padStart(2, '0')}:00:00${IST_OFFSET}`
  ).getTime();
  if (checkInMs <= standardMs) return 0;
  return roundHours((checkInMs - standardMs) / (1000 * 60 * 60));
}

function computeDayNightOtForRecord(row: AttendanceOtRow): {
  dayOt: number;
  nightOt: number;
  holidayWork: number;
} {
  const workHours = parseFloat(String(row.work_hours ?? '')) || 0;
  const ymd = attendanceDateYmd(row.date);

  if (String(row.status || '') === 'absent') {
    return { dayOt: 0, nightOt: 0, holidayWork: 0 };
  }

  if (isWeekendYmd(ymd) && workHours > 0) {
    const hours = roundHours(workHours);
    return { dayOt: 0, nightOt: 0, holidayWork: hours };
  }

  const lateHours = computeLateHours(row);
  // OT = max(0, 근무−8−지각−퇴근유예 30분)
  const totalOt = Math.max(
    0,
    workHours - STANDARD_WORK_DAY_HOURS - lateHours - OT_END_GRACE_HOURS
  );
  if (totalOt <= 0) {
    return { dayOt: 0, nightOt: 0, holidayWork: 0 };
  }

  const checkOutMs = parseCheckOutMs(row);
  if (checkOutMs == null) {
    return { dayOt: totalOt, nightOt: 0, holidayWork: 0 };
  }

  const standardEndMs = new Date(
    `${ymd}T${String(STANDARD_END_HOUR_IST).padStart(2, '0')}:00:00${IST_OFFSET}`
  ).getTime();
  /** 18:30 이전 퇴근분은 OT·야간 OT 모두 제외 */
  const otEligibleEndMs = standardEndMs + OT_END_GRACE_MINUTES * 60 * 1000;
  if (checkOutMs <= otEligibleEndMs) {
    return { dayOt: totalOt, nightOt: 0, holidayWork: 0 };
  }

  const nightWorkBeyondGrace = (checkOutMs - otEligibleEndMs) / (1000 * 60 * 60);
  const nightOt = roundHours(Math.min(totalOt, nightWorkBeyondGrace));
  const dayOt = roundHours(Math.max(0, totalOt - nightOt));
  return { dayOt, nightOt, holidayWork: 0 };
}

/** 근태·급여 공통 — OT = max(0, 근무−8−지각−0.5), 주말=휴일근무, 18:30 이후=야간 OT */
export function summarizeAttendanceOt(rows: AttendanceOtRow[]): AttendanceOtSummary {
  let dayOtHours = 0;
  let nightOtHours = 0;
  let holidayWorkHours = 0;
  let lateHoursDeducted = 0;
  let daysWorked = 0;
  let absentDays = 0;

  for (const row of rows) {
    const status = String(row.status || '');
    if (status === 'absent') {
      absentDays += 1;
      continue;
    }
    daysWorked += 1;
    const ymd = attendanceDateYmd(row.date);
    const workHours = parseFloat(String(row.work_hours ?? '')) || 0;
    if (!(isWeekendYmd(ymd) && workHours > 0) && status !== 'absent') {
      const late = computeLateHours(row);
      const otBeforeLate = Math.max(
        0,
        workHours - STANDARD_WORK_DAY_HOURS - OT_END_GRACE_HOURS
      );
      const otAfterLate = Math.max(0, otBeforeLate - late);
      lateHoursDeducted += otBeforeLate - otAfterLate;
    }
    const part = computeDayNightOtForRecord(row);
    dayOtHours += part.dayOt;
    nightOtHours += part.nightOt;
    holidayWorkHours += part.holidayWork;
  }

  return {
    daysWorked,
    absentDays,
    recordCount: rows.length,
    dayOtHours: roundHours(dayOtHours),
    nightOtHours: roundHours(nightOtHours),
    holidayWorkHours: roundHours(holidayWorkHours),
    lateHoursDeducted: roundHours(lateHoursDeducted),
    overtimeHours: roundHours(dayOtHours + nightOtHours)
  };
}
