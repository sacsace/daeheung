/** I, O 제외 — 읽기 쉬운 대문자+숫자 */
const BOOKING_ID_CHARS = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomAlnumSegment(len: number): string {
  let out = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint8Array(len);
    crypto.getRandomValues(buf);
    for (let i = 0; i < len; i++) {
      out += BOOKING_ID_CHARS[buf[i] % BOOKING_ID_CHARS.length];
    }
  } else {
    for (let i = 0; i < len; i++) {
      out += BOOKING_ID_CHARS[Math.floor(Math.random() * BOOKING_ID_CHARS.length)];
    }
  }
  return out;
}

/** 객실 예약 — 짧은 표시용 번호 (예: RB-A3K7M2). DB unique 충돌 시 재시도 */
export function generateRoomBookingId(): string {
  return `RB-${randomAlnumSegment(6)}`;
}

/** 프론트 워크인 — 동일 규칙, 접두만 구분 (예: W-X9Y1Z4) */
export function generateWalkInBookingId(): string {
  return `W-${randomAlnumSegment(6)}`;
}
