/**
 * 인도 주(州)별 Professional Tax(PT) 월간 산출
 * — 회사 등록 지역(GST state code / settings) 기준
 */

export type PtSlab = { upTo: number; amount: number };

/** GST state code → 월 급여(gross) 구간별 PT (오름차순 upTo) */
const STATE_PT_SLABS: Record<string, PtSlab[]> = {
  /** Maharashtra */
  '27': [
    { upTo: 7500, amount: 0 },
    { upTo: 10000, amount: 175 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  /** Karnataka */
  '29': [
    { upTo: 15000, amount: 0 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  /** West Bengal */
  '19': [
    { upTo: 10000, amount: 0 },
    { upTo: 15000, amount: 110 },
    { upTo: 25000, amount: 130 },
    { upTo: 40000, amount: 150 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  /** Tamil Nadu */
  '33': [
    { upTo: 21000, amount: 0 },
    { upTo: 30000, amount: 135 },
    { upTo: 45000, amount: 315 },
    { upTo: 60000, amount: 690 },
    { upTo: 75000, amount: 1025 },
    { upTo: Number.POSITIVE_INFINITY, amount: 1250 }
  ],
  /** Gujarat */
  '24': [
    { upTo: 5999, amount: 0 },
    { upTo: 8999, amount: 80 },
    { upTo: 11999, amount: 150 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  /** Telangana */
  '36': [
    { upTo: 15000, amount: 0 },
    { upTo: 20000, amount: 150 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  /** Andhra Pradesh */
  '37': [
    { upTo: 15000, amount: 0 },
    { upTo: 20000, amount: 150 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  /** Madhya Pradesh */
  '23': [
    { upTo: 18750, amount: 0 },
    { upTo: 25000, amount: 125 },
    { upTo: 33333, amount: 167 },
    { upTo: Number.POSITIVE_INFINITY, amount: 208 }
  ],
  /** Odisha */
  '21': [
    { upTo: 13304, amount: 0 },
    { upTo: 25000, amount: 125 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  /** Assam */
  '18': [
    { upTo: 10000, amount: 0 },
    { upTo: 15000, amount: 150 },
    { upTo: 25000, amount: 180 },
    { upTo: Number.POSITIVE_INFINITY, amount: 208 }
  ],
  /** Jharkhand */
  '20': [
    { upTo: 25000, amount: 0 },
    { upTo: 41667, amount: 100 },
    { upTo: 66667, amount: 150 },
    { upTo: 83333, amount: 175 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  /** Chhattisgarh */
  '22': [
    { upTo: 10000, amount: 0 },
    { upTo: 15000, amount: 150 },
    { upTo: 20000, amount: 180 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  /** Kerala */
  '32': [
    { upTo: 11999, amount: 0 },
    { upTo: 17999, amount: 120 },
    { upTo: 29999, amount: 180 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  /** Meghalaya */
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
  /** Tripura */
  '16': [
    { upTo: 7500, amount: 0 },
    { upTo: 15000, amount: 150 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  /** Sikkim */
  '11': [
    { upTo: 20000, amount: 0 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ],
  /** Bihar */
  '10': [
    { upTo: 150000 / 12, amount: 0 },
    { upTo: Number.POSITIVE_INFINITY, amount: 200 }
  ]
};

/** PT 미적용 주 (Delhi, UP 등) */
const PT_EXEMPT_STATE_CODES = new Set([
  '01',
  '02',
  '03',
  '04',
  '05',
  '07',
  '08',
  '09',
  '14',
  '15',
  '26',
  '30',
  '31',
  '34',
  '35',
  '38'
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
  return Math.round(n * 100) / 100;
}

export function normalizeIndianStateCode(raw: unknown): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 2) {
    const code = digits.slice(0, 2).padStart(2, '0');
    return code;
  }
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
        const fromRow = normalizeIndianStateCode(item.state_code) ?? stateCodeFromGstNumber(item.gst_number);
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
  /** YYYY-MM — Maharashtra 2월 특례 */
  payrollMonth?: string | null;
};

/** 주별 PT 월액 (GST state code 기준). 주 미지정이면 0 — 호출측에서 기본값 처리 */
export function computeProfessionalTaxByState(input: ComputeProfessionalTaxInput): number {
  const gross = Math.max(0, Number(input.grossMonthly) || 0);
  if (gross <= 0) return 0;

  const code = normalizeIndianStateCode(input.stateCode);
  if (!code || PT_EXEMPT_STATE_CODES.has(code)) return 0;

  const slabs = STATE_PT_SLABS[code];
  if (!slabs) {
    return gross > 25000 ? 200 : 0;
  }

  let amount = lookupSlabAmount(gross, slabs);

  const month = String(input.payrollMonth ?? '').trim();
  const monthNum = /^(\d{4})-(\d{2})/.exec(month)?.[2];
  if (code === '27' && monthNum === '02' && gross >= 10001) {
    amount = 300;
  }

  return roundInr(amount);
}

/** DB에서 회사 등록 주 코드 조회 */
export async function resolveCompanyRegisteredStateCode(
  companyId: number,
  models?: {
    Company?: { findByPk: (id: number, opts: object) => Promise<any> };
    CompanyGstNumber?: { findOne: (opts: object) => Promise<any> };
  }
): Promise<string | null> {
  const CompanyModel = models?.Company;
  const GstModel = models?.CompanyGstNumber;
  if (!CompanyModel) return null;

  const company = await CompanyModel.findByPk(companyId, {
    attributes: ['id', 'settings', 'address', 'business_number']
  });
  if (!company) return null;

  let gst_numbers: Array<string | { gst_number?: string; state_code?: string }> = [];
  if (GstModel) {
    const gstRow = await GstModel.findOne({
      where: { company_id: companyId, status: 'active' },
      order: [['id', 'ASC']],
      attributes: ['gst_number', 'state_code']
    });
    if (gstRow) {
      gst_numbers = [
        {
          gst_number: gstRow.gst_number,
          state_code: gstRow.state_code
        }
      ];
    }
  }

  return resolveRegisteredStateCodeFromCompanyLike({
    settings: company.settings,
    address: company.address,
    business_number: company.business_number,
    gst_numbers
  });
}
