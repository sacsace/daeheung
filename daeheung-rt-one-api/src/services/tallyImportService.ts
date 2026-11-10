/**
 * Tally Export (XML / JSON) → MSV GL import.
 *
 * Mapping contract (accurate DB write):
 * - GROUP     → gl_accounts (account_type=group, account_group, nature)
 * - LEDGER    → gl_accounts (ledger, parent_id, opening_balance, aliases, flags)
 * - Party-like LEDGER (Sundry Debtors/Creditors) → partners + ledger link via flags
 * - VOUCHER   → gl_vouchers (draft) + gl_voucher_lines + extended columns
 *
 * Never auto-posts. Opening balances stored on accounts; posted balance only after Post.
 */
import { Op } from 'sequelize';
import fs from 'fs';
import GlAccount from '../models/GlAccount';
import GlVoucher from '../models/GlVoucher';
import GlVoucherLine from '../models/GlVoucherLine';
import Partner from '../models/Partner';
import PartnerGstNumber from '../models/PartnerGstNumber';
import { createGlVoucherWithLines, ensureDefaultChartOfAccounts } from './glPostingService';
import { LEDGER_NAME_ALIASES, resolveLedgerStrict } from '../utils/accountResolution';
import { ensureAccountingMasters } from './voucherMasterService';
import { normalizePartnerCompanyName } from '../utils/partnerCompanyName';
import { referenceCacheDel } from '../utils/redisCache';
import { toSentenceCase } from '../utils/textCase';

export type TallyNature = 'asset' | 'liability' | 'income' | 'expense' | 'equity';

export type ParsedTallyLedger = {
  name: string;
  parent?: string;
  openingBalance?: number;
  isGroup?: boolean;
  guid?: string;
  mailingName?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  address?: string;
  alias?: string;
  isBillWise?: boolean;
  isCostCentresOn?: boolean;
};

export type ParsedTallyBillAllocation = {
  name?: string;
  billType?: string;
  amount?: number;
};

export type ParsedTallyBankAllocation = {
  date?: string;
  instrumentNumber?: string;
  transactionType?: string;
  transferMode?: string;
  amount?: number;
};

export type ParsedTallyVoucherLine = {
  ledgerName: string;
  debit: number;
  credit: number;
  narration?: string;
  isPartyLedger?: boolean;
  billAllocations?: ParsedTallyBillAllocation[];
  bankAllocations?: ParsedTallyBankAllocation[];
};

export type ParsedTallyVoucher = {
  date: string;
  effectiveDate?: string;
  voucherType: string;
  voucherNumber: string;
  reference?: string;
  narration?: string;
  guid?: string;
  partyLedgerName?: string;
  partyGstin?: string;
  partyAddress?: string;
  partyEmail?: string;
  partyPhone?: string;
  isInvoice?: boolean;
  currencyCode?: string;
  exchangeRate?: number;
  lines: ParsedTallyVoucherLine[];
};

export type TallyParseResult = {
  format: 'xml' | 'json';
  ledgers: ParsedTallyLedger[];
  vouchers: ParsedTallyVoucher[];
};

export type TallyImportOptions = {
  tenantId: number;
  companyId: number;
  userId: number;
  dryRun?: boolean;
  createMissingLedgers?: boolean;
  importLedgers?: boolean;
  importVouchers?: boolean;
  createMissingParties?: boolean;
};

export type TallyImportIssue = {
  level: 'info' | 'warn' | 'error';
  message: string;
  context?: string;
};

export type TallyImportResult = {
  dryRun: boolean;
  format: 'xml' | 'json';
  parsed: { ledgers: number; groups: number; vouchers: number };
  ledgers: { matched: number; created: number; skipped: number; groupsCreated: number };
  parties: { matched: number; created: number };
  vouchers: { created: number; skipped: number; failed: number };
  issues: TallyImportIssue[];
  createdVoucherIds: number[];
  createdAccountCodes: string[];
  mapping: Array<{ tally: string; msv: string; kind: string }>;
};

const PARENT_NATURE: Array<{ match: RegExp; nature: TallyNature }> = [
  {
    match:
      /cash[- ]?in[- ]?hand|bank accounts?|current assets?|fixed assets?|stock[- ]?in[- ]?hand|sundry debtors|loans?\s*&?\s*advances?\s*\(asset\)|deposits?\s*\(asset\)|investments?/i,
    nature: 'asset',
  },
  {
    match:
      /current liabilities|sundry creditors|duties\s*&?\s*taxes|provisions|loans?\s*\(liability\)|bank od|secured loans|unsecured loans/i,
    nature: 'liability',
  },
  { match: /capital account|reserves?\s*&?\s*surplus|partner.?s?\s*capital|drawings/i, nature: 'equity' },
  { match: /sales accounts?|direct incomes?|indirect incomes?|revenue/i, nature: 'income' },
  { match: /purchase accounts?|direct expenses?|indirect expenses?|cost of|expenses?/i, nature: 'expense' },
  { match: /^assets?$/i, nature: 'asset' },
  { match: /^liabilities$/i, nature: 'liability' },
  { match: /^expenses?$/i, nature: 'expense' },
  { match: /^incomes?$/i, nature: 'income' },
];

const normalizeName = (value: unknown) =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const round2 = (n: number) => Number((Number(n) || 0).toFixed(2));

