import type { PayrollGridRow } from './payroll/payrollGridTypes';
import { formatOtHourDisplay } from './payroll/payrollGridUtils';
import { loadPayrollColumnPrefs } from './payroll/payrollColumnPrefs';
import { loadPayrollSalaryRatios } from './payroll/payrollSalaryRatios';
import { formatPositionLabel } from '../../utils/positionLabels';
import {
  inrAmountInWords,
  money,
  shortCompanyName,
  type PayslipCompanyInfo,
  type PayslipLabels,
} from './PayslipContent';
import { PAYSLIP_LABELS_EN } from './payslipLabelsEn';

const PRIMARY = '#1D4E7C';
const PRIMARY_SOFT = '#E8F1F8';
const PRIMARY_BORDER = '#7BA3C4';
const TEXT = '#0F172A';
const MUTED = '#64748B';
const LINE = '#D1DAE4';
const HEADER_BG = '#F0F4F8';
const LEDGER_HEAD = '#F1F5F9';
const WARN = '#C2410C';
const DANGER = '#B91C1C';
const SUCCESS = '#15803D';
const WHITE = '#FFFFFF';

type LedgerLine = { label: string; value: string; highlight?: boolean };

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseMoney(v: string | number | undefined | null): number {
  if (v === '' || v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function displayText(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return '';
  const s = String(value).trim();
  if (!s || /^\[object\s+object\]$/i.test(s)) return '';
  return s;
}

function formatDateOnly(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return '';
  const s = String(value).trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }
  return s;
}

function statementDateFromPeriod(period: string): string {
  const p = displayText(period);
  if (!p || !/^\d{4}-\d{2}$/.test(p)) return '';
  const [y, m] = p.split('-').map(Number);
  const last = new Date(y, m, 0);
  return last.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function moneyFromField(v: string | number | undefined | null): string {
  return money(parseMoney(v));
}

function resolveLogoSrc(logo?: string | null): string {
  const raw = String(logo || '').trim();
  if (!raw) return '';
  // data URL은 메일 용량 폭증을 막기 위해 작은 로고만 인라인
  if (raw.startsWith('data:')) return raw.length <= 120_000 ? raw : '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (typeof window !== 'undefined' && raw.startsWith('/')) {
    return `${window.location.origin}${raw}`;
  }
  return '';
}

function buildLedger(row: PayrollGridRow, labels: PayslipLabels, companyId?: string | number | null) {
  const dayHours = parseMoney(row.day_ot_hour);
  const otRate = parseMoney(row.ot_rate);
  const otPayTotal = Math.floor(dayHours * otRate);
  const grossPay = parseMoney(row.sum_total);
  const pfEmp = parseMoney(row.pf_employee);
  const esicEmp = parseMoney(row.esic_employee);
  const tdsAmt = parseMoney(row.tds);
  const ptAmt = parseMoney(row.pt);
  const otherDeduct = Math.max(0, parseMoney(row.deduct_this_month) - (pfEmp + esicEmp + tdsAmt + ptAmt));
  const totalDeductions =
    parseMoney(row.deduct_this_month) > 0
      ? parseMoney(row.deduct_this_month)
      : pfEmp + esicEmp + tdsAmt + ptAmt + otherDeduct;
  const netPay = parseMoney(row.net_salary_payable);
  const dayOtLabel =
    dayHours > 0 ? `${labels.dayOt} (${formatOtHourDisplay(dayHours)}h)` : labels.dayOt;

  const customLines = Array.isArray(row.payslip_earning_lines) ? row.payslip_earning_lines : [];
  const earningItems: LedgerLine[] = customLines.length
    ? customLines.map((line) => ({
        label: line.label,
        value: money(line.amount),
        highlight: line.highlight,
      }))
    : [
        ...(() => {
          const ratios = loadPayrollSalaryRatios(companyId);
          const lines = ratios.parts.map((part) => {
            let amount = 0;
            if (part.id === 'basic_salary') amount = Number(row.basic_salary) || 0;
            else if (part.id === 'house_rent_allowance') amount = Number(row.house_rent_allowance) || 0;
            else if (part.id === 'other_allowance') amount = Number(row.other_allowance) || 0;
            else amount = Number(row.constant_parts?.[part.id]) || 0;
            return { label: part.label, value: money(amount) };
          });
          const known = new Set(ratios.parts.map((p) => p.id));
          Object.entries(row.constant_parts || {}).forEach(([id, amount]) => {
            if (known.has(id) || !(Number(amount) > 0)) return;
            lines.push({ label: id.replace(/_/g, ' '), value: money(amount) });
          });
          return lines;
        })(),
        ...(Number(row.food_allowance) > 0
          ? [{ label: labels.foodAllowance, value: money(row.food_allowance) }]
          : []),
        ...(dayHours > 0
          ? [{ label: dayOtLabel, value: money(otPayTotal), highlight: true }]
          : dayHours === 0 && otPayTotal === 0
            ? [{ label: labels.dayOt, value: money(0), highlight: true }]
            : []),
        ...(Number(row.transport_allowance) > 0
          ? [{ label: labels.extraAllowance, value: money(row.transport_allowance), highlight: true }]
          : []),
        ...(() => {
          const prefs = loadPayrollColumnPrefs(companyId);
          const lines: LedgerLine[] = [];
          const shown = new Set<string>();
          for (const col of prefs.customColumns) {
            const amount = Number(row.custom_allowances?.[col.id]) || 0;
            if (amount <= 0) continue;
            shown.add(col.id);
            let label = col.label;
            const isCountFormula =
              col.inputMode === 'count' && Boolean(String(col.formula || '').trim());
            if (isCountFormula) {
              const count = Math.max(
                0,
                Math.floor(Number(row.custom_allowance_inputs?.[col.id]) || 0)
              );
              if (count > 0) label = `${col.label} (${count})`;
            }
            lines.push({ label, value: money(amount), highlight: true });
          }
          Object.entries(row.custom_allowances || {}).forEach(([key, amount]) => {
            if (shown.has(key) || !(Number(amount) > 0)) return;
            lines.push({
              label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
              value: money(amount),
              highlight: true,
            });
          });
          return lines;
        })(),
      ];

  const deductionItems: LedgerLine[] = [
    { label: labels.pfEmployee, value: moneyFromField(row.pf_employee) },
    { label: labels.esicEmployee, value: moneyFromField(row.esic_employee) },
    { label: labels.pt, value: moneyFromField(row.pt) },
    { label: labels.tds, value: money(row.tds) },
  ];
  if (otherDeduct > 0) {
    deductionItems.push({ label: labels.deductMonth, value: money(otherDeduct) });
  }

  return { earningItems, deductionItems, grossPay, totalDeductions, netPay };
}

function empFieldHtml(label: string, value: string, opts?: { highlight?: boolean; link?: boolean }) {
  if (!value) return '';
  const color = opts?.highlight ? DANGER : opts?.link ? PRIMARY : TEXT;
  const valueHtml = opts?.link
    ? `<a href="mailto:${esc(value)}" style="color:${PRIMARY};text-decoration:none;font-weight:600;">${esc(value)}</a>`
    : `<span style="color:${color};font-weight:600;font-size:13px;line-height:1.3;">${esc(value)}</span>`;
  return `
    <td style="width:33.33%;vertical-align:top;padding:6px 10px 8px 0;">
      <div style="font-size:11px;font-weight:600;color:${MUTED};margin-bottom:3px;">${esc(label)}</div>
      ${valueHtml}
    </td>`;
}

function ledgerRowHtml(
  left: LedgerLine | null,
  right: LedgerLine | null,
  opts?: { total?: boolean }
) {
  const total = Boolean(opts?.total);
  const leftLabelColor = total ? PRIMARY : left?.highlight ? DANGER : MUTED;
  const leftValueColor = total ? PRIMARY : left?.highlight ? DANGER : TEXT;
  const rightLabelColor = total ? WARN : MUTED;
  const rightValueColor = total ? WARN : TEXT;
  const leftBg = total ? PRIMARY_SOFT : WHITE;
  const border = total ? 'none' : `1px solid ${LINE}`;
  const weight = total ? 700 : 500;
  return `
    <tr>
      <td style="width:50%;background:${leftBg};border-bottom:${border};padding:10px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="font-size:13px;font-weight:${weight};color:${leftLabelColor};">${left ? esc(left.label) : '&nbsp;'}</td>
            <td align="right" style="font-size:13px;font-weight:${total ? 700 : 600};color:${leftValueColor};white-space:nowrap;">${left ? esc(left.value) : '&nbsp;'}</td>
          </tr>
        </table>
      </td>
      <td style="width:1px;background:#CBD5E1;"></td>
      <td style="width:50%;background:${WHITE};border-bottom:${border};padding:10px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="font-size:13px;font-weight:${weight};color:${rightLabelColor};">${right ? esc(right.label) : '&nbsp;'}</td>
            <td align="right" style="font-size:13px;font-weight:${total ? 700 : 600};color:${rightValueColor};white-space:nowrap;">${right ? esc(right.value) : '&nbsp;'}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export type BuildPayslipEmailHtmlOptions = {
  companyInfo?: PayslipCompanyInfo | null;
  companyId?: string | number | null;
  labels?: PayslipLabels;
  /** 본문 위에 붙일 짧은 안내문(plain text) */
  introText?: string;
  /**
   * 메일 본문에 인라인으로 보여줄 명세서 이미지 CID (예: payslip@mvs).
   * 있으면 HTML 카드 대신 이미지로 표시한다.
   */
  inlineImageCid?: string;
};

/** 급여관리 발송 등 — 기본 영문 안내문 */
export function buildDefaultPayslipMailIntro(vars: {
  name?: string | null;
  company?: string | null;
  period?: string | null;
}): string {
  const name = String(vars.name || 'Employee').trim() || 'Employee';
  const company = shortCompanyName(vars.company) || 'Company';
  const period = String(vars.period || '').trim();
  const ym = period.match(/^(20\d{2})-(\d{1,2})$/);
  const year = ym ? ym[1] : period.match(/^(20\d{2})/)?.[1] || '';
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const monthLabel = ym ? months[Math.max(0, Number(ym[2]) - 1)] || period : period;
  return [
    `Dear ${name},`,
    '',
    'I hope you are doing well.',
    '',
    `Please find attached your payslip for ${monthLabel}${year ? ` ${year}` : ''} for your reference.`,
    'Kindly review it at your convenience, and please feel free to contact us if you have any questions or require further clarification.',
    'Thank you for your continued dedication and contribution to the company.',
    'Best regards,',
    company,
  ].join('\n');
}

/**
 * 화면/PDF 급여 명세서와 동일한 구성의 메일용 HTML (인라인 스타일 + table 레이아웃).
 */
export function buildPayslipEmailHtml(
  row: PayrollGridRow,
  options: BuildPayslipEmailHtmlOptions = {}
): string {
  const labels = options.labels || PAYSLIP_LABELS_EN;
  const companyInfo = options.companyInfo || null;
  const companyName = shortCompanyName(companyInfo?.name) || '—';
  const companyContact = [companyInfo?.address, companyInfo?.phone, companyInfo?.email]
    .filter((x) => !!String(x || '').trim())
    .join(' · ');
  const logoSrc = resolveLogoSrc(companyInfo?.logo);
  const employeeName = displayText(row.employee_name) || 'Employee';
  const workingMonth = displayText(row.working_month);
  const paidDays = displayText(row.days_worked);
  const { earningItems, deductionItems, grossPay, totalDeductions, netPay } = buildLedger(
    row,
    labels,
    options.companyId
  );

  const rowCount = Math.max(earningItems.length, deductionItems.length);
  const ledgerRows = Array.from({ length: rowCount }, (_, i) =>
    ledgerRowHtml(earningItems[i] ?? null, deductionItems[i] ?? null)
  ).join('');
  const totalRow = ledgerRowHtml(
    { label: labels.grossSalary, value: money(grossPay) },
    { label: labels.totalDeductions, value: money(totalDeductions) },
    { total: true }
  );

  const empCells = [
    empFieldHtml(labels.workingMonth, workingMonth),
    empFieldHtml(labels.statementDate, statementDateFromPeriod(workingMonth)),
    empFieldHtml(labels.totalDaysInMonth, displayText(row.total_day_of_month)),
    empFieldHtml(labels.paidDays, paidDays),
    empFieldHtml(labels.unpaidLeave, displayText(row.unpaid_leave) || '0', { highlight: true }),
    empFieldHtml(labels.empId, row.emp_id ? String(row.emp_id).toUpperCase() : ''),
    empFieldHtml(labels.designation, formatPositionLabel(row.position, 'en', false) || ''),
    empFieldHtml(labels.email, displayText(row.employee_email), { link: true }),
    empFieldHtml(labels.dateOfJoin, formatDateOnly(row.joining_date)),
    empFieldHtml(labels.department, displayText(row.department)),
    empFieldHtml(labels.bank, displayText(row.bank_name)),
    empFieldHtml(labels.account, displayText(row.bank_account)),
    empFieldHtml(labels.ifsc, displayText(row.ifsc)),
  ].filter(Boolean);

  const empRows: string[] = [];
  for (let i = 0; i < empCells.length; i += 3) {
    const a = empCells[i] || '<td style="width:33.33%;"></td>';
    const b = empCells[i + 1] || '<td style="width:33.33%;"></td>';
    const c = empCells[i + 2] || '<td style="width:33.33%;"></td>';
    empRows.push(`<tr>${a}${b}${c}</tr>`);
  }

  const intro = String(options.introText || '')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />');
  const inlineCid = String(options.inlineImageCid || '').trim();

  if (inlineCid) {
    return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F8FAFC;">
  <div style="font-family:Segoe UI,Arial,sans-serif;color:${TEXT};max-width:720px;margin:0 auto;padding:16px 12px 24px;">
    ${
      intro
        ? `<div style="font-size:14px;line-height:1.55;color:${TEXT};margin:0 0 16px;">${intro}</div>`
        : ''
    }
    <div style="margin:0 0 12px;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;background:${WHITE};">
      <img src="cid:${esc(inlineCid)}" alt="${esc(labels.title)} ${esc(employeeName)}" style="display:block;width:100%;max-width:720px;height:auto;border:0;" />
    </div>
    <div style="font-size:11px;color:${MUTED};text-align:center;">${esc(labels.autoGenerated)}</div>
    <div style="font-size:11px;color:${MUTED};text-align:center;margin-top:6px;">A PDF copy is also attached for your records.</div>
  </div>
</body>
</html>`.trim();
  }

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F8FAFC;">
  <div style="font-family:Segoe UI,Arial,sans-serif;color:${TEXT};max-width:720px;margin:0 auto;padding:16px 12px 24px;">
    ${
      intro
        ? `<div style="font-size:14px;line-height:1.55;color:${TEXT};margin:0 0 16px;">${intro}</div>`
        : ''
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${WHITE};border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="background:${HEADER_BG};border-top:3px solid ${PRIMARY};border-bottom:1px solid #CBD5E1;padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="vertical-align:top;padding-right:12px;">
                <div style="display:inline-block;background:${PRIMARY_SOFT};color:${PRIMARY};font-size:11px;font-weight:700;letter-spacing:0.14em;padding:4px 10px;border-radius:6px;margin-bottom:8px;">${esc(labels.payrollBadge)}</div>
                <div style="font-size:22px;font-weight:700;line-height:1.2;margin:0 0 4px;">${esc(labels.title)}</div>
                <div style="font-size:20px;font-weight:700;line-height:1.25;margin:0 0 12px;">${esc(employeeName)}</div>
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    ${
                      workingMonth
                        ? `<td style="background:${WHITE};border:1px solid ${LINE};border-radius:8px;padding:10px 14px;min-width:110px;margin-right:8px;">
                            <div style="font-size:11px;font-weight:600;color:${MUTED};margin-bottom:4px;">${esc(labels.workingMonth)}</div>
                            <div style="font-size:18px;font-weight:700;color:${PRIMARY};line-height:1.1;">${esc(workingMonth)}</div>
                          </td>`
                        : ''
                    }
                    ${
                      paidDays
                        ? `<td style="width:10px;"></td>
                          <td style="background:${WHITE};border:1px solid ${LINE};border-radius:8px;padding:10px 14px;min-width:110px;">
                            <div style="font-size:11px;font-weight:600;color:${MUTED};margin-bottom:4px;">${esc(labels.paidDays)}</div>
                            <div style="font-size:18px;font-weight:700;color:${PRIMARY};line-height:1.1;">${esc(paidDays)}</div>
                          </td>`
                        : ''
                    }
                  </tr>
                </table>
              </td>
              <td style="width:280px;vertical-align:top;">
                <div style="background:${WHITE};border:1px solid ${LINE};border-radius:8px;padding:12px 14px;">
                  ${
                    logoSrc
                      ? `<div style="margin-bottom:8px;"><img src="${esc(logoSrc)}" alt="${esc(companyName)}" style="max-height:48px;max-width:180px;display:block;" /></div>`
                      : ''
                  }
                  <div style="font-size:11px;font-weight:600;color:${MUTED};margin-bottom:4px;">${esc(labels.companyName)}</div>
                  ${
                    companyName !== '—'
                      ? `<div style="font-size:15px;font-weight:700;line-height:1.35;color:${TEXT};">${esc(companyName)}</div>`
                      : ''
                  }
                  ${
                    companyContact
                      ? `<div style="font-size:12px;color:${MUTED};line-height:1.45;margin-top:4px;">${esc(companyContact)}</div>`
                      : ''
                  }
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 20px 20px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;color:${PRIMARY};text-transform:uppercase;margin:0 0 10px;">${esc(labels.employee)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${LINE};border-radius:8px;margin-bottom:18px;">
            <tr><td style="padding:10px 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                ${empRows.join('')}
              </table>
            </td></tr>
          </table>

          <div style="font-size:12px;font-weight:700;letter-spacing:0.06em;color:${PRIMARY};text-transform:uppercase;margin:0 0 10px;">${esc(labels.earningsAndDeductions)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${LINE};border-radius:8px;overflow:hidden;margin-bottom:16px;">
            <tr>
              <td style="width:50%;background:${LEDGER_HEAD};border-top:2px solid ${PRIMARY};border-bottom:1px solid ${LINE};padding:10px 14px;font-size:12px;font-weight:600;letter-spacing:0.02em;color:#475569;text-transform:uppercase;">${esc(labels.earnings)}</td>
              <td style="width:1px;background:#CBD5E1;"></td>
              <td style="width:50%;background:${LEDGER_HEAD};border-top:2px solid ${PRIMARY};border-bottom:1px solid ${LINE};padding:10px 14px;font-size:12px;font-weight:600;letter-spacing:0.02em;color:#475569;text-transform:uppercase;">${esc(labels.employeeDeductions)}</td>
            </tr>
            ${ledgerRows}
            ${totalRow}
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:2px solid ${PRIMARY_BORDER};background:${PRIMARY_SOFT};border-radius:8px;margin-bottom:12px;">
            <tr>
              <td style="padding:14px 16px;">
                <div style="font-size:13px;font-weight:700;color:${PRIMARY};margin-bottom:4px;">${esc(labels.netPay)}</div>
                <div style="font-size:28px;font-weight:700;color:${TEXT};line-height:1.15;letter-spacing:-0.02em;margin-bottom:6px;">${esc(money(netPay))}</div>
                <div style="font-size:13px;font-weight:600;color:${SUCCESS};">${esc(labels.amountInWords)}: ${esc(inrAmountInWords(netPay))}</div>
              </td>
            </tr>
          </table>

          <div style="font-size:11px;color:${MUTED};text-align:center;">${esc(labels.autoGenerated)}</div>
          <div style="font-size:11px;color:${MUTED};text-align:center;margin-top:6px;">A PDF copy is also attached for your records.</div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`.trim();
}
