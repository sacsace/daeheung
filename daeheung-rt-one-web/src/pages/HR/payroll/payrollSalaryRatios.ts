/** 급여 상수 영역(기본급·수당 등) — 항목 추가/수정/삭제 + % 분배 */

export type PayrollConstantPart = {
  id: string;
  label: string;
  pct: number;
};

/** @deprecated 구버전 localStorage — load 시 parts 로 변환 */
export type PayrollSalaryRatiosLegacy = {
  basicPct: number;
  hraPct: number;
  otherPct: number;
};

export type PayrollSalaryRatios = {
  parts: PayrollConstantPart[];
};

const STORAGE_KEY = 'mvs.payrollGrid.salaryRatios.v2';
const LEGACY_STORAGE_KEY = 'mvs.payrollGrid.salaryRatios.v1';

function storageKey(companyId?: string | number | null): string {
  const id = String(companyId ?? '').trim();
  return id ? `${STORAGE_KEY}.company.${id}` : STORAGE_KEY;
}

export const SYSTEM_CONSTANT_IDS = [
  'basic_salary',
  'house_rent_allowance',
  'other_allowance',
] as const;

export type SystemConstantId = (typeof SYSTEM_CONSTANT_IDS)[number];

export function isSystemConstantId(id: string): id is SystemConstantId {
  return (SYSTEM_CONSTANT_IDS as readonly string[]).includes(id);
}

/** DataGrid field for a constant part */
export function constantPartField(id: string): string {
  if (isSystemConstantId(id)) return id;
  return `const__${id}`;
}

export function parseConstantPartField(field: string): string | null {
  if (field === 'basic_salary' || field === 'house_rent_allowance' || field === 'other_allowance') {
    return field;
  }
  if (!field.startsWith('const__')) return null;
  return field.slice('const__'.length) || null;
}

export const DEFAULT_CONSTANT_PARTS: PayrollConstantPart[] = [
  { id: 'basic_salary', label: '기본급', pct: 50 },
  { id: 'house_rent_allowance', label: '주거 수당', pct: 30 },
  { id: 'other_allowance', label: '기타 수당', pct: 20 },
];

export const DEFAULT_SALARY_RATIOS: PayrollSalaryRatios = {
  parts: DEFAULT_CONSTANT_PARTS.map((p) => ({ ...p })),
};

/** 구 API 호환: parts → basic/hra/other % */
export function ratiosToLegacy(ratios: PayrollSalaryRatios): PayrollSalaryRatiosLegacy {
  const map = new Map(ratios.parts.map((p) => [p.id, p.pct]));
  return {
    basicPct: map.get('basic_salary') ?? 0,
    hraPct: map.get('house_rent_allowance') ?? 0,
    otherPct: map.get('other_allowance') ?? 0,
  };
}

function clampPct(n: unknown, fallback = 0): number {
  const v = typeof n === 'number' ? n : parseFloat(String(n ?? ''));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, Math.round(v * 100) / 100));
}

function slugifyId(label: string): string {
  const base = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base || `const_${Date.now().toString(36)}`;
}

export function createConstantPartId(label: string, existing: PayrollConstantPart[]): string {
  let id = slugifyId(label);
  if (isSystemConstantId(id)) id = `c_${id}`;
  const used = new Set(existing.map((p) => p.id));
  if (!used.has(id)) return id;
  let n = 2;
  while (used.has(`${id}_${n}`)) n += 1;
  return `${id}_${n}`;
}