const parseAmount = (value: unknown) => {
  if (value == null) return 0;
  const raw = String(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const decodeXmlEntities = (text: string) =>
  text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");

const attr = (openTag: string, name: string) => {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i');
  const m = openTag.match(re);
  return m ? decodeXmlEntities(m[1]) : '';
};

const childText = (block: string, tag: string) => {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  if (!m) return '';
  const inner = m[1].replace(/<[^>]+>/g, ' ').trim();
  return decodeXmlEntities(normalizeName(inner));
};

/** All direct/nested text values for a tag (e.g. multiple Tally ADDRESS lines). */
const allChildTexts = (block: string, tag: string): string[] => {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const inner = decodeXmlEntities(m[1].replace(/<[^>]+>/g, ' ').trim());
    const n = normalizeName(inner);
    if (n) out.push(n);
  }
  return out;
};

const extractBlocks = (xml: string, tag: string) => {
  const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const blocks: Array<{ open: string; body: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    blocks.push({ open: m[1] || '', body: m[2] || '' });
  }
  return blocks;
};

/** Indian GSTIN: 15 chars (state + PAN + entity + Z + check). */
const GSTIN_RE = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/i;

const normalizeGstin = (value: unknown): string => {
  const raw = normalizeName(value).toUpperCase().replace(/[\s-]/g, '');
  if (!raw) return '';
  const m = raw.match(GSTIN_RE);
  return m ? m[1].toUpperCase() : '';
};

const isValidEmail = (value: unknown): boolean => {
  const s = normalizeName(value);
  if (!s || s.length > 255) return false;
  // Reject company names / mailing names mistakenly mapped as email
  if (!s.includes('@')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
};

const sanitizePartyEmail = (value: unknown): string | undefined => {
  const s = normalizeName(value);
  return isValidEmail(s) ? s : undefined;
};

/** Pull GSTIN from common Tally ledger / voucher locations. */
const extractPartyGstin = (body: string): string | undefined => {
  const nested = [
    ...extractBlocks(body, 'LEDGSTREGDETAILS.LIST'),
    ...extractBlocks(body, 'GSTDETAILS.LIST'),
    ...extractBlocks(body, 'LEDGSTINDETAILS.LIST'),
    ...extractBlocks(body, 'GSTREGISTRATIONDETAILS.LIST'),
    ...extractBlocks(body, 'LEDMULTIADDRESSLIST.LIST'),
    ...extractBlocks(body, 'LEDMAILINGDETAILS.LIST'),
  ].flatMap((b) => [
    childText(b.body, 'GSTIN'),
    childText(b.body, 'PARTYGSTIN'),
    childText(b.body, 'GSTINUIN'),
    childText(b.body, 'UIN'),
    childText(b.body, 'GSTREGISTRATIONNUMBER'),
  ]);

  const candidates = [
    childText(body, 'PARTYGSTIN'),
    childText(body, 'GSTIN'),
    childText(body, 'GSTINUIN'),
    childText(body, 'UIN'),
    childText(body, 'GSTREGISTRATIONNUMBER'),
    ...allChildTexts(body, 'PARTYGSTIN'),
    ...allChildTexts(body, 'GSTIN'),
    ...allChildTexts(body, 'GSTINUIN'),
    ...nested,
  ];

  for (const c of candidates) {
    const gstin = normalizeGstin(c);
    if (gstin) return gstin;
  }

  // Last resort: scan plain text for a GSTIN-shaped token (covers odd Tally layouts)
  const plain = body.replace(/<[^>]+>/g, ' ').toUpperCase();
  const scanned = plain.match(GSTIN_RE);
  return scanned ? scanned[1].toUpperCase() : undefined;
};

/**
 * Collect Tally ADDRESS lines (+ PIN/STATE/COUNTRY) into a single comma-separated line.
 */
const extractPartyAddressOneLine = (body: string): string | undefined => {
  const mailingBodies = [
    body,
    ...extractBlocks(body, 'LEDMAILINGDETAILS.LIST').map((b) => b.body),
    ...extractBlocks(body, 'LEDMULTIADDRESSLIST.LIST').map((b) => b.body),
    ...extractBlocks(body, 'BASICBUYERADDRESS.LIST').map((b) => b.body),
  ];

  const lines: string[] = [];
  for (const chunk of mailingBodies) {
    lines.push(...allChildTexts(chunk, 'ADDRESS'));
  }

  const extras = [
    childText(body, 'PINCODE') || childText(body, 'PINCODENUMBER'),
    childText(body, 'STATE') || childText(body, 'STATENAME'),
    childText(body, 'COUNTRY') || childText(body, 'COUNTRYOFRESIDENCE'),
    ...mailingBodies.flatMap((chunk) => [
      childText(chunk, 'PINCODE') || childText(chunk, 'PINCODENUMBER'),
      childText(chunk, 'STATE') || childText(chunk, 'STATENAME'),
      childText(chunk, 'COUNTRY') || childText(chunk, 'COUNTRYOFRESIDENCE'),
    ]),
  ]
    .map((v) => normalizeName(v))
    .filter(Boolean);

  const unique: string[] = [];
  for (const part of [...lines, ...extras]) {
    if (!unique.some((u) => u.toLowerCase() === part.toLowerCase())) unique.push(part);
  }
  return unique.length ? unique.join(', ') : undefined;
};

/** Prefer filled fields when the same ledger appears more than once in the export. */
const mergeParsedLedger = (base: ParsedTallyLedger, next: ParsedTallyLedger): ParsedTallyLedger => ({
  ...base,
  parent: base.parent || next.parent,
  openingBalance: base.openingBalance ?? next.openingBalance,
  guid: base.guid || next.guid,
  mailingName: base.mailingName || next.mailingName,
  gstin: base.gstin || next.gstin,
  pan: base.pan || next.pan,
  email: base.email || next.email,
  phone: base.phone || next.phone,
  address: base.address || next.address,
  alias: base.alias || next.alias,
  isBillWise: base.isBillWise || next.isBillWise,
  isCostCentresOn: base.isCostCentresOn || next.isCostCentresOn,
  isGroup: base.isGroup || next.isGroup,
});

const isPlaceholderBusinessNumber = (value: unknown) =>
  /^TALLY-/i.test(normalizeName(value));

const isYes = (value: unknown) => {
  const s = normalizeName(value).toLowerCase();
  return s === 'yes' || s === 'y' || s === 'true' || s === '1';
};

const parseTallyDate = (raw: string): string => {
  const s = normalizeName(raw).replace(/[^\d]/g, '');
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
};

/** 거래처(업체명)처럼 보이는지 — 부모 그룹 없을 때 BS(채권/채무)로 분류 */
const isLikelyPartyName = (name?: string | null) => {
  const n = normalizeName(name);
  if (!n) return false;
  return /\b(pvt\.?\s*ltd\.?|private\s+limited|ltd\.?|llc|inc\.?|limited|llp)\b/i.test(n);
};

const isPartyParent = (parent?: string) => {
  const p = normalizeName(parent).toLowerCase();
  return /sundry debtors|sundry creditors|\bdebtors\b|\bcreditors\b|accounts?\s*receivable|accounts?\s*payable/.test(
    p
  );
};

export const natureFromParent = (parent?: string, name?: string): TallyNature =>
  inferTallyNature({ parent, name });

/**
 * 부모 그룹이 비어 있을 때 원장명으로 성격 추정.
 * Tally 마스터에 PARENT가 빠져 전부 expense로 들어가는 문제를 보완한다.
 */
const natureFromLedgerName = (name?: string | null): TallyNature | null => {
  const n = normalizeName(name);
  if (!n) return null;

  if (/\b(capital account|capital|drawings|reserves?\b|surplus)\b/i.test(n)) return 'equity';

  // 명확한 수익 (호텔·서비스·매출)
  if (/^(sales|sale)$/i.test(n)) return 'income';
  if (
    /\b(food sales|card sales|online food sales|swiggy sales|opera sales|kripara sales)\b/i.test(n)
  ) {
    return 'income';
  }
  if (
    /\b(room rent|room rental|car rent|office rent|store room rent|chef room rent|house rent|generator rent|md house rent|staff house rent|lotus hotel rent|samsung rent)\b/i.test(
      n
    )
  ) {
    return 'income';
  }
  if (
    /\b(professional service fee|prior period income|driver service income|service fee)\b/i.test(n)
  ) {
    return 'income';
  }
  if (/\b(indirect incomes?|direct incomes?|other income|interest (received|income)|discount received)\b/i.test(n)) {
    return 'income';
  }

  // GST / Duties
  if (/\boutput\s*(cgst|sgst|igst|gst)\b|\b(cgst|sgst|igst)\s*output\b/i.test(n)) return 'liability';
  if (/\binput\s*(cgst|sgst|igst|gst)\b|\b(cgst|sgst|igst)\s*input\b/i.test(n)) return 'asset';
  if (/\bduties\s*&?\s*taxes\b/i.test(n)) return 'liability';

  // 은행·현금 (수수료 제외)
  if (/\bbank charges?\b|\binterest (paid|on)\b/i.test(n)) return 'expense';
  if (/\bbank\b|cash[- ]?in[- ]?hand|^cash$|petty cash/i.test(n)) return 'asset';

  // 대출·미결
  if (/\bloan\b/i.test(n)) return 'liability';
  if (/\bsuspense\b/i.test(n)) return 'asset';
  if (/\bcredit card\b/i.test(n)) return 'liability';

  // 비용·매입
  if (
    /\b(purchase|expenses?|travelling|office expenses|medical expenses|software expenses|gst expenses|consumable|groceries|gas purchase|water purchase|salary|wages|freight|postage|printing|stationery|repairs?|maintenance|depreciation|discount allowed|round off)\b/i.test(
      n
    )
  ) {
    return 'expense';
  }

  // 거래처명은 아래에서 잔액으로 분류
  if (isLikelyPartyName(n)) return null;

  // 일반 sales/income 키워드 (거래처명 제외 후)
  if (/\b(sales|income|revenue)\b/i.test(n)) return 'income';
  if (/\bexpenses?\b/i.test(n)) return 'expense';

  return null;
};

/** 부모 그룹 → 원장명 순으로 계정 성격 결정 */
export const inferTallyNature = (opts: {
  parent?: string | null;
  name?: string | null;
}): TallyNature => {
  const parent = normalizeName(opts.parent);
  if (parent) {
    for (const row of PARENT_NATURE) {
      if (row.match.test(parent)) return row.nature;
    }
    if (isPartyParent(parent)) {
      return /creditor|payable/i.test(parent) ? 'liability' : 'asset';
    }
  }
  const fromName = natureFromLedgerName(opts.name);
  if (fromName) return fromName;
  return 'expense';
};

const isCashOrBankParent = (parent?: string, name?: string) => {
  const blob = `${parent || ''} ${name || ''}`.toLowerCase();
  return /cash[- ]?in[- ]?hand|bank accounts?|cash|bank/.test(blob);
};

const mapVoucherType = (raw: string): 'journal' | 'payment' | 'receipt' | 'contra' | 'sales' | 'purchase' => {
  const t = normalizeName(raw).toLowerCase();
  if (t.includes('payment')) return 'payment';
  if (t.includes('receipt')) return 'receipt';
  if (t.includes('contra')) return 'contra';
  if (t.includes('credit note') || t.includes('debit note')) return 'journal';
  if (t.includes('sales') || t.includes('sale')) return 'sales';
  if (t.includes('purchase')) return 'purchase';
  return 'journal';
};

const amountToDrCr = (amountRaw: unknown, isDeemedPositive?: string) => {
  const amount = parseAmount(amountRaw);
  const abs = round2(Math.abs(amount));
  if (isYes(isDeemedPositive)) return { debit: abs, credit: 0 };
  const deemed = normalizeName(isDeemedPositive).toLowerCase();
  if (deemed === 'no' || deemed === 'n' || deemed === 'false') return { debit: 0, credit: abs };
  if (amount < 0) return { debit: abs, credit: 0 };
  return { debit: 0, credit: abs };
};

const parseBillAllocations = (entryBody: string): ParsedTallyBillAllocation[] =>
  extractBlocks(entryBody, 'BILLALLOCATIONS.LIST').map((b) => ({
    name: childText(b.body, 'NAME') || undefined,
    billType: childText(b.body, 'BILLTYPE') || undefined,
    amount: parseAmount(childText(b.body, 'AMOUNT')) || undefined,
  }));

const parseBankAllocations = (entryBody: string): ParsedTallyBankAllocation[] =>
  extractBlocks(entryBody, 'BANKALLOCATIONS.LIST').map((b) => ({
    date: childText(b.body, 'DATE') ? parseTallyDate(childText(b.body, 'DATE')) : undefined,
    instrumentNumber: childText(b.body, 'INSTRUMENTNUMBER') || undefined,
    transactionType: childText(b.body, 'TRANSACTIONTYPE') || undefined,
    transferMode: childText(b.body, 'TRANSFERMODE') || undefined,
    amount: parseAmount(childText(b.body, 'AMOUNT')) || undefined,
  }));

const parseEntryList = (entryBody: string): ParsedTallyVoucherLine | null => {
  const ledgerName = normalizeName(childText(entryBody, 'LEDGERNAME'));
  if (!ledgerName) return null;
  const { debit, credit } = amountToDrCr(childText(entryBody, 'AMOUNT'), childText(entryBody, 'ISDEEMEDPOSITIVE'));
  if (debit <= 0 && credit <= 0) return null;
  const narration = childText(entryBody, 'NARRATION') || undefined;
  const bills = parseBillAllocations(entryBody);
  const banks = parseBankAllocations(entryBody);
  return {
    ledgerName,
    debit,
    credit,
    narration,
    isPartyLedger: isYes(childText(entryBody, 'ISPARTYLEDGER')),
    billAllocations: bills.length ? bills : undefined,
    bankAllocations: banks.length ? banks : undefined,
  };
};

/** Inventory invoice mode: nested accounting allocations contribute to voucher lines */
const parseInventoryAccountingLines = (voucherBody: string): ParsedTallyVoucherLine[] => {
  const lines: ParsedTallyVoucherLine[] = [];
  for (const inv of extractBlocks(voucherBody, 'ALLINVENTORYENTRIES.LIST')) {
    for (const alloc of extractBlocks(inv.body, 'ACCOUNTINGALLOCATIONS.LIST')) {
      const line = parseEntryList(alloc.body);
      if (line) lines.push(line);
    }
  }
  return lines;
};

const parseLedgerBlock = (open: string, body: string): ParsedTallyLedger | null => {
  const name = normalizeName(attr(open, 'NAME') || childText(body, 'NAME'));
  if (!name) return null;
  const parent = childText(body, 'PARENT') || undefined;
  const opening = parseAmount(childText(body, 'OPENINGBALANCE'));
  const gstin = extractPartyGstin(body);
  const panRaw =
    childText(body, 'INCOMETAXNUMBER') ||
    childText(body, 'PANNUMBER') ||
    (gstin && gstin.length === 15 ? gstin.slice(2, 12) : '');
  return {
    name,
    parent,
    openingBalance: opening || undefined,
    isGroup: false,
    guid: childText(body, 'GUID') || attr(open, 'RESERVEDNAME') || undefined,
    mailingName: childText(body, 'MAILINGNAME') || undefined,
    gstin: gstin || undefined,
    pan: normalizeName(panRaw) || undefined,
    email: sanitizePartyEmail(childText(body, 'EMAIL') || childText(body, 'EMAILCC') || childText(body, 'LEDGEREMAIL')),
    phone:
      childText(body, 'LEDGERPHONE') ||
      childText(body, 'PHONE') ||
      childText(body, 'LEDGERMOBILE') ||
      childText(body, 'MOBILENUMBERS') ||
      undefined,
    address: extractPartyAddressOneLine(body),
    alias: childText(body, 'ALIAS') || childText(body, 'ADDITIONALNAME') || undefined,
    isBillWise: isYes(childText(body, 'ISBILLWISEON')),
    isCostCentresOn: isYes(childText(body, 'ISCOSTCENTRESON')),
  };
};

const parseGroupBlock = (open: string, body: string): ParsedTallyLedger | null => {
  const name = normalizeName(attr(open, 'NAME') || childText(body, 'NAME'));
  if (!name) return null;
  return {
    name,
    parent: childText(body, 'PARENT') || undefined,
    isGroup: true,
    guid: childText(body, 'GUID') || undefined,
  };
};

const parseVoucherBlock = (open: string, body: string): ParsedTallyVoucher | null => {
  const voucherType =
    normalizeName(attr(open, 'VCHTYPE') || childText(body, 'VOUCHERTYPENAME') || 'Journal') || 'Journal';
  const voucherNumber = normalizeName(childText(body, 'VOUCHERNUMBER') || '');
  const reference = normalizeName(childText(body, 'REFERENCE') || '') || undefined;
  const date = parseTallyDate(childText(body, 'DATE') || childText(body, 'EFFECTIVEDATE') || '');
  const effectiveDateRaw = childText(body, 'EFFECTIVEDATE');
  const narration = childText(body, 'NARRATION') || undefined;
  const guid = childText(body, 'GUID') || attr(open, 'REMOTEID') || undefined;
  const partyLedgerName = childText(body, 'PARTYLEDGERNAME') || undefined;

  const lines: ParsedTallyVoucherLine[] = [];
  const seenKey = new Set<string>();
  const pushLine = (line: ParsedTallyVoucherLine | null) => {
    if (!line) return;
    const key = `${line.ledgerName}|${line.debit}|${line.credit}|${line.narration || ''}`;
    if (seenKey.has(key)) return;
    seenKey.add(key);
    lines.push(line);
  };

  // Prefer ALLLEDGERENTRIES; fall back to LEDGERENTRIES; then inventory accounting allocations
  const allBlocks = extractBlocks(body, 'ALLLEDGERENTRIES.LIST');
  if (allBlocks.length) {
    for (const block of allBlocks) pushLine(parseEntryList(block.body));
  } else {
    for (const block of extractBlocks(body, 'LEDGERENTRIES.LIST')) {
      pushLine(parseEntryList(block.body));
    }
  }
  for (const line of parseInventoryAccountingLines(body)) pushLine(line);

  if (lines.length < 2) return null;

  const fxRate = parseAmount(childText(body, 'EXCHANGERATE') || childText(body, 'RATEOFEXCHANGE'));

  return {
    date,
    effectiveDate: effectiveDateRaw ? parseTallyDate(effectiveDateRaw) : undefined,
    voucherType,
    voucherNumber: voucherNumber || reference || guid || `${date}-${lines[0].ledgerName}`,
    reference,
    narration,
    guid,
    partyLedgerName,
    partyGstin: extractPartyGstin(body),
    partyAddress: extractPartyAddressOneLine(body),
    partyEmail: sanitizePartyEmail(
      childText(body, 'EMAIL') || childText(body, 'PARTYEMAIL') || childText(body, 'BASICBUYEREMAIL')
    ),
    partyPhone:
      childText(body, 'BASICBUYERPHONE') ||
      childText(body, 'LEDGERPHONE') ||
      childText(body, 'PHONE') ||
      undefined,
    isInvoice: isYes(childText(body, 'ISINVOICE')),
    currencyCode: childText(body, 'CURRENCYNAME') || 'INR',
    exchangeRate: fxRate > 0 ? fxRate : 1,
    lines,
  };
};

export const parseTallyXml = (xml: string): TallyParseResult => {
  const ledgers: ParsedTallyLedger[] = [];
  const vouchers: ParsedTallyVoucher[] = [];
  const seenLedgers = new Set<string>();

  for (const block of extractBlocks(xml, 'GROUP')) {
    const g = parseGroupBlock(block.open, block.body);
    if (!g) continue;
    const key = `g:${g.name.toLowerCase()}`;
    if (seenLedgers.has(key)) continue;
    seenLedgers.add(key);
    ledgers.push(g);
  }

  for (const block of extractBlocks(xml, 'LEDGER')) {
    const l = parseLedgerBlock(block.open, block.body);
    if (!l) continue;
    const key = `l:${l.name.toLowerCase()}`;
    const existingIdx = ledgers.findIndex((row) => !row.isGroup && row.name.toLowerCase() === l.name.toLowerCase());
    if (existingIdx >= 0) {
      ledgers[existingIdx] = mergeParsedLedger(ledgers[existingIdx], l);
      continue;
    }
    if (seenLedgers.has(key)) continue;
    seenLedgers.add(key);
    ledgers.push(l);
  }

  for (const block of extractBlocks(xml, 'VOUCHER')) {
    const v = parseVoucherBlock(block.open, block.body);
    if (v) vouchers.push(v);
  }

  return { format: 'xml', ledgers, vouchers };
};

const asArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
};

export const parseTallyJson = (jsonText: string): TallyParseResult => {
  const data = JSON.parse(jsonText);
  const ledgers: ParsedTallyLedger[] = [];
  const vouchers: ParsedTallyVoucher[] = [];
  const seen = new Set<string>();

  const collectLedgers = (items: any[]) => {
    for (const item of items) {
      const name = normalizeName(item?.name || item?.NAME || item?.ledgerName);
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      ledgers.push({
        name,
        parent: normalizeName(item?.parent || item?.PARENT) || undefined,
        openingBalance: parseAmount(item?.openingBalance || item?.OPENINGBALANCE) || undefined,
        isGroup: Boolean(item?.isGroup || item?.accountType === 'group'),
        guid: normalizeName(item?.guid || item?.GUID) || undefined,
        gstin:
          normalizeGstin(
            item?.gstin || item?.GSTIN || item?.partyGstin || item?.PARTYGSTIN || item?.gstRegistrationNumber
          ) || undefined,
        pan: normalizeName(item?.pan || item?.PAN || item?.INCOMETAXNUMBER) || undefined,
        email: normalizeName(item?.email || item?.EMAIL) || undefined,
        phone: normalizeName(item?.phone || item?.PHONE || item?.LEDGERPHONE) || undefined,
        address: (() => {
          const raw = item?.address || item?.ADDRESS || item?.mailingAddress;
          if (Array.isArray(raw)) {
            const parts = raw.map((v) => normalizeName(v)).filter(Boolean);
            return parts.length ? parts.join(', ') : undefined;
          }
          return normalizeName(raw) || undefined;
        })(),
        alias: normalizeName(item?.alias || item?.ALIAS) || undefined,
      });
    }
  };

  const collectVouchers = (items: any[]) => {
    for (const item of items) {
      const linesRaw = asArray(item?.lines || item?.entries || item?.ALLLEDGERENTRIES);
      const lines: ParsedTallyVoucherLine[] = [];
      for (const entry of linesRaw) {
        const ledgerName = normalizeName(entry?.ledgerName || entry?.LEDGERNAME || entry?.name);
        if (!ledgerName) continue;
        let debit = parseAmount(entry?.debit);
        let credit = parseAmount(entry?.credit);
        if (debit <= 0 && credit <= 0 && entry?.amount != null) {
          const mapped = amountToDrCr(entry.amount, entry?.isDeemedPositive || entry?.ISDEEMEDPOSITIVE);
          debit = mapped.debit;
          credit = mapped.credit;
        }
        if (debit <= 0 && credit <= 0) continue;
        lines.push({
          ledgerName,
          debit: round2(debit),
          credit: round2(credit),
          narration: normalizeName(entry?.narration) || undefined,
          isPartyLedger: Boolean(entry?.isPartyLedger),
        });
      }
      if (lines.length < 2) continue;
      vouchers.push({
        date: parseTallyDate(String(item?.date || item?.DATE || '')),
        voucherType: normalizeName(item?.voucherType || item?.VCHTYPE || 'Journal') || 'Journal',
        voucherNumber:
          normalizeName(item?.voucherNumber || item?.VOUCHERNUMBER || item?.guid || '') ||
          `json-${vouchers.length + 1}`,
        reference: normalizeName(item?.reference || item?.REFERENCE) || undefined,
        narration: normalizeName(item?.narration || item?.NARRATION) || undefined,
        guid: normalizeName(item?.guid || item?.GUID) || undefined,
        partyLedgerName: normalizeName(item?.partyLedgerName || item?.PARTYLEDGERNAME) || undefined,
        currencyCode: normalizeName(item?.currencyCode || 'INR') || 'INR',
        exchangeRate: parseAmount(item?.exchangeRate) || 1,
        lines,
      });
    }
  };

  if (Array.isArray(data)) {
    if (data[0]?.lines || data[0]?.entries) collectVouchers(data);
    else collectLedgers(data);
  } else if (data && typeof data === 'object') {
    collectLedgers(asArray(data.ledgers || data.LEDGERS || data.masters));
    collectVouchers(asArray(data.vouchers || data.VOUCHERS || data.daybook));
  }

  return { format: 'json', ledgers, vouchers };
};

/** Decode Tally export files (often UTF-16 on Windows) into a JS string. */
export const readTallyFileText = (filePath: string): { content: string; encoding: string } => {
  const buf = fs.readFileSync(filePath);
  if (!buf.length) return { content: '', encoding: 'empty' };

  // UTF-16 LE BOM
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { content: buf.toString('utf16le'), encoding: 'utf16le-bom' };
  }
  // UTF-16 BE BOM
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.alloc(buf.length - 2);
    for (let i = 2; i + 1 < buf.length; i += 2) {
      swapped[i - 2] = buf[i + 1];
      swapped[i - 1] = buf[i];
    }
    return { content: swapped.toString('utf16le'), encoding: 'utf16be-bom' };
  }
  // UTF-8 BOM
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { content: buf.slice(3).toString('utf8'), encoding: 'utf8-bom' };
  }

  // Heuristic: many null bytes in first 256 → UTF-16 LE without BOM
  const sample = buf.subarray(0, Math.min(buf.length, 256));
  let nulls = 0;
  for (let i = 0; i < sample.length; i += 1) if (sample[i] === 0) nulls += 1;
  if (nulls > sample.length * 0.3 && sample.length > 20) {
    // Prefer LE (Windows Tally)
    const asLe = buf.toString('utf16le');
    if (/<ENVELOPE|<VOUCHER|<LEDGER|LEDGERNAME/i.test(asLe)) {
      return { content: asLe, encoding: 'utf16le' };
    }
  }

  let utf8 = buf.toString('utf8');
  // Strip accidental NULs if someone saved UTF-16 as bytes into mixed stream
  const nulSegments = utf8.split('\u0000');
  const hasXmlNulPrefix = nulSegments.some(
    (segment, index) => index > 0 && nulSegments[index - 1].endsWith('<') && /^[A-Za-z]/.test(segment)
  );
  if (utf8.includes('\u0000') && hasXmlNulPrefix) {
    utf8 = utf8.split('\u0000').join('');
    return { content: utf8, encoding: 'utf8-stripped-nul' };
  }
  return { content: utf8, encoding: 'utf8' };
};

