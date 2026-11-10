/** 명세서 Earnings에 그대로 그릴 행 (엑셀 열 단위 수당 등) */
export type PayslipEarningLine = {
  label: string;
  amount: number;
  highlight?: boolean;
};

export type PayrollGridRow = {
  id: number;
  row_no: number;
  emp_id: string;
  bank_account: string;
  ifsc: string;
  bank_name: string;
  employee_email: string;
  department: string;
  employee_name: string;
  position: string;
  birth_date: string;
  joining_date: string;
  /** 근무형태 코드 (fulltime | daily | service | …) */
  employment_type?: string;
  /** 급여 근무월(YYYY-MM) */
  working_month: string;
  basic_salary: number;
  house_rent_allowance: number;
  other_allowance: number;
  /** Food / Meals allowance — 급여 패키지 구성 */
  food_allowance: number;
  /**
   * 상수 영역 사용자 추가 항목 (id → 금액).
   * basic_salary / house_rent_allowance / other_allowance 는 전용 필드 사용.
   */
  constant_parts?: Record<string, number>;
  total_salary: number;
  total_day_of_month: string;
  unpaid_leave: string;
  days_worked: string;
  /** extra_fields.employment_salary_basis — monthly | daily | fixed_rest_monthly */
  employment_salary_basis?: string;
  /** Fixed Rest-Day 정기 휴무일 수 (기본 4) */
  fixed_rest_days?: number;
  ot_rate: number;
  day_ot_hour: number;
  night_ot_hour: number;
  /** 인사정보 OT 적용 대상 (기본 false — 체크한 직원만 자동 OT 반영) */
  ot_eligible?: boolean;
  /** 인사정보 PT 적용 (기본 true — 회사 GST 주 기준 자동 계산) */
  pt_eligible?: boolean;
  /** 그리드에서 OT 시간을 수동 입력한 경우 — 미적용 직원이어도 OT 계산 허용 */
  ot_manual?: boolean;
  /** 그리드에서 OT 요율을 직접 입력한 경우 — 기본급 공식으로 덮어쓰지 않음 */
  ot_rate_manual?: boolean;
  /** 그리드에서 PF(직원) 금액을 수동 입력한 경우 — 자동 재계산 덮어쓰기 방지 */
  pf_manual?: boolean;
  /** 그리드에서 TDS 금액을 수동 입력한 경우 */
  tds_manual?: boolean;
  /** 그리드에서 PT 금액을 수동 입력한 경우 */
  pt_manual?: boolean;
  /** 그리드에서 ESIC 금액을 수동 입력한 경우 — 자동 재계산 덮어쓰기 방지 */
  esic_manual?: boolean;
  /** true면 PF 상한 적용 (기본), false면 기본급×12% — deprecated, pf_calc_mode 사용 */
  pf_cap_1800?: boolean;
  /** 인사정보 PF 계산: cap_1800(상한 3,000) | basic_12pct | total_12pct | none */
  pf_calc_mode?: 'cap_1800' | 'basic_12pct' | 'total_12pct' | 'none';
  transport_allowance: number;
  overtime: number;
  sum_total: number;
  /** 사용자 추가 수당 컬럼 값 (컬럼 id → 금액) */
  custom_allowances?: Record<string, number>;
  /** count 모드 컬럼 — 사용자 입력 횟수 (컬럼 id → 횟수) */
  custom_allowance_inputs?: Record<string, number>;
  /** extra_fields.indian_pf_mode — 기본 basic_12pct */
  indian_pf_mode?: 'basic_12pct' | 'gross_6pct' | 'epf_12pct_half';
  pf_employee: string;
  pf_employer: string;
  esic_employee: string;
  esic_employer: string;
  tds: number;
  pt: string;
  /** API deductions — 명세서·저장에 사용 */
  deduct_this_month: number;
  net_salary_payable: number;
  /**
   * 엑셀 매핑 열 순서·헤더명 그대로의 수당 행.
   * 있으면 명세서 Earnings는 이 목록을 사용 (합산 Other Allowance 대신).
   */
  payslip_earning_lines?: PayslipEarningLine[];
  actions?: string;
};
