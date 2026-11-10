/**
 * 인도 GST e-invoice — Invoice Registration Portal (IRP) 연동
 * 실제 과세는 GSP를 통해 NIC IRP로 전달되는 경우가 일반적입니다.
 * GST_IRP_MODE=live + GST_GSP_* 설정 시 HTTP POST, 그 외는 NIC 응답 형식 mock.
 */

import crypto from 'crypto';
import axios from 'axios';
import { env } from '../config/env';

export type GstTransactionType = 'B2B' | 'B2C' | 'SEZWP' | 'SEZWOP' | 'EXPWP' | 'EXPWOP' | 'DEXP';

export interface GstPartyDtls {
  gstin: string;
  legalName: string;
  tradeName?: string;
  address1: string;
  location: string;
  pinCode: number;
  stateCode: string;
}

export interface GstItemLine {
  slNo: string;
  productDesc: string;
  isService: 'Y' | 'N';
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxableValue: number;
  gstRate: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
}

/** NIC e-invoice JSON (핵심 필드만 — GSP가 추가 검증) */
export interface GstEInvoiceNicPayload {
  Version: string;
  TranDtls: {
    TaxSch: 'GST';
    SupTyp: string;
    RegRev: 'Y' | 'N';
    IgstOnIntra: 'Y' | 'N';
  };
  DocDtls: { Typ: 'INV' | 'CRN' | 'DBN'; No: string; Dt: string };
  SellerDtls: Record<string, string | number>;
  BuyerDtls: Record<string, string | number>;
  ItemList: Array<Record<string, string | number>>;
  ValDtls: {
    AssVal: number;
    CgstVal: number;
    SgstVal: number;
    IgstVal: number;
    CesVal: number;
    TotInvVal: number;
  };
}

const DEFAULT_HSN = '998311';

export function gstinStateCode(gstin: string | null | undefined): string {
  if (!gstin || gstin.length < 2) return '96';
  return gstin.trim().slice(0, 2);
}

export function isPlausibleGstin(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test((gstin || '').trim().toUpperCase());
}

