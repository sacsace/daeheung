/** 급여 그리드 컬럼 순서·사용자 추가 수당 컬럼 (회사별 브라우저 저장) */

export type PayrollCustomColumnInputMode = 'amount' | 'count';

export type PayrollCustomColumn = {
  /** extra_fields.custom_allowances 키 */
  id: string;
  label: string;
  /** amount: 셀 값 = 지급액. count: 셀 값 = 횟수, formula 로 금액 산출 */
  inputMode?: PayrollCustomColumnInputMode;
  /** count 모드일 때. 변수 n = 사용자 입력 횟수. 예: n * 100 */
  formula?: string;
};

export type PayrollColumnPrefs = {
  /** DataGrid field 순서. 없는 필드는 기본 순서 뒤에 붙임 */
  order: string[];
  customColumns: PayrollCustomColumn[];
};

const STORAGE_KEY = 'mvs.payrollGrid.columnPrefs.v1';

function storageKey(companyId?: string | number | null): string {
  const id = String(companyId ?? '').trim();
  return id ? `${STORAGE_KEY}.company.${id}` : STORAGE_KEY;
}

/** 고정(시스템) 컬럼 기본 순서 — actions는 항상 맨 뒤 */
export const PAYROLL_DEFAULT_COLUMN_ORDER: string[] = [
  'row_no',
  'emp_id',
  'bank_account',
  'ifsc',
  'bank_name',
  'employee_email',
  'department',
  'employee_name',
  'employment_type',
  'joining_date',
  'working_month',
  'basic_salary',
  'house_rent_allowance',
  'other_allowance',
  'total_salary',
  'total_day_of_month',
  'unpaid_leave',
  'days_worked',
  'ot_rate',
  'day_ot_hour',
  'sum_total',
  'esic_employer',
  'pf_employer',
  'esic_employee',
  'pf_employee',
  'tds',
  'pt',
  'net_salary_payable',
  'actions',
];

export function customColumnField(id: string): string {
  return `custom__${id}`;
}

export function parseCustomColumnField(field: string): string | null {
  if (!field.startsWith('custom__')) return null;
  return field.slice('custom__'.length) || null;
}

function slugifyLabel(label: string): string {
  const base = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base || `col_${Date.now().toString(36)}`;
}

export function loadPayrollColumnPrefs(companyId?: string | number | null): PayrollColumnPrefs {
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) {
      return { order: [...PAYROLL_DEFAULT_COLUMN_ORDER], customColumns: [] };
    }
    const parsed = JSON.parse(raw) as Partial<PayrollColumnPrefs>;
    const customColumns = Array.isArray(parsed.customColumns)
      ? parsed.customColumns
          .map((c) => {
            const raw = c as PayrollCustomColumn;
            const inputMode =
              raw?.inputMode === 'count' || raw?.inputMode === 'amount' ? raw.inputMode : 'amount';
            const formula =
              inputMode === 'count' ? String(raw?.formula ?? '').trim() : undefined;
            return {
              id: String(raw?.id || '').trim(),
              label: String(raw?.label || '').trim(),
              inputMode,
              ...(formula ? { formula } : {}),
            };
          })
          .filter((c) => c.id && c.label)
      : [];
    const order = Array.isArray(parsed.order)
      ? parsed.order
          .map((f) => String(f))
          .filter((f) => Boolean(f) && f !== 'food_allowance' && f !== 'transport_allowance')
      : [...PAYROLL_DEFAULT_COLUMN_ORDER];
    return { order, customColumns };
  } catch {
    return { order: [...PAYROLL_DEFAULT_COLUMN_ORDER], customColumns: [] };
  }
}

export function savePayrollColumnPrefs(
  prefs: PayrollColumnPrefs,
  companyId?: string | number | null
): void {
  localStorage.setItem(storageKey(companyId), JSON.stringify(prefs));
}