export const parseTallyExport = (content: string, fileName?: string): TallyParseResult => {
  const trimmed = String(content || '').replace(/^\uFEFF/, '').trim();
  if (!trimmed) throw new Error('파일이 비어 있습니다.');
  const lowerName = String(fileName || '').toLowerCase();
  const looksJson = lowerName.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[');
  if (looksJson) {
    try {
      return parseTallyJson(trimmed);
    } catch (err: any) {
      if (lowerName.endsWith('.json')) throw new Error(`JSON 파싱 실패: ${err?.message || err}`);
    }
  }

  const hasXmlMarker =
    /<ENVELOPE|<TALLYMESSAGE|<VOUCHER\b|<LEDGER\b|<GROUP\b|LEDGERNAME|VOUCHERNUMBER|ALLLEDGERENTRIES/i.test(
      trimmed
    );
  if (!hasXmlMarker && !trimmed.includes('<')) {
    const head = trimmed.slice(0, 80).replace(/\s+/g, ' ');
    throw new Error(
      `Tally XML/JSON Export 형식이 아닙니다. (파일 시작: "${head}…") Tally → Export → XML 로 내려받은 파일을 사용해 주세요.`
    );
  }

  const parsed = parseTallyXml(trimmed);
  if (parsed.ledgers.length === 0 && parsed.vouchers.length === 0) {
    const head = trimmed.slice(0, 120).replace(/\s+/g, ' ');
    throw new Error(
      `파일에서 LEDGER / VOUCHER 데이터를 찾지 못했습니다. Day Book/Masters XML인지 확인해 주세요. (시작: "${head}…")`
    );
  }
  return parsed;
};

const findExistingAccount = (accounts: any[], ledgerName: string, tallyGuid?: string): any | null => {
  if (tallyGuid) {
    const guidToken = `guid:${tallyGuid}`.toLowerCase();
    const byGuid = accounts.find((a) =>
      String(a.search_aliases || '')
        .toLowerCase()
        .split(/[,|;]/)
        .map((s: string) => s.trim())
        .includes(guidToken)
    );
    if (byGuid) return byGuid;
  }

  const target = ledgerName.toLowerCase();
  const aliasCode = LEDGER_NAME_ALIASES[target];
  if (aliasCode) {
    const byCode = accounts.find((a) => String(a.code) === aliasCode && a.account_type !== 'group');
    if (byCode) return byCode;
  }
  return (
    accounts.find((a) => {
      const names = [a.name, a.name_en, a.search_aliases]
        .map((v) => normalizeName(v).toLowerCase())
        .filter(Boolean);
      if (names.includes(target)) return true;
      if (a.search_aliases) {
        const aliases = String(a.search_aliases)
          .split(/[,|;]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        if (aliases.includes(target)) return true;
      }
      return false;
    }) || null
  );
};

const nextCode = async (tenantId: number, companyId: number, prefix: string) => {
  const last = await (GlAccount as any).findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      code: { [Op.like]: `${prefix}%` },
    },
    order: [['code', 'DESC']],
  });
  const seq = last ? Number(String(last.code).replace(/\D/g, '') || 0) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

