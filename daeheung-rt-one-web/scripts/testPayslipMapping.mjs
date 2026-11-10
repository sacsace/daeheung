/**
 * 로컬 Payslip test 엑셀 5종 헤더 매핑 검증 (개발용)
 */
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

const dir =
  process.argv[2] ||
  String.raw`C:\Users\NXTGN-PC\Dropbox\99.Private Documents\Desktop\Payslip test`;

const FILES = [
  'MSV Test (MSV).xlsx',
  'MSV Test (Tescom).xlsx',
  'MVS Test (GS).xlsx',
  'MVS Test (Hyvison).xlsx',
  'Sample.xlsx',
];

const SUMMABLE = new Set(['other_allowance', 'transport_allowance', 'deduct_this_month']);

const FIELD_OPTIONS = [
  { value: 'emp_id', aliases: ['empid', 'employeeid', 'emp id', 'employee id', 'emp. id'] },
  { value: 'employee_name', aliases: ['name of employee', 'employee name', 'name'] },
  { value: 'employee_email', aliases: ['email id', 'emailid', 'e-mail', 'email'] },
  { value: 'department', aliases: ['department', 'dept'] },
  { value: 'position', aliases: ['designation', 'position'] },
  {
    value: 'bank_account',
    aliases: ['bank account', 'account no', 'account number', 'a/c no', 'a/c', 'ac'],
  },
  { value: 'ifsc', aliases: ['ifsc code', 'ifsc'] },
  { value: 'bank_name', aliases: ['bank name', 'bank'] },
  { value: 'joining_date', aliases: ['joining date', 'date of joining', 'date of join', 'doj'] },
  { value: 'birth_date', aliases: ['date of birth', 'birth date', 'dob', 'birthday'] },
  { value: 'basic_salary', aliases: ['basic salary', 'basic'] },
  {
    value: 'house_rent_allowance',
    aliases: ['house rent allowance', 'hra', 'hrd'],
  },
  {
    value: 'other_allowance',
    aliases: [
      'discretionary performance allowance',
      'long service allowance',
      'team leader allowance',
      'team reader allowance',
      'korean language allowance',
      'koeran language',
      'korean language',
      'medical allowance',
      'meals allowance',
      'meals allowanc',
      'food allowance',
      'night shift allowance',
      'day shift allowance',
      'special allowance',
      'site allowance',
      'other site allowance',
      'other (site) allowance',
      'other allowances',
      'other allowance',
    ],
  },
  { value: 'total_salary', aliases: ['total salary'] },
  {
    value: 'total_day_of_month',
    aliases: ['total day of month', 'total days of month', 'total days', 'days in month', 'twdf'],
  },
  { value: 'unpaid_leave', aliases: ['unpaid leave', 'lop'] },
  { value: 'days_worked', aliases: ['days worked', 'working days'] },
  {
    value: 'day_ot_hour',
    aliases: [
      'ot day hours',
      'ot/day hours',
      'day ot hours',
      'ot day hour',
      'day ot hour',
      'ot/hour',
      'ot hour',
      'ot hours',
    ],
  },
  {
    value: 'night_ot_hour',
    aliases: [
      'ot night hours',
      'ot/night hours',
      'night ot hours',
      'ot night hour',
      'night ot hour',
    ],
  },
  { value: 'ot_rate', aliases: ['ot rate', 'ot/rate'] },
  {
    value: 'overtime_pay',
    aliases: ['overtime pay', 'ot amount', 'ot pay', 'ot amt', 'overtime', 'ot'],
  },
  {
    value: 'transport_allowance',
    aliases: [
      'transportation allowance',
      'transport allowance',
      'transport/travel allowance',
      'travel allowance',
      'extra allowance',
    ],
  },
  { value: 'sum_total', aliases: ['sum total', 'gross total', 'gross pay', 'gross salary'] },
  {
    value: 'pf_employee',
    aliases: ['pf employee contribution', 'employee pf contribution', 'pf employee', 'epf'],
  },
  {
    value: 'esic_employee',
    aliases: [
      'esic employee contribution',
      'esi employee contribution',
      'employee esic contribution',
      'employee esi contribution',
      'esic employee',
      'esi employee',
    ],
  },
  { value: 'tds', aliases: ['tds'] },
  { value: 'pt', aliases: ['professional tax', 'pt'] },
  {
    value: 'deduct_this_month',
    aliases: [
      'amount to be deducted this month',
      'deducted this month',
      'deduct this month',
      'total deduction',
      'total deductions',
      'vpf',
    ],
  },
  {
    value: 'net_salary_payable',
    aliases: ['net salary payable', 'net salary', 'salary payable', 'net pay'],
  },
];