export function mergeColumnOrder(
  savedOrder: string[],
  allFields: string[]
): string[] {
  const known = new Set(allFields);
  const result: string[] = [];
  for (const f of savedOrder) {
    if (known.has(f) && !result.includes(f)) result.push(f);
  }
  for (const f of allFields) {
    if (!result.includes(f)) {
      if (f === 'actions') continue;
      // 근무형태는 입사일 바로 앞
      if (f === 'employment_type') {
        const joinIdx = result.indexOf('joining_date');
        if (joinIdx >= 0) {
          result.splice(joinIdx, 0, f);
          continue;
        }
      }
      const actionsIdx = result.indexOf('actions');
      if (actionsIdx >= 0) result.splice(actionsIdx, 0, f);
      else result.push(f);
    }
  }
  if (known.has('actions') && !result.includes('actions')) result.push('actions');
  return ensureLeadColumns(result);
}

/** 번호·사번은 항상 앞 두 칸에 고정 */
export function ensureLeadColumns(order: string[]): string[] {
  const tail: string[] = [];
  const seen = new Set(['row_no', 'emp_id']);
  for (const f of order) {
    if (f === 'row_no' || f === 'emp_id' || f === 'actions') continue;
    if (seen.has(f)) continue;
    seen.add(f);
    tail.push(f);
  }
  const next = ['row_no', 'emp_id', ...tail];
  if (order.includes('actions')) next.push('actions');
  return next;
}

export function createCustomColumnId(label: string, existing: PayrollCustomColumn[]): string {
  let id = slugifyLabel(label);
  const used = new Set(existing.map((c) => c.id));
  if (!used.has(id)) return id;
  let n = 2;
  while (used.has(`${id}_${n}`)) n += 1;
  return `${id}_${n}`;
}

/** 사용자 추가 컬럼을 OT(시간) 바로 뒤 · 지급 합계 앞에 배치 */
export function placeCustomColumnsAfterTransport(
  order: string[],
  customFields: string[]
): string[] {
  const customSet = new Set(customFields);
  const withoutCustom = order.filter(
    (f) => !customSet.has(f) && !f.startsWith('custom__') && f !== 'transport_allowance'
  );
  const fromOrder = order.filter((f) => f.startsWith('custom__') || customSet.has(f));
  const orderedCustom: string[] = [];
  for (const f of fromOrder) {
    if (!orderedCustom.includes(f)) orderedCustom.push(f);
  }
  for (const f of customFields) {
    if (!orderedCustom.includes(f)) orderedCustom.push(f);
  }
  if (orderedCustom.length === 0) return withoutCustom;

  const otIdx = withoutCustom.indexOf('day_ot_hour');
  const sumIdx = withoutCustom.indexOf('sum_total');
  const insertAt =
    otIdx >= 0
      ? otIdx + 1
      : sumIdx >= 0
        ? sumIdx
        : Math.max(0, withoutCustom.length - 1);
  const next = [...withoutCustom];
  next.splice(insertAt, 0, ...orderedCustom);
  return next;
}

/**
 * 상수 영역 컬럼(기본급·주거·기타 + 추가 상수)을
 * 기타 수당 위치 기준 — working_month 다음 ~ total_salary 앞에 묶어서 배치.
 */
export function placeConstantPartsAfterOther(
  order: string[],
  constantFields: string[]
): string[] {
  const constSet = new Set(constantFields);
  const systemIds = ['basic_salary', 'house_rent_allowance', 'other_allowance'];
  const without = order.filter(
    (f) => !constSet.has(f) && !f.startsWith('const__') && !systemIds.includes(f)
  );
  const orderedConsts: string[] = [];
  for (const f of constantFields) {
    if (!orderedConsts.includes(f)) orderedConsts.push(f);
  }
  if (orderedConsts.length === 0) return without;

  const workingIdx = without.indexOf('working_month');
  const totalIdx = without.indexOf('total_salary');
  const insertAt =
    workingIdx >= 0
      ? workingIdx + 1
      : totalIdx >= 0
        ? totalIdx
        : Math.max(0, without.length - 1);
  const next = [...without];
  next.splice(insertAt, 0, ...orderedConsts);
  return next;
}