const buildImportVoucherNo = (v: ParsedTallyVoucher) => {
  const base = normalizeName(v.voucherNumber || v.guid || 'X')
    .replace(/[^a-zA-Z0-9\-_/]/g, '')
    .slice(0, 28);
  const type = normalizeName(v.voucherType || 'VOUCHER')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 12);
  return `TLY-${type || 'VOUCHER'}-${base || Date.now()}`.slice(0, 50);
};

const ensurePartnerGstNumber = async (partnerId: number, gstin: string) => {
  if (!gstin || partnerId <= 0) return;
  const existing = await (PartnerGstNumber as any).findOne({
    where: { partner_id: partnerId, gst_number: { [Op.iLike]: gstin } },
  });
  if (existing) return;
  await (PartnerGstNumber as any).create({
    partner_id: partnerId,
    gst_number: gstin,
  });
};

const enrichPartyFromLedger = async (party: any, ledger: ParsedTallyLedger) => {
  if (!party || party.id <= 0) return party;
  const gstin = normalizeGstin(ledger.gstin);
  const address = normalizeName(ledger.address || '');
  const pan = normalizeName(ledger.pan || '');
  const phone = normalizeName(ledger.phone || '');
  const companyName = normalizePartnerCompanyName(ledger.name) || normalizePartnerCompanyName(party.company_name);
  const patch: Record<string, unknown> = {};

  if (companyName && String(party.company_name || '') !== companyName) {
    patch.company_name = companyName;
  }
  if (gstin && (isPlaceholderBusinessNumber(party.business_number) || !normalizeName(party.business_number))) {
    patch.business_number = gstin;
  }
  if (address && !normalizeName(party.address)) {
    patch.address = address;
  }
  if (pan && isPlaceholderBusinessNumber(party.business_number) && !gstin) {
    patch.business_number = pan;
  }
  if (pan && !normalizeName(party.pan_number)) {
    patch.pan_number = pan;
  }
  if (phone && !normalizeName(party.phone)) {
    patch.phone = phone.slice(0, 20);
  }
  const cleanEmail = sanitizePartyEmail(ledger.email);
  if (cleanEmail && (!normalizeName(party.email) || !isValidEmail(party.email) || String(party.email).endsWith('@tally.import'))) {
    patch.email = cleanEmail;
  } else if (normalizeName(party.email) && !isValidEmail(party.email)) {
    // Repair bad values like company name stored in email from older imports
    patch.email = `${String(party.company_name || ledger.name || 'tally')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 24)
      .toLowerCase() || 'tally'}@tally.import`;
  }

  if (Object.keys(patch).length) {
    await party.update(patch);
  }
  if (gstin) {
    await ensurePartnerGstNumber(party.id, gstin);
  }
  return party;
};

