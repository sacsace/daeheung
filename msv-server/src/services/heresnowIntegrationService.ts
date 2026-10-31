import { Attendance, Company, User } from '../models';
import { Op } from 'sequelize';

const TIME_ZONE = 'Asia/Kolkata';

/** Canonical public origin — apex(heresnow.in)는 API/앱이 없어 www로 통일 */
export const DEFAULT_HERESNOW_ORIGIN = 'https://www.heresnow.in';

/**
 * HeresNow 베이스 URL 정규화.
 * - trailing slash 제거
 * - http → https
 * - heresnow.in(apex) → www.heresnow.in (apex는 Railway 앱이 아님)
 */
export function resolveHeresnowBaseUrl(raw?: string | null): string {
  const input = String(raw ?? process.env.HERESNOW_API_BASE_URL ?? DEFAULT_HERESNOW_ORIGIN).trim();
  if (!input) return DEFAULT_HERESNOW_ORIGIN;
  try {
    const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const u = new URL(withScheme);
    let host = u.hostname.toLowerCase();
    if (host === 'heresnow.in') host = 'www.heresnow.in';
    return `https://${host}`;
  } catch {
    return DEFAULT_HERESNOW_ORIGIN;
  }
}

export function getHeresnowLoginUrl(raw?: string | null): string {
  return `${resolveHeresnowBaseUrl(raw)}/login`;
}

async function fetchHeresnowApi(url: string, headers: Record<string, string>): Promise<Response> {
  // HTML 로그인·도메인 루프를 따라가지 않음 (ERR_TOO_MANY_REDIRECTS / HTML 응답 방지)
  const response = await fetch(url, { headers, redirect: 'manual' });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location') || '';
    throw new Error(
      `HeresNow API redirected (${response.status}${location ? ` → ${location}` : ''}). ` +
        `Set HERESNOW_API_BASE_URL to ${DEFAULT_HERESNOW_ORIGIN}`
    );
  }
  return response;
}

export type HeresnowCompanySettings = {
  enabled?: boolean;
  companyId?: string;
  externalCompanyId?: string;
  apiKey?: string;
  unregisteredUsers?: Array<{
    email?: string;
    name?: string;
    externalEmployeeId?: string;
    lastSeenAt?: string;
  }>;
  unregisteredAttendanceRecords?: Array<{
    email?: string;
    name?: string;
    externalEmployeeId?: string;
    date?: string;
    checkIn?: string;
    checkOut?: string;
    status?: string;
    lastSeenAt?: string;
  }>;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  lastSyncCount?: number;
};

export type HeresnowAttendanceRecord = {
  employeeExternalId?: string;
  externalEmployeeId?: string;
  employeeId?: string;
  userId?: string | number;
  date?: string;
  local_date?: string;
  attendanceDate?: string;
  checkIn?: string | null;
  checkOut?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  status?: string;
  type?: string;
  action?: string;
  occurredAt?: string;
  timestamp?: string;
  id?: string;
  eventId?: string;
  localDate?: string;
  employeeEmail?: string;
  email?: string;
  employeeName?: string;
  name?: string;
};

type HeresnowMvsEvent = {
  attendanceId?: string;
  localDate?: string;
  timestamp?: string;
  type?: 'CHECK_IN' | 'CHECK_OUT' | string;
  employee?: {
    externalEmployeeId?: string | null;
    id?: string | null;
    email?: string | null;
    name?: string | null;
  } | null;
};

type HeresnowMonthlyAttendanceRow = {
  date?: string;
  localDate?: string;
  attendanceDate?: string;
  checkIn?: string | { timestamp?: string | null; localTime?: string | null; time?: string | null } | null;
  checkOut?: string | { timestamp?: string | null; localTime?: string | null; time?: string | null } | null;
  check_in?: string | { timestamp?: string | null; localTime?: string | null; time?: string | null } | null;
  check_out?: string | { timestamp?: string | null; localTime?: string | null; time?: string | null } | null;
  inTime?: string | null;
  outTime?: string | null;
  clockIn?: string | null;
  clockOut?: string | null;
  status?: string;
  employeeExternalId?: string | null;
  externalEmployeeId?: string | null;
  employeeId?: string | null;
  userId?: string | number | null;
  employeeEmail?: string | null;
  email?: string | null;
  employeeName?: string | null;
  name?: string | null;
  employee?: {
    externalEmployeeId?: string | null;
    id?: string | null;
    email?: string | null;
    name?: string | null;
  } | null;
};

type HeresnowMonthlyEmployeeBundle = {
  employeeExternalId?: string | null;
  externalEmployeeId?: string | null;
  employeeId?: string | null;
  userId?: string | number | null;
  employeeEmail?: string | null;
  email?: string | null;
  employeeName?: string | null;
  name?: string | null;
  employee?: {
    externalEmployeeId?: string | null;
    id?: string | null;
    email?: string | null;
    name?: string | null;
  } | null;
  attendances?: HeresnowMonthlyAttendanceRow[];
  attendanceRecords?: HeresnowMonthlyAttendanceRow[];
  records?: HeresnowMonthlyAttendanceRow[];
  data?: HeresnowMonthlyAttendanceRow[];
  rows?: HeresnowMonthlyAttendanceRow[];
};

const pad2 = (value: number) => value.toString().padStart(2, '0');

const getDateInTimeZone = (value: Date) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(value);
};

/** Asia/Kolkata 벽시계 ISO (+05:30). toISOString() UTC를 client_time에 넣으면 표시가 5.5시간 밀린다. */
const toIstClientTimeISO = (value: Date) => {
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
  const parts = formatter.formatToParts(value);
  const lookup = (type: string) => parts.find((part) => part.type === type)?.value || '00';
  return `${lookup('year')}-${lookup('month')}-${lookup('day')}T${lookup('hour')}:${lookup('minute')}:${lookup('second')}+05:30`;
};

