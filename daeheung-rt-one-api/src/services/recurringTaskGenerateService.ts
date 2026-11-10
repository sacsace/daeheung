import {
  RecurringBoardClient,
  RecurringTaskAssignment,
  RecurringTaskInstance,
  RecurringTaskTemplate,
  WorkBoard,
} from '../models';

const FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUALLY', 'CUSTOM'] as const;

function normalizeFrequency(value: unknown): (typeof FREQUENCIES)[number] {
  const raw = String(value || 'MONTHLY').trim().toUpperCase();
  return (FREQUENCIES as readonly string[]).includes(raw)
    ? (raw as (typeof FREQUENCIES)[number])
    : 'MONTHLY';
}

export function parsePeriod(value: unknown): { period: string; year: number; month: number } | null {
  const raw = String(value || '').trim();
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return { period: `${year}-${String(month).padStart(2, '0')}`, year, month };
}

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function frequencyAppliesToPeriod(frequency: string, month: number): boolean {
  const f = normalizeFrequency(frequency);
  if (f === 'MONTHLY' || f === 'CUSTOM') return true;
  if (f === 'QUARTERLY') return [3, 6, 9, 12].includes(month);
  if (f === 'HALF_YEARLY') return [3, 9].includes(month);
  if (f === 'ANNUALLY') return month === 3;
  return true;
}

function periodBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function computeDueDate(year: number, month: number, dueDay?: number | null): string {
  const bounds = periodBounds(year, month);
  if (!dueDay || dueDay < 1) return bounds.end;
  let dueYear = year;
  let dueMonth = month + 1;
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }
  const maxDay = new Date(dueYear, dueMonth, 0).getDate();
  const day = Math.min(dueDay, maxDay);
  return `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export type GenerateBoardResult = {
  board_id: number;
  period: string;
  created: number;
  skipped: number;
  instance_ids: number[];
  skipped_reason?: string;
};

/**
 * 한 보드의 특정 period 인스턴스를 생성한다. 이미 있으면 스킵(멱등).
 */
export async function generateRecurringInstancesForBoard(
  board: { id: number; tenant_id: number; company_id: number },
  periodInput?: string | null,
  createdBy?: number | null
): Promise<GenerateBoardResult> {
  const parsed = parsePeriod(periodInput) || parsePeriod(currentPeriod())!;
  const { period, year, month } = parsed;
  const bounds = periodBounds(year, month);

  const [templates, clients, assignments] = await Promise.all([
    RecurringTaskTemplate.findAll({ where: { board_id: board.id, is_active: true } }),
    RecurringBoardClient.findAll({ where: { board_id: board.id, is_active: true } }),
    RecurringTaskAssignment.findAll({ where: { board_id: board.id, is_active: true } }),
  ]);

  if (clients.length === 0) {
    return {
      board_id: board.id,
      period,
      created: 0,
      skipped: 0,
      instance_ids: [],
      skipped_reason: 'no_clients',
    };
  }

  const applicable = templates.filter((t) => frequencyAppliesToPeriod(String(t.frequency), month));
  if (applicable.length === 0) {
    return {
      board_id: board.id,
      period,
      created: 0,
      skipped: 0,
      instance_ids: [],
      skipped_reason: 'no_applicable_templates',
    };
  }

  const assignmentMap = new Map<string, RecurringTaskAssignment>();
  for (const a of assignments) {
    assignmentMap.set(`${a.customer_id}:${a.template_id}`, a);
  }

  let created = 0;
  let skipped = 0;
  const instanceIds: number[] = [];

  for (const client of clients) {
    for (const template of applicable) {
      const existing = await RecurringTaskInstance.findOne({
        where: {
          board_id: board.id,
          customer_id: client.customer_id,
          template_id: template.id,
          period,
        },
        paranoid: false,
      });
      if (existing && !existing.deleted_at) {
        skipped += 1;
        continue;
      }

      const assignment = assignmentMap.get(`${client.customer_id}:${template.id}`);
      /** 담당 미지정 고객사×템플릿은 체크리스트에 안 나오므로 생성도 건너뜀 */
      if (!assignment?.assigned_user_id) {
        skipped += 1;
        continue;
      }
      const dueDate = computeDueDate(year, month, template.default_due_day);

      if (existing && existing.deleted_at) {
        await existing.restore();
        await existing.update({
          period_start: bounds.start,
          period_end: bounds.end,
          due_date: dueDate,
          status: 'PENDING',
          assigned_user_id: assignment?.assigned_user_id ?? null,
          reviewer_user_id: assignment?.reviewer_user_id ?? null,
          completed_by: null,
          completed_at: null,
          verified_by: null,
          verified_at: null,
          notes: null,
          attachments: [],
          created_by: createdBy ?? existing.created_by ?? null,
        });
        instanceIds.push(existing.id);
        created += 1;
        continue;
      }

      const row = await RecurringTaskInstance.create({
        tenant_id: board.tenant_id,
        company_id: board.company_id,
        board_id: board.id,
        template_id: template.id,
        customer_id: client.customer_id,
        period,
        period_start: bounds.start,
        period_end: bounds.end,
        due_date: dueDate,
        status: 'PENDING',
        assigned_user_id: assignment?.assigned_user_id ?? null,
        reviewer_user_id: assignment?.reviewer_user_id ?? null,
        attachments: [],
        created_by: createdBy ?? null,
      });
      instanceIds.push(row.id);
      created += 1;
    }
  }

  return {
    board_id: board.id,
    period,
    created,
    skipped,
    instance_ids: instanceIds,
  };
}

export type GenerateAllResult = {
  period: string;
  boards: number;
  created: number;
  skipped: number;
  details: GenerateBoardResult[];
};

/** 모든 RECURRING 보드에 대해 지정(또는 현재) period 인스턴스를 멱등 생성 */
export async function generateRecurringInstancesForAllBoards(
  periodInput?: string | null
): Promise<GenerateAllResult> {
  const period = (parsePeriod(periodInput) || parsePeriod(currentPeriod())!).period;
  const boards = await WorkBoard.findAll({
    where: { board_type: 'RECURRING' },
    attributes: ['id', 'tenant_id', 'company_id', 'name'],
  });

  const details: GenerateBoardResult[] = [];
  let created = 0;
  let skipped = 0;

  for (const board of boards) {
    try {
      const result = await generateRecurringInstancesForBoard(board, period, null);
      details.push(result);
      created += result.created;
      skipped += result.skipped;
    } catch (error) {
      console.error(`recurring auto-generate board ${board.id} failed:`, error);
      details.push({
        board_id: board.id,
        period,
        created: 0,
        skipped: 0,
        instance_ids: [],
        skipped_reason: 'error',
      });
    }
  }

  return { period, boards: boards.length, created, skipped, details };
}

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6시간
const DAY1_HOUR_UTC = Number(process.env.RECURRING_GENERATE_HOUR_UTC || 1);

let timer: NodeJS.Timeout | null = null;
let running = false;

function isAutoGenerateDisabled(): boolean {
  const raw = String(process.env.RECURRING_AUTO_GENERATE_DISABLED || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/**
 * 현재 period 누락 인스턴스 보강(멱등).
 * interval마다 실행되어 월중 추가된 고객사·템플릿도 반영한다.
 */
export async function runRecurringAutoGenerateTick(): Promise<GenerateAllResult | null> {
  if (isAutoGenerateDisabled()) return null;
  if (running) return null;
  running = true;
  try {
    const period = currentPeriod();
    const result = await generateRecurringInstancesForAllBoards(period);
    const now = new Date();
    const isDay1Pass =
      now.getUTCDate() === 1 &&
      now.getUTCHours() >= (Number.isFinite(DAY1_HOUR_UTC) ? DAY1_HOUR_UTC : 1);

    if (result.created > 0 || isDay1Pass) {
      console.info(
        `recurring auto-generate: period=${result.period} boards=${result.boards} created=${result.created} skipped=${result.skipped}`
      );
    }
    return result;
  } catch (error) {
    console.error('recurring auto-generate failed:', error);
    return null;
  } finally {
    running = false;
  }
}

export function startRecurringTaskGenerateScheduler(): void {
  if (timer) return;
  if (isAutoGenerateDisabled()) {
    console.info('recurring auto-generate scheduler: disabled by env');
    return;
  }

  const intervalRaw = Number(process.env.RECURRING_AUTO_GENERATE_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  const intervalMs =
    Number.isFinite(intervalRaw) && intervalRaw >= 60 * 60 * 1000 ? intervalRaw : DEFAULT_INTERVAL_MS;

  // 기동 직후 한 번 (현재 달 누락분 보강)
  void runRecurringAutoGenerateTick();
  timer = setInterval(() => void runRecurringAutoGenerateTick(), intervalMs);
  timer.unref();
  console.info(
    `recurring auto-generate scheduler: every ${Math.round(intervalMs / 3600000)}h (idempotent current period)`
  );
}
