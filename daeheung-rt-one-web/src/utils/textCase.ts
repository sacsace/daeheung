/** 첫 글자 대문자, 나머지 소문자 (문장 케이스) */
export function toSentenceCase(value: string | null | undefined): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const firstLetter = s.search(/[A-Za-z\uAC00-\uD7A3]/);
  if (firstLetter < 0) return s;
  return s.slice(0, firstLetter) + s.charAt(firstLetter).toUpperCase() + s.slice(firstLetter + 1).toLowerCase();
}

const hasHangul = (value: string) => /[\uAC00-\uD7A3]/.test(value);

/**
 * 영어 항목만 문장 케이스. 한글은 그대로 둔다.
 * "(a) Short Term Borrowings" → "(a) Short term borrowings"
 */
export function formatEnglishSentenceLabel(value: string | null | undefined): string {
  const s = String(value ?? '').trim();
  if (!s || hasHangul(s)) return s;

  const prefixMatch = s.match(/^(Note\s+\d+\s+|\(([a-zA-Z]+|\d+)\)\s+)/i);
  if (prefixMatch) {
    const rest = s.slice(prefixMatch[0].length).trim();
    if (!rest) return s;
    return `${prefixMatch[0].replace(/\s+$/, ' ')}${toSentenceCase(rest)}`;
  }
  return toSentenceCase(s);
}

/** 단어마다 첫 글자 대문자·나머지 소문자 (입력 양식용) */
export function toProperCaseInput(value: string | null | undefined): string {
  const raw = String(value ?? '');
  if (!raw.trim()) return raw;

  // 한글만 있으면 원문 유지 (대소문자 개념 없음)
  if (hasHangul(raw) && !/[A-Za-z]/.test(raw)) return raw;

  return raw.replace(/[A-Za-z0-9]+/g, (word) => {
    if (/^\d+$/.test(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

/** IFSC / GSTIN / PAN 등 코드성 값은 대소문자 변환 제외 */
export function looksLikeIdentityCode(value: string): boolean {
  const t = String(value || '').replace(/[\s-]/g, '');
  if (!t) return false;
  if (/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(t)) return true; // IFSC
  if (/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]{3}$/i.test(t)) return true; // GSTIN
  if (/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(t)) return true; // PAN
  return false;
}

const SKIP_INPUT_TYPES = new Set([
  'password',
  'email',
  'number',
  'tel',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'url',
  'hidden',
  'file',
  'color',
  'range',
  'checkbox',
  'radio',
  'search',
]);

export function shouldApplyProperCaseToInput(
  el: HTMLInputElement | HTMLTextAreaElement
): boolean {
  if (el.disabled || el.readOnly) return false;
  if (el.dataset.skipProperCase === '1' || el.dataset.skipProperCase === 'true') return false;
  if (el instanceof HTMLInputElement) {
    const type = String(el.type || 'text').toLowerCase();
    if (SKIP_INPUT_TYPES.has(type)) return false;
    const mode = String(el.inputMode || '').toLowerCase();
    if (mode === 'numeric' || mode === 'decimal' || mode === 'tel' || mode === 'email') return false;
  }
  const name = `${el.name || ''} ${el.id || ''} ${el.getAttribute('autocomplete') || ''}`.toLowerCase();
  if (
    /password|email|otp|pin|ifsc|gst|pan|aadhaar|aadhar|cin|token|secret|userid|user_id|login|bank[_-]?name|\bbank\b|account[_-]?number|accountnumber|phone|tel/.test(
      name
    )
  ) {
    return false;
  }
  // 댓글·답글: 입력한 대소문자 그대로 유지
  const commentMeta = `${name} ${el.className || ''} ${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''}`.toLowerCase();
  if (/comment|reply|댓글|답글/.test(commentMeta)) {
    return false;
  }
  if (el.closest('[data-skip-proper-case="1"], [data-skip-proper-case="true"], [data-comment-input="1"]')) {
    return false;
  }
  if (looksLikeIdentityCode(el.value)) return false;
  return true;
}

/** React controlled input 값 갱신 (native setter + input/change) */
export function setNativeInputValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  descriptor?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
