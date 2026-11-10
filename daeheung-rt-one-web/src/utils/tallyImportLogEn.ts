/** Translate Tally import issue logs to English for Excel export. */

export const tallyIssueLevelToEn = (level: string): string => {
  if (level === 'error') return 'Failed';
  if (level === 'warn') return 'Warning';
  if (level === 'info') return 'Info';
  return level || '-';
};

export const tallyIssueMessageToEn = (message: string): string => {
  const m = String(message || '');
  const rules: Array<[RegExp, string]> = [
    [/^계정 중복 매칭\(재사용\):\s*(.+)$/u, 'Account matched (reused): $1'],
    [/^계정 미매칭:\s*(.+)$/u, 'Account unmatched: $1'],
    [/^계정 생성:\s*(.+)$/u, 'Account created: $1'],
    [/^전표 건너뜀\(파일 내 중복\):\s*(.+)$/u, 'Voucher skipped (duplicate in file): $1'],
    [/^전표 건너뜀\(GUID 중복\):\s*(.+)$/u, 'Voucher skipped (duplicate GUID): $1'],
    [/^전표 건너뜀\(Tally 전표번호·일자 중복\):\s*(.+)$/u, 'Voucher skipped (duplicate Tally voucher no. + date): $1'],
    [/^전표 건너뜀\(전표번호 중복\):\s*(.+)$/u, 'Voucher skipped (duplicate voucher number): $1'],
    [/^전표 건너뜀\(DB 중복 제약\):\s*(.+)$/u, 'Voucher skipped (DB unique constraint): $1'],
    [/^전표 실패 — 계정 없음:\s*(.+)$/u, 'Voucher failed — account not found: $1'],
    [/^전표 실패 — 그룹 계정 전기 불가:\s*(.+)$/u, 'Voucher failed — cannot post to group account: $1'],
    [/^전표 실패 — 라인 부족\(최소 2줄, 현재 (.+)줄\)$/u, 'Voucher failed — insufficient lines (min 2, found $1)'],
    [
      /^전표 실패 — 복식부기 불일치:\s*차변\s*(.+)\s*\/\s*대변\s*(.+)$/u,
      'Voucher failed — unbalanced entry: Debit $1 / Credit $2',
    ],
    [/^전표 실패 — 생성 오류:\s*(.+)$/u, 'Voucher failed — create error: $1'],
    [
      /^파트너 마스터 파싱:\s*거래처원장\s*(.+?)건\s*·\s*GSTIN\s*(.+?)건\s*·\s*주소\s*(.+?)건$/u,
      'Party master parsed: party ledgers $1 · GSTIN $2 · address $3',
    ],
    [/^파트너 회사명 정규화:\s*(.+?)건.*$/u, 'Partner company names normalized: $1'],
    [/^파트너 회사명 정규화 중 오류:\s*(.+)$/u, 'Partner company name normalization error: $1'],
  ];

  for (const [re, repl] of rules) {
    if (re.test(m)) return m.replace(re, repl);
  }
  return m;
};

export const tallyIssueContextToEn = (context?: string | null): string => {
  let c = String(context || '-');
  if (!c || c === '-') return '-';

  c = c
    .replace(/전표:/g, 'Voucher:')
    .replace(/일자:/g, 'Date:')
    .replace(/유형:/g, 'Type:')
    .replace(/차이:/g, 'Diff:')
    .replace(/사유:/g, 'Reason:')
    .replace(/원본라인:/g, 'Source lines:')
    .replace(/차변 합계와 대변 합계가 일치하지 않음/g, 'Debit total does not equal credit total')
    .replace(/차변·대변을 구성할 유효 계정이 부족함/g, 'Not enough valid accounts for debit/credit lines')
    .replace(/전표 거래처보강\s*(\d+)건/g, 'Voucher party enrichment $1')
    .replace(/알 수 없는 오류/g, 'Unknown error');

  return c;
};
