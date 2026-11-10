import nodemailer from 'nodemailer';
import { Company, User } from '../models';
import {
  buildNodemailerTransportOptions,
  listMailTransportCandidates,
  type MailTransportResolved,
} from './mailConfig';
import { bilingualSubject, buildBilingualHtml, buildBilingualText } from './mailBilingual';
import { parseSettingsBlob } from './settingsBlob';

function isSmtpAuthError(err: unknown): boolean {
  const e = err as { code?: string; responseCode?: number; message?: string };
  if (e?.code === 'EAUTH') return true;
  if (e?.responseCode === 535) return true;
  const msg = String(e?.message || '');
  return /Username and Password not accepted|Invalid login|BadCredentials/i.test(msg);
}

function formatSmtpAuthHint(mailOpts: MailTransportResolved): string {
  const host = mailOpts.host || '';
  const user = mailOpts.auth?.user || '';
  if (/gmail\.com/i.test(host) || /@gmail\.com$/i.test(user)) {
    return 'Gmail requires an App Password (not the account password). Update company/personal SMTP.';
  }
  return 'Check SMTP username/password in company or personal mail settings.';
}

async function sendMailWithFallback(
  candidates: MailTransportResolved[],
  mail: { to: string; subject: string; text: string; html: string }
): Promise<void> {
  if (!candidates.length) {
    console.warn('[notifyMail] mail transport not configured (company or personal SMTP)');
    return;
  }

  let lastErr: unknown;
  for (let i = 0; i < candidates.length; i++) {
    const mailOpts = candidates[i];
    try {
      const transporter = nodemailer.createTransport(buildNodemailerTransportOptions(mailOpts));
      await transporter.sendMail({
        from: mailOpts.from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      return;
    } catch (err) {
      lastErr = err;
      if (isSmtpAuthError(err) && i < candidates.length - 1) {
        console.warn(
          `[notifyMail] SMTP auth failed for ${mailOpts.auth.user}@${mailOpts.host}; trying next transport. ${formatSmtpAuthHint(mailOpts)}`
        );
        continue;
      }
      if (isSmtpAuthError(err)) {
        console.warn(
          `[notifyMail] SMTP auth failed for ${mailOpts.auth.user}@${mailOpts.host} → ${mail.to}. ${formatSmtpAuthHint(mailOpts)}`
        );
        return;
      }
      throw err;
    }
  }
  if (lastErr) throw lastErr;
}

function resolveAppBaseUrl(): string {
  const raw = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '';
  const first = raw.split(',')[0]?.trim();
  return first ? first.replace(/\/$/, '') : '';
}

const parseUserSettings = parseSettingsBlob;

const COMMENT_FEATURES = new Set([
  'work_board_comment',
  'work_board_comment_reply',
  'project_task_comment',
  'project_task_comment_reply',
]);

const REMINDER_FEATURES = new Set([
  'unread_reminder',
  'project_task_comment_reminder',
  'email_digest',
]);

/** 수신자 알림 메일 수신 허용 여부 */
export function shouldSendEmailForNotification(
  settings: Record<string, unknown>,
  feature?: string
): boolean {
  const ui = (settings.ui || {}) as Record<string, unknown>;
  const prefs = (ui.notificationSettings || {}) as Record<string, unknown>;
  // email 스위치가 명시적으로 false일 때만 차단 (미설정·true는 발송)
  if (prefs.email === false) return false;

  const f = String(feature || '');
  const digest = String(prefs.emailDigest || 'immediate').toLowerCase();
  const isDigestMode = digest === 'daily' || digest === 'weekly';
  // 매일/매주 요약: 이벤트 즉시 메일은 생략 (리마인드·다이제스트만 허용)
  if (isDigestMode && !REMINDER_FEATURES.has(f)) {
    return false;
  }

  if (COMMENT_FEATURES.has(f)) {
    if (prefs.comments === false) return false;
    return true;
  }
  if (f === 'project_task_comment_reminder' || f === 'unread_reminder' || f === 'email_digest') {
    if (prefs.unreadReminder === false) return false;
    // 미답변 댓글 리마인드는 댓글 유형이 꺼져 있으면 생략
    if (f === 'project_task_comment_reminder' && prefs.comments === false) return false;
    return true;
  }
  if (f === 'work_board' || f === 'project_task') {
    if (prefs.workBoard === false) return false;
  }
  if (f === 'work_report' && prefs.workReport === false) return false;
  if (f === 'vacation' && prefs.vacation === false) return false;
  if ((f === 'approval' || f === 'quotation' || f === 'employment_contract') && prefs.approval === false) {
    return false;
  }
  if (f === 'expense_report' && prefs.expense === false) return false;
  if (f === 'system' && prefs.system === false) return false;
  return true;
}

/** 사용자 settings blob에서 알림 prefs 추출 */
export function getNotificationPrefsFromSettings(settings: unknown): Record<string, unknown> {
  const parsed = parseUserSettings(settings);
  const ui = (parsed.ui || {}) as Record<string, unknown>;
  return (ui.notificationSettings || {}) as Record<string, unknown>;
}

export function resolveNotificationLink(data?: Record<string, unknown>): string {
  const base = resolveAppBaseUrl();
  if (!base || !data) return '';

  const feature = String(data.feature || '');
  switch (feature) {
    case 'work_report':
      return `${base}/work/reports`;
    case 'work_board':
    case 'work_board_comment':
    case 'work_board_comment_reply': {
      if (typeof data.href === 'string' && data.href.startsWith('/') && !data.href.startsWith('//')) {
        return `${base}${data.href}`;
      }
      if (data.board_id != null) {
        const cardQs =
          data.card_id != null && Number(data.card_id) > 0 ? `?card=${data.card_id}` : '';
        return `${base}/work/projects/${data.board_id}${cardQs}`;
      }
      return `${base}/work/projects`;
    }
    case 'project_task':
    case 'project_task_comment':
    case 'project_task_comment_reply':
    case 'project_task_comment_reminder':
    case 'unread_reminder':
    case 'email_digest': {
      if (typeof data.href === 'string' && data.href.startsWith('/') && !data.href.startsWith('//')) {
        return `${base}${data.href}`;
      }
      if (data.project_id != null) {
        return `${base}/work/project-management/${data.project_id}`;
      }
      return `${base}/work/project-management`;
    }
    case 'expense_report':
      return `${base}/accounting/expense`;
    case 'approval':
      return `${base}/work/approval`;
    case 'vacation':
      return `${base}/hr/leave`;
    case 'quotation':
      return `${base}/work/quotation`;
    default:
      if (data.href) {
        const href = String(data.href);
        if (href.startsWith('http://') || href.startsWith('https://')) return href;
        if (href.startsWith('/') && !href.startsWith('//')) return `${base}${href}`;
      }
      return base;
  }
}

const TITLE_EN_BY_KO: Record<string, string> = {
  '업무 등록': 'Work Task Created',
  '업무 담당자 지정': 'Work Assignee Assignment',
  '업무 참조 지정': 'Work Watcher Assignment',
  '댓글 멘션': 'Comment Mention',
  '댓글 답글': 'Comment Reply',
  '프로젝트 댓글 답변 요청': 'Project comment reply needed',
  '프로젝트 댓글': 'Project task comment',
  '프로젝트 댓글 답글': 'Project task comment reply',
  '프로젝트 초대': 'Project Invitation',
  'Task 배정': 'Task Assigned',
  '미읽음·대기 항목 알림': 'Unread / pending items reminder',
  '휴가 승인 요청': 'Leave Approval Request',
  '견적서 승인 요청': 'Quotation Approval Request',
  '인보이스 삭제 승인 요청': 'Invoice Delete Approval Request',
  '업무 보고서 제출': 'Work Report Submitted',
  '업무 보고서': 'Work Report',
  '업무 보고서 승인': 'Work Report Approved',
  '업무 보고서 피드백': 'Work Report Feedback',
  '전자결재 승인 요청': 'Approval Request',
  '전자결재 승인 완료': 'Approval Completed',
  '전자결재 반려': 'Approval Rejected',
  '전자결재 에스컬레이션': 'Approval Forwarded',
  '보너스 지급 결재 요청': 'Bonus Payment Approval Request',
  '급여 확정 결재 요청': 'Payroll Approval Request',
  '전자근로계약 승인 요청': 'Employment Contract Approval Request',
  '전자근로계약 서명 요청': 'Employment Contract Signature Request',
  '전자근로계약 반려': 'Employment Contract Rejected',
  '결제 요청 반려': 'Payment Request Rejected',
  '결제 요청 승인': 'Payment Request Approved',
  '결제 요청': 'Payment Request',
  '결제 승인': 'Payment Approved',
  '결제 반려': 'Payment Rejected',
  '송금 대기': 'Remittance Pending',
  '지출 승인 요청': 'Expense Approval Request',
  '지출 승인': 'Expense Approved',
  '지출 반려': 'Expense Rejected',
  '지출결의서 제출': 'Expense Report Submitted',
  '지출결의서 참조': 'Expense Report CC',
  '지출결의서 수정 반려': 'Expense Report Returned for Revision',
  '지출결의서 승인권자 지정': 'Expense Report Approver Assigned',
  '지출결의서 승인권자 변경': 'Expense Report Approver Changed',
  '지출결의서 승인': 'Expense Report Approved',
  '지출결의서 반려': 'Expense Report Rejected',
};

function resolveEnglishTitle(title: string, data?: Record<string, unknown>): string {
  const fromData = String(data?.title_en || '').trim();
  if (fromData) return fromData;
  const raw = String(title || '').trim();
  const exact = TITLE_EN_BY_KO[raw];
  if (exact) return exact;
  const keys = Object.keys(TITLE_EN_BY_KO).sort((a, b) => b.length - a.length);
  for (const ko of keys) {
    if (raw.startsWith(ko)) {
      return raw.replace(ko, TITLE_EN_BY_KO[ko]);
    }
  }
  if (hasKoreanSentence(raw)) return 'Notification';
  return raw || 'Notification';
}

/** 문장 안의 한글 조사·동사. 문서 제목(따옴표)은 그대로 둔다. */
function hasKoreanSentence(text: string): boolean {
  const outside = String(text || '').replace(/"[^"]*"/g, '');
  return /[가-힣]/.test(outside);
}

const MESSAGE_PATTERNS: Array<[RegExp, (...groups: string[]) => string]> = [
  [/^(.+?)님이 "(.+)" 결재를 요청했습니다\.?$/, (name, title) => `${name} requested approval for "${title}".`],
  [/^(.+?)님이 "(.+)" 결재를 승인했습니다\. 다음 승인이 필요합니다\.?$/, (name, title) => `${name} approved "${title}". The next approval is required.`],
  [/^(.+?)님이 "(.+)" 결재를 최종 승인했습니다\.?$/, (name, title) => `${name} gave final approval for "${title}".`],
  [/^(.+?)님이 "(.+)" 결재를 반려했습니다\.?$/, (name, title) => `${name} rejected the approval "${title}".`],
  [/^(.+?)님이 "(.+)" 결재를 회원님에게 전달했습니다\.?$/, (name, title) => `${name} forwarded the approval "${title}" to you.`],
  [/^(.+?)님이 "(.+)" 업무를 등록하고 담당자로 지정했습니다\.?$/, (name, title) => `${name} created "${title}" and assigned you as the assignee.`],
  [/^(.+?)님이 "(.+)" 카드의 담당자로 지정했습니다\.?$/, (name, title) => `${name} assigned you as the assignee of the "${title}" card.`],
  [/^(.+?)님이 "(.+)" 카드의 참조자로 지정했습니다\.?$/, (name, title) => `${name} added you as a watcher on the "${title}" card.`],
  [/^(.+?)님이 "(.+)" 카드 댓글에서 회원님을 언급했습니다\.?$/, (name, title) => `${name} mentioned you in a comment on the "${title}" card.`],
  [/^(.+?)님이 "(.+)" 카드 댓글에 답글을 남겼습니다\.?$/, (name, title) => `${name} replied to a comment on the "${title}" card.`],
  [/^(.+?)님이 "(.+)" 댓글에 답글을 남겼습니다\.?$/, (name, title) => `${name} replied to a comment on "${title}".`],
  [/^(.+?)님이 "(.+)"에 댓글을 남겼습니다\.?$/, (name, title) => `${name} commented on "${title}".`],
  [/^(.+?)님이 휴가를 신청했습니다\. \((.+)\)$/, (name, period) => `${name} submitted a leave request. (${period})`],
  [/^(.+?)님의 휴가 승인 요청이 지정되었습니다\. \((.+)\)$/, (name, period) => `You were assigned to approve leave for ${name}. (${period})`],
  [/^(.+?)님이 견적서 (.+) 승인을 요청했습니다\.?$/, (name, number) => `${name} requested approval for quotation ${number}.`],
  [/^(.+?)님이 인보이스 (.+) 삭제 승인을 요청했습니다\.?$/, (name, number) => `${name} requested approval to delete invoice ${number}.`],
  [/^(.+) 삭제 승인 요청이 등록되었습니다\.?$/, (number) => `A delete approval request was registered for ${number}.`],
  [/^"(.+)" 프로젝트에 초대되었습니다\.?$/, (name) => `You were invited to the "${name}" project.`],
  [/^(.+?)님이 "(.+)" 보고서를 제출했습니다\. 확인해 주세요\.?$/, (name, title) => `${name} submitted the report "${title}". Please review it.`],
  [/^(.+?)님이 "(.+)" 보고서를 등록하고 수신자로 지정했습니다\.?$/, (name, title) => `${name} filed the report "${title}" and added you as a recipient.`],
  [/^(.+?)님이 "(.+)" 보고서를 승인했습니다\.?$/, (name, title) => `${name} approved the report "${title}".`],
  [/^(.+?)님이 "(.+)" 보고서에 피드백을 남겼습니다\.?$/, (name, title) => `${name} left feedback on the report "${title}".`],
  [/^(.+?)님이 "(.+)" 지출결의서를 수정 반려했습니다\..*$/, (name, title) => `${name} returned the expense report "${title}" for revision. Please edit and resubmit.`],
  [/^(.+?)님이 "(.+)" 지출결의서의 승인권자로 지정했습니다\.?$/, (name, title) => `${name} assigned you as the approver for the expense report "${title}".`],
  [/^(.+?)님이 "(.+)" 지출결의서의 승인권자를 변경했습니다\.?$/, (name, title) => `${name} changed the approver for the expense report "${title}".`],
  [/^(.+?)님이 "(.+)" 지출결의서를 제출했습니다\. 검토해 주세요\.?$/, (name, title) => `${name} submitted the expense report "${title}". Please review it.`],
  [/^(.+?)님이 "(.+)" 지출결의서에 참조로 지정했습니다\..*$/, (name, title) => `${name} added you as a CC on the expense report "${title}". You can track its progress.`],
  [/^(.+?)님이 "(.+)" 지출결의서를 승인했습니다\.?$/, (name, title) => `${name} approved the expense report "${title}".`],
  [/^(.+?)님이 "(.+)" 지출결의서를 반려했습니다\.?$/, (name, title) => `${name} rejected the expense report "${title}".`],
  [/^(.+?)님이 결제 요청을 보냈습니다\.?$/, (name) => `${name} sent a payment request.`],
  [/^(.+?)님의 결제 요청이 승인되었습니다\. 송금이 필요합니다\.?$/, (name) => `${name}'s payment request was approved. Remittance is required.`],
  [/^결제 요청이 반려되었습니다\. 사유: (.+)$/, (reason) => `The payment request was rejected. Reason: ${reason}`],
  [/^결제 요청이 반려되었습니다\.?$/, () => 'The payment request was rejected.'],
  [/^결제 요청이 승인되었습니다\. 사유: (.+)$/, (reason) => `The payment request was approved. Reason: ${reason}`],
  [/^결제 요청이 승인되었습니다\.?$/, () => 'The payment request was approved.'],
  [/^(.+) 승인 요청이 있습니다\.?$/, (title) => `Approval requested for ${title}.`],
  [/^(.+) 서명이 필요합니다\.?$/, (title) => `Your signature is required for ${title}.`],
  [/^(.+)이\(가\) 반려되었습니다\. 사유: (.+)$/, (title, reason) => `${title} was rejected. Reason: ${reason}`],
  [/^(.+)이\(가\) 반려되었습니다\.?$/, (title) => `${title} was rejected.`],
];

function translateNotificationMessage(message: string): string | null {
  const text = String(message || '').trim();
  if (!text) return null;
  for (const [pattern, render] of MESSAGE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    return render(...match.slice(1));
  }
  return null;
}

function localizeSystemTitles(text: string): string {
  return String(text || '')
    .replace(/보너스 지급 결재/g, 'Bonus payment approval')
    .replace(/급여 확정 결재/g, 'Payroll approval');
}

function englishFallback(message: string): string {
  const quoted = message.match(/"([^"]+)"/)?.[1]?.trim();
  const name = message.split('님')[0]?.trim();
  const actor = name && !hasKoreanSentence(name) ? name : '';
  if (actor && quoted) return `${actor} sent you a notification about "${quoted}".`;
  if (quoted) return `You have a notification about "${quoted}".`;
  return 'You have a new notification in MVS.';
}

function resolveEnglishMessage(
  message: string,
  data?: Record<string, unknown>
): string {
  const fromData = String(data?.message_en || '').trim();
  if (fromData && !hasKoreanSentence(fromData)) return fromData;

  const translated = translateNotificationMessage(message);
  if (translated && !hasKoreanSentence(translated)) return translated;

  const feature = String(data?.feature || '');
  const actor = String(data?.actor_name || '').trim();
  const cardTitle = String(data?.card_title || '').trim();

  if (feature === 'work_board' && actor && cardTitle) {
    return `${actor} assigned you as the assignee of the "${cardTitle}" card.`;
  }
  if (feature === 'work_board_comment' && actor && cardTitle) {
    return `${actor} mentioned you in a comment on the "${cardTitle}" card.`;
  }
  if (feature === 'quotation') {
    const qn = String(data?.quotation_number || '').trim();
    if (qn) {
      const name = message.split('님이')[0]?.trim() || 'Someone';
      return `${name} requested approval for quotation ${qn}.`;
    }
  }

  if (translated) return hasKoreanSentence(translated) ? englishFallback(message) : translated;
  if (hasKoreanSentence(message)) return englishFallback(message);
  return message;
}

/**
 * 사용자 알림(pushNotification)에 대응하는 이메일 발송.
 * 수신 주소는 User.email에서 조회한다. 본문은 영문만.
 * SMTP: 회사 → 발신자(sender) 개인 SMTP → 환경변수.
 */
export async function sendUserNotificationEmail(params: {
  targetUserId: number;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  tenantId?: number;
  companyId?: number;
  /** 회사 SMTP 없을 때 폴백용 발신자(업무 등록자 등) */
  senderUserId?: number;
}): Promise<void> {
  const target = await User.findByPk(params.targetUserId, {
    attributes: ['id', 'email', 'username', 'tenant_id', 'company_id', 'status', 'settings']
  });
  if (!target) return;

  const to = String((target as any).email || '').trim();
  if (!to) {
    console.warn(`[notifyMail] user ${params.targetUserId} has no email`);
    return;
  }

  const targetSettings = parseUserSettings((target as any).settings);
  const feature = params.data ? String(params.data.feature || '') : '';
  if (!shouldSendEmailForNotification(targetSettings, feature)) {
    return;
  }

  const tenantId = params.tenantId ?? (target as any).tenant_id;
  const companyId = params.companyId ?? (target as any).company_id;

  const companyRow =
    companyId != null && tenantId != null
      ? await Company.findOne({ where: { id: companyId, tenant_id: tenantId } })
      : null;

  let senderUser: { settings?: unknown } | null = null;
  if (params.senderUserId) {
    senderUser = await User.findByPk(params.senderUserId, {
      attributes: ['id', 'settings'],
    });
  }

  // 회사 → 발신자 개인 → 수신자 개인 → env 순 (인증 실패 시 다음 후보)
  const candidates = listMailTransportCandidates(companyRow, [senderUser, target as any]);
  if (!candidates.length) {
    console.warn('[notifyMail] mail transport not configured (company or personal SMTP)');
    return;
  }

  const link = resolveNotificationLink(params.data);
  const titleEn = localizeSystemTitles(resolveEnglishTitle(params.title, params.data));
  const messageEn = localizeSystemTitles(resolveEnglishMessage(params.message, params.data));
  const content = {
    titleKo: titleEn,
    titleEn,
    bodyKo: messageEn,
    bodyEn: messageEn,
    linkUrl: link || undefined
  };

  await sendMailWithFallback(candidates, {
    to,
    subject: bilingualSubject(`[MVS] ${titleEn}`, `[MVS] ${titleEn}`),
    text: buildBilingualText(content),
    html: buildBilingualHtml(content),
  });
}
