import { Op } from 'sequelize';
import {
  ExpenseReport,
  Project,
  ProjectTask,
  ProjectTaskAssignee,
  ProjectTaskComment,
  User,
  WorkBoardCard,
} from '../models';
import {
  listUnreadNotificationsForUser,
  listUserIdsWithUnreadNotifications,
} from '../controllers/notificationController';
import {
  getNotificationPrefsFromSettings,
  sendUserNotificationEmail,
} from '../utils/userNotificationMail';

/** UTC 기준 매일 이 시각에 1회 (로컬 개발 시 서버 재시작마다 즉시 발송하지 않음) */
const DIGEST_HOUR_UTC = Number(process.env.UNREAD_REMINDER_HOUR_UTC || 1);
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let running = false;
/** YYYY-MM-DD (UTC) — 프로세스 내 하루 1회 가드 */
let lastRunDayUtc: string | null = null;

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function shouldRunNow(now = new Date()): boolean {
  if (lastRunDayUtc === utcDayKey(now)) return false;
  const hour = Number.isFinite(DIGEST_HOUR_UTC) ? Math.floor(DIGEST_HOUR_UTC) : 1;
  // 해당 UTC 시각에만 실행 → 서버 재시작마다 즉시 재발송하지 않음
  return now.getUTCHours() === hour;
}

type DigestBucket = {
  unreadNotifs: Array<{ title: string; message: string }>;
  expenses: Array<{ title: string; expenseId: string }>;
  tasks: Array<{ projectName: string; taskTitle: string }>;
  cards: Array<{ title: string }>;
  unansweredComments: Array<{ projectName: string; taskTitle: string; preview: string }>;
};

function emptyBucket(): DigestBucket {
  return {
    unreadNotifs: [],
    expenses: [],
    tasks: [],
    cards: [],
    unansweredComments: [],
  };
}

function bucketHasItems(b: DigestBucket): boolean {
  return (
    b.unreadNotifs.length +
      b.expenses.length +
      b.tasks.length +
      b.cards.length +
      b.unansweredComments.length >
    0
  );
}

function shouldSendDigestForUser(prefs: Record<string, unknown>, now: Date): boolean {
  if (prefs.email === false) return false;
  if (prefs.unreadReminder === false) return false;
  const digest = String(prefs.emailDigest || 'immediate').toLowerCase();
  // weekly 요약 사용자는 UTC 월요일에만 발송
  if (digest === 'weekly' && now.getUTCDay() !== 1) return false;
  return true;
}

function formatDigestMessage(b: DigestBucket): { ko: string; en: string } {
  const sectionsKo: string[] = [];
  const sectionsEn: string[] = [];

  if (b.unreadNotifs.length) {
    const lines = b.unreadNotifs
      .slice(0, 8)
      .map((n) => `· ${n.title}: ${n.message}`.slice(0, 160));
    const more =
      b.unreadNotifs.length > 8 ? `\n…and ${b.unreadNotifs.length - 8} more` : '';
    sectionsKo.push(`미읽음 알림 ${b.unreadNotifs.length}건\n${lines.join('\n')}${more}`);
    sectionsEn.push(`Unread notifications (${b.unreadNotifs.length})\n${lines.join('\n')}${more}`);
  }
  if (b.expenses.length) {
    const lines = b.expenses.slice(0, 8).map((e) => `· ${e.title || e.expenseId}`);
    const more = b.expenses.length > 8 ? `\n…and ${b.expenses.length - 8} more` : '';
    sectionsKo.push(`승인 대기 지출 ${b.expenses.length}건\n${lines.join('\n')}${more}`);
    sectionsEn.push(`Pending expenses (${b.expenses.length})\n${lines.join('\n')}${more}`);
  }
  if (b.tasks.length) {
    const lines = b.tasks.slice(0, 8).map((t) => `· [${t.projectName}] ${t.taskTitle}`);
    const more = b.tasks.length > 8 ? `\n…and ${b.tasks.length - 8} more` : '';
    sectionsKo.push(`미완료 담당 업무 ${b.tasks.length}건\n${lines.join('\n')}${more}`);
    sectionsEn.push(`Open assigned tasks (${b.tasks.length})\n${lines.join('\n')}${more}`);
  }
  if (b.cards.length) {
    const lines = b.cards.slice(0, 8).map((c) => `· ${c.title}`);
    const more = b.cards.length > 8 ? `\n…and ${b.cards.length - 8} more` : '';
    sectionsKo.push(`미완료 보드 카드 ${b.cards.length}건\n${lines.join('\n')}${more}`);
    sectionsEn.push(`Open board cards (${b.cards.length})\n${lines.join('\n')}${more}`);
  }
  if (b.unansweredComments.length) {
    const lines = b.unansweredComments
      .slice(0, 8)
      .map((c) => `· [${c.projectName}] ${c.taskTitle}: "${c.preview || '…'}"`);
    const more =
      b.unansweredComments.length > 8
        ? `\n…and ${b.unansweredComments.length - 8} more`
        : '';
    sectionsKo.push(
      `미답변 댓글 ${b.unansweredComments.length}건\n${lines.join('\n')}${more}`
    );
    sectionsEn.push(
      `Unanswered comments (${b.unansweredComments.length})\n${lines.join('\n')}${more}`
    );
  }

  return {
    ko: `확인이 필요한 항목이 있습니다.\n\n${sectionsKo.join('\n\n')}\n\nMVS에서 확인해 주세요.`,
    en: `You have items that need attention.\n\n${sectionsEn.join('\n\n')}\n\nPlease review them in MVS.`,
  };
}

