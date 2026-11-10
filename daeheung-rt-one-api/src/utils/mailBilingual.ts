/**
 * 시스템 아웃바운드 메일 — **영문 전용**.
 * (호환을 위해 bilingual* 함수명·ko 필드 유지하되, 본문/제목은 en을 우선 사용한다.)
 */

export function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 제목: 영문만 사용 (ko는 무시, en 없으면 ko 폴백) */
export function bilingualSubject(ko: string, en: string): string {
  const e = String(en || '').trim();
  const k = String(ko || '').trim();
  return e || k || '[MVS]';
}

export type BilingualMailContent = {
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
  /** 이미 HTML인 본문(표 등). 있으면 bodyEn 대신 삽입 */
  bodyHtmlKo?: string;
  bodyHtmlEn?: string;
  linkUrl?: string;
  linkLabelKo?: string;
  linkLabelEn?: string;
  footerKo?: string;
  footerEn?: string;
};

const DEFAULT_FOOTER_EN = 'This is an MVS notification.';
const DEFAULT_LINK_EN = 'View in system';

function nlToBr(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br/>');
}

function pickEn(en: string, ko: string): string {
  const e = String(en || '').trim();
  const k = String(ko || '').trim();
  return e || k;
}

/** plain text 본문 (영문만) */
export function buildBilingualText(content: BilingualMailContent): string {
  const linkEn = content.linkLabelEn || DEFAULT_LINK_EN;
  const footerEn = content.footerEn || DEFAULT_FOOTER_EN;
  const title = pickEn(content.titleEn, content.titleKo);
  const body = pickEn(content.bodyEn, content.bodyKo);

  const lines = [
    title,
    body,
    content.linkUrl ? `\n${linkEn}: ${content.linkUrl}` : '',
    '',
    footerEn,
  ];

  return lines
    .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n');
}

/** HTML 본문 (영문만) */
export function buildBilingualHtml(content: BilingualMailContent): string {
  const linkEn = content.linkLabelEn || DEFAULT_LINK_EN;
  const footerEn = content.footerEn || DEFAULT_FOOTER_EN;
  const title = pickEn(content.titleEn, content.titleKo);
  const bodyEn =
    content.bodyHtmlEn ??
    `<p style="margin:0 0 16px;">${nlToBr(pickEn(content.bodyEn, content.bodyKo))}</p>`;
  const linkHtml = content.linkUrl
    ? `<p><a href="${escapeHtml(content.linkUrl)}" style="color:#007a83;">${escapeHtml(linkEn)}</a></p>`
    : '';

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#111827;line-height:1.55;max-width:640px;">
      <p style="margin:0 0 4px;font-weight:700;">${escapeHtml(title)}</p>
      ${bodyEn}
      ${linkHtml}
      <p style="margin-top:20px;font-size:12px;color:#9ca3af;">${escapeHtml(footerEn)}</p>
    </div>
  `.trim();
}
