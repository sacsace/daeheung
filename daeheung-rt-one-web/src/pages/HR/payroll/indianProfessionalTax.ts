/**
 * 인도 주(州)별 Professional Tax(PT) — 프론트 급여 그리드용
 * (서버 `daeheung-rt-one-api/src/utils/indianProfessionalTax.ts` 와 동일 규칙)
 */

export type PtSlab = { upTo: number; amount: number };

const STATE_PT_SLABS: Record<string, PtSlab[]> = {
  '27': [
    { upTo: 7500, amount: 0 },
    { upTo: 10000, amount: 175 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  '29': [
    { upTo: 15000, amount: 0 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  '19': [
    { upTo: 10000, amount: 0 },
    { upTo: 15000, amount: 110 },
    { upTo: 25000, amount: 130 },
    { upTo: 40000, amount: 150 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  '33': [
    { upTo: 21000, amount: 0 },
    { upTo: 30000, amount: 135 },
    { upTo: 45000, amount: 315 },
    { upTo: 60000, amount: 690 },
    { upTo: 75000, amount: 1025 },
    { upTo: Number.POSITIVE_INFINITY, amount: 1250 }
  ],
  '24': [
    { upTo: 5999, amount: 0 },
    { upTo: 8999, amount: 80 },
    { upTo: 11999, amount: 150 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  '36': [
    { upTo: 15000, amount: 0 },
    { upTo: 20000, amount: 150 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  '37': [
    { upTo: 15000, amount: 0 },
    { upTo: 20000, amount: 150 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  '23': [
    { upTo: 18750, amount: 0 },
    { upTo: 25000, amount: 125 },
    { upTo: 33333, amount: 167 },
    { upTo: Number.POSITIVE_INFINITY, amount: 208 }
  ],
  '21': [
    { upTo: 13304, amount: 0 },
    { upTo: 25000, amount: 125 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  '18': [
    { upTo: 10000, amount: 0 },
    { upTo: 15000, amount: 150 },
    { upTo: 25000, amount: 180 },
    { upTo: Number.POSITIVE_INFINITY, amount: 208 }
  ],
  '20': [
    { upTo: 25000, amount: 0 },
    { upTo: 41667, amount: 100 },
    { upTo: 66667, amount: 150 },
    { upTo: 83333, amount: 175 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  '22': [
    { upTo: 10000, amount: 0 },
    { upTo: 15000, amount: 150 },
    { upTo: 20000, amount: 180 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  '32': [
    { upTo: 11999, amount: 0 },
    { upTo: 17999, amount: 120 },
    { upTo: 29999, amount: 180 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  '17': [
    { upTo: 4166, amount: 0 },
    { upTo: 6250, amount: 16 },
    { upTo: 8333, amount: 25 },
    { upTo: 10416, amount: 41 },
    { upTo: 12500, amount: 62 },
    { upTo: 16666, amount: 83 },
    { upTo: 20833, amount: 104 },
    { upTo: Number.POSITIVE_INFINITY, amount: 125 }
  ],
  '16': [
    { upTo: 7500, amount: 0 },
    { upTo: 15000, amount: 150 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  '11': [
    { upTo: 20000, amount: 0 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  '10': [
    { upTo: 12500, amount: 0 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ]
};

const PT_EXEMPT_STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '07', '08', '09', '14', '15', '26', '30', '31', '34', '35', '38'
]);

const ADDRESS_STATE_HINTS: Array<{ code: string; patterns: RegExp[] }> = [
  { code: '29', patterns: [/karnataka/i, /bangalore/i, /bengaluru/i, /mysore/i, /mysuru/i] },
  { code: '27', patterns: [/maharashtra/i, /mumbai/i, /pune/i, /nagpur/i] },
  { code: '19', patterns: [/west bengal/i, /kolkata/i] },
  { code: '33', patterns: [/tamil nadu/i, /chennai/i, /coimbatore/i] },
  { code: '24', patterns: [/gujarat/i, /ahmedabad/i, /surat/i] },
  { code: '36', patterns: [/telangana/i, /hyderabad/i] },
  { code: '37', patterns: [/andhra pradesh/i, /visakhapatnam/i, /vijayawada/i] },
  { code: '32', patterns: [/kerala/i, /kochi/i, /thiruvananthapuram/i] }
];

function roundInr(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n);
}

export function normalizeIndianStateCode(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 2) return digits.slice(0, 2).padStart(2, '0');
  return null;
}

export function stateCodeFromGstNumber(gstNumber: unknown): string | null {
  const gst = String(gstNumber ?? '').trim().toUpperCase();
  if (gst.length < 2) return null;
  return normalizeIndianStateCode(gst.slice(0, 2));
}

export function stateCodeFromAddress(address: unknown): string | null {
  const text = String(address ?? '');
  if (!text.trim()) return null;
  for (const hint of ADDRESS_STATE_HINTS) {
    if (hint.patterns.some((re) => re.test(text))) return hint.code;
  }
  return null;
}

const GST_STATE_NAMES: Record<string, string> = {
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '19': 'West Bengal',
  '33': 'Tamil Nadu',
  '24': 'Gujarat',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '23': 'Madhya Pradesh',
  '21': 'Odisha',
  '18': 'Assam',
  '20': 'Jharkhand',
  '22': 'Chhattisgarh',
  '32': 'Kerala',
  '17': 'Meghalaya',
  '16': 'Tripura',
  '11': 'Sikkim',
  '10': 'Bihar',
};

export function indianStateLabel(stateCode: string | null | undefined): string {
  const code = normalizeIndianStateCode(stateCode);
  if (!code) return '';
  return GST_STATE_NAMES[code] || `State ${code}`;
}

export function resolveRegisteredStateCodeFromCompanyLike(company: {
  settings?: Record<string, unknown> | null;
  address?: string | null;
  business_number?: string | null;
  gst_numbers?: Array<string | { gst_number?: string; state_code?: string }> | null;
}): string | null {
  const settings = (company.settings && typeof company.settings === 'object'
    ? company.settings
    : {}) as Record<string, unknown>;
  const payroll = (settings.payroll && typeof settings.payroll === 'object'
    ? settings.payroll
    : {}) as Record<string, unknown>;
  const general = (settings.general && typeof settings.general === 'object'
    ? settings.general
    : {}) as Record<string, unknown>;

  const fromSettings =
    payroll.registered_state_code ??
    payroll.registeredStateCode ??
    general.registered_state_code ??
    general.registeredStateCode ??
    general.gst_state_code ??
    general.gstStateCode;
  const normalizedSettings = normalizeIndianStateCode(fromSettings);
  if (normalizedSettings) return normalizedSettings;

  const gstList = company.gst_numbers;
  if (Array.isArray(gstList) && gstList.length > 0) {
    for (const item of gstList) {
      if (typeof item === 'string') {
        const fromGst = stateCodeFromGstNumber(item);
        if (fromGst) return fromGst;
      } else if (item && typeof item === 'object') {
        const fromRow =
          normalizeIndianStateCode(item.state_code) ?? stateCodeFromGstNumber(item.gst_number);
        if (fromRow) return fromRow;
      }
    }
  }

  const fromBusiness = stateCodeFromGstNumber(company.business_number);
  if (fromBusiness) return fromBusiness;

  return stateCodeFromAddress(company.address);
}

function lookupSlabAmount(gross: number, slabs: PtSlab[]): number {
  for (const slab of slabs) {
    if (gross <= slab.upTo) return slab.amount;
  }
  return 0;
}

export type ComputeProfessionalTaxInput = {
  grossMonthly: number;
  stateCode?: string | null;
  payrollMonth?: string | null;
};

export function computeProfessionalTaxByState(input: ComputeProfessionalTaxInput): number {
  const gross = Math.max(0, Number(input.grossMonthly) || 0);
  if (gross <= 0) return 0;

  const code = normalizeIndianStateCode(input.stateCode);
  // 회사 GST 주 미확인 시에도 고액 급여는 기본 PT(₹200) 적용 — 서버와 동일
  if (!code) {
    return gross > 25000 ? 200 : 0;
  }
  if (PT_EXEMPT_STATE_CODES.has(code)) return 0;

  const slabs = STATE_PT_SLABS[code];
  if (!slabs) return gross > 25000 ? 200 : 0;

  let amount = lookupSlabAmount(gross, slabs);
  const monthNum = /^(\d{4})-(\d{2})/.exec(String(input.payrollMonth ?? '').trim())?.[2];
  if (code === '27' && monthNum === '02' && gross >= 10001) {
    amount = 300;
  }
  return roundInr(amount);
}
