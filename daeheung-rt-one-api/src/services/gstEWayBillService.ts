/**
 * 인도 GST E-Way Bill — NIC/GSP 연동
 * 실제 발급은 GST Suvidha Provider(GSP)가 NIC ewaybillgst API와 통신하는 경우가 일반적입니다.
 * GST_EWAY_MODE=live + GSP URL 설정 시 HTTP POST, 그 외는 NIC 응답 형식 mock.
 *
 * GSP별 요청/응답 JSON이 다를 수 있으므로, 선택한 GSP 문서에 맞게 경로·헤더·바디를 조정하세요.
 * @see https://docs.ewaybillgst.gov.in/apidocs/
 */

import crypto from 'crypto';
import axios from 'axios';
import { env } from '../config/env';
import { formatInvoiceDateDdMmYyyy, gstinStateCode } from './gstEInvoiceService';

export interface EWayBillRowLike {
  id: number;
  supply_type: 'outward' | 'inward';
  sub_supply_type?: string | null;
  document_type: 'invoice' | 'credit_note' | 'debit_note' | 'bill_of_supply';
  document_number: string;
  document_date: Date | string;
  invoice_number: string;
  invoice_date: Date | string;
  from_gstin: string;
  from_name: string;
  from_address: string;
  from_pincode: string;
  from_state: string;
  from_state_code: number;
  to_gstin?: string | null;
  to_name: string;
  to_address: string;
  to_pincode: string;
  to_state: string;
  to_state_code: number;
  transport_mode: 'road' | 'rail' | 'air' | 'ship';
  vehicle_number?: string | null;
  vehicle_type?: string | null;
  transporter_id?: string | null;
  transporter_name?: string | null;
  transporter_gstin?: string | null;
  transporter_doc_number?: string | null;
  transporter_doc_date?: Date | string | null;
  distance?: number | string | null;
  total_value: number | string;
  total_tax_amount: number | string;
  total_amount: number | string;
  eway_bill_number: string;
}

export interface EWayBillItemRowLike {
  item_name: string;
  hsn_code: string;
  quantity: number | string;
  unit: string;
  unit_price: number | string;
  total_value: number | string;
  cgst_rate?: number | string | null;
  cgst_amount?: number | string | null;
  sgst_rate?: number | string | null;
  sgst_amount?: number | string | null;
  igst_rate?: number | string | null;
  igst_amount?: number | string | null;
  cess_rate?: number | string | null;
  cess_amount?: number | string | null;
}

