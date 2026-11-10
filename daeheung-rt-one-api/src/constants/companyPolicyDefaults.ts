/** 회사 정책 탭 키 (고정) */
export const COMPANY_POLICY_KEYS = [
  'employment',
  'attendance',
  'leave',
  'salary_payroll',
  'confidentiality_data',
  'posh',
  'separation',
] as const;

export type CompanyPolicyKey = (typeof COMPANY_POLICY_KEYS)[number];

export const isCompanyPolicyKey = (value: unknown): value is CompanyPolicyKey =>
  typeof value === 'string' && (COMPANY_POLICY_KEYS as readonly string[]).includes(value);

type PolicySeed = {
  key: CompanyPolicyKey;
  title_ko: string;
  title_en: string;
  content_ko: string;
  content_en: string;
};

export const COMPANY_POLICY_DEFAULTS: PolicySeed[] = [
  {
    key: 'employment',
    title_ko: '고용 정책',
    title_en: 'Employment Policy',
    content_ko: `1. 목적
본 정책은 회사와 임직원 간의 고용 관계, 의무 및 기대사항을 명확히 합니다.

2. 적용 범위
정규직·계약직·인턴 등 회사에 고용된 모든 임직원에게 적용됩니다.

3. 채용 및 근로계약
- 채용은 공정하고 차별 없는 절차로 진행합니다.
- 근로조건은 근로계약서에 명시하며, 변경 시 서면으로 안내합니다.

4. 근무 태도
임직원은 회사의 가치와 규정을 준수하고, 업무에 성실히 임해야 합니다.

5. 정책 개정
본 정책은 회사 필요에 따라 개정될 수 있으며, 개정 내용은 공지됩니다.`,
    content_en: `1. Purpose
This policy clarifies the employment relationship, duties, and expectations between the Company and its employees.

2. Scope
Applies to all employees engaged by the Company, including permanent, contractual, and intern roles.

3. Hiring & Employment Contract
- Recruitment shall be fair and non-discriminatory.
- Terms of employment are set out in the employment contract; material changes will be communicated in writing.

4. Conduct
Employees shall follow Company values and rules and perform duties in good faith.

5. Amendments
This policy may be updated as required; changes will be notified to employees.`,
  },
  {
    key: 'attendance',
    title_ko: '근태 정책',
    title_en: 'Attendance Policy',
    content_ko: `1. 목적
근무시간·출퇴근·근태 관리 기준을 정의합니다.

2. 근무시간
표준 근무시간 및 휴게시간은 회사·사업장 안내를 따릅니다.

3. 출퇴근 기록
지정된 시스템(또는 방법)으로 출퇴근을 기록해야 하며, 대리 체크인은 금지됩니다.

4. 지각·조퇴·결근
사전 승인 없는 지각·조퇴·결근은 근태 규정에 따라 처리됩니다.

5. 재택·외근
재택근무·외근은 사전 승인 후 허용되며, 근태 기록을 유지해야 합니다.`,
    content_en: `1. Purpose
Defines working hours, attendance recording, and related standards.

2. Working Hours
Standard hours and breaks follow Company / workplace guidance.

3. Attendance Recording
Employees must record attendance via the designated system/method. Proxy check-in is prohibited.

4. Late Arrival, Early Leave, Absence
Unapproved late arrival, early leave, or absence is handled under attendance rules.

5. Remote / Field Work
WFH and field work require prior approval and proper attendance records.`,
  },
  {
    key: 'leave',
    title_ko: '휴가 정책',
    title_en: 'Leave Policy',
    content_ko: `1. 목적
연차·병가 등 휴가의 신청·승인·사용 기준을 정합니다.

2. 휴가 종류
회사 규정 및 관련 법령에 따른 연차, 병가, 경조사 휴가 등이 포함될 수 있습니다.

3. 신청 절차
휴가는 지정된 시스템으로 사전 신청하고, 승인자의 승인을 받아야 합니다.

4. 긴급 휴가
불가피한 사유로 사전 신청이 어려운 경우, 가능한 한 빠르게 보고·사후 신청합니다.

5. 잔여 휴가
잔여 일수·소멸 기준은 회사 규정 및 법령을 따릅니다.`,
    content_en: `1. Purpose
Sets standards for applying, approving, and using leave (annual, sick, etc.).

2. Types of Leave
May include annual leave, sick leave, and other leave types under Company rules and applicable law.

3. Application
Leave must be requested in the designated system and approved by the approver.

4. Emergency Leave
If prior application is not possible, report as soon as practicable and complete follow-up application.

5. Leave Balance
Balances and lapse rules follow Company policy and applicable law.`,
  },
  {
    key: 'salary_payroll',
    title_ko: '급여·페이롤 정책',
    title_en: 'Salary & Payroll Policy',
    content_ko: `1. 목적
급여 산정·지급·공제에 관한 기준을 안내합니다.

2. 급여 구성
기본급, 수당, 법정 공제 등은 근로계약 및 급여 명세에 따릅니다.

3. 지급일
급여는 회사 지정 주기로 지급되며, 공휴일 등으로 일정이 조정될 수 있습니다.

4. 명세
급여 명세서는 시스템에서 확인할 수 있습니다. 오류가 있으면 즉시 HR/급여 담당에 문의하세요.

5. 기밀
본인 및 타인의 급여 정보는 기밀이며, 무단 공유를 금지합니다.`,
    content_en: `1. Purpose
Explains how salary is calculated, paid, and deducted.

2. Pay Components
Basic pay, allowances, and statutory deductions follow the employment contract and payslip.

3. Pay Cycle
Salary is paid on the Company schedule; dates may shift for holidays/banking constraints.

4. Payslips
Payslips are available in the system. Report discrepancies promptly to HR/Payroll.

5. Confidentiality
Compensation information is confidential; unauthorized sharing is prohibited.`,
  },
  {
    key: 'confidentiality_data',
    title_ko: '기밀·데이터 정책',
    title_en: 'Confidentiality & Data',
    content_ko: `1. 목적
회사·고객·임직원 정보의 보호와 적정 사용을 규정합니다.

2. 기밀정보
영업비밀, 고객 데이터, 미공개 재무·인사 정보 등은 기밀로 취급합니다.

3. 접근·이용
업무상 필요한 범위에서만 접근·이용하며, 개인 목적 사용을 금지합니다.

4. 외부 반출
승인 없는 외부 전송·저장·복제를 금지합니다.

5. 퇴사 시
퇴사·이동 시 회사 자료·계정·기기를 반납하고 접근 권한을 종료합니다.`,
    content_en: `1. Purpose
Protects Company, customer, and employee information and defines proper use.

2. Confidential Information
Trade secrets, customer data, and non-public financial/HR information are confidential.

3. Access & Use
Access only as needed for work; personal use is prohibited.

4. External Transfer
Unauthorized transfer, storage, or copying outside approved channels is forbidden.

5. On Exit
Return Company data, accounts, and devices and cease access upon separation or transfer.`,
  },
  {
    key: 'posh',
    title_ko: 'POSH (직장 내 성희롱 예방)',
    title_en: 'POSH',
    content_ko: `1. 목적
직장 내 성희롱·성폭력을 예방하고, 안전하고 존중받는 근무 환경을 유지합니다. (POSH: Prevention of Sexual Harassment)

2. 무관용
성희롱은 엄격히 금지되며, 위반 시 조사 및 징계 절차가 진행될 수 있습니다.

3. 신고
피해 또는 목격 시 지정된 신고 채널(내부위원회/HR 등)로 신고할 수 있습니다.

4. 조사
신고는 공정하고 가능한 한 신속·비공개로 처리됩니다. 보복을 금지합니다.

5. 교육
회사는 관련 인식 교육을 실시할 수 있으며, 임직원은 성실히 참여해야 합니다.`,
    content_en: `1. Purpose
Prevents sexual harassment at the workplace and maintains a safe, respectful environment (POSH).

2. Zero Tolerance
Sexual harassment is strictly prohibited and may lead to inquiry and disciplinary action.

3. Reporting
Incidents may be reported through designated channels (Internal Committee / HR, etc.).

4. Inquiry
Complaints will be handled fairly, promptly, and confidentially to the extent practicable. Retaliation is prohibited.

5. Awareness
The Company may conduct awareness training; employees are expected to participate.`,
  },
  {
    key: 'separation',
    title_ko: '퇴직·이직 정책',
    title_en: 'Separation Policy',
    content_ko: `1. 목적
사직·해고·계약 종료 등 고용 종료 절차를 안내합니다.

2. 사직
사직은 근로계약 및 회사 규정이 정한 통지 기간을 준수하여 서면(또는 시스템)으로 제출합니다.

3. 인수인계
퇴사 전 업무·자료·계정 인수인계를 완료해야 합니다.

4. 정산
미사용 휴가·급여·공제 등 정산은 회사 절차와 법령에 따릅니다.

5. 회사 자산
노트북·출입카드·서류 등 회사 자산을 반납해야 하며, 기밀 유지 의무는 퇴사 후에도 지속될 수 있습니다.`,
    content_en: `1. Purpose
Explains resignation, termination, and other employment separation procedures.

2. Resignation
Submit resignation in writing/system with the notice period in the contract and Company rules.

3. Handover
Complete handover of work, documents, and access before the last working day.

4. Full & Final
Leave encashment, pay, and deductions follow Company process and applicable law.

5. Company Property
Return devices, badges, and documents. Confidentiality obligations may continue after exit.`,
  },
];

export const getCompanyPolicyDefault = (key: CompanyPolicyKey): PolicySeed => {
  const found = COMPANY_POLICY_DEFAULTS.find((row) => row.key === key);
  if (!found) {
    throw new Error(`Unknown company policy key: ${key}`);
  }
  return found;
};
