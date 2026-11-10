import { api } from '../client';

export const projectService = {
  getProjects: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    manager_id?: number | string;
    company_id?: number | string;
    q?: string;
  }) => {
    const response = await api.get('/projects', { params });
    return response.data;
  },

  getProject: async (id: number) => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
  },

  createProject: async (data: any) => {
    const response = await api.post('/projects', data);
    return response.data;
  },

  updateProject: async (id: number, data: any) => {
    const response = await api.put(`/projects/${id}`, data);
    return response.data;
  },

  deleteProject: async (id: number) => {
    const response = await api.delete(`/projects/${id}`);
    return response.data;
  },

  moveProject: async (id: number, direction: 'up' | 'down') => {
    const response = await api.post(`/projects/${id}/move`, { direction });
    return response.data;
  },

  getMembers: async (projectId: number) => {
    const response = await api.get(`/projects/${projectId}/members`);
    return response.data;
  },

  addMembers: async (
    projectId: number,
    data: { user_ids: number[]; role?: string }
  ) => {
    const response = await api.post(`/projects/${projectId}/members`, data);
    return response.data;
  },

  updateMember: async (projectId: number, memberId: number, data: { role: string }) => {
    const response = await api.put(`/projects/${projectId}/members/${memberId}`, data);
    return response.data;
  },

  removeMember: async (projectId: number, memberId: number) => {
    const response = await api.delete(`/projects/${projectId}/members/${memberId}`);
    return response.data;
  },

  getOverview: async (projectId: number) => {
    const response = await api.get(`/projects/${projectId}/overview`);
    return response.data;
  },

  getSchedules: async (projectId: number, params?: { from?: string; to?: string }) => {
    const response = await api.get(`/projects/${projectId}/schedules`, { params });
    return response.data;
  },

  createSchedule: async (projectId: number, data: Record<string, unknown>) => {
    const response = await api.post(`/projects/${projectId}/schedules`, data);
    return response.data;
  },

  updateSchedule: async (projectId: number, scheduleId: number, data: Record<string, unknown>) => {
    const response = await api.put(`/projects/${projectId}/schedules/${scheduleId}`, data);
    return response.data;
  },

  deleteSchedule: async (projectId: number, scheduleId: number) => {
    const response = await api.delete(`/projects/${projectId}/schedules/${scheduleId}`);
    return response.data;
  },

  getTasks: async (
    projectId: number,
    params?: { status?: string; priority?: string; assignee_id?: number }
  ) => {
    const response = await api.get(`/projects/${projectId}/tasks`, { params });
    return response.data;
  },

  createTask: async (projectId: number, data: Record<string, unknown>) => {
    const response = await api.post(`/projects/${projectId}/tasks`, data);
    return response.data;
  },

  updateTask: async (projectId: number, taskId: number, data: Record<string, unknown>) => {
    const response = await api.put(`/projects/${projectId}/tasks/${taskId}`, data);
    return response.data;
  },

  moveTask: async (projectId: number, taskId: number, direction: 'up' | 'down') => {
    const response = await api.post(`/projects/${projectId}/tasks/${taskId}/move`, { direction });
    return response.data;
  },

  deleteTask: async (projectId: number, taskId: number) => {
    const response = await api.delete(`/projects/${projectId}/tasks/${taskId}`);
    return response.data;
  },

  getActivities: async (projectId: number, params?: { limit?: number }) => {
    const response = await api.get(`/projects/${projectId}/activities`, { params });
    return response.data;
  },

  getTask: async (projectId: number, taskId: number) => {
    const response = await api.get(`/projects/${projectId}/tasks/${taskId}`);
    return response.data;
  },

  getTaskComments: async (projectId: number, taskId: number) => {
    const response = await api.get(`/projects/${projectId}/tasks/${taskId}/comments`);
    return response.data;
  },

  createTaskComment: async (
    projectId: number,
    taskId: number,
    content: string,
    parentId?: number | null
  ) => {
    const response = await api.post(`/projects/${projectId}/tasks/${taskId}/comments`, {
      content,
      ...(parentId != null && Number(parentId) > 0 ? { parent_id: Number(parentId) } : {}),
    });
    return response.data;
  },

  deleteTaskComment: async (projectId: number, taskId: number, commentId: number) => {
    const response = await api.delete(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`);
    return response.data;
  },

  uploadTaskAttachments: async (projectId: number, taskId: number, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const response = await api.post(`/projects/${projectId}/tasks/${taskId}/attachments`, formData, {
      timeout: 120000,
    });
    return response.data;
  },

  deleteTaskAttachment: async (projectId: number, taskId: number, storedName: string) => {
    const response = await api.delete(
      `/projects/${projectId}/tasks/${taskId}/attachments/${encodeURIComponent(storedName)}`
    );
    return response.data;
  },
};

/** ?�렐로형 ?�업 보드 (/api/work/boards) */

export const workBoardService = {
  getBoards: async (params?: { company_id?: number; light?: boolean }) => {
    const response = await api.get('/work/boards', { params });
    return response.data;
  },
  createBoard: async (data: {
    name: string;
    description?: string;
    board_color?: string;
    board_type?: 'GENERAL' | 'RECURRING';
    company_id?: number;
  }) => {
    const response = await api.post('/work/boards', data);
    return response.data;
  },
  getBoard: async (boardId: number, options?: { light?: boolean }) => {
    const params = options?.light ? { light: '1' } : undefined;
    const response = await api.get(`/work/boards/${boardId}`, { params });
    return response.data;
  },
  updateBoard: async (
    boardId: number,
    data: { name?: string; description?: string | null; board_color?: string | null }
  ) => {
    const response = await api.put(`/work/boards/${boardId}`, data);
    return response.data;
  },
  moveBoard: async (boardId: number, index: number) => {
    const response = await api.post(`/work/boards/${boardId}/move`, { index });
    return response.data;
  },
  deleteBoard: async (boardId: number) => {
    const response = await api.delete(`/work/boards/${boardId}`);
    return response.data;
  },
  createList: async (
    boardId: number,
    data: { title: string; description?: string | null; assignee_user_id?: number | null }
  ) => {
    const response = await api.post(`/work/boards/${boardId}/lists`, data);
    return response.data;
  },
  updateList: async (
    boardId: number,
    listId: number,
    data: { title?: string; description?: string | null; assignee_user_id?: number | null }
  ) => {
    const response = await api.put(`/work/boards/${boardId}/lists/${listId}`, data);
    return response.data;
  },
  moveList: async (boardId: number, listId: number, index: number) => {
    const response = await api.post(`/work/boards/${boardId}/lists/${listId}/move`, { index });
    return response.data;
  },
  deleteList: async (boardId: number, listId: number) => {
    const response = await api.delete(`/work/boards/${boardId}/lists/${listId}`);
    return response.data;
  },
  createCard: async (boardId: number, listId: number, data: Record<string, unknown>) => {
    const response = await api.post(`/work/boards/${boardId}/lists/${listId}/cards`, data);
    return response.data;
  },
  updateCard: async (boardId: number, cardId: number, data: Record<string, unknown>) => {
    const response = await api.put(`/work/boards/${boardId}/cards/${cardId}`, data);
    return response.data;
  },
  moveCard: async (
    boardId: number,
    cardId: number,
    list_id: number,
    index: number,
    targetBoardId?: number
  ) => {
    const body: { list_id: number; index: number; board_id?: number } = { list_id, index };
    if (targetBoardId != null && Number(targetBoardId) !== Number(boardId)) {
      body.board_id = Number(targetBoardId);
    }
    const response = await api.post(`/work/boards/${boardId}/cards/${cardId}/move`, body);
    return response.data;
  },
  deleteCard: async (boardId: number, cardId: number) => {
    const response = await api.delete(`/work/boards/${boardId}/cards/${cardId}`);
    return response.data;
  },
  getCardComments: async (boardId: number, cardId: number) => {
    const response = await api.get(`/work/boards/${boardId}/cards/${cardId}/comments`);
    return response.data;
  },
  createCardComment: async (
    boardId: number,
    cardId: number,
    content: string,
    mention_user_ids?: number[],
    parent_id?: number | null
  ) => {
    const payload: any = { content };
    if (Array.isArray(mention_user_ids) && mention_user_ids.length > 0) {
      payload.mention_user_ids = mention_user_ids;
    }
    if (parent_id != null && Number.isInteger(parent_id) && parent_id > 0) {
      payload.parent_id = parent_id;
    }
    const response = await api.post(`/work/boards/${boardId}/cards/${cardId}/comments`, payload);
    return response.data;
  },
  deleteCardComment: async (boardId: number, cardId: number, commentId: number) => {
    const response = await api.delete(`/work/boards/${boardId}/cards/${cardId}/comments/${commentId}`);
    return response.data;
  },
  markCardCommentsRead: async (boardId: number, cardId: number) => {
    const response = await api.post(`/work/boards/${boardId}/cards/${cardId}/comments/read`);
    return response.data;
  },
  uploadCardAttachments: async (boardId: number, cardId: number, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const response = await api.post(`/work/boards/${boardId}/cards/${cardId}/attachments`, formData, {
      timeout: 120000,
    });
    return response.data;
  },
  deleteCardAttachment: async (boardId: number, cardId: number, storedName: string) => {
    const response = await api.delete(
      `/work/boards/${boardId}/cards/${cardId}/attachments/${encodeURIComponent(storedName)}`
    );
    return response.data;
  },
  getMembers: async (boardId: number) => {
    const response = await api.get(`/work/boards/${boardId}/members`);
    return response.data;
  },
  inviteMember: async (boardId: number, user_id: number) => {
    const response = await api.post(`/work/boards/${boardId}/members`, { user_id });
    return response.data;
  },
  updateMemberRole: async (boardId: number, userId: number, role: 'owner' | 'member') => {
    const response = await api.put(`/work/boards/${boardId}/members/${userId}`, { role });
    return response.data;
  },
  removeMember: async (boardId: number, userId: number) => {
    const response = await api.delete(`/work/boards/${boardId}/members/${userId}`);
    return response.data;
  },

  /** 정기 업무(RECURRING) */
  getRecurringOverview: async (boardId: number) => {
    const response = await api.get(`/work/boards/${boardId}/recurring/overview`);
    return response.data;
  },
  createRecurringTemplate: async (
    boardId: number,
    data: {
      name: string;
      code?: string | null;
      description?: string | null;
      category?: string | null;
      frequency?: string;
      default_priority?: string;
      default_due_day?: number | null;
      requires_attachment?: boolean;
      requires_verification?: boolean;
    }
  ) => {
    const response = await api.post(`/work/boards/${boardId}/recurring/templates`, data);
    return response.data;
  },
  updateRecurringTemplate: async (
    boardId: number,
    templateId: number,
    data: Record<string, unknown>
  ) => {
    const response = await api.put(`/work/boards/${boardId}/recurring/templates/${templateId}`, data);
    return response.data;
  },
  deleteRecurringTemplate: async (boardId: number, templateId: number) => {
    const response = await api.delete(`/work/boards/${boardId}/recurring/templates/${templateId}`);
    return response.data;
  },
  seedRecurringSampleTemplates: async (boardId: number) => {
    const response = await api.post(`/work/boards/${boardId}/recurring/templates/seed-samples`);
    return response.data;
  },
  addRecurringClients: async (
    boardId: number,
    customer_ids: number[],
    partner_ids: number[] = []
  ) => {
    const response = await api.post(`/work/boards/${boardId}/recurring/clients`, {
      customer_ids,
      partner_ids,
    });
    return response.data;
  },
  removeRecurringClient: async (boardId: number, customerId: number) => {
    const response = await api.delete(`/work/boards/${boardId}/recurring/clients/${customerId}`);
    return response.data;
  },
  upsertRecurringAssignment: async (
    boardId: number,
    data: {
      customer_id: number;
      template_id: number;
      assigned_user_id?: number | null;
      reviewer_user_id?: number | null;
      is_active?: boolean;
    }
  ) => {
    const response = await api.put(`/work/boards/${boardId}/recurring/assignments`, data);
    return response.data;
  },
  bulkUpsertRecurringAssignments: async (
    boardId: number,
    data: {
      items: Array<{ customer_id: number; template_id: number }>;
      set_assignee?: boolean;
      assigned_user_id?: number | null;
      set_reviewer?: boolean;
      reviewer_user_id?: number | null;
    }
  ) => {
    const response = await api.put(`/work/boards/${boardId}/recurring/assignments/bulk`, data);
    return response.data;
  },
  getRecurringChecklist: async (boardId: number, period?: string) => {
    const response = await api.get(`/work/boards/${boardId}/recurring/checklist`, {
      params: period ? { period } : undefined,
    });
    return response.data;
  },
  generateRecurringPeriod: async (boardId: number, period?: string) => {
    const response = await api.post(`/work/boards/${boardId}/recurring/generate`, period ? { period } : {});
    return response.data;
  },
  getRecurringInstance: async (boardId: number, instanceId: number) => {
    const response = await api.get(`/work/boards/${boardId}/recurring/instances/${instanceId}`);
    return response.data;
  },
  updateRecurringInstance: async (
    boardId: number,
    instanceId: number,
    data: {
      status?: string;
      notes?: string | null;
      due_date?: string | null;
      assigned_user_id?: number | null;
      reviewer_user_id?: number | null;
    }
  ) => {
    const response = await api.put(`/work/boards/${boardId}/recurring/instances/${instanceId}`, data);
    return response.data;
  },
  uploadRecurringInstanceAttachments: async (boardId: number, instanceId: number, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const response = await api.post(
      `/work/boards/${boardId}/recurring/instances/${instanceId}/attachments`,
      formData,
      { timeout: 120000 }
    );
    return response.data;
  },
  deleteRecurringInstanceAttachment: async (boardId: number, instanceId: number, storedName: string) => {
    const response = await api.delete(
      `/work/boards/${boardId}/recurring/instances/${instanceId}/attachments/${encodeURIComponent(storedName)}`
    );
    return response.data;
  },
};

// ?�무 ?�계 API ?�비??
export const workStatisticService = {
  // ?�무 ?�계 목록 조회
  getWorkStatistics: async (params?: { user_id?: number; period?: string; start_period?: string; end_period?: string }) => {
    const response = await api.get('/work/statistics', { params });
    return response.data;
  },

  // ?�무 ?�계 ?�세 조회
  getWorkStatistic: async (id: number) => {
    const response = await api.get(`/work/statistics/${id}`);
    return response.data;
  },

  // ?�무 ?�계 ?�성
  createWorkStatistic: async (data: any) => {
    const response = await api.post('/work/statistics', data);
    return response.data;
  },

  // ?�무 ?�계 ?�정
  updateWorkStatistic: async (id: number, data: any) => {
    const response = await api.put(`/work/statistics/${id}`, data);
    return response.data;
  },

  // ?�무 ?�계 ??��
  deleteWorkStatistic: async (id: number) => {
    const response = await api.delete(`/work/statistics/${id}`);
    return response.data;
  }
};

// ?�자 결제 API ?�비??
export const approvalService = {
  // ?�자 결제 목록 조회
  getApprovals: async (params?: {
    requester_id?: number;
    current_approver_id?: number;
    status?: string;
    type?: string;
    priority?: string;
  }) => {
    const response = await api.get('/work/approvals', { params });
    return response.data;
  },

  // ?�자 결제 ?�세 조회
  getApproval: async (id: number) => {
    const response = await api.get(`/work/approvals/${id}`);
    return response.data;
  },

  // ?�자 결제 ?�성
  createApproval: async (data: any) => {
    const response = await api.post('/work/approvals', data);
    return response.data;
  },

  // ?�자 결제 ?�정
  updateApproval: async (id: number, data: any) => {
    const response = await api.put(`/work/approvals/${id}`, data);
    return response.data;
  },

  // ?�자 결제 ??��
  deleteApproval: async (id: number) => {
    const response = await api.delete(`/work/approvals/${id}`);
    return response.data;
  },

  // ?�자 결제 ?�출
  submitApproval: async (id: number) => {
    const response = await api.post(`/work/approvals/${id}/submit`);
    return response.data;
  },

  // ?�자 결제 ?�인
  approveApproval: async (id: number, comment?: string, signature?: string) => {
    const response = await api.post(`/work/approvals/${id}/approve`, { comment, signature });
    return response.data;
  },

  // ?�자 결제 거�?
  rejectApproval: async (id: number, comment?: string) => {
    const response = await api.post(`/work/approvals/${id}/reject`, { comment });
    return response.data;
  },

  // ?�자 결제 ?�스컬레?�션
  escalateApproval: async (id: number, data: { next_approver_id: number; comment?: string }) => {
    const response = await api.post(`/work/approvals/${id}/escalate`, data);
    return response.data;
  },

  getApprovalTypes: async (params?: { company_id?: number; include_inactive?: number }) => {
    const response = await api.get('/work/approvals/types', { params });
    return response.data;
  },

  createApprovalType: async (data: { name: string; code?: string; sort_order?: number; company_id?: number }) => {
    const response = await api.post('/work/approvals/types', data);
    return response.data;
  },

  updateApprovalType: async (id: number, data: { name?: string; sort_order?: number; company_id?: number }) => {
    const response = await api.put(`/work/approvals/types/${id}`, data);
    return response.data;
  },

  deleteApprovalType: async (id: number) => {
    const response = await api.delete(`/work/approvals/types/${id}`);
    return response.data;
  },
};

// 견적??관�?API ?�비??
export const workReportService = {
  // ?�무 보고??목록 조회
  getWorkReports: async (params?: {
    author_id?: number;
    status?: string;
    type?: string;
    priority?: string;
    start_date?: string;
    end_date?: string;
    /** `cc`???�버?�서 받�? 보고?��? ?�일?�게 처리(?�전 ?�라?�언???�환) */
    scope?: 'authored' | 'received' | 'cc';
  }) => {
    const response = await api.get('/work/reports', { params });
    return response.data;
  },

  // ?�무 보고???�세 조회
  getWorkReport: async (id: number) => {
    const response = await api.get(`/work/reports/${id}`);
    return response.data;
  },

  // ?�무 보고???�성
  createWorkReport: async (data: any) => {
    const response = await api.post('/work/reports', data);
    return response.data;
  },

  // ?�무 보고???�정
  updateWorkReport: async (id: number, data: any) => {
    const response = await api.put(`/work/reports/${id}`, data);
    return response.data;
  },

  // ?�무 보고????��
  deleteWorkReport: async (id: number) => {
    const response = await api.delete(`/work/reports/${id}`);
    return response.data;
  },

  // ?�무 보고???�출
  submitWorkReport: async (id: number) => {
    const response = await api.post(`/work/reports/${id}/submit`);
    return response.data;
  },

  // 업무 보고 검수 (승인/거절)
  reviewWorkReport: async (id: number, status: 'approved' | 'rejected', review_comment?: string) => {
    const response = await api.post(`/work/reports/${id}/review`, { status, review_comment });
    return response.data;
  }
};

/** 업무 담당 리스트 (/api/work/assignee-list) */
export const workAssigneeListService = {
  getList: async (params?: { company_id?: number }) => {
    const response = await api.get('/work/assignee-list', { params });
    return response.data;
  },
  createAssignee: async (data: {
    name: string;
    title?: string;
    email?: string;
    user_id?: number;
    company_id?: number;
  }) => {
    const response = await api.post('/work/assignee-list/assignees', data);
    return response.data;
  },
  updateAssignee: async (
    id: number,
    data: {
      name?: string;
      title?: string | null;
      email?: string | null;
      user_id?: number | null;
    }
  ) => {
    const response = await api.put(`/work/assignee-list/assignees/${id}`, data);
    return response.data;
  },
  deleteAssignee: async (id: number) => {
    const response = await api.delete(`/work/assignee-list/assignees/${id}`);
    return response.data;
  },
  moveAssignee: async (id: number, index: number) => {
    const response = await api.post(`/work/assignee-list/assignees/${id}/move`, { index });
    return response.data;
  },
  createItem: async (
    assigneeId: number,
    data: { name: string; note?: string; is_highlighted?: boolean; partner_id?: number }
  ) => {
    const response = await api.post(`/work/assignee-list/assignees/${assigneeId}/items`, data);
    return response.data;
  },
  updateItem: async (
    id: number,
    data: {
      name?: string;
      note?: string | null;
      is_highlighted?: boolean;
      partner_id?: number | null;
    }
  ) => {
    const response = await api.put(`/work/assignee-list/items/${id}`, data);
    return response.data;
  },
  getMyScope: async () => {
    const response = await api.get('/work/assignee-list/my-scope');
    return response.data;
  },
  deleteItem: async (id: number) => {
    const response = await api.delete(`/work/assignee-list/items/${id}`);
    return response.data;
  },
  moveItem: async (id: number, data: { assignee_id: number; index: number }) => {
    const response = await api.post(`/work/assignee-list/items/${id}/move`, data);
    return response.data;
  },
};