const findOrCreateParty = async ({
  tenantId,
  companyId,
  ledger,
  dryRun,
}: {
  tenantId: number;
  companyId: number;
  ledger: ParsedTallyLedger;
  dryRun: boolean;
}) => {
  const gstinOrBiz = normalizeGstin(ledger.gstin);
  const pan = normalizeName(ledger.pan || '');
  const addressOneLine = normalizeName(ledger.address || '') || null;
  const companyName = normalizePartnerCompanyName(ledger.name) || normalizeName(ledger.name);

  if (gstinOrBiz) {
    const byGstin = await (Partner as any).findOne({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        business_number: { [Op.iLike]: gstinOrBiz },
        status: { [Op.ne]: 'suspended' },
      },
    });
    if (byGstin) {
      if (!dryRun) await enrichPartyFromLedger(byGstin, ledger);
      return { party: byGstin, created: false };
    }

    // Also match via partner_gst_numbers table
    const gstRow = await (PartnerGstNumber as any).findOne({
      where: { gst_number: { [Op.iLike]: gstinOrBiz } },
      include: [
        {
          model: Partner,
          as: 'partner',
          required: true,
          where: {
            tenant_id: tenantId,
            company_id: companyId,
            status: { [Op.ne]: 'suspended' },
          },
        },
      ],
    });
    if (gstRow?.partner) {
      if (!dryRun) await enrichPartyFromLedger(gstRow.partner, ledger);
      return { party: gstRow.partner, created: false };
    }
  }

  if (pan) {
    const byPan = await (Partner as any).findOne({
      where: {
        tenant_id: tenantId,
        company_id: companyId,
        pan_number: { [Op.iLike]: pan },
        status: { [Op.ne]: 'suspended' },
      },
    });
    if (byPan) {
      if (!dryRun) await enrichPartyFromLedger(byPan, ledger);
      return { party: byPan, created: false };
    }
  }

  const existing = await (Partner as any).findOne({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      status: { [Op.ne]: 'suspended' },
      [Op.or]: [
        { company_name: { [Op.iLike]: companyName } },
        { company_name: { [Op.iLike]: normalizeName(ledger.name) } },
      ],
    },
  });
  if (existing) {
    if (!dryRun) await enrichPartyFromLedger(existing, ledger);
    return { party: existing, created: false };
  }

  const parentLower = normalizeName(ledger.parent).toLowerCase();
  const businessType = /sundry debtors/.test(parentLower)
    ? 'customer'
    : /sundry creditors/.test(parentLower)
      ? 'partner'
      : 'other';

  if (dryRun) {
    return {
      party: { id: -1, company_name: companyName },
      created: true,
    };
  }

  const businessNumber =
    gstinOrBiz || pan || `TALLY-${Date.now().toString(36).slice(-8)}`;

  const party = await (Partner as any).create({
    tenant_id: tenantId,
    company_id: companyId,
    company_name: companyName,
    business_number: businessNumber,
    pan_number: pan || (gstinOrBiz ? gstinOrBiz.slice(2, 12) : null),
    business_type: businessType,
    address: addressOneLine,
    phone: ledger.phone ? normalizeName(ledger.phone).slice(0, 20) : null,
    email:
      sanitizePartyEmail(ledger.email) ||
      `${companyName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24).toLowerCase() || 'tally'}@tally.import`,
    status: 'active',
    notes: `[Tally Import] parent=${ledger.parent || ''} guid=${ledger.guid || ''}`.slice(0, 500),
  });

  if (gstinOrBiz) {
    await ensurePartnerGstNumber(party.id, gstinOrBiz);
  }

  return { party, created: true };
};