export function formatInvoiceDateDdMmYyyy(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function extractPin6(address?: string | null): number | null {
  if (!address) return null;
  const m = String(address).match(/\b(\d{6})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function mapSupTyp(txn: GstTransactionType): string {
  switch (txn) {
    case 'B2C':
      return 'B2C';
    case 'SEZWP':
    case 'SEZWOP':
      return txn;
    case 'EXPWP':
    case 'EXPWOP':
    case 'DEXP':
      return txn;
    default:
      return 'B2B';
  }
}

/** UI/DB에 저장된 transaction_type(Export, SEZ 등)을 NIC SupTyp 코드로 맞춤 */
export function normalizeTransactionType(raw: string | null | undefined): GstTransactionType {
  const t = (raw || 'B2B').trim();
  if (t === 'Export') return 'EXPWP';
  if (t === 'SEZ') return 'SEZWP';
  if (['B2B', 'B2C', 'SEZWP', 'SEZWOP', 'EXPWP', 'EXPWOP', 'DEXP'].includes(t)) {
    return t as GstTransactionType;
  }
  return 'B2B';
}

export function buildNicEInvoicePayload(params: {
  seller: GstPartyDtls;
  buyer: GstPartyDtls;
  invoiceNumber: string;
  invoiceDateIso: string;
  transactionType: GstTransactionType;
  items: GstItemLine[];
  totals: { subtotal: number; taxAmount: number; totalAmount: number };
}): GstEInvoiceNicPayload {
  const { seller, buyer, invoiceNumber, invoiceDateIso, transactionType, items, totals } = params;
  const sellerSt = seller.stateCode;
  const buyerSt = buyer.stateCode;
  const intra = sellerSt === buyerSt;

  let sumIgst = 0;
  let sumCgst = 0;
  let sumSgst = 0;
  let sumCess = 0;
  let sumAss = 0;

  const ItemList = items.map((line) => {
    sumAss += line.taxableValue;
    sumIgst += line.igstAmount;
    sumCgst += line.cgstAmount;
    sumSgst += line.sgstAmount;
    sumCess += line.cessAmount;
    return {
      SlNo: line.slNo,
      PrdDesc: line.productDesc,
      IsServc: line.isService,
      HsnCd: line.hsnCode,
      Qty: line.quantity,
      UnitPrice: Number(line.unitPrice.toFixed(2)),
      TotAmt: Number((line.taxableValue + line.discount).toFixed(2)),
      Discount: Number(line.discount.toFixed(2)),
      AssAmt: Number(line.taxableValue.toFixed(2)),
      GstRt: line.gstRate,
      IgstAmt: intra ? 0 : Number(line.igstAmount.toFixed(2)),
      CgstAmt: intra ? Number(line.cgstAmount.toFixed(2)) : 0,
      SgstAmt: intra ? Number(line.sgstAmount.toFixed(2)) : 0,
      CesRt: 0,
      CesAmt: Number(line.cessAmount.toFixed(2))
    };
  });

  const ValDtls = {
    AssVal: Number(sumAss.toFixed(2)),
    CgstVal: Number(sumCgst.toFixed(2)),
    SgstVal: Number(sumSgst.toFixed(2)),
    IgstVal: Number(sumIgst.toFixed(2)),
    CesVal: Number(sumCess.toFixed(2)),
    TotInvVal: Number(totals.totalAmount.toFixed(2))
  };

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: mapSupTyp(transactionType),
      RegRev: 'N',
      IgstOnIntra: 'N'
    },
    DocDtls: {
      Typ: 'INV',
      No: invoiceNumber,
      Dt: formatInvoiceDateDdMmYyyy(invoiceDateIso)
    },
    SellerDtls: {
      Gstin: seller.gstin.toUpperCase(),
      LglNm: seller.legalName,
      TrdNm: seller.tradeName || seller.legalName,
      Addr1: seller.address1,
      Loc: seller.location,
      Pin: seller.pinCode,
      Stcd: seller.stateCode
    },
    BuyerDtls: {
      Gstin: buyer.gstin.toUpperCase(),
      LglNm: buyer.legalName,
      TrdNm: buyer.tradeName || buyer.legalName,
      Addr1: buyer.address1,
      Loc: buyer.location,
      Pin: buyer.pinCode,
      Stcd: buyer.stateCode
    },
    ItemList,
    ValDtls
  };
}

/** DB 인보이스·품목에서 GstItemLine 생성 (세금 분해) */
export function linesFromInvoiceRows(params: {
  items: Array<{
    item_name: string;
    description?: string;
    quantity: number | string;
    unit_price: number | string;
    total_price: number | string;
    tax_rate: number | string;
    tax_amount: number | string;
    hsn_sac?: string | null;
  }>;
  intraState: boolean;
}): GstItemLine[] {
  const { items, intraState } = params;
  return items.map((row, idx) => {
    const qty = Number(row.quantity) || 1;
    const unitPrice = Number(row.unit_price) || 0;
    const taxableValue = Number(row.total_price) || 0;
    const taxAmt = Number(row.tax_amount) || 0;
    const gstRate = Number(row.tax_rate) || 0;
    let igst = 0;
    let cgst = 0;
    let sgst = 0;
    if (intraState) {
      cgst = taxAmt / 2;
      sgst = taxAmt / 2;
    } else {
      igst = taxAmt;
    }
    return {
      slNo: String(idx + 1),
      productDesc: String(row.description || row.item_name || 'Item'),
      isService: 'N',
      hsnCode: (row.hsn_sac && String(row.hsn_sac).trim()) || DEFAULT_HSN,
      quantity: qty,
      unitPrice,
      discount: 0,
      taxableValue,
      gstRate,
      igstAmount: igst,
      cgstAmount: cgst,
      sgstAmount: sgst,
      cessAmount: 0
    };
  });
}

export interface IrpSuccessResult {
  Irn: string;
  AckNo: string;
  AckDt: string;
  SignedQRCode: string;
  Status?: string;
}

function mockIrpSuccess(payload: GstEInvoiceNicPayload): IrpSuccessResult {
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const irn = hash; // 64 hex — 실제 IRN도 유사 길이
  const ackNo = String(Math.floor(100000000000 + Math.random() * 900000000000));
  const now = new Date();
  const ackDt = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const signedQr = Buffer.from(
    JSON.stringify({ Irn: irn, AckNo: ackNo, AckDt: ackDt, DocNo: payload.DocDtls.No }),
    'utf8'
  ).toString('base64');

  return {
    Irn: irn,
    AckNo: ackNo,
    AckDt: ackDt,
    SignedQRCode: signedQr,
    Status: 'ACT'
  };
}

/**
 * GSP live 호출 — 엔드포인트/바디는 선택한 GSP에 맞게 조정 필요 (환경변수로 URL만 고정).
 */
export async function submitPayloadToIrp(payload: GstEInvoiceNicPayload): Promise<IrpSuccessResult> {
  const mode = (env.GST_IRP_MODE || 'mock').toLowerCase();
  if (mode !== 'live' || !env.GST_GSP_BASE_URL) {
    return mockIrpSuccess(payload);
  }

  const url = `${env.GST_GSP_BASE_URL.replace(/\/$/, '')}${env.GST_GSP_IRP_PATH || '/einvoice/generate'}`;
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
    const body = data?.data ?? data;
    if (!body?.Irn && !body?.irn) {
      throw new Error(body?.ErrorMessage || body?.message || 'IRP 응답에 IRN이 없습니다.');
    }
    return {
      Irn: body.Irn || body.irn,
      AckNo: String(body.AckNo ?? body.ackNo ?? ''),
      AckDt: String(body.AckDt ?? body.ackDt ?? ''),
      SignedQRCode: String(body.SignedQRCode ?? body.signedQRCode ?? ''),
      Status: body.Status
    };
  } catch (e: any) {
    const msg = e?.response?.data?.ErrorMessage || e?.message || 'GSP IRP 호출 실패';
    throw new Error(msg);
  }
}

export function buildSellerPartyFromCompany(company: {
  name: string;
  business_number?: string;
  address?: string;
  settings?: Record<string, unknown>;
}): GstPartyDtls {
  const gstin = String(company.business_number || '').trim().toUpperCase();
  const settings = company.settings || {};
  const pin =
    typeof settings.gst_pin === 'number'
      ? settings.gst_pin
      : typeof settings.gst_pin === 'string'
        ? parseInt(String(settings.gst_pin), 10)
        : extractPin6(company.address) || 560001;
  const loc = typeof settings.gst_location === 'string' ? settings.gst_location : 'Bengaluru';
  return {
    gstin,
    legalName: company.name,
    tradeName: company.name,
    address1: (company.address || 'Address').slice(0, 100),
    location: loc,
    pinCode: Number.isFinite(pin) ? pin : 560001,
    stateCode: gstinStateCode(gstin)
  };
}

export function buildBuyerPartyFromCustomer(customer: {
  name: string;
  business_number?: string | null;
  address?: string | null;
}): GstPartyDtls {
  const gstin = String(customer.business_number || '').trim().toUpperCase();
  const pin = extractPin6(customer.address) || 110001;
  return {
    gstin,
    legalName: customer.name,
    tradeName: customer.name,
    address1: (customer.address || 'Address').slice(0, 100),
    location: 'City',
    pinCode: pin,
    stateCode: gstinStateCode(gstin)
  };
}
