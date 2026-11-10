import nodemailer from 'nodemailer';
import { Company, User } from '../models';
import { buildNodemailerTransportOptions, getSystemMailTransportOptions } from './mailConfig';
import {
  bilingualSubject,
  buildBilingualHtml,
  buildBilingualText,
  escapeHtml
} from './mailBilingual';

export type WorkReportMailResult =
  | { sent: true; to: string; ccCount: number }
  | { sent: false; reason: string };

function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function resolveAppBaseUrl(): string {
  const raw = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '';
  const first = raw.split(',')[0]?.trim();
  return first ? first.replace(/\/$/, '') : '';
}

function formatReportDate(value: unknown): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/**
 * 업무 보고서 제출 시 수신자(To)·참조(CC)에게 이메일 발송.
 * 메일 설정·수신 이메일 없으면 sent:false 반환(보고서 저장은 유지).
 */
export async function sendWorkReportSubmittedEmail(params: {
  tenantId?: number;
  companyId?: number;
  senderUserId?: number;
  report: {
    id: number;
    report_id: string;
    title: string;
    content?: string;
    summary?: string | null;
    report_date?: string | Date;
    type?: string;
  };
  authorName: string;
  recipientUserId: number;
  ccUserIds?: number[];
}): Promise<WorkReportMailResult> {
  const { tenantId, companyId, senderUserId, report, authorName, recipientUserId, ccUserIds = [] } = params;

  if (tenantId == null || companyId == null) {
    return { sent: false, reason: 'tenant/company 정보 없음' };
  }

  const recipientRow = await User.findOne({
    where: { id: recipientUserId, tenant_id: tenantId, company_id: companyId },
    attributes: ['id', 'email', 'username', 'status']
  });
  const to = String((recipientRow as any)?.email || '').trim();
  if (!to) {
    return { sent: false, reason: '수신자 이메일이 등록되어 있지 않습니다.' };
  }

  const companyRow = await Company.findOne({ where: { id: companyId, tenant_id: tenantId } });
  const mailOpts = getSystemMailTransportOptions(companyRow);
  if (!mailOpts) {
    return { sent: false, reason: '메일 서버가 설정되지 않았습니다.' };
  }

  let ccAddresses: string[] = [];
  const uniqueCcIds = [
    ...new Set(
      ccUserIds
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0 && id !== recipientUserId && id !== senderUserId)
    )
  ];
  if (uniqueCcIds.length > 0) {
    const ccUsers = await User.findAll({
      where: { id: uniqueCcIds, tenant_id: tenantId, company_id: companyId },
      attributes: ['id', 'email']
    });
    ccAddresses = ccUsers
      .map((u: any) => String(u.email || '').trim())
      .filter((email) => email && email.toLowerCase() !== to.toLowerCase());
    ccAddresses = [...new Set(ccAddresses)];
  }

  const title = String(report.title || '').trim() || 'Work Report';
  const reportId = String(report.report_id || report.id);
  const reportDate = formatReportDate(report.report_date);
  const summaryPlain = stripHtml(String(report.summary || ''));
  const contentPlain = stripHtml(String(report.content || ''));
  const contentExcerpt = contentPlain.length > 1200 ? `${contentPlain.slice(0, 1200)}…` : contentPlain;

  const baseUrl = resolveAppBaseUrl();
  const viewUrl = baseUrl ? `${baseUrl}/work/reports` : '';

  const metaLinesEn = [
    `Report ID: ${reportId}`,
    reportDate ? `Date: ${reportDate}` : '',
    `Title: ${title}`,
    summaryPlain ? `\nSummary:\n${summaryPlain}` : '',
    contentExcerpt ? `\nContent:\n${contentExcerpt}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  const sharedTable = `
      <table style="border-collapse:collapse;margin:12px 0 16px;width:100%;">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top;">Report ID</td><td>${escapeHtml(reportId)}</td></tr>
        ${reportDate ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top;">Date</td><td>${escapeHtml(reportDate)}</td></tr>` : ''}
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top;">Title</td><td><strong>${escapeHtml(title)}</strong></td></tr>
      </table>
      ${summaryPlain ? `<p style="margin:0 0 8px;"><span style="color:#6b7280;">Summary</span><br/>${escapeHtml(summaryPlain).replace(/\n/g, '<br/>')}</p>` : ''}
      ${contentExcerpt ? `<p style="margin:0 0 12px;"><span style="color:#6b7280;">Content</span><br/>${escapeHtml(contentExcerpt).replace(/\n/g, '<br/>')}</p>` : ''}
  `;

  const content = {
    titleKo: 'Work Report Submitted',
    titleEn: 'Work Report Submitted',
    bodyKo: `${authorName} submitted a work report.\n\n${metaLinesEn}`,
    bodyEn: `${authorName} submitted a work report.\n\n${metaLinesEn}`,
    bodyHtmlEn: `<p style="margin:0 0 12px;"><strong>${escapeHtml(authorName)}</strong> submitted a work report.</p>${sharedTable}`,
    linkUrl: viewUrl || undefined,
    footerEn: 'This is an MVS work report notification.'
  };

  const transporter = nodemailer.createTransport(buildNodemailerTransportOptions(mailOpts));
  await transporter.sendMail({
    from: mailOpts.from,
    to,
    cc: ccAddresses.length > 0 ? ccAddresses : undefined,
    subject: bilingualSubject(`[Work Report] ${title}`, `[Work Report] ${title}`),
    text: buildBilingualText(content),
    html: buildBilingualHtml(content)
  });

  return { sent: true, to, ccCount: ccAddresses.length };
}