const normalize = (v) =>
  String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const BLOCK = new Set([
  'no',
  'sno',
  'increasesalarydate',
  'advancepaymentamount',
  'balanceofsalaryadvance',
  'previousmonthadjustment',
  'previousmonthadjustemnt',
  'monthtotalcost',
  'accountcash',
  'paymentdate',
  'dayshift',
  'nightshift',
  'workingmonth',
  'workingmonths',
]);

function scoreFieldAlias(headerNorm, alias) {
  const a = normalize(alias);
  if (!headerNorm || !a) return 0;
  if (headerNorm.includes('employer')) return 0;
  if (BLOCK.has(headerNorm)) return 0;
  if (headerNorm === a) return 1000 + a.length;
  if (headerNorm.startsWith(a) || headerNorm.includes(a)) {
    if (a.length <= 2 && headerNorm !== a) return 0;
    if (a.length <= 3 && headerNorm.length > a.length + 6 && !headerNorm.startsWith(a)) return 0;
    return 500 + a.length;
  }
  return 0;
}

function matchField(header, used) {
  const key = normalize(header);
  if (!key) return null;
  let best = null;
  for (const option of FIELD_OPTIONS) {
    if (used.has(option.value) && !SUMMABLE.has(option.value)) continue;
    for (const alias of option.aliases) {
      const s = scoreFieldAlias(key, alias);
      if (s > 0 && (!best || s > best.score)) best = { field: option.value, score: s };
    }
  }
  return best?.field ?? null;
}

function cellToText(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s || /^\[object\s+object\]$/i.test(s)) return '';
    if (/^=/.test(s) || /^_xlfn/i.test(s)) return '';
    return s;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'object') {
    const obj = value;
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((p) => (p && p.text) || '').join('').trim();
    }
    if (obj.result != null && obj.result !== '') return cellToText(obj.result);
    if (obj.text != null) return cellToText(obj.text);
    if (obj.formula != null) {
      const formulaRaw = String(obj.formula);
      const normalized = formulaRaw.startsWith('=') ? formulaRaw : `=${formulaRaw}`;
      const constant = normalized.match(/^=\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (constant) return constant[1];
    }
  }
  return '';
}

async function analyze(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fs.readFileSync(path.join(dir, file)));
  const sheet = wb.worksheets[0];
  let best = { index: 0, score: 0 };
  for (let r = 1; r <= 12; r += 1) {
    const row = sheet.getRow(r);
    let score = 0;
    for (let c = 1; c <= 50; c += 1) {
      const h = cellToText(row.getCell(c).value).replace(/\s+/g, ' ').trim();
      if (!h) continue;
      if (matchField(h, new Set())) score += 1;
    }
    if (score > best.score) best = { index: r, score };
  }
  const headerRow = sheet.getRow(best.index);
  const headers = [];
  for (let c = 1; c <= 50; c += 1) {
    headers.push(cellToText(headerRow.getCell(c).value).replace(/\s+/g, ' ').trim());
  }
  while (headers.length && !headers[headers.length - 1]) headers.pop();

  const used = new Set();
  const mapping = {};
  headers.forEach((h, i) => {
    if (!h) return;
    const f = matchField(h, used);
    if (!f) return;
    mapping[i] = f;
    if (!SUMMABLE.has(f)) used.add(f);
  });

  const dataRow = sheet.getRow(best.index + 1);
  const sample = {};
  Object.entries(mapping).forEach(([i, f]) => {
    const raw = dataRow.getCell(Number(i) + 1).value;
    sample[f] = (sample[f] ? `${sample[f]} | ` : '') + cellToText(raw);
  });

  return { file, headerRow: best.index, headers, mapping, sample };
}

for (const file of FILES) {
  const r = await analyze(file);
  console.log(`\n===== ${r.file} (header row ${r.headerRow}) =====`);
  r.headers.forEach((h, i) => {
    if (!h) return;
    const f = r.mapping[i] || '(unmapped)';
    console.log(`  [${String(i).padStart(2)}] ${h}  →  ${f}`);
  });
  console.log('  sample values:', JSON.stringify(r.sample, null, 2));
}