/** % 합이 100이 아니면 비율 스케일. 빈 목록이면 기본값 */
export function normalizeSalaryRatios(
  input: PayrollSalaryRatios | PayrollSalaryRatiosLegacy | Partial<PayrollConstantPart>[]
): PayrollSalaryRatios {
  let parts: PayrollConstantPart[] = [];

  if (Array.isArray(input)) {
    parts = input.map((p) => ({
      id: String((p as PayrollConstantPart).id || '').trim(),
      label: String((p as PayrollConstantPart).label || '').trim(),
      pct: clampPct((p as PayrollConstantPart).pct, 0),
    }));
  } else if (input && typeof input === 'object' && Array.isArray((input as PayrollSalaryRatios).parts)) {
    parts = (input as PayrollSalaryRatios).parts.map((p) => ({
      id: String(p.id || '').trim(),
      label: String(p.label || '').trim(),
      pct: clampPct(p.pct, 0),
    }));
  } else if (input && typeof input === 'object' && 'basicPct' in input) {
    const leg = input as PayrollSalaryRatiosLegacy;
    parts = [
      { id: 'basic_salary', label: '기본급', pct: clampPct(leg.basicPct, 50) },
      { id: 'house_rent_allowance', label: '주거 수당', pct: clampPct(leg.hraPct, 30) },
      { id: 'other_allowance', label: '기타 수당', pct: clampPct(leg.otherPct, 20) },
    ];
  }

  parts = parts.filter((p) => p.id && p.label);
  if (parts.length === 0) {
    return { parts: DEFAULT_CONSTANT_PARTS.map((p) => ({ ...p })) };
  }

  const sum = parts.reduce((s, p) => s + p.pct, 0);
  if (sum <= 0) {
    const even = Math.floor((100 / parts.length) * 100) / 100;
    parts = parts.map((p, i) => ({
      ...p,
      pct: i === parts.length - 1 ? Math.max(0, 100 - even * (parts.length - 1)) : even,
    }));
  } else if (Math.abs(sum - 100) > 0.05) {
    parts = parts.map((p, i) => {
      if (i === parts.length - 1) {
        const prev = parts
          .slice(0, -1)
          .reduce((s, x) => s + Math.round(((x.pct / sum) * 10000) / 100), 0);
        return { ...p, pct: Math.max(0, Math.round((100 - prev) * 100) / 100) };
      }
      return { ...p, pct: Math.round((p.pct / sum) * 10000) / 100 };
    });
  }

  return { parts };
}

/** 편집 중: 마지막 항목 % = 나머지 (스케일 없음). 라벨은 trim 하지 않음(입력 중 띄어쓰기 유지). */
export function draftSalaryRatios(parts: PayrollConstantPart[]): PayrollSalaryRatios {
  const cleaned = parts
    .map((p) => ({
      id: String(p.id || '').trim(),
      label: String(p.label ?? ''),
      pct: clampPct(p.pct, 0),
    }))
    .filter((p) => p.id);
  if (cleaned.length === 0) {
    return { parts: DEFAULT_CONSTANT_PARTS.map((p) => ({ ...p })) };
  }
  if (cleaned.length === 1) {
    return { parts: [{ ...cleaned[0], pct: 100 }] };
  }
  const head = cleaned.slice(0, -1);
  const headSum = head.reduce((s, p) => s + p.pct, 0);
  const last = {
    ...cleaned[cleaned.length - 1],
    pct: Math.max(0, Math.round((100 - headSum) * 100) / 100),
  };
  return { parts: [...head, last] };
}

export function loadPayrollSalaryRatios(companyId?: string | number | null): PayrollSalaryRatios {
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (raw) {
      return normalizeSalaryRatios(JSON.parse(raw) as PayrollSalaryRatios);
    }
    const legacy = companyId == null ? localStorage.getItem(LEGACY_STORAGE_KEY) : null;
    if (legacy) {
      const migrated = normalizeSalaryRatios(JSON.parse(legacy) as PayrollSalaryRatiosLegacy);
      savePayrollSalaryRatios(migrated, companyId);
      return migrated;
    }
    return { parts: DEFAULT_CONSTANT_PARTS.map((p) => ({ ...p })) };
  } catch {
    return { parts: DEFAULT_CONSTANT_PARTS.map((p) => ({ ...p })) };
  }
}

export function savePayrollSalaryRatios(
  ratios: PayrollSalaryRatios,
  companyId?: string | number | null
): void {
  const normalized = normalizeSalaryRatios(ratios);
  localStorage.setItem(storageKey(companyId), JSON.stringify(normalized));
}

/** 패키지 금액을 parts %로 분배. 마지막에 잔액 몰아줌 */
export function splitPackageByRatios(
  packageAmount: number,
  ratios: PayrollSalaryRatios
): Record<string, number> {
  const total = Math.max(0, Math.floor(Number(packageAmount) || 0));
  const { parts } = normalizeSalaryRatios(ratios);
  const result: Record<string, number> = {};
  let allocated = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i];
    if (i === parts.length - 1) {
      result[p.id] = Math.max(0, total - allocated);
    } else {
      const amount = Math.floor((total * p.pct) / 100);
      result[p.id] = amount;
      allocated += amount;
    }
  }
  return result;
}

/** @deprecated 호환용 */
export function splitPackageByRatiosLegacy(
  packageAmount: number,
  ratios: PayrollSalaryRatios
): { basic: number; hra: number; other: number } {
  const m = splitPackageByRatios(packageAmount, ratios);
  return {
    basic: m.basic_salary ?? 0,
    hra: m.house_rent_allowance ?? 0,
    other: m.other_allowance ?? 0,
  };
}