async function collectUnansweredCommentsByAssignee(): Promise<Map<number, DigestBucket['unansweredComments']>> {
  const map = new Map<number, DigestBucket['unansweredComments']>();
  try {
    const topComments = await (ProjectTaskComment as any).findAll({
      where: { parent_id: null },
      attributes: ['id', 'task_id', 'user_id', 'content'],
      include: [
        {
          model: ProjectTask,
          as: 'task',
          required: true,
          attributes: ['id', 'title', 'project_id', 'status', 'is_active'],
          where: {
            is_active: true,
            status: { [Op.notIn]: ['completed', 'cancelled'] },
          },
          include: [
            {
              model: Project,
              as: 'project',
              required: true,
              attributes: ['id', 'name'],
            },
            {
              model: ProjectTaskAssignee,
              as: 'assignees',
              required: false,
              attributes: ['user_id'],
            },
          ],
        },
      ],
    });
    if (!topComments.length) return map;

    const topIds = topComments.map((c: any) => Number(c.id)).filter((id: number) => id > 0);
    const replyRows = await (ProjectTaskComment as any).findAll({
      where: { parent_id: { [Op.in]: topIds } },
      attributes: ['parent_id'],
      raw: true,
    });
    const replied = new Set(
      replyRows.map((r: any) => Number(r.parent_id)).filter((id: number) => id > 0)
    );

    for (const comment of topComments) {
      const commentId = Number(comment.id);
      if (replied.has(commentId)) continue;
      const task = comment.task;
      const project = task?.project;
      if (!task || !project) continue;
      const authorId = comment.user_id != null ? Number(comment.user_id) : null;
      const preview = String(comment.content || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
      const item = {
        projectName: String(project.name || ''),
        taskTitle: String(task.title || ''),
        preview,
      };
      for (const a of Array.isArray(task.assignees) ? task.assignees : []) {
        const uid = Number(a.user_id);
        if (!Number.isFinite(uid) || uid <= 0) continue;
        if (authorId != null && uid === authorId) continue;
        const list = map.get(uid) || [];
        list.push(item);
        map.set(uid, list);
      }
    }
  } catch (err) {
    console.error('unread reminder: unanswered comments:', err);
  }
  return map;
}

/**
 * 미읽음 알림·대기 지출·미완료 업무/카드·미답변 댓글을 하루 1회 메일로 리마인드.
 */
export async function sendUnreadReminders(): Promise<number> {
  if (running) return 0;
  running = true;
  let mailCount = 0;
  const now = new Date();

  try {
    const byUser = new Map<number, DigestBucket>();
    const ensure = (uid: number) => {
      if (!byUser.has(uid)) byUser.set(uid, emptyBucket());
      return byUser.get(uid)!;
    };

    for (const uid of listUserIdsWithUnreadNotifications()) {
      const rows = listUnreadNotificationsForUser(uid, 20);
      const b = ensure(uid);
      b.unreadNotifs = rows.map((n) => ({
        title: String(n.title || 'Notification'),
        message: String(n.message || '').slice(0, 120),
      }));
    }

    try {
      const expenses = await (ExpenseReport as any).findAll({
        where: {
          is_active: true,
          status: { [Op.in]: ['submitted', 'in_review'] },
          current_approver_id: { [Op.ne]: null },
        },
        attributes: ['id', 'title', 'expense_id', 'current_approver_id', 'company_id', 'tenant_id'],
        limit: 500,
      });
      for (const exp of expenses) {
        const uid = Number(exp.current_approver_id);
        if (!Number.isFinite(uid) || uid <= 0) continue;
        ensure(uid).expenses.push({
          title: String(exp.title || ''),
          expenseId: String(exp.expense_id || exp.id),
        });
      }
    } catch (err) {
      console.error('unread reminder: expenses:', err);
    }

    try {
      const assignments = await (ProjectTaskAssignee as any).findAll({
        attributes: ['user_id', 'task_id'],
        include: [
          {
            model: ProjectTask,
            as: 'task',
            required: true,
            attributes: ['id', 'title', 'project_id', 'status', 'is_active'],
            where: {
              is_active: true,
              status: { [Op.notIn]: ['completed', 'cancelled'] },
            },
            include: [
              {
                model: Project,
                as: 'project',
                required: true,
                attributes: ['id', 'name'],
              },
            ],
          },
        ],
        limit: 800,
      });
      for (const row of assignments) {
        const uid = Number(row.user_id);
        if (!Number.isFinite(uid) || uid <= 0) continue;
        const task = row.task;
        if (!task) continue;
        ensure(uid).tasks.push({
          projectName: String(task.project?.name || ''),
          taskTitle: String(task.title || ''),
        });
      }
    } catch (err) {
      console.error('unread reminder: tasks:', err);
    }

    try {
      const cards = await (WorkBoardCard as any).findAll({
        where: {
          assignee_user_id: { [Op.ne]: null },
          completed_at: null,
        },
        attributes: ['id', 'title', 'assignee_user_id'],
        limit: 500,
      });
      for (const card of cards) {
        const uid = Number(card.assignee_user_id);
        if (!Number.isFinite(uid) || uid <= 0) continue;
        ensure(uid).cards.push({ title: String(card.title || '') });
      }
    } catch (err) {
      console.error('unread reminder: board cards:', err);
    }

    const unanswered = await collectUnansweredCommentsByAssignee();
    for (const [uid, items] of unanswered) {
      ensure(uid).unansweredComments = items;
    }

    const userIds = [...byUser.keys()].filter((id) => bucketHasItems(byUser.get(id)!));
    if (!userIds.length) return 0;

    const users = await (User as any).findAll({
      where: {
        id: { [Op.in]: userIds },
        status: 'active',
      },
      attributes: ['id', 'email', 'settings', 'tenant_id', 'company_id'],
    });

    for (const user of users) {
      const uid = Number(user.id);
      const bucket = byUser.get(uid);
      if (!bucket || !bucketHasItems(bucket)) continue;

      const prefs = getNotificationPrefsFromSettings(user.settings);
      if (!shouldSendDigestForUser(prefs, now)) continue;
      if (prefs.comments === false) {
        bucket.unansweredComments = [];
      }
      if (prefs.expense === false) {
        bucket.expenses = [];
      }
      if (prefs.workBoard === false) {
        bucket.tasks = [];
        bucket.cards = [];
      }
      if (!bucketHasItems(bucket)) continue;

      const to = String(user.email || '').trim();
      if (!to) continue;

      const { ko, en } = formatDigestMessage(bucket);
      try {
        await sendUserNotificationEmail({
          targetUserId: uid,
          title: '미읽음·대기 항목 알림',
          message: ko,
          data: {
            feature: 'unread_reminder',
            title_en: 'Unread / pending items reminder',
            message_en: en,
            href: '/notifications',
          },
          tenantId: user.tenant_id,
          companyId: user.company_id,
        });
        mailCount += 1;
      } catch (err) {
        const msg = (err as Error)?.message || String(err);
        console.warn(`unread reminder mail failed for user ${uid}: ${msg.split('\n')[0]}`);
      }
    }

    lastRunDayUtc = utcDayKey(now);
    if (mailCount > 0) {
      console.info(`unread reminder: sent ${mailCount} mail(s)`);
    } else {
      console.info('unread reminder: run complete (0 sent)');
    }
    return mailCount;
  } catch (error) {
    console.error('unread reminder failed:', error);
    return 0;
  } finally {
    running = false;
  }
}

export function startUnreadReminderScheduler(): void {
  if (timer) return;
  const kick = () => {
    if (!shouldRunNow()) return;
    void sendUnreadReminders();
  };
  // 기동 직후 폭주 방지: 첫 검사는 5분 뒤, 이후 매시간 슬롯 확인
  setTimeout(kick, 5 * 60 * 1000).unref();
  timer = setInterval(kick, CHECK_INTERVAL_MS);
  timer.unref();
  console.info(
    `unread reminder scheduler: daily after ${Number.isFinite(DIGEST_HOUR_UTC) ? DIGEST_HOUR_UTC : 1}:00 UTC`
  );
}