export const importTallyExport = async (
  content: string,
  options: TallyImportOptions,
  fileName?: string
): Promise<TallyImportResult> => {
  const {
    tenantId,
    companyId,
    userId,
    dryRun = false,
    createMissingLedgers = true,
    importLedgers = true,
    importVouchers = true,
    createMissingParties = true,
  } = options;

  await ensureDefaultChartOfAccounts({ tenantId, companyId, userId });
  await ensureAccountingMasters({ tenantId, companyId, userId }).catch(() => undefined);

  const parsed = parseTallyExport(content, fileName);
  const issues: TallyImportIssue[] = [];
  const mapping: TallyImportResult['mapping'] = [];
  const createdVoucherIds: number[] = [];
  const createdAccountCodes: string[] = [];

  let matched = 0;
  let created = 0;
  let groupsCreated = 0;
  let ledgerSkipped = 0;
  let partiesMatched = 0;
  let partiesCreated = 0;
  let vouchersCreated = 0;
  let vouchersSkipped = 0;
  let vouchersFailed = 0;
  const resolvedNames = new Set<string>();
  const createdNames = new Set<string>();
  const syncedPartyNames = new Set<string>();

  const syncPartyFromLedger = async (ledger: ParsedTallyLedger) => {
    if (!createMissingParties || dryRun || ledger.isGroup) return null;
    if (!isPartyParent(ledger.parent)) return null;
    const { party, created: partyWasCreated } = await findOrCreateParty({
      tenantId,
      companyId,
      ledger,
      dryRun: false,
    });
    const pkey = ledger.name.toLowerCase();
    if (!syncedPartyNames.has(pkey)) {
      syncedPartyNames.add(pkey);
      if (partyWasCreated) partiesCreated += 1;
      else partiesMatched += 1;
      mapping.push({
        tally: ledger.name,
        msv: `partner#${party.id}`,
        kind: partyWasCreated ? 'party-create' : 'party-match',
      });
    }
    return party;
  };

  let accounts: any[] = await (GlAccount as any).findAll({
    where: { tenant_id: tenantId, company_id: companyId, is_active: true },
  });

  const refreshAccounts = async () => {
    accounts = await (GlAccount as any).findAll({
      where: { tenant_id: tenantId, company_id: companyId, is_active: true },
    });
  };

  const ensureAccount = async (ledger: ParsedTallyLedger) => {
    const key = ledger.name.toLowerCase();
    const existing = findExistingAccount(accounts, ledger.name, ledger.guid);
    if (existing && existing.id > 0) {
      if (!resolvedNames.has(key) && !createdNames.has(key)) {
        resolvedNames.add(key);
        matched += 1;
        mapping.push({
          tally: ledger.name,
          msv: `${existing.code} ${existing.name}`,
          kind: existing.account_type === 'group' ? 'group-match' : 'ledger-match',
        });
        if (ledger.guid) {
          issues.push({
            level: 'info',
            message: `계정 중복 매칭(재사용): ${ledger.name}`,
            context: `${existing.code}${ledger.guid ? ` / guid:${ledger.guid}` : ''}`,
          });
        }
      }
      // Enrich aliases / flags when importing masters
      if (!dryRun && !ledger.isGroup) {
        const patch: any = {};
        if (ledger.name) {
          const nextName = toSentenceCase(ledger.name);
          if (nextName && nextName !== existing.name) patch.name = nextName;
          const nextNameEn = toSentenceCase(ledger.mailingName || ledger.name);
          if (nextNameEn && nextNameEn !== existing.name_en) patch.name_en = nextNameEn;
        }
        if (ledger.alias && !String(existing.search_aliases || '').includes(ledger.alias)) {
          patch.search_aliases = [existing.search_aliases, ledger.alias, ledger.name]
            .filter(Boolean)
            .join(', ')
            .slice(0, 2000);
        }
        if (ledger.parent && !existing.account_group) patch.account_group = ledger.parent;
        const nextNature = inferTallyNature({
          parent: ledger.parent || existing.account_group,
          name: ledger.name || existing.name,
        });
        if (nextNature && nextNature !== existing.nature) {
          // 부모가 채워지거나 이름 휴리스틱이 더 정확할 때만 갱신
          if (ledger.parent || existing.account_group || nextNature !== 'expense') {
            patch.nature = nextNature;
          }
        }
        if (isCashOrBankParent(ledger.parent, ledger.name) && !existing.is_cash_or_bank) {
          patch.is_cash_or_bank = true;
        }
        if (isPartyParent(ledger.parent) && !existing.is_ar_ap) {
          patch.is_ar_ap = true;
          patch.party_required = true;
        }
        if (Object.keys(patch).length) {
          await existing.update(patch);
          Object.assign(existing, patch);
        }
      }
      // Re-import: existing accounts were previously skipped for party sync — enrich GST/address now
      if (!dryRun) {
        await syncPartyFromLedger({
          ...ledger,
          parent: ledger.parent || existing.account_group || undefined,
        });
        // Also sync when GL already marked AR/AP but parent string missing in this file row
        if (
          createMissingParties &&
          !ledger.isGroup &&
          (existing.is_ar_ap || isPartyParent(existing.account_group)) &&
          !isPartyParent(ledger.parent)
        ) {
          await syncPartyFromLedger({
            ...ledger,
            parent: existing.account_group || 'Sundry Debtors',
          });
        }
      }
      return existing;
    }

    if (!createMissingLedgers) {
      if (!resolvedNames.has(key)) {
        ledgerSkipped += 1;
        resolvedNames.add(key);
        issues.push({
          level: 'warn',
          message: `계정 미매칭: ${ledger.name}`,
          context: ledger.parent,
        });
      }
      return null;
    }

    if (createdNames.has(key)) return findExistingAccount(accounts, ledger.name);

    if (dryRun) {
      created += 1;
      if (ledger.isGroup) groupsCreated += 1;
      createdNames.add(key);
      createdAccountCodes.push(`(preview) ${ledger.name}`);
      const preview = {
        id: -1,
        name: ledger.name,
        name_en: ledger.name,
        code: 'PREVIEW',
        account_type: ledger.isGroup ? 'group' : 'ledger',
      };
      accounts.push(preview);
      mapping.push({
        tally: ledger.name,
        msv: `(new) ${ledger.name}`,
        kind: ledger.isGroup ? 'group-create' : 'ledger-create',
      });
      return preview;
    }

    // Ensure parent group exists first when possible
    let parentId: number | null = null;
    if (ledger.parent) {
      const parentExisting = findExistingAccount(accounts, ledger.parent);
      if (parentExisting?.id > 0) parentId = parentExisting.id;
      else if (createMissingLedgers) {
        const parentAcc = await ensureAccount({
          name: ledger.parent,
          parent: undefined,
          isGroup: true,
        });
        if (parentAcc?.id > 0) parentId = parentAcc.id;
      }
    }

    const prefix = ledger.isGroup ? 'TLYG' : 'TLY';
    const code = await nextCode(tenantId, companyId, prefix);
    const nature = inferTallyNature({
      parent: ledger.parent || (ledger.isGroup ? ledger.name : undefined),
      name: ledger.name,
    });
    const opening = round2(ledger.openingBalance || 0);
    const aliases = [ledger.alias, ledger.mailingName, ledger.guid ? `guid:${ledger.guid}` : '']
      .filter(Boolean)
      .join(', ');

    const row = await (GlAccount as any).create({
      tenant_id: tenantId,
      company_id: companyId,
      parent_id: parentId,
      code,
      name: toSentenceCase(ledger.name),
      name_en: toSentenceCase(ledger.mailingName || ledger.name),
      account_type: ledger.isGroup ? 'group' : 'ledger',
      nature,
      opening_balance: opening,
      // Opening is stored; do not treat as posted activity
      current_balance: opening,
      is_system: false,
      is_active: true,
      search_aliases: aliases || null,
      account_group: ledger.parent || null,
      is_cash_or_bank: isCashOrBankParent(ledger.parent, ledger.name),
      is_ar_ap: isPartyParent(ledger.parent),
      party_required: isPartyParent(ledger.parent),
      created_by: userId,
      updated_by: userId,
    });

    created += 1;
    if (ledger.isGroup) groupsCreated += 1;
    createdNames.add(key);
    createdAccountCodes.push(code);
    accounts.push(row);
    mapping.push({
      tally: ledger.name,
      msv: `${code} ${ledger.name}`,
      kind: ledger.isGroup ? 'group-create' : 'ledger-create',
    });
    issues.push({
      level: 'info',
      message: `계정 생성: ${code} ${ledger.name} (${nature}${ledger.isGroup ? ', group' : ''})`,
      context: ledger.parent,
    });

    if (createMissingParties && !ledger.isGroup && isPartyParent(ledger.parent)) {
      await syncPartyFromLedger(ledger);
    }

    return row;
  };

  if (importLedgers) {
    const groups = parsed.ledgers.filter((l) => l.isGroup);
    const leafLedgers = parsed.ledgers.filter((l) => !l.isGroup);
    for (const g of groups) await ensureAccount(g);
    for (const ledger of leafLedgers) await ensureAccount(ledger);
  }

  if (!dryRun && importLedgers) {
    try {
      await reclassifyTallyAccountNatures({ tenantId, companyId });
    } catch (e: any) {
      issues.push({
        level: 'warn',
        message: `계정 성격 재분류 실패: ${e?.message || e}`,
      });
    }
  }

  // Enrich partners from voucher-level party GSTIN/address (masters often omit these)
  if (createMissingParties && !dryRun) {
    const fromVouchers = new Map<string, ParsedTallyLedger>();
    for (const v of parsed.vouchers) {
      const name = normalizeName(v.partyLedgerName);
      if (!name) continue;
      if (!v.partyGstin && !v.partyAddress && !v.partyEmail && !v.partyPhone) continue;
      const key = name.toLowerCase();
      const prev = fromVouchers.get(key) || { name, parent: 'Sundry Debtors' };
      fromVouchers.set(key, {
        ...prev,
        gstin: prev.gstin || v.partyGstin,
        address: prev.address || v.partyAddress,
        email: prev.email || v.partyEmail,
        phone: prev.phone || v.partyPhone,
      });
    }
    for (const ledger of fromVouchers.values()) {
      await syncPartyFromLedger(ledger);
    }

    const withGst = parsed.ledgers.filter((l) => !l.isGroup && l.gstin).length;
    const withAddr = parsed.ledgers.filter((l) => !l.isGroup && l.address).length;
    const partyLedgers = parsed.ledgers.filter((l) => !l.isGroup && isPartyParent(l.parent)).length;
    const voucherGst = [...fromVouchers.values()].filter((l) => l.gstin).length;
    issues.push({
      level: withGst + voucherGst > 0 ? 'info' : 'warn',
      message: `파트너 마스터 파싱: 거래처원장 ${partyLedgers}건 · GSTIN ${withGst}건 · 주소 ${withAddr}건`,
      context: `전표 거래처보강 ${fromVouchers.size}건 · 전표GSTIN ${voucherGst}건`,
    });
    if (partyLedgers > 0 && withGst === 0 && voucherGst === 0) {
      issues.push({
        level: 'warn',
        message:
          'Tally 파일에 거래처 GSTIN이 없습니다. Gateway of Tally → Export → Masters(Ledgers)에서 GST 상세가 포함된 XML을 다시보내 주세요.',
        context: 'GST 번호는 Tally LEDGER의 PARTYGSTIN / LEDGSTREGDETAILS.GSTIN 에서만 가져옵니다.',
      });
    }
  }

  // Collect ledger names referenced only by vouchers
  if (importVouchers) {
    for (const v of parsed.vouchers) {
      for (const line of v.lines) {
        if (!findExistingAccount(accounts, line.ledgerName)) {
          await ensureAccount({ name: line.ledgerName, isGroup: false });
        }
      }
      if (v.partyLedgerName && !findExistingAccount(accounts, v.partyLedgerName)) {
        await ensureAccount({
          name: v.partyLedgerName,
          parent: 'Sundry Debtors',
          isGroup: false,
        });
      }
    }
    if (!dryRun) await refreshAccounts();

    const seenInFile = new Set<string>();

    const findDuplicateImportedVoucher = async (v: ParsedTallyVoucher, voucherNo: string) => {
      const byNo = await (GlVoucher as any).findOne({
        where: {
          tenant_id: tenantId,
          company_id: companyId,
          voucher_no: voucherNo,
          is_active: true,
          status: { [Op.ne]: 'cancelled' },
        },
      });
      if (byNo) return { reason: 'voucher_no' as const, row: byNo };

      if (v.guid) {
        try {
          const byGuid = await (GlVoucher as any).findOne({
            where: {
              tenant_id: tenantId,
              company_id: companyId,
              is_active: true,
              status: { [Op.ne]: 'cancelled' },
              amount_details: { [Op.contains]: { tallyGuid: v.guid } },
            },
          });
          if (byGuid) return { reason: 'guid' as const, row: byGuid };
        } catch {
          // JSONB contains unsupported — fall through
        }
      }

      const tallyNo = normalizeName(v.voucherNumber);
      if (tallyNo) {
        try {
          const byTallyNo = await (GlVoucher as any).findOne({
            where: {
              tenant_id: tenantId,
              company_id: companyId,
              is_active: true,
              status: { [Op.ne]: 'cancelled' },
              voucher_date: v.date,
              amount_details: {
                [Op.contains]: {
                  source: 'tally_import',
                  tallyVoucherType: v.voucherType,
                  tallyVoucherNumber: v.voucherNumber,
                },
              },
            },
          });
          if (byTallyNo) return { reason: 'tally_voucher_number' as const, row: byTallyNo };
        } catch {
          // fall through
        }
      }

      return null;
    };

    for (const v of parsed.vouchers) {
      const voucherNo = buildImportVoucherNo(v);
      const inFileKeys = [
        `no:${voucherNo}`,
        v.guid ? `guid:${v.guid}` : '',
        v.voucherNumber
          ? `tno:${normalizeName(v.voucherType).toLowerCase()}|${normalizeName(v.voucherNumber).toLowerCase()}|${v.date}`
          : '',
      ].filter(Boolean);

      const duplicateInFile = inFileKeys.find((k) => seenInFile.has(k));
      if (duplicateInFile) {
        vouchersSkipped += 1;
        issues.push({
          level: 'warn',
          message: `전표 건너뜀(파일 내 중복): ${v.voucherNumber || voucherNo}`,
          context: voucherNo,
        });
        continue;
      }
      inFileKeys.forEach((k) => seenInFile.add(k));

      const dup = await findDuplicateImportedVoucher(v, voucherNo);
      if (dup) {
        vouchersSkipped += 1;
        const reasonLabel =
          dup.reason === 'guid'
            ? 'GUID 중복'
            : dup.reason === 'tally_voucher_number'
              ? 'Tally 전표번호·일자 중복'
              : '전표번호 중복';
        issues.push({
          level: 'warn',
          message: `전표 건너뜀(${reasonLabel}): ${v.voucherNumber || voucherNo}`,
          context: `${voucherNo} → ${dup.row.voucher_no || dup.row.id}`,
        });
        continue;
      }

      const lines: Array<{
        lineNo: number;
        accountId?: number;
        accountName: string;
        debit: number;
        credit: number;
        narration?: string;
        isPartyLedger?: boolean;
        billAllocations?: ParsedTallyBillAllocation[];
        bankAllocations?: ParsedTallyBankAllocation[];
      }> = [];
      let lineOk = true;
      for (let i = 0; i < v.lines.length; i += 1) {
        const line = v.lines[i];
        let account = findExistingAccount(accounts, line.ledgerName);
        if (!account || account.id < 0) {
          const resolved = await resolveLedgerStrict({
            tenantId,
            companyId,
            accountName: line.ledgerName,
            allowPartialName: false,
          });
          if (resolved) {
            account = await (GlAccount as any).findByPk(resolved.id);
            if (account) accounts.push(account);
          }
        }
        if (!account) {
          lineOk = false;
          issues.push({
            level: 'error',
            message: `전표 실패 — 계정 없음: ${line.ledgerName}`,
            context: [
              `전표:${v.voucherNumber || voucherNo}`,
              `일자:${v.date || '-'}`,
              `유형:${v.voucherType || '-'}`,
              `라인:${i + 1}`,
              '사유:MSV에 매칭/생성할 계정과목이 없음',
            ].join(' · '),
          });
          break;
        }
        if (account.account_type === 'group') {
          lineOk = false;
          issues.push({
            level: 'error',
            message: `전표 실패 — 그룹 계정 전기 불가: ${line.ledgerName}`,
            context: [
              `전표:${v.voucherNumber || voucherNo}`,
              `일자:${v.date || '-'}`,
              `유형:${v.voucherType || '-'}`,
              `라인:${i + 1}`,
              '사유:그룹(상위) 계정에는 전표 라인을 넣을 수 없음',
            ].join(' · '),
          });
          break;
        }
        lines.push({
          lineNo: i + 1,
          accountId: account.id > 0 ? account.id : undefined,
          accountName: account.name || line.ledgerName,
          debit: line.debit,
          credit: line.credit,
          narration: line.narration,
          isPartyLedger: line.isPartyLedger,
          billAllocations: line.billAllocations,
          bankAllocations: line.bankAllocations,
        });
      }

      if (!lineOk || lines.length < 2) {
        vouchersFailed += 1;
        if (lineOk && lines.length < 2) {
          issues.push({
            level: 'error',
            message: `전표 실패 — 라인 부족(최소 2줄, 현재 ${lines.length}줄)`,
            context: [
              `전표:${v.voucherNumber || voucherNo}`,
              `일자:${v.date || '-'}`,
              `유형:${v.voucherType || '-'}`,
              `원본라인:${v.lines.length}`,
              '사유:차변·대변을 구성할 유효 계정이 부족함',
            ].join(' · '),
          });
        }
        continue;
      }

      const totalDr = round2(lines.reduce((s, l) => s + l.debit, 0));
      const totalCr = round2(lines.reduce((s, l) => s + l.credit, 0));
      if (Math.abs(totalDr - totalCr) > 0.01) {
        vouchersFailed += 1;
        issues.push({
          level: 'error',
          message: `전표 실패 — 복식부기 불일치: 차변 ${totalDr.toLocaleString()} / 대변 ${totalCr.toLocaleString()}`,
          context: [
            `전표:${v.voucherNumber || voucherNo}`,
            `일자:${v.date || '-'}`,
            `유형:${v.voucherType || '-'}`,
            `차이:${round2(totalDr - totalCr)}`,
            '사유:차변 합계와 대변 합계가 일치하지 않음',
          ].join(' · '),
        });
        continue;
      }

      if (dryRun) {
        vouchersCreated += 1;
        continue;
      }

      try {
        let partyId: number | null = null;
        const partyName = v.partyLedgerName || lines.find((l) => l.isPartyLedger)?.accountName;
        if (partyName && createMissingParties) {
          const party = await syncPartyFromLedger({
            name: partyName,
            parent: 'Sundry Debtors',
            gstin: v.partyGstin,
            address: v.partyAddress,
            email: v.partyEmail,
            phone: v.partyPhone,
          });
          partyId = party?.id > 0 ? party.id : null;
        }

        const narrationParts = [
          v.narration || '',
          v.reference ? `Ref:${v.reference}` : '',
          `[Tally:${v.voucherType}]`,
        ].filter(Boolean);

        const voucher = await createGlVoucherWithLines({
          tenantId,
          companyId,
          userId,
          voucherType: mapVoucherType(v.voucherType),
          voucherDate: v.date,
          narration: narrationParts.join(' · ').slice(0, 2000),
          lines: lines.map((l) => ({
            lineNo: l.lineNo,
            accountId: l.accountId,
            accountName: l.accountName,
            debit: l.debit,
            credit: l.credit,
            narration: l.narration,
          })),
          postImmediately: false,
          voucherNo,
          sourceType: 'tally_import',
          sourceCorrelationId: String(
            v.guid || `TLY-${v.voucherType || 'VOUCHER'}-${v.voucherNumber || voucherNo}-${v.date || ''}`
          ).slice(0, 80),
        });

        const amountDetails = {
          source: 'tally_import',
          tallyGuid: v.guid || null,
          tallyVoucherType: v.voucherType,
          tallyVoucherNumber: v.voucherNumber,
          tallyReference: v.reference || null,
          partyLedgerName: v.partyLedgerName || null,
          isInvoice: Boolean(v.isInvoice),
          fileName: fileName || null,
          linesMeta: lines.map((l) => ({
            lineNo: l.lineNo,
            ledgerName: l.accountName,
            billAllocations: l.billAllocations || [],
            bankAllocations: l.bankAllocations || [],
          })),
        };

        await voucher.update({
          party_id: partyId,
          posting_date: v.effectiveDate || v.date,
          invoice_number: v.isInvoice ? v.reference || v.voucherNumber : v.reference || null,
          invoice_date: v.isInvoice ? v.date : null,
          input_mode: 'tally_import',
          currency_code: v.currencyCode || 'INR',
          exchange_rate: v.exchangeRate || 1,
          amount_details: amountDetails,
          source_type: 'tally_import',
        });

        const savedLines = await (GlVoucherLine as any).findAll({ where: { voucher_id: voucher.id } });
        for (const saved of savedLines) {
          const src = lines.find((l) => l.lineNo === saved.line_no);
          if (!src) continue;
          await saved.update({
            party_id: src.isPartyLedger ? partyId : null,
            line_category: src.bankAllocations?.length
              ? 'bank'
              : src.billAllocations?.length
                ? 'bill'
                : null,
          });
        }

        vouchersCreated += 1;
        createdVoucherIds.push(voucher.id);
        mapping.push({
          tally: v.voucherNumber,
          msv: voucherNo,
          kind: 'voucher-create',
        });
      } catch (err: any) {
        const msg = String(err?.message || '');
        const isUnique =
          err?.name === 'SequelizeUniqueConstraintError' ||
          /unique|duplicate/i.test(msg);
        if (isUnique) {
          vouchersSkipped += 1;
          issues.push({
            level: 'warn',
            message: `전표 건너뜀(DB 중복 제약): ${v.voucherNumber || voucherNo}`,
            context: [
              `전표:${voucherNo}`,
              `일자:${v.date || '-'}`,
              `유형:${v.voucherType || '-'}`,
              `사유:${msg.slice(0, 180) || 'unique constraint'}`,
            ].join(' · '),
          });
        } else {
          vouchersFailed += 1;
          issues.push({
            level: 'error',
            message: `전표 실패 — 생성 오류: ${err?.message || '알 수 없는 오류'}`,
            context: [
              `전표:${v.voucherNumber || voucherNo}`,
              `일자:${v.date || '-'}`,
              `유형:${v.voucherType || '-'}`,
              `사유:${msg.slice(0, 180) || 'create failed'}`,
            ].join(' · '),
          });
        }
      }
    }
  }

  // Always re-apply company-name pattern for Tally partners (fixes ALL CAPS / Pvt Ltd leftovers)
  if (!dryRun) {
    try {
      const tallyPartners = await (Partner as any).findAll({
        where: {
          tenant_id: tenantId,
          company_id: companyId,
          status: { [Op.ne]: 'suspended' },
          [Op.or]: [
            { notes: { [Op.iLike]: '%[Tally Import]%' } },
            { email: { [Op.iLike]: '%@tally.import' } },
            { business_number: { [Op.iLike]: 'TALLY-%' } },
          ],
        },
      });
      let renamed = 0;
      let emailFixed = 0;
      for (const p of tallyPartners) {
        const next = normalizePartnerCompanyName(p.company_name);
        const patch: Record<string, unknown> = {};
        if (next && next !== String(p.company_name || '')) {
          patch.company_name = next;
          renamed += 1;
        }
        if (!isValidEmail(p.email)) {
          const nameForMail = String(next || p.company_name || 'tally');
          patch.email = `${nameForMail.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24).toLowerCase() || 'tally'}@tally.import`;
          emailFixed += 1;
        }
        if (Object.keys(patch).length) {
          await p.update(patch);
        }
      }
      if (renamed > 0) {
        issues.push({
          level: 'info',
          message: `파트너 회사명 정규화: ${renamed}건 (Title Case · Pvt Ltd → Private Limited)`,
        });
      }
      if (emailFixed > 0) {
        issues.push({
          level: 'info',
          message: `파트너 이메일 보정: ${emailFixed}건 (잘못된 회사명 값 → @tally.import)`,
        });
      }
      // Partner list API may serve Redis cache — always bust after Tally party sync/rename
      if (renamed > 0 || emailFixed > 0 || partiesCreated > 0 || partiesMatched > 0) {
        await referenceCacheDel('ref:partners:*').catch(() => undefined);
      }
    } catch (err: any) {
      issues.push({
        level: 'warn',
        message: `파트너 회사명 정규화 중 오류: ${err?.message || 'unknown'}`,
      });
    }
  }

  return {
    dryRun,
    format: parsed.format,
    parsed: {
      ledgers: parsed.ledgers.filter((l) => !l.isGroup).length,
      groups: parsed.ledgers.filter((l) => l.isGroup).length,
      vouchers: parsed.vouchers.length,
    },
    ledgers: { matched, created, skipped: ledgerSkipped, groupsCreated },
    parties: { matched: partiesMatched, created: partiesCreated },
    vouchers: { created: vouchersCreated, skipped: vouchersSkipped, failed: vouchersFailed },
    // 실패·경고를 먼저, 이어서 정보 — 전체 반환(리포트 탭에서 모두 확인)
    issues: (() => {
      const errors = issues.filter((i) => i.level === 'error');
      const warns = issues.filter((i) => i.level === 'warn');
      const infos = issues.filter((i) => i.level === 'info');
      return [...errors, ...warns, ...infos];
    })(),
    createdVoucherIds,
    createdAccountCodes,
    mapping: mapping.slice(0, 500),
  };
};