const looksLikeCuid = (value: string) => /^c[a-z0-9]{20,}$/i.test(value.trim());

const parseTimestamp = (value?: string | { timestamp?: string | null } | null) => {
  const raw =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object' && typeof value.timestamp === 'string'
        ? value.timestamp
        : null;
  if (!raw || typeof raw !== 'string') return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeTimeString = (value?: string | null) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const full = raw.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (full) {
    const hh = full[1];
    const mm = full[2];
    const ss = full[3] || '00';
    return `${hh}:${mm}:${ss}`;
  }
  return null;
};

const combineDateAndTimeToIso = (dateYmd?: string, time?: string | null) => {
  if (!dateYmd || !/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return undefined;
  const normalizedTime = normalizeTimeString(time);
  if (!normalizedTime) return undefined;
  return `${dateYmd}T${normalizedTime}+05:30`;
};

const getPunchTimestamp = (
  value?: string | { timestamp?: string | null } | null
) => (value && typeof value === 'object' ? value.timestamp || undefined : typeof value === 'string' ? value : undefined);

const getPunchLocalTime = (
  value?: string | { localTime?: string | null; time?: string | null } | null
) => (value && typeof value === 'object' ? value.localTime ?? value.time ?? undefined : typeof value === 'string' ? value : undefined);

const getRecordDate = (record: HeresnowAttendanceRecord): string | null => {
  if (record.local_date && /^\d{4}-\d{2}-\d{2}/.test(record.local_date)) {
    return record.local_date.slice(0, 10);
  }
  if (record.attendanceDate && /^\d{4}-\d{2}-\d{2}/.test(record.attendanceDate)) {
    return record.attendanceDate.slice(0, 10);
  }
  if (record.localDate && /^\d{4}-\d{2}-\d{2}/.test(record.localDate)) {
    return record.localDate.slice(0, 10);
  }
  if (record.date && /^\d{4}-\d{2}-\d{2}/.test(record.date)) {
    return record.date.slice(0, 10);
  }
  const byOccurred = parseTimestamp(record.occurredAt || record.timestamp);
  if (byOccurred) return getDateInTimeZone(byOccurred);
  const byCheckIn = parseTimestamp(record.checkIn || record.check_in);
  if (byCheckIn) return getDateInTimeZone(byCheckIn);
  const byCheckOut = parseTimestamp(record.checkOut || record.check_out);
  if (byCheckOut) return getDateInTimeZone(byCheckOut);
  return null;
};

const mapMvsEventToRecord = (event: HeresnowMvsEvent): HeresnowAttendanceRecord => {
  const normalizedType = String(event.type || '').toUpperCase();
  const employeeId = String(
    event.employee?.externalEmployeeId
    ?? event.employee?.id
    ?? ''
  ).trim();
  return {
    employeeExternalId: employeeId || undefined,
    externalEmployeeId: employeeId || undefined,
    date: event.localDate ? String(event.localDate).slice(0, 10) : undefined,
    type:
      normalizedType === 'CHECK_IN'
        ? 'check_in'
        : normalizedType === 'CHECK_OUT'
          ? 'check_out'
          : normalizedType.toLowerCase(),
    occurredAt: event.timestamp,
    eventId: event.attendanceId,
    employeeEmail: event.employee?.email || undefined,
    employeeName: event.employee?.name || undefined
  };
};

const mapMonthlyAttendanceRowToRecord = (row: HeresnowMonthlyAttendanceRow): HeresnowAttendanceRecord => {
  const dateYmd =
    (typeof row.date === 'string' && row.date.slice(0, 10))
    || (typeof row.localDate === 'string' && row.localDate.slice(0, 10))
    || (typeof row.attendanceDate === 'string' && row.attendanceDate.slice(0, 10))
    || undefined;
  const checkIn =
    getPunchTimestamp(row.checkIn)
    || getPunchTimestamp(row.check_in)
    || combineDateAndTimeToIso(dateYmd, getPunchLocalTime(row.checkIn) ?? getPunchLocalTime(row.check_in) ?? row.inTime ?? row.clockIn)
    || (typeof row.checkIn === 'string' ? row.checkIn : undefined)
    || (typeof row.check_in === 'string' ? row.check_in : undefined);
  const checkOut =
    getPunchTimestamp(row.checkOut)
    || getPunchTimestamp(row.check_out)
    || combineDateAndTimeToIso(dateYmd, getPunchLocalTime(row.checkOut) ?? getPunchLocalTime(row.check_out) ?? row.outTime ?? row.clockOut)
    || (typeof row.checkOut === 'string' ? row.checkOut : undefined)
    || (typeof row.check_out === 'string' ? row.check_out : undefined);
  const externalEmployeeId = String(
    row.employeeExternalId
    ?? row.externalEmployeeId
    ?? row.employeeId
    ?? row.userId
    ?? row.employee?.externalEmployeeId
    ?? row.employee?.id
    ?? ''
  ).trim();

  return {
    date: dateYmd,
    checkIn,
    checkOut,
    check_in: checkIn,
    check_out: checkOut,
    status: typeof row.status === 'string' ? row.status : undefined,
    employeeExternalId: externalEmployeeId || undefined,
    externalEmployeeId: externalEmployeeId || undefined,
    employeeEmail: String(row.employeeEmail ?? row.email ?? row.employee?.email ?? '').trim() || undefined,
    employeeName: String(row.employeeName ?? row.name ?? row.employee?.name ?? '').trim() || undefined
  };
};

const mapMonthlyEmployeeBundleToRecords = (bundle: HeresnowMonthlyEmployeeBundle): HeresnowAttendanceRecord[] => {
  const rows =
    (Array.isArray(bundle.attendances) && bundle.attendances)
    || (Array.isArray(bundle.attendanceRecords) && bundle.attendanceRecords)
    || (Array.isArray(bundle.records) && bundle.records)
    || (Array.isArray(bundle.data) && bundle.data)
    || (Array.isArray(bundle.rows) && bundle.rows)
    || [];

  if (!Array.isArray(rows) || rows.length === 0) return [];

  const inheritedExternalId = String(
    bundle.employeeExternalId
    ?? bundle.externalEmployeeId
    ?? bundle.employeeId
    ?? bundle.userId
    ?? bundle.employee?.externalEmployeeId
    ?? bundle.employee?.id
    ?? ''
  ).trim();
  const inheritedEmail = String(bundle.employeeEmail ?? bundle.email ?? bundle.employee?.email ?? '').trim();
  const inheritedName = String(bundle.employeeName ?? bundle.name ?? bundle.employee?.name ?? '').trim();

  return rows.map((row) => {
    const mapped = mapMonthlyAttendanceRowToRecord(row);
    if (!mapped.employeeExternalId && inheritedExternalId) {
      mapped.employeeExternalId = inheritedExternalId;
      mapped.externalEmployeeId = inheritedExternalId;
    }
    if (!mapped.employeeEmail && inheritedEmail) mapped.employeeEmail = inheritedEmail;
    if (!mapped.employeeName && inheritedName) mapped.employeeName = inheritedName;
    return mapped;
  });
};

const extractAttendanceRowsFromPayload = (payload: any): HeresnowAttendanceRecord[] => {
  if (Array.isArray(payload)) return payload as HeresnowAttendanceRecord[];
  if (!payload || typeof payload !== 'object') return [];

  const rootMonthly = Array.isArray(payload.employeeAttendance)
    ? payload.employeeAttendance.flatMap((entry: HeresnowMonthlyAttendanceRow | HeresnowMonthlyEmployeeBundle) => {
      const bundle = entry as HeresnowMonthlyEmployeeBundle;
      if (
        bundle
        && typeof bundle === 'object'
        && (
          Array.isArray(bundle.attendances)
          || Array.isArray(bundle.attendanceRecords)
          || Array.isArray(bundle.records)
          || Array.isArray(bundle.data)
          || Array.isArray(bundle.rows)
        )
      ) {
        return mapMonthlyEmployeeBundleToRecords(bundle);
      }
      return [mapMonthlyAttendanceRowToRecord(entry as HeresnowMonthlyAttendanceRow)];
    })
    : [];
  if (rootMonthly.length > 0) return rootMonthly;

  if (Array.isArray(payload.data)) return payload.data as HeresnowAttendanceRecord[];

  if (payload.data && typeof payload.data === 'object') {
    const nestedMonthly = Array.isArray(payload.data.employeeAttendance)
      ? payload.data.employeeAttendance.flatMap((entry: HeresnowMonthlyAttendanceRow | HeresnowMonthlyEmployeeBundle) => {
        const bundle = entry as HeresnowMonthlyEmployeeBundle;
        if (
          bundle
          && typeof bundle === 'object'
          && (
            Array.isArray(bundle.attendances)
            || Array.isArray(bundle.attendanceRecords)
            || Array.isArray(bundle.records)
            || Array.isArray(bundle.data)
            || Array.isArray(bundle.rows)
          )
        ) {
          return mapMonthlyEmployeeBundleToRecords(bundle);
        }
        return [mapMonthlyAttendanceRowToRecord(entry as HeresnowMonthlyAttendanceRow)];
      })
      : [];
    if (nestedMonthly.length > 0) return nestedMonthly;
    if (Array.isArray(payload.data.records)) return payload.data.records as HeresnowAttendanceRecord[];
    if (Array.isArray(payload.data.items)) return payload.data.items as HeresnowAttendanceRecord[];
  }

  if (Array.isArray(payload.records)) return payload.records as HeresnowAttendanceRecord[];
  if (Array.isArray(payload.items)) return payload.items as HeresnowAttendanceRecord[];
  if (Array.isArray(payload.attendanceRecords)) return payload.attendanceRecords as HeresnowAttendanceRecord[];
  if (Array.isArray(payload.events)) return payload.events.map((event: HeresnowMvsEvent) => mapMvsEventToRecord(event));
  return [];
};

const calculateWorkHours = (checkIn: Date | null, checkOut: Date | null) => {
  if (!checkIn || !checkOut) return null;
  const diffMs = checkOut.getTime() - checkIn.getTime();
  if (diffMs < 0) return null;
  return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
};

const normalizeEventType = (record: HeresnowAttendanceRecord) => {
  const raw = String(record.type || record.action || '').trim().toLowerCase();
  if (['check_in', 'checkin', 'clock_in', 'clockin', 'in', 'punch_in'].includes(raw)) return 'check_in';
  if (['check_out', 'checkout', 'clock_out', 'clockout', 'out', 'punch_out'].includes(raw)) return 'check_out';
  if (record.checkIn || record.check_in) return 'check_in';
  if (record.checkOut || record.check_out) return 'check_out';
  return raw || 'record';
};

const getEmployeeExternalId = (record: HeresnowAttendanceRecord) =>
  String(
    record.employeeExternalId
    ?? record.externalEmployeeId
    ?? record.employeeId
    ?? record.userId
    ?? ''
  ).trim();

const getEmployeeEmail = (record: HeresnowAttendanceRecord) =>
  String(record.employeeEmail ?? record.email ?? '').trim().toLowerCase();

const getAttendanceIdentityKey = (record: HeresnowAttendanceRecord) => {
  const explicitId = String(record.id ?? record.eventId ?? '').trim();
  if (explicitId) return `id:${explicitId}`;

  const employeeKey =
    getEmployeeEmail(record)
    || getEmployeeExternalId(record)
    || String(record.userId ?? '').trim()
    || 'unknown_employee';
  const dateKey = getRecordDate(record) || 'unknown_date';
  const eventType = normalizeEventType(record);
  const checkIn = parseTimestamp(record.checkIn ?? record.check_in)?.toISOString() || String(record.checkIn ?? record.check_in ?? '').trim();
  const checkOut = parseTimestamp(record.checkOut ?? record.check_out)?.toISOString() || String(record.checkOut ?? record.check_out ?? '').trim();

  return `composite:${employeeKey}|${dateKey}|${eventType}|${checkIn}|${checkOut}`;
};

const dedupeAttendanceRows = (rows: HeresnowAttendanceRecord[]) => {
  const seen = new Set<string>();
  const unique: HeresnowAttendanceRecord[] = [];

  for (const row of rows) {
    const key = getAttendanceIdentityKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  return unique;
};

export const getHeresnowSettings = (company: Company): HeresnowCompanySettings => {
  const settings = (company.settings || {}) as Record<string, unknown>;
  const integrations = (settings.integrations || {}) as Record<string, unknown>;
  const heresnow = (integrations.heresnow || {}) as HeresnowCompanySettings;
  const apiKey = typeof heresnow.apiKey === 'string' ? heresnow.apiKey.trim() : '';
  return {
    enabled: Boolean(heresnow.enabled),
    companyId: heresnow.companyId ? String(heresnow.companyId) : String(company.id),
    externalCompanyId: heresnow.externalCompanyId ? String(heresnow.externalCompanyId) : String(company.id),
    apiKey: apiKey || undefined,
    unregisteredUsers: Array.isArray(heresnow.unregisteredUsers) ? heresnow.unregisteredUsers : [],
    unregisteredAttendanceRecords: Array.isArray(heresnow.unregisteredAttendanceRecords) ? heresnow.unregisteredAttendanceRecords : [],
    lastSyncAt: heresnow.lastSyncAt ?? null,
    lastSyncError: heresnow.lastSyncError ?? null,
    lastSyncCount: typeof heresnow.lastSyncCount === 'number' ? heresnow.lastSyncCount : 0
  };
};

export const mergeHeresnowSettings = (
  company: Company,
  patch: Partial<HeresnowCompanySettings>
) => {
  const settings = { ...(company.settings || {}) } as Record<string, unknown>;
  const integrations = { ...((settings.integrations || {}) as Record<string, unknown>) };
  const current = getHeresnowSettings(company);
  integrations.heresnow = {
    ...current,
    ...patch
  };
  settings.integrations = integrations;
  return settings;
};

export async function findCompanyByExternalId(externalCompanyId: string) {
  const normalized = String(externalCompanyId || '').trim();
  if (!normalized) return null;

  const numericId = parseInt(normalized, 10);
  if (Number.isFinite(numericId)) {
    const byId = await Company.findByPk(numericId);
    if (byId) return byId;
  }

  const companies = await Company.findAll();
  for (const company of companies) {
    const hn = getHeresnowSettings(company);
    if (
      hn.enabled
      && (
        hn.externalCompanyId === normalized
        || hn.companyId === normalized
      )
    ) {
      return company;
    }
  }

  return null;
}

export async function findUserByExternalEmployeeId(company: Company, externalEmployeeId: string) {
  const normalized = String(externalEmployeeId || '').trim();
  if (!normalized) return null;

  const numericId = parseInt(normalized, 10);
  if (Number.isFinite(numericId)) {
    const byId = await User.findOne({
      where: {
        id: numericId,
        company_id: company.id,
        tenant_id: company.tenant_id,
        status: 'active'
      }
    });
    if (byId) return byId;
  }

  const byEmployeeNumber = await User.findOne({
    where: {
      employee_number: normalized,
      company_id: company.id,
      tenant_id: company.tenant_id,
      status: 'active'
    }
  });
  if (byEmployeeNumber) return byEmployeeNumber;

  return User.findOne({
    where: {
      userid: normalized,
      company_id: company.id,
      tenant_id: company.tenant_id,
      status: 'active'
    }
  });
}

export async function findUserByHeresnowRecord(company: Company, record: HeresnowAttendanceRecord) {
  const email = getEmployeeEmail(record);
  if (email) {
    const byEmail = await User.findOne({
      where: {
        email,
        company_id: company.id,
        tenant_id: company.tenant_id,
        status: 'active'
      }
    });
    if (byEmail) return byEmail;
  }

  const externalEmployeeId = getEmployeeExternalId(record);
  if (!externalEmployeeId) return null;
  return findUserByExternalEmployeeId(company, externalEmployeeId);
}

async function upsertAttendanceRecord(
  company: Company,
  user: User,
  input: {
    date: string;
    checkIn?: Date | null;
    checkOut?: Date | null;
    status?: string;
    noteTag?: string;
  }
) {
  const date = input.date.slice(0, 10);
  const attendance = await Attendance.findOne({
    where: {
      user_id: user.id,
      date,
      tenant_id: company.tenant_id,
      company_id: company.id
    }
  });

  const checkIn = input.checkIn ?? (attendance?.check_in ? new Date(attendance.check_in) : null);
  const checkOut = input.checkOut ?? (attendance?.check_out ? new Date(attendance.check_out) : null);
  const workHours = calculateWorkHours(checkIn, checkOut);

  let status: 'normal' | 'late' | 'early' | 'overtime' | 'absent' = 'normal';
  const rawStatus = String(input.status || '').trim().toLowerCase();
  if (['late', 'early', 'overtime', 'absent', 'normal'].includes(rawStatus)) {
    status = rawStatus as typeof status;
  } else if (checkIn) {
    const standardTime = new Date(`${date}T09:00:00+05:30`);
    status = checkIn.getTime() > standardTime.getTime() ? 'late' : 'normal';
  }

  const notes = input.noteTag ? `[HeresNow] ${input.noteTag}` : '[HeresNow] synced';
  const checkInClientTime = checkIn ? toIstClientTimeISO(checkIn) : undefined;
  const checkOutClientTime = checkOut ? toIstClientTimeISO(checkOut) : undefined;

  if (attendance) {
    if (input.checkIn) {
      attendance.check_in = checkIn;
      attendance.check_in_client_time = checkInClientTime;
    }
    if (input.checkOut) {
      attendance.check_out = checkOut;
      attendance.check_out_client_time = checkOutClientTime;
    }
    attendance.work_hours = workHours ?? attendance.work_hours;
    attendance.status = status;
    attendance.notes = attendance.notes ? `${attendance.notes}\n${notes}` : notes;
    await attendance.save();
    return attendance;
  }

  return Attendance.create({
    tenant_id: company.tenant_id,
    company_id: company.id,
    user_id: user.id,
    date,
    check_in: checkIn ?? undefined,
    check_out: checkOut ?? undefined,
    check_in_client_time: checkInClientTime,
    check_out_client_time: checkOutClientTime,
    work_hours: workHours ?? undefined,
    status,
    notes,
    ...( { is_active: true } as any )
  });
}

export async function applyHeresnowRecord(company: Company, record: HeresnowAttendanceRecord) {
  const employeeExternalId = getEmployeeExternalId(record);
  const employeeEmail = getEmployeeEmail(record);
  if (!employeeExternalId && !employeeEmail) {
    throw new Error('EMPLOYEE_ID_REQUIRED');
  }

  const user = await findUserByHeresnowRecord(company, record);
  if (!user) {
    const key = employeeEmail || employeeExternalId;
    throw new Error(`EMPLOYEE_NOT_FOUND:${key}`);
  }

  const occurredAt = parseTimestamp(record.occurredAt || record.timestamp);
  const explicitCheckIn = parseTimestamp(record.checkIn || record.check_in);
  const explicitCheckOut = parseTimestamp(record.checkOut || record.check_out);
  const eventType = normalizeEventType(record);

  let date = record.date ? String(record.date).slice(0, 10) : null;
  if (!date && occurredAt) date = getDateInTimeZone(occurredAt);
  if (!date && explicitCheckIn) date = getDateInTimeZone(explicitCheckIn);
  if (!date && explicitCheckOut) date = getDateInTimeZone(explicitCheckOut);
  if (!date) {
    throw new Error('DATE_REQUIRED');
  }

  if (explicitCheckIn || explicitCheckOut) {
    return upsertAttendanceRecord(company, user, {
      date,
      checkIn: explicitCheckIn,
      checkOut: explicitCheckOut,
      status: record.status,
      noteTag: 'record'
    });
  }

  if (eventType === 'check_in' && occurredAt) {
    return upsertAttendanceRecord(company, user, {
      date,
      checkIn: occurredAt,
      status: record.status,
      noteTag: record.id || record.eventId || 'check_in'
    });
  }

  if (eventType === 'check_out' && occurredAt) {
    return upsertAttendanceRecord(company, user, {
      date,
      checkOut: occurredAt,
      status: record.status,
      noteTag: record.id || record.eventId || 'check_out'
    });
  }

  throw new Error('UNSUPPORTED_EVENT');
}

export async function processHeresnowDispatch(body: any) {
  const externalCompanyId = String(
    body?.externalCompanyId ?? body?.companyId ?? body?.company_id ?? ''
  ).trim();

  const company = externalCompanyId
    ? await findCompanyByExternalId(externalCompanyId)
    : null;

  if (!company) {
    throw new Error('COMPANY_NOT_FOUND');
  }

  const hn = getHeresnowSettings(company);
  if (!hn.enabled) {
    throw new Error('INTEGRATION_DISABLED');
  }

  const events: HeresnowAttendanceRecord[] = Array.isArray(body?.events)
    ? body.events
    : Array.isArray(body?.records)
      ? body.records
      : body && typeof body === 'object' && getEmployeeExternalId(body)
        ? [body as HeresnowAttendanceRecord]
        : [];

  if (events.length === 0) {
    throw new Error('EVENTS_REQUIRED');
  }

  const results: Array<{ ok: boolean; error?: string; employeeExternalId?: string }> = [];
  let applied = 0;

  for (const event of events) {
    try {
      await applyHeresnowRecord(company, event);
      applied += 1;
      results.push({ ok: true, employeeExternalId: getEmployeeExternalId(event) });
    } catch (error: any) {
      results.push({
        ok: false,
        employeeExternalId: getEmployeeExternalId(event),
        error: error?.message || 'FAILED'
      });
    }
  }

  await company.update({
    settings: mergeHeresnowSettings(company, {
      lastSyncAt: new Date().toISOString(),
      lastSyncCount: applied,
      lastSyncError: applied === events.length ? null : 'partial_failure'
    })
  });

  return { companyId: company.id, applied, total: events.length, results };
}

export async function pullHeresnowAttendance(company: Company, options?: { since?: string; dryRun?: boolean }) {
  const hn = getHeresnowSettings(company);
  if (!hn.enabled) {
    throw new Error('INTEGRATION_DISABLED');
  }

  const apiKey =
    (typeof hn.apiKey === 'string' && hn.apiKey.trim())
    || process.env.MVS_INTEGRATION_API_KEY
    || process.env.HERESNOW_INTEGRATION_API_KEY;
  if (!apiKey) {
    throw new Error('API_KEY_NOT_CONFIGURED');
  }

  const baseUrl = resolveHeresnowBaseUrl();
  const url = new URL(`${baseUrl}/api/integrations/mvs/attendance`);
  const companyId = hn.companyId || String(company.id);
  const externalCompanyId = hn.externalCompanyId || String(company.id);
  url.searchParams.set('companyId', companyId);
  url.searchParams.set('externalCompanyId', externalCompanyId);
  // since 파라미터는 HeresNow 쿼리 의미가 월 조회와 다를 수 있어
  // 여기서는 원격에 전달하지 않고 MVS에서 월 범위를 강제 필터링한다.

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    'x-mvs-api-key': apiKey
  };
  const webhookBearer = process.env.MVS_WEBHOOK_BEARER;
  if (webhookBearer) {
    headers['X-MVS-Webhook-Bearer'] = webhookBearer;
  }

  type PullStatusKey = 'NO_STATUS' | 'PENDING' | 'DELIVERED';
  const queryModes: Array<{ key: PullStatusKey; status?: 'PENDING' | 'DELIVERED' }> = options?.since
    ? [
      { key: 'NO_STATUS' },
      { key: 'PENDING', status: 'PENDING' },
      { key: 'DELIVERED', status: 'DELIVERED' }
    ]
    : [{ key: 'NO_STATUS' }, { key: 'PENDING', status: 'PENDING' }];
  const sinceYmd = options?.since && /^\d{4}-\d{2}-\d{2}/.test(options.since) ? options.since.slice(0, 10) : null;
  const monthParam = sinceYmd ? sinceYmd.slice(0, 7) : undefined;
  let monthEndYmd: string | null = null;
  if (sinceYmd) {
    const year = parseInt(sinceYmd.slice(0, 4), 10);
    const month = parseInt(sinceYmd.slice(5, 7), 10);
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    monthEndYmd = `${endYear}-${pad2(endMonth)}-01`;
  }
  const rows: HeresnowAttendanceRecord[] = [];
  const debug = {
    sinceYmd,
    monthEndYmd,
    fetch: {
      NO_STATUS: { pages: 0, rawRows: 0, acceptedRows: 0, errors: 0, statuses: [] as number[], firstKeys: [] as string[] },
      PENDING: { pages: 0, rawRows: 0, acceptedRows: 0, errors: 0, statuses: [] as number[], firstKeys: [] as string[] },
      DELIVERED: { pages: 0, rawRows: 0, acceptedRows: 0, errors: 0, statuses: [] as number[], firstKeys: [] as string[] }
    },
    sampleDates: [] as string[],
    dedup: {
      before: 0,
      after: 0,
      removed: 0
    }
  };

  let successfulModeCount = 0;
  let authFailureCount = 0;
  let notFoundCount = 0;
  for (const mode of queryModes) {
    let cursor: string | null = null;
    for (let i = 0; i < 50; i += 1) {
      const pageUrl = new URL(url.toString());
      if (mode.status) {
        pageUrl.searchParams.set('status', mode.status);
      }
      if (monthParam) {
        pageUrl.searchParams.set('month', monthParam);
      }
      pageUrl.searchParams.set('limit', '200');
      if (cursor) pageUrl.searchParams.set('cursor', cursor);

      const response = await fetchHeresnowApi(pageUrl.toString(), headers);
      const payload = (await response.json().catch(() => ({}))) as any;
      debug.fetch[mode.key].statuses.push(response.status);
      if (debug.fetch[mode.key].pages === 0 && payload && typeof payload === 'object' && !Array.isArray(payload)) {
        debug.fetch[mode.key].firstKeys = Object.keys(payload).slice(0, 20);
      }

      if (!response.ok) {
        debug.fetch[mode.key].errors += 1;
        const message =
          typeof payload === 'object' && payload && !Array.isArray(payload)
            ? (typeof payload.message === 'string'
              ? payload.message
              : typeof payload.error === 'string'
                ? payload.error
                : `HeresNow API ${response.status}`)
            : `HeresNow API ${response.status}`;

        // 404/204: 해당 조회 모드에 데이터 없음 → 다음 모드 시도
        if (response.status === 404 || response.status === 204) {
          notFoundCount += 1;
          break;
        }
        // 401/403: 모드마다 다를 수 있어 즉시 중단하지 않고 다음 모드 시도
        // (월 데이터 없음/필터 미지원을 401로 주는 경우도 있어 동기화는 아래 empty 로 처리)
        if (response.status === 401 || response.status === 403) {
          authFailureCount += 1;
          break;
        }
        // 일부 환경에서 status 쿼리를 허용하지 않을 수 있으므로 모드 단위 실패는 건너뛴다.
        if (i === 0) break;
        throw new Error(message);
      }
      successfulModeCount += i === 0 ? 1 : 0;

      const pageRows = extractAttendanceRowsFromPayload(payload);
      debug.fetch[mode.key].pages += 1;
      debug.fetch[mode.key].rawRows += pageRows.length;

      if (sinceYmd) {
        const accepted = pageRows.filter((row) => {
          const rowDate = getRecordDate(row);
          if (rowDate && debug.sampleDates.length < 8) debug.sampleDates.push(rowDate);
          return rowDate
            ? (rowDate >= sinceYmd && (!monthEndYmd || rowDate < monthEndYmd))
            : false;
        });
        debug.fetch[mode.key].acceptedRows += accepted.length;
        rows.push(...accepted);
      } else {
        rows.push(...pageRows);
        debug.fetch[mode.key].acceptedRows += pageRows.length;
      }

      const nextCursor =
        !Array.isArray(payload) && payload
          ? (payload.nextCursor || payload.next_cursor || payload.cursor || null)
          : null;
      if (
        !payload
        || Array.isArray(payload)
        || !nextCursor
      ) {
        break;
      }
      cursor = nextCursor;
    }
  }
  if (successfulModeCount === 0) {
    // 월 지정 동기화: 원격이 비었거나 기간/필터 미지원(401·404)이어도 "데이터 없음"으로 성공 처리
    if (sinceYmd || notFoundCount > 0) {
      const emptyDebug = {
        ...debug,
        remoteEmpty: true,
        authFailureCount,
        notFoundCount
      };
      if (options?.dryRun) {
        return {
          applied: 0,
          total: 0,
          errors: [],
          unregisteredUsers: [],
          debug: emptyDebug
        };
      }
      await company.update({
        settings: mergeHeresnowSettings(company, {
          lastSyncAt: new Date().toISOString(),
          lastSyncCount: 0,
          lastSyncError: null
        })
      });
      return {
        applied: 0,
        total: 0,
        errors: [],
        unregisteredUsers: [],
        unregisteredAttendanceRecords: [],
        debug: emptyDebug
      };
    }
    if (authFailureCount > 0) {
      throw new Error('Unauthorized');
    }
    throw new Error('HeresNow API 응답을 확인할 수 없습니다. status 파라미터/권한 설정을 확인해주세요.');
  }

  const uniqueRows = dedupeAttendanceRows(rows);
  debug.dedup.before = rows.length;
  debug.dedup.after = uniqueRows.length;
  debug.dedup.removed = rows.length - uniqueRows.length;

  if (options?.dryRun) {
    return {
      applied: 0,
      total: uniqueRows.length,
      errors: [],
      unregisteredUsers: [],
      debug
    };
  }

  let applied = 0;
  const errors: string[] = [];
  const unregisteredMap = new Map<string, {
    email?: string;
    name?: string;
    externalEmployeeId?: string;
    lastSeenAt: string;
  }>();
  const unregisteredAttendanceMap = new Map<string, {
    email?: string;
    name?: string;
    externalEmployeeId?: string;
    date?: string;
    checkIn?: string;
    checkOut?: string;
    status?: string;
    lastSeenAt: string;
  }>();

  // HeresNow 에 해당 월 데이터가 0건이면 기존 MVS 근태를 지우지 않음
  // (빈 응답으로 월 전체를 날리면 UI가 비고, 연동 오류처럼 보임)
  if (sinceYmd && /^\d{4}-\d{2}-\d{2}$/.test(sinceYmd) && uniqueRows.length > 0) {
    const nextMonthStart = monthEndYmd as string;

    await Attendance.destroy({
      where: {
        tenant_id: company.tenant_id,
        company_id: company.id,
        date: {
          [Op.gte]: sinceYmd,
          [Op.lt]: nextMonthStart
        }
      }
    });
  }

  for (const row of uniqueRows) {
    try {
      await applyHeresnowRecord(company, row);
      applied += 1;
    } catch (error: any) {
      const message = error?.message || 'sync_failed';
      errors.push(message);
      if (typeof message === 'string' && message.startsWith('EMPLOYEE_NOT_FOUND:')) {
        const email = getEmployeeEmail(row) || undefined;
        const externalEmployeeId = getEmployeeExternalId(row) || undefined;
        const name = String(row.employeeName ?? row.name ?? '').trim() || undefined;
        const key = email || externalEmployeeId || message;
        if (!unregisteredMap.has(key)) {
          unregisteredMap.set(key, {
            email,
            name,
            externalEmployeeId,
            lastSeenAt: new Date().toISOString()
          });
        }

        const date = getRecordDate(row) || undefined;
        const identity = email || externalEmployeeId || name || '';
        if (date && identity) {
          const attendanceKey = `${identity}:${date}`;
          const checkIn =
            parseTimestamp(row.checkIn ?? row.check_in)?.toISOString()
            || (typeof row.checkIn === 'string' ? row.checkIn : undefined)
            || (typeof row.check_in === 'string' ? row.check_in : undefined);
          const checkOut =
            parseTimestamp(row.checkOut ?? row.check_out)?.toISOString()
            || (typeof row.checkOut === 'string' ? row.checkOut : undefined)
            || (typeof row.check_out === 'string' ? row.check_out : undefined);
          const current = unregisteredAttendanceMap.get(attendanceKey);
          const currentScore =
            (current?.checkIn ? 1 : 0)
            + (current?.checkOut ? 2 : 0)
            + (current?.status === 'absent' ? 1 : 0);
          const nextScore =
            (checkIn ? 1 : 0)
            + (checkOut ? 2 : 0)
            + (row.status === 'absent' ? 1 : 0);
          if (!current || nextScore >= currentScore) {
            unregisteredAttendanceMap.set(attendanceKey, {
              email,
              name,
              externalEmployeeId,
              date,
              checkIn,
              checkOut,
              status: typeof row.status === 'string' ? row.status : undefined,
              lastSeenAt: new Date().toISOString()
            });
          }
        }
      }
    }
  }

  const unregisteredUsers = Array.from(unregisteredMap.values());
  const unregisteredAttendanceRecords = Array.from(unregisteredAttendanceMap.values())
    .sort((a, b) => {
      const aKey = `${a.email || ''}|${a.externalEmployeeId || ''}|${a.date || ''}`;
      const bKey = `${b.email || ''}|${b.externalEmployeeId || ''}|${b.date || ''}`;
      return aKey.localeCompare(bKey);
    });

  await company.update({
    settings: mergeHeresnowSettings(company, {
      lastSyncAt: new Date().toISOString(),
      lastSyncCount: applied,
      lastSyncError: errors.length ? errors.slice(0, 3).join('; ') : null,
      unregisteredUsers,
      unregisteredAttendanceRecords
    })
  });

  return { applied, total: uniqueRows.length, errors, unregisteredUsers, unregisteredAttendanceRecords, debug };
}

export async function testHeresnowConnection(company: Company) {
  const hn = getHeresnowSettings(company);
  if (!hn.enabled) {
    throw new Error('INTEGRATION_DISABLED');
  }

  const apiKey =
    (typeof hn.apiKey === 'string' && hn.apiKey.trim())
    || process.env.MVS_INTEGRATION_API_KEY
    || process.env.HERESNOW_INTEGRATION_API_KEY;
  if (!apiKey) {
    throw new Error('API_KEY_NOT_CONFIGURED');
  }

  const baseUrl = resolveHeresnowBaseUrl();
  const url = new URL(`${baseUrl}/api/integrations/mvs/attendance`);
  const companyId = hn.companyId || String(company.id);
  const externalCompanyId = hn.externalCompanyId || String(company.id);
  url.searchParams.set('companyId', companyId);
  url.searchParams.set('externalCompanyId', externalCompanyId);
  url.searchParams.set('limit', '1');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
    'x-mvs-api-key': apiKey
  };

  const response = await fetchHeresnowApi(url.toString(), headers);
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    error?: unknown;
    count?: number;
  };

  // 데이터 없음(404/204)은 연동 자체는 성공 — 미리보기 0건
  if (response.status === 404 || response.status === 204) {
    return {
      ok: true,
      companyId: hn.companyId || String(company.id),
      externalCompanyId: hn.externalCompanyId || String(company.id),
      previewCount: 0,
      empty: true
    };
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload
        ? (typeof payload.message === 'string'
          ? payload.message
          : typeof payload.error === 'string'
            ? payload.error
            : `HeresNow API ${response.status}`)
        : `HeresNow API ${response.status}`;
    throw new Error(message);
  }

  const rows = extractAttendanceRowsFromPayload(payload);
  return {
    ok: true,
    companyId: hn.companyId || String(company.id),
    externalCompanyId: hn.externalCompanyId || String(company.id),
    previewCount: typeof payload.count === 'number' ? payload.count : rows.length
  };
}

