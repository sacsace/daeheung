export type DepreciationMethod = 'straight_line' | 'declining_balance' | 'units_of_production';

export type DepreciationScheduleRow = {
  year: number;
  yearLabel: string;
  openingBookValue: number;
  depreciation: number;
  accumulatedDepreciation: number;
  closingBookValue: number;
};

export type DepreciationInput = {
  purchasePrice: number;
  salvageValue?: number;
  usefulLife?: number;
  depreciationRate?: number;
  purchaseDate?: string;
  depreciationMethod?: DepreciationMethod;
  asOfDate?: Date | string;
};

export type DepreciationSummary = {
  purchasePrice: number;
  salvageValue: number;
  usefulLife: number;
  depreciationRate: number;
  method: DepreciationMethod;
  yearsElapsed: number;
  currentValue: number;
  accumulatedDepreciation: number;
  annualDepreciation: number;
  schedule: DepreciationScheduleRow[];
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const parseDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const yearsBetween = (start: Date, end: Date): number => {
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return ms / (1000 * 60 * 60 * 24 * 365.25);
};

/** 정률법 기본 상각률(%) — 잔존가·내용연수 기준, 없으면 균등 상각률 */
export const resolveDepreciationRate = (input: DepreciationInput): number => {
  const cost = Number(input.purchasePrice || 0);
  const salvage = Math.max(0, Number(input.salvageValue || 0));
  const life = Math.max(0, Math.floor(Number(input.usefulLife || 0)));
  const given = Number(input.depreciationRate || 0);
  if (given > 0) return given;
  if (life <= 0 || cost <= 0) return 0;

  if ((input.depreciationMethod || 'straight_line') === 'declining_balance') {
    if (salvage > 0 && salvage < cost) {
      const rate = (1 - Math.pow(salvage / cost, 1 / life)) * 100;
      return round2(Math.min(100, Math.max(0, rate)));
    }
    return round2(Math.min(100, (2 / life) * 100)); // 이중체감 근사
  }

  const depreciable = Math.max(0, cost - salvage);
  return round2((depreciable / cost / life) * 100);
};

/** 연도별 감가상각표 생성 */
export const buildDepreciationSchedule = (input: DepreciationInput): DepreciationScheduleRow[] => {
  const cost = round2(Number(input.purchasePrice || 0));
  const salvage = round2(Math.max(0, Math.min(cost, Number(input.salvageValue || 0))));
  const life = Math.max(0, Math.floor(Number(input.usefulLife || 0)));
  const method = input.depreciationMethod || 'straight_line';
  const purchase = parseDate(input.purchaseDate);
  const startYear = purchase ? purchase.getFullYear() : new Date().getFullYear();

  if (cost <= 0 || life <= 0) return [];

  const rate = resolveDepreciationRate(input) / 100;
  const schedule: DepreciationScheduleRow[] = [];
  let book = cost;
  let accumulated = 0;

  if (method === 'declining_balance') {
    for (let y = 1; y <= life; y += 1) {
      const opening = book;
      let dep = round2(opening * rate);
      const maxDep = round2(Math.max(0, opening - salvage));
      if (y === life || dep > maxDep) dep = maxDep;
      dep = Math.max(0, dep);
      accumulated = round2(accumulated + dep);
      book = round2(Math.max(salvage, opening - dep));
      schedule.push({
        year: y,
        yearLabel: `${startYear + y - 1}`,
        openingBookValue: opening,
        depreciation: dep,
        accumulatedDepreciation: accumulated,
        closingBookValue: book,
      });
      if (book <= salvage + 0.009) break;
    }
    return schedule;
  }

  // 정액법 (생산량비례법은 사용량 데이터 없어 정액법으로 처리)
  const annual = round2(Math.max(0, cost - salvage) / life);
  for (let y = 1; y <= life; y += 1) {
    const opening = book;
    let dep = annual;
    if (y === life) dep = round2(Math.max(0, opening - salvage));
    dep = Math.max(0, Math.min(dep, round2(opening - salvage)));
    accumulated = round2(accumulated + dep);
    book = round2(Math.max(salvage, opening - dep));
    schedule.push({
      year: y,
      yearLabel: `${startYear + y - 1}`,
      openingBookValue: opening,
      depreciation: dep,
      accumulatedDepreciation: accumulated,
      closingBookValue: book,
    });
  }
  return schedule;
};

/** 현재 시점 장부가·누적상각 + 전체 상각표 */
export const calculateDepreciation = (input: DepreciationInput): DepreciationSummary => {
  const cost = round2(Number(input.purchasePrice || 0));
  const salvage = round2(Math.max(0, Math.min(cost, Number(input.salvageValue || 0))));
  const life = Math.max(0, Math.floor(Number(input.usefulLife || 0)));
  const method = input.depreciationMethod || 'straight_line';
  const rate = resolveDepreciationRate(input);
  const schedule = buildDepreciationSchedule(input);
  const annualDepreciation =
    method === 'straight_line' || method === 'units_of_production'
      ? life > 0
        ? round2(Math.max(0, cost - salvage) / life)
        : 0
      : schedule[0]?.depreciation || 0;

  const purchase = parseDate(input.purchaseDate);
  const asOf = parseDate(input.asOfDate) || new Date();
  const yearsElapsed = purchase ? yearsBetween(purchase, asOf) : 0;

  if (!schedule.length) {
    return {
      purchasePrice: cost,
      salvageValue: salvage,
      usefulLife: life,
      depreciationRate: rate,
      method,
      yearsElapsed: round2(yearsElapsed),
      currentValue: cost,
      accumulatedDepreciation: 0,
      annualDepreciation,
      schedule,
    };
  }

  const completedYears = Math.min(schedule.length, Math.floor(yearsElapsed));
  const fraction = yearsElapsed - completedYears;

  let accumulated = completedYears > 0 ? schedule[completedYears - 1].accumulatedDepreciation : 0;
  if (fraction > 0 && completedYears < schedule.length) {
    accumulated = round2(accumulated + schedule[completedYears].depreciation * fraction);
  }
  accumulated = Math.min(round2(cost - salvage), Math.max(0, accumulated));
  const currentValue = round2(Math.max(salvage, cost - accumulated));

  return {
    purchasePrice: cost,
    salvageValue: salvage,
    usefulLife: life,
    depreciationRate: rate,
    method,
    yearsElapsed: round2(yearsElapsed),
    currentValue,
    accumulatedDepreciation: accumulated,
    annualDepreciation,
    schedule,
  };
};