/**
 * Tally 임포트 계정 성격(nature) 보정.
 * PARENT/그룹이 비어 전부 expense로 들어간 경우 손익·재무상태표가 비는 문제를 고친다.
 */
export const reclassifyTallyAccountNatures = async (params: {
  tenantId: number;
  companyId: number;
}): Promise<{ updated: number; byNature: Record<string, number> }> => {
  const { tenantId, companyId } = params;
  const accounts = await (GlAccount as any).findAll({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      is_active: true,
      account_type: 'ledger',
      [Op.or]: [{ code: { [Op.iLike]: 'TLY%' } }, { search_aliases: { [Op.iLike]: '%guid:%' } }],
    },
  });

  const sequelize = (GlAccount as any).sequelize;
  const [balanceRows] = await sequelize.query(
    `SELECT l.account_id AS id,
            COALESCE(SUM(l.debit::numeric) - SUM(l.credit::numeric), 0)::float AS net
     FROM gl_voucher_lines l
     INNER JOIN gl_vouchers v ON v.id = l.voucher_id
     WHERE v.tenant_id = :tenantId
       AND v.company_id = :companyId
       AND v.is_active = true
       AND v.input_mode = 'tally_import'
     GROUP BY l.account_id`,
    { replacements: { tenantId, companyId } }
  );
  const netByAccount = new Map<number, number>();
  for (const row of balanceRows as Array<{ id: number; net: number }>) {
    netByAccount.set(Number(row.id), Number(row.net) || 0);
  }

  let updated = 0;
  const byNature: Record<string, number> = {
    asset: 0,
    liability: 0,
    income: 0,
    expense: 0,
    equity: 0,
  };

  for (const account of accounts) {
    const parent = account.account_group || null;
    let nature = inferTallyNature({ parent, name: account.name });

    // 부모 그룹 없는 거래처명: 순차변→자산(채권), 순대변→부채(채무)
    if (isLikelyPartyName(account.name) && !normalizeName(parent)) {
      const opening = parseAmount(account.opening_balance);
      const net = opening + (netByAccount.get(Number(account.id)) || 0);
      nature = net >= 0 ? 'asset' : 'liability';
    }

    byNature[nature] = (byNature[nature] || 0) + 1;

    const patch: Record<string, unknown> = {};
    if (account.nature !== nature) patch.nature = nature;

    const cashOrBank = isCashOrBankParent(parent, account.name);
    if (!!account.is_cash_or_bank !== cashOrBank) patch.is_cash_or_bank = cashOrBank;

    const arAp = isPartyParent(parent) || isLikelyPartyName(account.name);
    if (!!account.is_ar_ap !== arAp) {
      patch.is_ar_ap = arAp;
      patch.party_required = arAp;
    }

    if (Object.keys(patch).length) {
      await account.update(patch);
      updated += 1;
    }
  }

  return { updated, byNature };
};