export function verifyHeresnowDispatchAuth(headers: Record<string, unknown>) {
  const dispatchSecret = process.env.INTEGRATION_DISPATCH_SECRET;
  const webhookBearer = process.env.MVS_WEBHOOK_BEARER;

  if (!dispatchSecret && !webhookBearer) {
    return false;
  }

  const authHeader = String(headers.authorization || headers.Authorization || '');
  if (webhookBearer && authHeader === `Bearer ${webhookBearer}`) {
    return true;
  }

  const integrationSecret = String(headers['x-integration-secret'] || headers['X-Integration-Secret'] || '');
  if (dispatchSecret && integrationSecret && integrationSecret === dispatchSecret) {
    return true;
  }

  return false;
}

export function isManualAttendanceDisabled(company: Company): boolean {
  return Boolean(getHeresnowSettings(company).enabled);
}

export async function getHeresnowIntegrationStatus(company: Company) {
  const hn = getHeresnowSettings(company);
  const effectiveApiKey =
    (typeof hn.apiKey === 'string' && hn.apiKey.trim())
    || process.env.MVS_INTEGRATION_API_KEY
    || process.env.HERESNOW_INTEGRATION_API_KEY;
  const apiConfigured = Boolean(effectiveApiKey);
  const dispatchConfigured = Boolean(process.env.INTEGRATION_DISPATCH_SECRET || process.env.MVS_WEBHOOK_BEARER);
  const apiKeyHint =
    typeof effectiveApiKey === 'string' && effectiveApiKey.trim().length >= 4
      ? `••••${effectiveApiKey.trim().slice(-4)}`
      : null;
  const apiKeyMasked = (() => {
    if (typeof effectiveApiKey !== 'string') return null;
    const raw = effectiveApiKey.trim();
    if (!raw) return null;
    const maskLength = Math.max(1, Math.floor(raw.length * 0.7));
    const visible = raw.slice(maskLength);
    return `${'*'.repeat(maskLength)}${visible}`;
  })();

  return {
    enabled: hn.enabled,
    companyId: hn.companyId || String(company.id),
    externalCompanyId: hn.externalCompanyId || String(company.id),
    apiKeyHint,
    apiKeyMasked,
    unregisteredUsers: hn.unregisteredUsers || [],
    unregisteredAttendanceRecords: hn.unregisteredAttendanceRecords || [],
    unregisteredCount: Array.isArray(hn.unregisteredUsers) ? hn.unregisteredUsers.length : 0,
    lastSyncAt: hn.lastSyncAt,
    lastSyncError: hn.lastSyncError,
    lastSyncCount: hn.lastSyncCount ?? 0,
    heresnowUrl: resolveHeresnowBaseUrl(),
    heresnowLoginUrl: getHeresnowLoginUrl(),
    apiConfigured,
    dispatchConfigured,
    webhookPath: '/api/integrations/mvs/dispatch',
    manualClockDisabled: Boolean(hn.enabled),
  };
}
