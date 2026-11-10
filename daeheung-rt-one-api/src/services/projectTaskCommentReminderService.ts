import { Op } from 'sequelize';
import {
  Project,
  ProjectTask,
  ProjectTaskAssignee,
  ProjectTaskComment,
  User,
} from '../models';
import { sendUserNotificationEmail } from '../utils/userNotificationMail';

let running = false;

type ReminderItem = {
  projectId: number;
  projectName: string;
  companyId: number;
  tenantId: number;
  taskId: number;
  taskTitle: string;
  commentId: number;
  commentPreview: string;
  authorName: string;
};

/**
 * 프로젝트 Task 댓글에 답글이 없으면 담당자에게 하루 1회 안내 메일.
 * - 최상위 댓글만 대상 (답글에는 재알림 없음)
 * - 완료·취소 Task 제외
 * - 작성자 본인은 수신에서 제외
 */
export async function notifyUnansweredProjectTaskComments(): Promise<number> {
  if (running) return 0;
  running = true;
  let mailCount = 0;
  try {
    const topComments = await (ProjectTaskComment as any).findAll({
      where: { parent_id: null },
      attributes: ['id', 'task_id', 'user_id', 'content', 'created_at'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username'],
          required: false,
        },
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
              attributes: ['id', 'name', 'company_id', 'tenant_id'],
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

    if (!topComments.length) return 0;

    const topIds = topComments.map((c: any) => Number(c.id)).filter((id: number) => id > 0);
    const replyRows = await (ProjectTaskComment as any).findAll({
      where: { parent_id: { [Op.in]: topIds } },
      attributes: ['parent_id'],
      raw: true,
    });
    const repliedParentIds = new Set(
      replyRows.map((r: any) => Number(r.parent_id)).filter((id: number) => id > 0)
    );

    /** assigneeUserId → items */
    const byAssignee = new Map<number, ReminderItem[]>();

    for (const comment of topComments) {
      const commentId = Number(comment.id);
      if (repliedParentIds.has(commentId)) continue;

      const task = comment.task;
      const project = task?.project;
      if (!task || !project) continue;

      const assignees: any[] = Array.isArray(task.assignees) ? task.assignees : [];
      const authorId = comment.user_id != null ? Number(comment.user_id) : null;
      const authorName = String(comment.user?.username || 'Someone').trim() || 'Someone';
      const preview = String(comment.content || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);

      const item: ReminderItem = {
        projectId: Number(project.id),
        projectName: String(project.name || ''),
        companyId: Number(project.company_id),
        tenantId: Number(project.tenant_id),
        taskId: Number(task.id),
        taskTitle: String(task.title || ''),
        commentId,
        commentPreview: preview,
        authorName,
      };

      for (const a of assignees) {
        const uid = Number(a.user_id);
        if (!Number.isFinite(uid) || uid <= 0) continue;
        if (authorId != null && uid === authorId) continue;
        const list = byAssignee.get(uid) || [];
        list.push(item);
        byAssignee.set(uid, list);
      }
    }

    for (const [userId, items] of byAssignee) {
      if (!items.length) continue;
      const first = items[0];
      const linesKo = items
        .slice(0, 8)
        .map(
          (it) =>
            `· [${it.projectName}] ${it.taskTitle} — ${it.authorName}: "${it.commentPreview || '…'}"`
        )
        .join('\n');
      const linesEn = items
        .slice(0, 8)
        .map(
          (it) =>
            `· [${it.projectName}] ${it.taskTitle} — ${it.authorName}: "${it.commentPreview || '…'}"`
        )
        .join('\n');
      const moreKo =
        items.length > 8 ? `\n외 ${items.length - 8}건` : '';
      const moreEn =
        items.length > 8 ? `\n…and ${items.length - 8} more` : '';

      try {
        await sendUserNotificationEmail({
          targetUserId: userId,
          title: '프로젝트 댓글 답변 요청',
          message: `담당 Task에 답변이 없는 댓글이 ${items.length}건 있습니다.\n${linesKo}${moreKo}\n프로젝트 관리에서 확인해 답변해 주세요.`,
          data: {
            feature: 'project_task_comment_reminder',
            title_en: 'Project comment reply needed',
            message_en: `You have ${items.length} unanswered comment(s) on tasks assigned to you.\n${linesEn}${moreEn}\nPlease open Project Management and reply.`,
            href: `/work/project-management/${first.projectId}`,
            project_id: first.projectId,
            task_id: first.taskId,
          },
          tenantId: first.tenantId,
          companyId: first.companyId,
        });
        mailCount += 1;
      } catch (err) {
        console.error(`project comment reminder mail failed for user ${userId}:`, err);
      }
    }

    if (mailCount > 0) {
      console.info(`project task comment reminder: sent ${mailCount} mail(s)`);
    }
    return mailCount;
  } catch (error) {
    console.error('project task comment reminder failed:', error);
    return 0;
  } finally {
    running = false;
  }
}

/**
 * 스케줄러는 unreadReminderService로 통합됨 (미답변 댓글 포함).
 * 하위 호환용 no-op.
 */
export function startProjectTaskCommentReminderScheduler(): void {
  /* no-op: daily unanswered-comment mail is part of unreadReminderService */
}