/** NIC 문서 흔한 필드명 기반 JSON (GSP가 그대로 전달하거나 래핑할 수 있음) */
export interface NicStyleEWayBillPayload {
  supplyType: string;
  subSupplyType: number;
  docType: string;
  docNo: string;
  docDate: string;
  fromGstin: string;
  fromTrdName: string;
  fromAddr1: string;
  fromPlace: string;
  fromPincode: number;
  actFromStateCode: number;
  fromStateCode: number;
  toGstin: string;
  toTrdName: string;
  toAddr1: string;
  toPlace: string;
  toPincode: number;
  actToStateCode: number;
  toStateCode: number;
  transactionType: number;
  itemList: Array<Record<string, string | number>>;
  totInvValue: number;
  transMode: string;
  transDistance: string;
  vehicleNo: string;
  vehicleType: string;
  transporterId: string;
  transporterName: string;
  transDocNo: string;
  transDocDate: string;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapDocType(t: EWayBillRowLike['document_type']): string {
  switch (t) {
    case 'credit_note':
      return 'CRN';
    case 'debit_note':
      return 'DBN';
    case 'bill_of_supply':
      return 'BOS';
    default:
      return 'INV';
  }
}

function mapTransMode(mode: EWayBillRowLike['transport_mode']): string {
  switch (mode) {
    case 'rail':
      return '2';
    case 'air':
      return '3';
    case 'ship':
      return '4';
    default:
      return '1';
  }
}

function parseSubSupplyType(raw?: string | null): number {
  if (!raw) return 1;
  const n = parseInt(String(raw).replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function hsnAsNumber(hsn: string): number {
  const d = parseInt(String(hsn).replace(/\D/g, '').slice(0, 8), 10);
  return Number.isFinite(d) && d > 0 ? d : 9999;
}

export function buildNicStyleEWayBillPayload(
  bill: EWayBillRowLike,
  items: EWayBillItemRowLike[]
): NicStyleEWayBillPayload {
  const docDateStr = formatInvoiceDateDdMmYyyy(
    typeof bill.document_date === 'string' ? bill.document_date : String(bill.document_date)
  );
  const fromPin = parseInt(String(bill.from_pincode).replace(/\D/g, '').slice(0, 6), 10) || 110001;
  const toPin = parseInt(String(bill.to_pincode).replace(/\D/g, '').slice(0, 6), 10) || 110001;
  const toGstin = (bill.to_gstin || '').trim().toUpperCase() || 'URP';

  const itemList = items.map((row) => {
    const taxable = num(row.total_value);
    const cgstR = num(row.cgst_rate);
    const sgstR = num(row.sgst_rate);
    const igstR = num(row.igst_rate);
    const cessR = num(row.cess_rate);
    return {
      productName: String(row.item_name || 'Goods').slice(0, 100),
      productDesc: String(row.item_name || '').slice(0, 100),
      hsnCode: hsnAsNumber(String(row.hsn_code || '9999')),
      quantity: num(row.quantity, 1),
      qtyUnit: String(row.unit || 'PCS').slice(0, 12),
      taxableAmount: Number(taxable.toFixed(2)),
      cgstRate: cgstR,
      sgstRate: sgstR,
      igstRate: igstR,
      cessRate: cessR,
      cessAdvol: num(row.cess_amount)
    };
  });

  const totInv = num(bill.total_amount);

  const transDocDate = bill.transporter_doc_date
    ? formatInvoiceDateDdMmYyyy(
        typeof bill.transporter_doc_date === 'string'
          ? bill.transporter_doc_date
          : String(bill.transporter_doc_date)
      )
    : '';

  return {
    supplyType: bill.supply_type === 'inward' ? 'I' : 'O',
    subSupplyType: parseSubSupplyType(bill.sub_supply_type),
    docType: mapDocType(bill.document_type),
    docNo: String(bill.document_number || bill.invoice_number).slice(0, 16),
    docDate: docDateStr,
    fromGstin: bill.from_gstin.trim().toUpperCase(),
    fromTrdName: String(bill.from_name).slice(0, 100),
    fromAddr1: String(bill.from_address).slice(0, 120),
    fromPlace: String(bill.from_state || bill.from_state_code).slice(0, 50),
    fromPincode: fromPin,
    actFromStateCode: bill.from_state_code,
    fromStateCode: bill.from_state_code,
    toGstin,
    toTrdName: String(bill.to_name).slice(0, 100),
    toAddr1: String(bill.to_address).slice(0, 120),
    toPlace: String(bill.to_state || bill.to_state_code).slice(0, 50),
    toPincode: toPin,
    actToStateCode: bill.to_state_code,
    toStateCode: bill.to_state_code,
    transactionType: 1,
    itemList,
    totInvValue: Number(totInv.toFixed(2)),
    transMode: mapTransMode(bill.transport_mode),
    transDistance: String(num(bill.distance, 1)),
    vehicleNo: String(bill.vehicle_number || '').replace(/\s/g, '').toUpperCase().slice(0, 20),
    vehicleType: (bill.vehicle_type || 'R').toString().slice(0, 1).toUpperCase() || 'R',
    transporterId: String(bill.transporter_id || '').slice(0, 15),
    transporterName: String(bill.transporter_name || '').slice(0, 100),
    transDocNo: String(bill.transporter_doc_number || '').slice(0, 20),
    transDocDate
  };
}

export interface GstnEWayBillSuccess {
  ewayBillNo: string;
  validUpto: Date;
  /** GSTN에서 내려주는 서명 QR 문자열(표시·스캔용) */
  qrCode: string;
}

function pickFirst(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function parseGstnDate(raw: unknown): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  // dd/MM/yyyy HH:mm:ss ...
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
  if (m) {
    const d = new Date(
      parseInt(m[3], 10),
      parseInt(m[2], 10) - 1,
      parseInt(m[1], 10),
      parseInt(m[4], 10),
      parseInt(m[5], 10),
      parseInt(m[6], 10)
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(s);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function parseGspEWayBillResponse(data: unknown): GstnEWayBillSuccess {
  const body =
    data && typeof data === 'object' && 'data' in (data as any) && (data as any).data != null
      ? (data as any).data
      : data;
  if (!body || typeof body !== 'object') {
    throw new Error('GSP E-Way Bill 응답이 비어 있습니다.');
  }
  const o = body as Record<string, unknown>;

  const ewayNo = pickFirst(o, [
    'ewayBillNo',
    'EwbNo',
    'ewbNo',
    'EwayBillNo',
    'eway_no',
    'EWBNo',
    'eWayBillNo'
  ]);
  if (ewayNo == null || String(ewayNo).trim() === '') {
    throw new Error(
      (o.error as string) ||
        (o.message as string) ||
        (o.ErrorMessage as string) ||
        'GSP 응답에 E-Way Bill 번호가 없습니다.'
    );
  }

  const validRaw = pickFirst(o, ['validUpto', 'ValidUpto', 'validTill', 'ValidTill', 'ewbValidTill']);
  const validUpto = parseGstnDate(validRaw) || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  })();

  const qrRaw = pickFirst(o, ['qrCode', 'QRCode', 'signedQRCode', 'SignedQRCode', 'barcode', 'Barcode']);
  const qrCode =
    qrRaw != null
      ? String(qrRaw)
      : JSON.stringify({
          EwbNo: String(ewayNo),
          ValidUpto: validUpto.toISOString()
        });

  return {
    ewayBillNo: String(ewayNo).trim(),
    validUpto,
    qrCode
  };
}

function mockGstnSuccess(payload: NicStyleEWayBillPayload): GstnEWayBillSuccess {
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12);
  const ewayBillNo = `${hash.slice(0, 4)}${hash.slice(4, 8)}${hash.slice(8, 12)}`;
  const validUpto = new Date();
  validUpto.setHours(validUpto.getHours() + 24);
  const qrCode = Buffer.from(
    JSON.stringify({
      mock: true,
      note: 'GST_EWAY_MODE is not live — this is not a government E-Way Bill',
      supplyType: payload.supplyType,
      docNo: payload.docNo,
      fromGstin: payload.fromGstin,
      toGstin: payload.toGstin
    }),
    'utf8'
  ).toString('base64');
  return { ewayBillNo: `MOCK-${ewayBillNo}`, validUpto, qrCode };
}

function ewayBaseUrl(): string {
  const u = (env.GST_GSP_EWAY_BASE_URL || env.GST_GSP_BASE_URL || '').trim();
  return u.replace(/\/$/, '');
}

/**
 * GSP로 E-Way Bill 생성 요청 — live 시 axios POST, mock 시 로컬 더미 번호.
 */
export async function submitEWayBillToGstn(payload: NicStyleEWayBillPayload): Promise<GstnEWayBillSuccess> {
  const mode = (env.GST_EWAY_MODE || 'mock').toLowerCase();
  const base = ewayBaseUrl();
  if (mode !== 'live' || !base) {
    return mockGstnSuccess(payload);
  }

  const path = env.GST_GSP_EWAY_PATH || '/ewaybill/generate';
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (env.GST_GSP_AUTH_HEADER && env.GST_GSP_AUTH_VALUE) {
      headers[env.GST_GSP_AUTH_HEADER] = env.GST_GSP_AUTH_VALUE;
    }
    const { data } = await axios.post(url, payload, {
      headers,
      timeout: env.GST_GSP_TIMEOUT_MS || 60000
    });
    return parseGspEWayBillResponse(data);
  } catch (e: any) {
    const msg =
      e?.response?.data?.ErrorMessage ||
      e?.response?.data?.message ||
      e?.response?.data?.error ||
      e?.message ||
      'GSP E-Way Bill 호출 실패';
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
}

export function assertLiveEWayConfig(): string | null {
  const mode = (env.GST_EWAY_MODE || 'mock').toLowerCase();
  if (mode !== 'live') return null;
  if (!ewayBaseUrl()) {
    return 'GST_EWAY_MODE=live 인데 GST_GSP_BASE_URL(또는 GST_GSP_EWAY_BASE_URL)이 비어 있습니다.';
  }
  return null;
}
