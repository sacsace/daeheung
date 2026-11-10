import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  List,
  ListItem,
  ListItemAvatar,
  Menu,
  MenuItem,
  Pagination,
  Popper,
  Paper,
  TextField,
  Tooltip,
  Typography,
  Autocomplete,
  FormControlLabel,
  InputBase,
  Switch
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  AttachFile as AttachFileIcon,
  ChatBubble as ChatBubbleIcon,
  ChatBubbleOutline as ChatBubbleOutlineIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditOutlinedIcon,
  MoreHoriz as MoreHorizIcon,
  Notes as NotesIcon,
  PersonAdd as PersonAddIcon,
  PhotoOutlined as PhotoOutlinedIcon,
  LibraryAddOutlined as LibraryAddOutlinedIcon,
  Search as SearchIcon,
  SubdirectoryArrowRight as SubdirectoryArrowRightIcon,
  VisibilityOutlined as VisibilityOutlinedIcon
} from '@mui/icons-material';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  closestCenter,
  closestCorners,
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  defaultDropAnimationSideEffects,
  useDroppable,
  useSensor,
  useSensors,
  type DropAnimation,
} from '@dnd-kit/core';
import { restrictToWindowEdges, snapCenterToCursor } from '@dnd-kit/modifiers';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { workBoardService } from '../../services/api';
import { useMenuStore, useStore } from '../../store';
import { filterActiveCompanyUsers, useReferenceDataStore } from '../../store/referenceDataStore';
import { findMenuIdByPath } from '../../utils/findMenuByPath';
import { showErrorPopup, showSuccessPopup, showSuccessToast } from '../../utils/errorHandler';
import { holdScrollPosition } from '../../utils/preserveScroll';
import { getUploadUrl } from '../../utils/uploadUrl';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { usePhotoPreviewOptional } from '../../components/Common/PhotoPreviewProvider';
import RichTextEditor from '../../components/RichTextEditor/RichTextEditor';
import WorkRecurringBoardPage from './WorkRecurringBoardPage';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsOutlinedLabelProps, mvsPageContentMaxWidth } from '../../theme/daeheungLayout';

const CARD_DETAIL_OUTLINED = mvsOutlinedLabelProps;

type BoardList = {
  id: number;
  title: string;
  description?: string | null;
  position: number;
  assignee_user_id?: number | null;
  assignee?: { id: number; username: string; userid?: string; avatar_url?: string | null } | null;
  cards?: BoardCard[];
};

type BoardCard = {
  id: number;
  title: string;
  description?: string;
  color?: string | null;
  reference_user_ids?: number[];
  due_date?: string | null;
  position: number;
  list_id?: number;
  created_by?: number | null;
  created_at?: string | null;
  createdAt?: string | null;
  completed_at?: string | null;
  assignee_user_id?: number | null;
  assignee?: { id: number; username: string; avatar_url?: string | null };
  comments?: BoardCardComment[];
  attachments?: unknown;
  attachment_count?: number;
  comment_count?: number;
  has_unread_comments?: boolean;
};

type BoardCardAttachment = {
  originalName: string;
  storedName: string;
  path: string;
  mimeType?: string;
  size?: number;
  uploadedAt?: string;
};

const WORK_BOARD_CARD_MAX_ATTACHMENTS = 10;
const WORK_BOARD_CARD_MAX_FILE_BYTES = 20 * 1024 * 1024;
const WORK_BOARD_CARD_ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
]);

const WORK_BOARD_CARD_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const getAttachmentFileExtension = (fileName: string): string => {
  const base = String(fileName || '').trim();
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx).toLowerCase();
};

const isAllowedBoardCardAttachmentFile = (file: File): boolean => {
  const ext = getAttachmentFileExtension(file.name);
  if (WORK_BOARD_CARD_ALLOWED_EXTENSIONS.has(ext)) return true;
  const mime = String(file.type || '').toLowerCase();
  if (!mime || mime === 'application/octet-stream') {
    return WORK_BOARD_CARD_ALLOWED_EXTENSIONS.has(ext);
  }
  return WORK_BOARD_CARD_ALLOWED_MIME_TYPES.has(mime);
};

const normalizeBoardCardAttachments = (raw: unknown): BoardCardAttachment[] => {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const item = row as Record<string, unknown>;
      const storedName = String(item.storedName || item.stored_name || '').trim();
      const pathRaw = String(item.path || '').trim();
      const originalName = String(item.originalName || item.original_name || storedName || 'attachment').trim();
      const pathValue = (pathRaw || (storedName ? `work-board-cards/${storedName}` : ''))
        .replace(/^\/+/, '')
        .replace(/^uploads\//i, '');
      if (!pathValue) return null;
      return {
        originalName,
        storedName: storedName || pathValue.split('/').pop() || originalName,
        path: pathValue,
        mimeType:
          item.mimeType != null || item.mime_type != null
            ? String(item.mimeType || item.mime_type)
            : undefined,
        size: item.size != null && Number.isFinite(Number(item.size)) ? Number(item.size) : undefined,
        uploadedAt:
          item.uploadedAt != null || item.uploaded_at != null
            ? String(item.uploadedAt || item.uploaded_at)
            : undefined,
      } satisfies BoardCardAttachment;
    })
    .filter(Boolean) as BoardCardAttachment[];
};

const countBoardCardAttachments = (raw: unknown, attachmentCount?: number): number => {
  if (typeof attachmentCount === 'number' && Number.isFinite(attachmentCount) && attachmentCount >= 0) {
    return attachmentCount;
  }
  return normalizeBoardCardAttachments(raw).length;
};

const formatAttachmentFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getBoardCardAttachmentUrl = (attachment: BoardCardAttachment): string =>
  getUploadUrl(attachment.path || attachment.storedName);

type BoardCardComment = {
  id: number;
  card_id: number;
  user_id?: number | null;
  parent_id?: number | null;
  parentId?: number | null;
  content: string;
  created_at?: string;
  createdAt?: string;
  user?: { id: number; username?: string; userid?: string; avatar_url?: string | null };
};

const resolveCommentParentId = (comment: BoardCardComment): number | null => {
  const raw = comment.parent_id ?? comment.parentId;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const resolveCommentCreatedAt = (
  comment: { created_at?: string | null; createdAt?: string | null } | null | undefined
): string => {
  const raw = comment?.createdAt ?? comment?.created_at;
  if (!raw) return '';
  return String(raw);
};

function sortBoardCardCommentsThreaded(comments: BoardCardComment[]): BoardCardComment[] {
  const list = (comments || []).slice();
  const byParent = new Map<number | null, BoardCardComment[]>();
  for (const c of list) {
    const pid = resolveCommentParentId(c);
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(c);
  }
  byParent.forEach((arr) => {
    arr.sort((a: BoardCardComment, b: BoardCardComment) => {
      const ta = new Date(resolveCommentCreatedAt(a)).getTime() || 0;
      const tb = new Date(resolveCommentCreatedAt(b)).getTime() || 0;
      return ta - tb;
    });
  });
  const out: BoardCardComment[] = [];
  const walk = (pid: number | null) => {
    const kids = byParent.get(pid);
    if (!kids) return;
    for (const c of kids) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(null);
  return out;
}

type CardDetailState = {
  cardId: number;
  /** 칸반에서 막 생성된 카드를 연 경우: 카드 세부 저장 전까지 댓글 비활성 */
  blockCommentsUntilDetailSave: boolean;
  title: string;
  description: string;
  dueDate: string;
  color: string;
  assigneeUserId: number | null;
  referenceUserIds: number[];
  createdBy: number | null;
  createdAt: string;
  boardId: number;
  originalBoardId: number;
  listId: number;
  originalListId: number;
  listTitle: string;
  attachments: BoardCardAttachment[];
};

type MemberOption = {
  id: number;
  label: string;
  userid: string;
};

const CARD_COLOR_PRESETS = [
  '#1976D2',
  '#2E7D32',
  '#ED6C02',
  '#D32F2F',
  '#7B1FA2',
  '#00897B',
  '#0288D1',
  '#C2185B',
  '#455A64',
  '#6D4C41',
  '#F9A825',
  '#3949AB',
  '#558B2F',
];

const COMPLETED_LIST_KEYWORDS = ['업무 완료', '완료', '종료', 'done', 'completed', 'closed', 'work completed'];

const isCompletedListTitle = (title?: string): boolean => {
  const normalized = String(title || '').trim().toLowerCase();
  if (!normalized) return false;
  return COMPLETED_LIST_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
};

const resolveCompletedList = <T extends { id: number; title: string; position: number }>(
  lists: T[]
): T | undefined => {
  const sorted = [...lists].sort((a, b) => a.position - b.position);
  const preferred = sorted.find((list) => {
    const title = String(list.title || '').trim().toLowerCase();
    return title === '업무 완료' || title.includes('업무 완료') || title.includes('work completed');
  });
  if (preferred) return preferred;
  const byKeyword = sorted.find((list) => isCompletedListTitle(list.title));
  if (byKeyword) return byKeyword;
  // 완료 열이 명시되지 않은 보드: 2열 이상이면 마지막 열을 완료 이동 대상으로 사용
  if (sorted.length >= 2) return sorted[sorted.length - 1];
  return undefined;
};

/** DB에 한글 기본값으로 저장된 리스트 제목을 영어 UI에서만 치환 (저장 값은 그대로) */
const displayBoardListTitle = (title: string, lang: 'ko' | 'en'): string => {
  if (lang !== 'en') return String(title || '');
  const raw = String(title || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const map: Record<string, string> = {
    할일: 'To Do',
    '할 일': 'To Do',
    todo: 'To Do',
    'to do': 'To Do',
    'to-do': 'To Do',
    진행중: 'In Progress',
    '진행 중': 'In Progress',
    진행: 'In Progress',
    'in progress': 'In Progress',
    완료: 'Done',
    '업무 완료': 'Done',
    종료: 'Closed',
    대기: 'Pending',
    '검토 대기': 'Pending review',
    '검토중': 'In review',
    '검토 중': 'In review',
    보류: 'On hold',
    백로그: 'Backlog'
  };
  if (map[raw]) return map[raw];
  if (map[lower]) return map[lower];
  const nospace = raw.replace(/\s+/g, '');
  if (map[nospace]) return map[nospace];
  return raw;
};

const decodeHtmlEntities = (value: string): string => {
  if (typeof window === 'undefined') return value;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const normalizeRichTextHtml = (html?: string): string => {
  if (!html) return '';
  const raw = String(html);
  if (!raw.trim()) return '';
  if (raw.includes('&lt;') || raw.includes('&gt;') || raw.includes('&quot;') || raw.includes('&#')) {
    return decodeHtmlEntities(raw);
  }
  return raw;
};

const getPlainTextFromHtml = (html?: string): string => {
  const normalizedHtml = normalizeRichTextHtml(html);
  if (!normalizedHtml) return '';

  if (typeof window === 'undefined') {
    return normalizedHtml
      .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, ' ')
      .replace(/src\s*=\s*["'][^"']*["']/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<img[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const root = document.createElement('div');
  root.innerHTML = normalizedHtml;
  root.querySelectorAll('style, script, img').forEach((node) => node.remove());
  return (root.textContent || '')
    .replace(/src\s*=\s*["'][^"']*["']/gi, ' ')
    .replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const isRichTextEmpty = (html?: string): boolean => {
  const normalizedHtml = normalizeRichTextHtml(html);
  if (!normalizedHtml) return true;
  const text = getPlainTextFromHtml(normalizedHtml);
  if (text.length > 0) return false;
  return !/<img\s+[^>]*src=/i.test(normalizedHtml);
};

const formatDueDate = (date?: string | null): string => {
  if (!date) return '';
  const raw = String(date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  return raw;
};

const formatCardCreatedAt = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};

const resolveBoardCardCreatedAt = (
  card: { created_at?: string | null; createdAt?: string | null } | null | undefined
): string => {
  const raw = card?.createdAt ?? card?.created_at;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
};

const formatDateTime = (value?: string | Date | null, locale: 'ko' | 'en' = 'ko'): string => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const DRAG_TRANSITION = 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)';
const KANBAN_DROP_ANIMATION: DropAnimation = {
  duration: 220,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.15' } },
  }),
};

const BOARD_PAN_IGNORE_SELECTOR = [
  '[data-kanban-card]',
  '[data-kanban-list-handle]',
  '[data-board-no-pan]',
  'button',
  'a',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="listbox"]',
  '[role="presentation"]',
  '[contenteditable="true"]',
  '.MuiButtonBase-root',
  '.MuiChip-root',
  '.MuiInputBase-root',
  '.MuiAutocomplete-root',
  '.MuiAutocomplete-popper',
  '.MuiAutocomplete-listbox',
  '.MuiPopover-root',
  '.MuiModal-root',
  '.MuiMenu-root',
].join(',');

/** 칸반 — 트렐로형 라운드·라벤더 보드 (상세 폼은 모서리를 조금 덜 둥글게) */
const KANBAN_DETAIL_SHELL_RADIUS = '4px';
const KANBAN_SURFACE_RADIUS = '4px';
const KANBAN_CHIP_RADIUS = '3px';
const KANBAN_CONTROL_RADIUS = '4px';
const KANBAN_COLUMN_RADIUS = '8px';
const KANBAN_CARD_RADIUS = '4px';

/** 소분류(칸반 열) — 불투명 패널 + 얇은 보더 */
const KANBAN_COLUMN_BG = '#F1F5F9';
const KANBAN_COLUMN_BORDER = '1px solid #E2E8F0';
const KANBAN_COLUMN_SHADOW = 'none';
const KANBAN_MEMBER_PANEL_BG = '#F8FAFC';
const KANBAN_MEMBER_PANEL_BORDER = '1px solid #E2E8F0';
const KANBAN_CARD_BG = '#FFFFFF';
const KANBAN_CARD_BORDER = '1px solid #D8E1EC';
const KANBAN_CARD_SHADOW = 'none';
const KANBAN_CARD_HOVER_SHADOW = '0 1px 2px rgba(15, 23, 42, 0.08)';
const KANBAN_TITLE_DESC_GAP = 0.75;
const KANBAN_META_ICON_COLOR = '#6B778C';

/** 칸반 카드 최소 높이(열·드래그 미리보기 동일) */
const WORK_BOARD_CARD_MIN_HEIGHT_PX = 68;

/** 보드 멤버 — 겹침 원형 아바타 */
const BOARD_MEMBER_AVATAR_SIZE = 32;
const BOARD_MEMBER_AVATAR_OVERLAP_PX = 10;
const BOARD_MEMBER_AVATAR_MAX = 20;

const AVATAR_PALETTE = ['#6554C0', '#00B8D9', '#36B37E', '#FF5630', '#FFAB00', '#403294'];

const kanbanMetaChipSx = {
  height: 22,
  fontWeight: 600,
  fontSize: '0.68rem',
  borderRadius: KANBAN_CHIP_RADIUS,
  border: 'none',
  bgcolor: '#F0F4F8',
  color: '#475569',
} as const;

const cardDetailFieldLabelSx = {
  display: 'block',
  mb: 0.65,
  fontWeight: 700,
  fontSize: '0.75rem',
  lineHeight: '20px',
  color: '#475569',
} as const;

const cardDetailSectionPaperSx = {
  p: 1.25,
  flexShrink: 0,
  borderRadius: KANBAN_SURFACE_RADIUS,
  border: 'none',
  bgcolor: 'transparent',
  boxShadow: 'none',
} as const;

const cardDetailFormSectionSx = {
  borderRadius: KANBAN_SURFACE_RADIUS,
  p: 0,
  border: 'none',
  bgcolor: 'transparent',
  boxShadow: 'none',
  flexShrink: 0,
} as const;

const cardDetailInputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: KANBAN_CONTROL_RADIUS,
    bgcolor: '#FFFFFF',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E2E8F0' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
  },
  '& .MuiInputBase-input': { fontSize: '0.875rem' },
} as const;

const cardDetailOutlinedWhiteSx = {
  ...cardDetailInputSx,
  '& .MuiOutlinedInput-root': {
    ...(cardDetailInputSx['& .MuiOutlinedInput-root'] as Record<string, unknown>),
    bgcolor: '#FFFFFF',
    height: 46,
    '&:hover': { bgcolor: '#F8FAFC' },
    '&.Mui-focused': { bgcolor: '#FFFFFF' },
    '&.Mui-disabled': { bgcolor: '#F1F5F9' },
  },
  '& .MuiSelect-select': { py: '10px' },
} as const;

const WORK_BOARD_COLUMN_WIDTH_PX = 272;

const isHexColor = (value?: string | null): value is string => Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));

const hexToRgba = (hex: string, alphaValue: number) => {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alphaValue})`;
};

/** 댓글 멘션 토큰: @[표시이름|userid] 또는 @token (레거시) */
const COMMENT_MENTION_TOKEN_RE = /@\[([^\]]+)\]|@([^\s@]+)/g;

const normalizeMentionLookupKey = (value: string): string =>
  String(value || '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();

const findMemberByMentionToken = (
  rawToken: string,
  members?: Array<{ id: number; label: string; userid: string }>
) => {
  const lookup = normalizeMentionLookupKey(rawToken);
  return members?.find((member) => {
    const byName = normalizeMentionLookupKey(member.label) === lookup;
    const byUserid = String(member.userid || '').trim().toLowerCase() === rawToken.toLowerCase();
    const byUseridNorm = normalizeMentionLookupKey(member.userid) === lookup;
    return byName || byUserid || byUseridNorm;
  });
};

/** 멘션 원형 칩 — 이름 전체 표시 (잘림 없음) */
function MentionUserIdChip({
  name,
  userId,
  title,
}: {
  name: string;
  userId?: number;
  title?: string;
}) {
  const label = String(name || '').trim() || '?';
  return (
    <Box
      component="span"
      title={title || label}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        flexShrink: 0,
        minWidth: 28,
        height: 28,
        px: 1,
        borderRadius: '999px',
        bgcolor: userId != null ? getAvatarColor(userId) : '#64748B',
        color: '#FFFFFF',
        fontSize: '0.75rem',
        fontWeight: 700,
        lineHeight: 1.2,
        mx: 0.2,
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  );
}

type ComposerCommentPart =
  | { type: 'text'; text: string }
  | { type: 'mention'; userid: string; id?: number; label?: string };

const splitComposerComment = (
  value: string,
  members?: Array<{ id: number; label: string; userid: string }>
): { parts: ComposerCommentPart[]; tail: string } => {
  const re = /@\[([^\]]+)\]/g;
  const parts: ComposerCommentPart[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', text: value.slice(last, m.index) });
    }
    const raw = String(m[1] || '').trim();
    const matched = findMemberByMentionToken(raw, members);
    parts.push({
      type: 'mention',
      userid: matched?.userid || raw,
      id: matched?.id,
      label: matched?.label || raw,
    });
    last = m.index + m[0].length;
  }
  return { parts, tail: value.slice(last) };
};

const joinComposerComment = (parts: ComposerCommentPart[], tail: string): string =>
  parts
    .map((p) => (p.type === 'mention' ? `@[${p.label || p.userid}]` : p.text))
    .join('') + tail;

/** 댓글 본문의 @멘션을 원형 이름 칩으로 표시 */
function renderCommentWithMentions(
  text: string,
  members?: Array<{ id: number; label: string; userid: string }>
): React.ReactNode {
  if (text == null || text === '') return null;
  const re = new RegExp(COMMENT_MENTION_TOKEN_RE.source, 'g');
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push(text.slice(last, m.index));
    }
    const rawToken = String(m[1] || m[2] || '').trim();
    const matched = findMemberByMentionToken(rawToken, members);
    const displayName = matched?.label || rawToken;
    out.push(
      <MentionUserIdChip
        key={`mention-${m.index}-${key++}`}
        name={displayName}
        userId={matched?.id}
        title={matched?.userid ? `${displayName} (${matched.userid})` : displayName}
      />
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push(text.slice(last));
  }
  return out.length > 0 ? <>{out}</> : text;
}

const normalizeBoardData = (payload: any) => {
  if (!payload) return payload;
  const lists = Array.isArray(payload.lists)
    ? payload.lists.map((list: any) => ({
        ...list,
        cards: Array.isArray(list.cards)
          ? list.cards.map((card: any) => ({
              ...card,
              description: normalizeRichTextHtml(card?.description)
            }))
          : []
      }))
    : [];

  return {
    ...payload,
    lists
  };
};

/** 서버 moveList와 동일한 삽입 규칙으로 목록 순서만 미리 반영 */
const applyOptimisticListMove = (board: any, activeListId: number, targetIndex: number): any => {
  if (!board?.lists) return board;
  const sorted = [...board.lists].sort((a: BoardList, b: BoardList) => a.position - b.position);
  const moving = sorted.find((l) => l.id === activeListId);
  if (!moving) return board;
  const others = sorted.filter((l) => l.id !== activeListId);
  const insertAt = Math.min(Math.max(0, targetIndex), others.length);
  const next = [...others.slice(0, insertAt), moving, ...others.slice(insertAt)].map((l, i) => ({
    ...l,
    position: i
  }));
  return { ...board, lists: next };
};

/** 대분류에 담당자가 있으면 카드 업무 담당을 그 담당자로 맞춤 */
const resolveListAssigneeForCard = (
  list: BoardList | undefined | null
): BoardCard['assignee'] | undefined => {
  if (!list) return undefined;
  const aid = list.assignee_user_id != null ? Number(list.assignee_user_id) : null;
  if (aid == null || !Number.isFinite(aid) || aid <= 0) return undefined;
  if (list.assignee && Number(list.assignee.id) === aid) {
    return {
      id: aid,
      username: list.assignee.username || '',
      avatar_url: list.assignee.avatar_url
    };
  }
  return { id: aid, username: list.assignee?.username || '' };
};

/** 서버 moveCard와 동일하게 카드만 미리 옮김 — 성공 시 전체 리로드 없이 자연스러운 UX */
const applyOptimisticCardMove = (
  board: any,
  activeCardId: number,
  targetListId: number,
  targetIndex: number
): any => {
  if (!board?.lists) return board;
  const lists: BoardList[] = board.lists.map((list: BoardList) => ({
    ...list,
    cards: [...(list.cards || [])] as BoardCard[]
  }));

  let moved: BoardCard | null = null;
  let sourceListId: number | null = null;
  for (const l of lists) {
    const row = l.cards ?? [];
    const i = row.findIndex((c: BoardCard) => c.id === activeCardId);
    if (i >= 0) {
      moved = row[i];
      sourceListId = l.id;
      row.splice(i, 1);
      l.cards = row;
      break;
    }
  }
  if (!moved) return board;

  const target = lists.find((l: BoardList) => l.id === targetListId);
  if (!target) return board;

  let cardToInsert = moved;
  if (sourceListId !== targetListId) {
    const nextAssignee = resolveListAssigneeForCard(target);
    if (nextAssignee) {
      const prevAssigneeId = moved.assignee?.id != null ? Number(moved.assignee.id) : null;
      const nextRefs = new Set(
        (moved.reference_user_ids || [])
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      );
      if (prevAssigneeId != null && prevAssigneeId !== nextAssignee.id) {
        nextRefs.add(prevAssigneeId);
      }
      nextRefs.delete(nextAssignee.id);
      cardToInsert = {
        ...moved,
        assignee: nextAssignee,
        reference_user_ids: Array.from(nextRefs)
      };
    }
  }

  const filtered = (target.cards ?? []).filter((c: BoardCard) => c.id !== activeCardId);
  const insertAt = Math.min(Math.max(0, targetIndex), filtered.length);
  filtered.splice(insertAt, 0, cardToInsert);
  target.cards = filtered;

  return { ...board, lists };
};

const applyCardMoveMetaOnBoard = (
  board: any,
  cardId: number,
  meta: {
    assignee?: { id: number; username?: string; avatar_url?: string | null } | null;
    reference_user_ids?: number[];
  }
): any => {
  if (!board?.lists) return board;
  return {
    ...board,
    lists: (board.lists as BoardList[]).map((list) => ({
      ...list,
      cards: (list.cards || []).map((c) => {
        if (c.id !== cardId) return c;
        const next: BoardCard = { ...c };
        if (meta.assignee !== undefined) {
          next.assignee = meta.assignee
            ? {
                id: Number(meta.assignee.id),
                username: meta.assignee.username || c.assignee?.username || '',
                avatar_url: meta.assignee.avatar_url ?? c.assignee?.avatar_url
              }
            : undefined;
        }
        if (meta.reference_user_ids !== undefined) {
          next.reference_user_ids = meta.reference_user_ids
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0);
        }
        return next;
      })
    }))
  };
};

/** 드롭 시 위치가 실제로 바뀌는지 판별 (불필요한 moveCard 방지) */
const findCardPositionInBoard = (boardData: any, cardId: number): { listId: number; index: number } | null => {
  if (!boardData?.lists) return null;
  for (const list of boardData.lists as BoardList[]) {
    const cards = list.cards || [];
    const index = cards.findIndex((c: BoardCard) => c.id === cardId);
    if (index >= 0) return { listId: list.id, index };
  }
  return null;
};

/** over 대상에서 카드 드롭 위치 계산 (dragOver / dragEnd 공용) */
const resolveCardDropTarget = (
  lists: BoardList[],
  activeCardId: number,
  overId: string
): { targetListId: number; targetIndex: number } | null => {
  if (overId.startsWith('list-')) {
    const targetListId = parseInt(overId.replace('list-', ''), 10);
    if (!Number.isFinite(targetListId)) return null;
    const list = lists.find((l) => l.id === targetListId);
    if (!list) return null;
    const filtered = (list.cards || []).filter((c) => c.id !== activeCardId);
    return { targetListId, targetIndex: filtered.length };
  }
  if (overId.startsWith('card-')) {
    const overCardId = parseInt(overId.replace('card-', ''), 10);
    if (!Number.isFinite(overCardId) || overCardId === activeCardId) return null;
    let found: BoardList | undefined;
    for (const l of lists) {
      if ((l.cards || []).some((c) => c.id === overCardId)) {
        found = l;
        break;
      }
    }
    if (!found) return null;
    const filtered = (found.cards || []).filter((c) => c.id !== activeCardId);
    const idx = filtered.findIndex((c) => c.id === overCardId);
    return { targetListId: found.id, targetIndex: idx >= 0 ? idx : filtered.length };
  }
  return null;
};

/** 대분류(열) 드롭 대상 인덱스 */
const resolveListDropTargetIndex = (
  lists: BoardList[],
  activeListId: number,
  overId: string
): number | null => {
  let targetListId: number | null = null;
  if (overId.startsWith('listcol-')) {
    targetListId = parseInt(overId.replace('listcol-', ''), 10);
  } else if (overId.startsWith('list-')) {
    targetListId = parseInt(overId.replace('list-', ''), 10);
  } else if (overId.startsWith('card-')) {
    const overCardId = parseInt(overId.replace('card-', ''), 10);
    for (const l of lists) {
      if ((l.cards || []).some((c) => c.id === overCardId)) {
        targetListId = l.id;
        break;
      }
    }
  }
  if (!targetListId || !Number.isFinite(targetListId) || targetListId === activeListId) return null;
  const ordered = [...lists].sort((a, b) => a.position - b.position);
  const targetIndex = ordered.findIndex((l) => l.id === targetListId);
  return targetIndex >= 0 ? targetIndex : null;
};

/** 카드: closestCorners(카드·리스트 droppable만), 대분류(열) 이동: closestCenter */
const kanbanCollisionDetection: CollisionDetection = (args) => {
  const activeId = String(args.active.id);

  if (activeId.startsWith('listcol-')) {
    const containers = args.droppableContainers.filter((c) => String(c.id).startsWith('listcol-'));
    return closestCenter({ ...args, droppableContainers: containers });
  }

  if (activeId.startsWith('card-')) {
    const containers = args.droppableContainers.filter((c) => {
      const id = String(c.id);
      return id.startsWith('card-') || id.startsWith('list-');
    });
    return closestCorners({ ...args, droppableContainers: containers });
  }

  return closestCorners(args);
};

function KanbanInlineTitle({
  title,
  descriptionPlain,
  titleFontSize = '0.8125rem',
  compact = false,
}: {
  title: string;
  descriptionPlain: string;
  titleFontSize?: string;
  /** 카드 면 — 제목만 표시(설명은 아이콘으로) */
  compact?: boolean;
}) {
  const hasDesc = Boolean(descriptionPlain) && !compact;
  const fullLabel = hasDesc || compact ? (descriptionPlain ? `${title} (${descriptionPlain})` : title) : title;
  return (
    <Typography
      component="div"
      variant="subtitle2"
      title={fullLabel}
      sx={{
        flexShrink: 0,
        minWidth: 0,
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: 1.45,
        fontSize: titleFontSize,
        letterSpacing: '-0.01em',
        fontWeight: 500,
        color: 'text.primary',
      }}
    >
      {compact ? (
        title || '\u00a0'
      ) : (
        <>
          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {title || '\u00a0'}
          </Box>
          {hasDesc ? (
            <Box
              component="span"
              sx={{
                fontWeight: 400,
                color: 'text.secondary',
                fontSize: `calc(${titleFontSize} - 0.0625rem)`,
                ml: KANBAN_TITLE_DESC_GAP,
              }}
            >
              ({descriptionPlain})
            </Box>
          ) : null}
        </>
      )}
    </Typography>
  );
}

const getAvatarColor = (userId: number) => AVATAR_PALETTE[Math.abs(userId) % AVATAR_PALETTE.length];

const resolveUserAvatarSrc = (avatarUrl?: string | null) => {
  const resolved = getUploadUrl(avatarUrl);
  return resolved || undefined;
};

type BoardMemberLite = {
  user_id: number;
  user?: { id?: number; username?: string; avatar_url?: string | null };
};

function resolveCardFaceAvatars(card: BoardCard, members: BoardMemberLite[]) {
  const seen = new Set<number>();
  const avatars: { id: number; label: string; src?: string }[] = [];
  const push = (id?: number | null, label?: string, avatarUrl?: string | null) => {
    const uid = id != null ? Number(id) : 0;
    if (!uid || seen.has(uid)) return;
    seen.add(uid);
    avatars.push({
      id: uid,
      label: (label || '?').trim().charAt(0).toUpperCase() || '?',
      src: resolveUserAvatarSrc(avatarUrl),
    });
  };
  push(card.assignee?.id, card.assignee?.username, card.assignee?.avatar_url);
  (card.reference_user_ids || []).forEach((rid) => {
    const m = members.find((x) => Number(x.user_id) === Number(rid));
    push(rid, m?.user?.username, m?.user?.avatar_url);
  });
  return avatars.slice(0, 4);
}

function KanbanMetaIcon({
  icon,
  count,
  unread,
}: {
  icon: React.ReactNode;
  count?: number;
  unread?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: unread ? 0.35 : 0.25,
        color: unread ? '#FFFFFF' : KANBAN_META_ICON_COLOR,
        fontSize: '0.75rem',
        lineHeight: 1,
        ...(unread
          ? {
              px: 0.55,
              py: 0.2,
              borderRadius: '999px',
              bgcolor: '#E53935',
            }
          : {}),
      }}
    >
      {icon}
      {count != null && count > 0 ? (
        <Box component="span" sx={{ fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1 }}>
          {count}
        </Box>
      ) : null}
    </Box>
  );
}

const DraggableCard = memo(function DraggableCard({
  card,
  onOpenDetail,
  dragDisabled,
  isCompletedList,
  members,
}: {
  card: BoardCard;
  onOpenDetail: (card: BoardCard) => void;
  dragDisabled?: boolean;
  isCompletedList?: boolean;
  members: BoardMemberLite[];
}) {
  const theme = useTheme();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver: isCardOver,
  } = useSortable({
    id: `card-${card.id}`,
    data: { type: 'card', cardId: card.id, card },
    disabled: Boolean(dragDisabled),
    animateLayoutChanges: () => true,
  });

  // DragOverlay + sortable: 원본은 플레이스홀더, 형제 카드는 transition으로 밀림
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition || DRAG_TRANSITION,
    opacity: isDragging ? 0.22 : 1,
    pointerEvents: isDragging ? 'none' : undefined,
  };

  const descPlain =
    card.description && !isRichTextEmpty(card.description) ? getPlainTextFromHtml(card.description) : '';

  const cardAccent = isHexColor(card.color) ? String(card.color) : null;
  const cardBg =
    theme.palette.mode === 'light' ? KANBAN_CARD_BG : alpha(theme.palette.grey[900], 0.88);
  const commentCount = card.comment_count ?? card.comments?.length ?? 0;
  const hasUnreadComments = Boolean(card.has_unread_comments);
  const attachmentCount = countBoardCardAttachments(card.attachments, card.attachment_count);
  const referenceCount = card.reference_user_ids?.length ?? 0;
  const hasDesc = Boolean(descPlain);
  const faceAvatars = resolveCardFaceAvatars(card, members);
  const showMeta =
    hasDesc ||
    commentCount > 0 ||
    attachmentCount > 0 ||
    referenceCount > 0 ||
    Boolean(card.due_date) ||
    faceAvatars.length > 0;

  return (
    <Card
      ref={setNodeRef}
      elevation={0}
      data-kanban-card=""
      style={style}
      sx={{
        width: '100%',
        height: 'auto',
        minHeight: WORK_BOARD_CARD_MIN_HEIGHT_PX,
        display: 'flex',
        flexDirection: 'column',
        cursor: dragDisabled ? 'pointer' : isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        bgcolor: isDragging ? alpha(theme.palette.primary.main, 0.05) : cardBg,
        border: isDragging
          ? `1px dashed ${alpha(theme.palette.primary.main, 0.5)}`
          : theme.palette.mode === 'light'
            ? KANBAN_CARD_BORDER
            : 'none',
        borderRadius: KANBAN_CARD_RADIUS,
        overflow: 'hidden',
        boxShadow: isCardOver && !isDragging ? KANBAN_CARD_HOVER_SHADOW : KANBAN_CARD_SHADOW,
        outline: isCardOver && !isDragging ? `2px solid ${alpha(theme.palette.primary.main, 0.35)}` : 'none',
        outlineOffset: 0,
        willChange: 'transform',
        zIndex: isDragging ? 2 : 1,
        contain: 'layout style',
        '&:hover': isDragging
          ? undefined
          : {
              boxShadow: KANBAN_CARD_HOVER_SHADOW,
            },
      }}
      {...(dragDisabled ? {} : listeners)}
      {...(dragDisabled ? {} : attributes)}
      onClick={() => {
        if (!isDragging) onOpenDetail(card);
      }}
    >
      {isDragging ? (
        <Box sx={{ minHeight: WORK_BOARD_CARD_MIN_HEIGHT_PX - 4, px: 1.25, py: 1.15 }} />
      ) : (
        <>
      {cardAccent ? (
        <Box sx={{ height: 6, flexShrink: 0, bgcolor: cardAccent }} />
      ) : null}
      <CardContent
        sx={{
          flex: 1,
          minHeight: 0,
          py: 1.15,
          px: 1.25,
          display: 'flex',
          flexDirection: 'column',
          gap: showMeta ? 0.85 : 0,
          overflow: 'hidden',
          '&:last-child': { pb: 1.15 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, minWidth: 0 }}>
          {isCompletedList ? (
            <CheckCircleIcon sx={{ fontSize: 18, color: '#36B37E', flexShrink: 0, mt: 0.1 }} />
          ) : null}
          <KanbanInlineTitle
            title={card.title || ''}
            descriptionPlain={descPlain}
            titleFontSize="0.8125rem"
            compact
          />
        </Box>
        {showMeta ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
              justifyContent: 'space-between',
              gap: 0.75,
            flexShrink: 0,
              minHeight: 22,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
              {referenceCount > 0 ? (
                <KanbanMetaIcon
                  icon={<VisibilityOutlinedIcon sx={{ fontSize: 15 }} />}
                  count={referenceCount}
                />
              ) : null}
              {hasDesc ? (
                <KanbanMetaIcon icon={<NotesIcon sx={{ fontSize: 15 }} />} />
              ) : null}
              {commentCount > 0 ? (
                <KanbanMetaIcon
                  icon={
                    hasUnreadComments ? (
                      <ChatBubbleIcon sx={{ fontSize: 14, color: '#FFFFFF' }} />
                    ) : (
                      <ChatBubbleOutlineIcon sx={{ fontSize: 15, color: KANBAN_META_ICON_COLOR }} />
                    )
                  }
                  count={commentCount}
                  unread={hasUnreadComments}
                />
              ) : null}
              {attachmentCount > 0 ? (
                <KanbanMetaIcon
                  icon={<AttachFileIcon sx={{ fontSize: 15 }} />}
                  count={attachmentCount}
                />
              ) : null}
              {card.due_date ? (
            <Chip
              size="small"
                  label={formatDueDate(card.due_date)}
              sx={{
                    ...kanbanMetaChipSx,
                    height: 20,
                    fontSize: '0.625rem',
                    bgcolor: alpha('#FF5630', 0.12),
                    color: '#BF2600',
                  }}
                />
              ) : null}
            </Box>
            {faceAvatars.length > 0 ? (
              <AvatarGroup
                max={4}
              sx={{
                  flexShrink: 0,
                  '& .MuiAvatar-root': {
                    width: 24,
                    height: 24,
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    border: '2px solid #fff',
                  },
                }}
              >
                {faceAvatars.map((a) => (
                  <Avatar
                    key={a.id}
                    src={a.src}
                    alt={a.label}
                    sx={{ bgcolor: a.src ? 'transparent' : getAvatarColor(a.id) }}
                  >
                    {a.label}
                  </Avatar>
                ))}
              </AvatarGroup>
            ) : null}
        </Box>
        ) : null}
      </CardContent>
        </>
      )}
    </Card>
  );
});

const ListColumn = memo(function ListColumn({
  list,
  listTitleEditing,
  listTitleDraft,
  listSaving,
  composerOpen,
  composerTitle,
  composerDesc,
  onListTitleDraftChange,
  onStartEditListTitle,
  onOpenListSettings,
  onSaveListTitle,
  onDeleteList,
  onComposerTitleChange,
  onComposerDescChange,
  onOpenComposer,
  onCloseComposer,
  onSubmitCard,
  savingCard,
  onOpenCardDetail,
  txt,
  language,
  allowListReorder,
  allowCardDrag,
  allowListTitleEdit,
  allowListDelete,
  allowAddCard,
  members,
  isCompletedList,
}: {
  list: BoardList;
  listTitleEditing: boolean;
  listTitleDraft: string;
  listSaving: boolean;
  composerOpen: boolean;
  composerTitle: string;
  composerDesc: string;
  onListTitleDraftChange: (v: string) => void;
  onStartEditListTitle: (listId: number) => void;
  onOpenListSettings: (listId: number) => void;
  onSaveListTitle: () => void;
  onDeleteList: (listId: number, listTitle: string) => void;
  onComposerTitleChange: (v: string) => void;
  onComposerDescChange: (v: string) => void;
  onOpenComposer: (listId: number) => void;
  onCloseComposer: () => void;
  onSubmitCard: () => void;
  savingCard: boolean;
  onOpenCardDetail: (card: BoardCard, listTitle: string, listId: number) => void;
  txt: (ko: string, en: string) => string;
  language: 'ko' | 'en';
  allowListReorder: boolean;
  /** 검색·내 업무 필터 중에도 카드 이동 허용 */
  allowCardDrag: boolean;
  allowListTitleEdit: boolean;
  allowListDelete: boolean;
  allowAddCard: boolean;
  members: BoardMemberLite[];
  isCompletedList?: boolean;
}) {
  const theme = useTheme();
  const [listMenuAnchor, setListMenuAnchor] = useState<null | HTMLElement>(null);
  const { setNodeRef: setCardDropRef, isOver } = useDroppable({ id: `list-${list.id}` });
  const {
    attributes: listDragAttributes,
    listeners: listDragListeners,
    setNodeRef: setListSortRef,
    transform: listTransform,
    transition: listTransition,
    isDragging: isListDragging,
  } = useSortable({
    id: `listcol-${list.id}`,
    data: { type: 'list', listId: list.id },
    disabled: !allowListReorder,
    animateLayoutChanges: () => true,
  });
  const cards = list.cards || [];
  const cardSortIds = useMemo(() => cards.map((c) => `card-${c.id}`), [cards]);

  const handleOpenCard = useCallback(
    (card: BoardCard) => onOpenCardDetail(card, list.title, list.id),
    [onOpenCardDetail, list.title, list.id]
  );

  const setColumnRef = (node: HTMLElement | null) => {
    setCardDropRef(node);
    setListSortRef(node);
  };

  // 열 드래그도 Overlay 사용 — 원본은 자리 표시, 형제 열은 transition으로 밀림
  const listStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(listTransform),
    transition: isListDragging ? undefined : listTransition || DRAG_TRANSITION,
    opacity: isListDragging ? 0.28 : 1,
    pointerEvents: isListDragging ? 'none' : undefined,
  };

  return (
    <Paper
      ref={setColumnRef}
      elevation={0}
      data-kanban-column=""
      style={listStyle}
      sx={{
        boxSizing: 'border-box',
        flex: `0 0 ${WORK_BOARD_COLUMN_WIDTH_PX}px`,
        width: `${WORK_BOARD_COLUMN_WIDTH_PX}px`,
        minWidth: WORK_BOARD_COLUMN_WIDTH_PX,
        maxWidth: `${WORK_BOARD_COLUMN_WIDTH_PX}px`,
        bgcolor: theme.palette.mode === 'light' ? KANBAN_COLUMN_BG : alpha(theme.palette.common.black, 0.22),
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        outline: isOver ? '2px solid' : 'none',
        outlineColor: alpha(theme.palette.primary.main, 0.45),
        outlineOffset: 0,
        p: 1.25,
        borderRadius: KANBAN_COLUMN_RADIUS,
        border: theme.palette.mode === 'light' ? KANBAN_COLUMN_BORDER : 'none',
        boxShadow: theme.palette.mode === 'light' ? KANBAN_COLUMN_SHADOW : 'none',
        alignSelf: 'flex-start',
        minHeight: 120,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
        willChange: 'transform',
        zIndex: isListDragging ? 10 : 1,
      }}
    >
      <Box
        data-kanban-list-handle=""
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          mb: 1,
          px: 0.15,
          flexShrink: 0,
            cursor: allowListReorder ? 'grab' : 'default',
          }}
          {...(allowListReorder ? listDragAttributes : {})}
          {...(allowListReorder ? listDragListeners : {})}
        >
        {listTitleEditing && allowListTitleEdit ? (
          <TextField
            autoFocus
            hiddenLabel
            size="small"
            value={listTitleDraft}
            onChange={(e) => onListTitleDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSaveListTitle();
              }
            }}
            sx={{ flex: 1 }}
          />
        ) : (
          <>
          <Typography
              component="span"
            sx={{
                fontWeight: 700,
              fontSize: '0.875rem',
                color: '#172B4D',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}
              title={displayBoardListTitle(list.title, language)}
          >
            {displayBoardListTitle(list.title, language)}
          </Typography>
            <Typography
              component="span"
              sx={{ fontSize: '0.8125rem', fontWeight: 500, color: '#6B778C', flexShrink: 0 }}
            >
              {cards.length}
            </Typography>
          </>
        )}
        {listTitleEditing && allowListTitleEdit ? (
          <IconButton
            size="small"
            onClick={onSaveListTitle}
            disabled={listSaving || !listTitleDraft.trim()}
            aria-label={txt('제목 저장', 'Save title')}
          >
            <CheckIcon fontSize="small" />
          </IconButton>
        ) : (allowListTitleEdit || allowListDelete) ? (
          <>
                <IconButton
                  size="small"
              aria-label={txt('대분류 메뉴', 'List menu')}
              onClick={(e) => setListMenuAnchor(e.currentTarget)}
              sx={{ color: '#6B778C', borderRadius: KANBAN_CONTROL_RADIUS }}
                >
              <MoreHorizIcon fontSize="small" />
                </IconButton>
            <Menu
              anchorEl={listMenuAnchor}
              open={Boolean(listMenuAnchor)}
              onClose={() => setListMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              {allowListTitleEdit ? (
                <MenuItem
                  onClick={() => {
                    setListMenuAnchor(null);
                    onStartEditListTitle(list.id);
                  }}
                >
                  <EditOutlinedIcon fontSize="small" sx={{ mr: 1 }} />
                  {txt('제목 수정', 'Edit title')}
                </MenuItem>
              ) : null}
              {allowListTitleEdit ? (
                <MenuItem
                  onClick={() => {
                    setListMenuAnchor(null);
                    onOpenListSettings(list.id);
                  }}
                >
                  <PersonAddIcon fontSize="small" sx={{ mr: 1 }} />
                  {txt('대분류 설정', 'List settings')}
                </MenuItem>
              ) : null}
              {allowListDelete ? (
                <MenuItem
                  onClick={() => {
                    setListMenuAnchor(null);
                    onDeleteList(list.id, list.title);
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                  {txt('대분류 삭제', 'Delete list')}
                </MenuItem>
              ) : null}
            </Menu>
          </>
        ) : null}
            </Box>
      {!listTitleEditing && (list.assignee?.username || list.assignee_user_id) ? (
        <Typography
        sx={{
            px: 1,
            pb: 0.75,
            fontSize: '0.75rem',
            color: '#6B778C',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={
            list.assignee?.username ||
            members.find((m: any) => Number(m.user_id) === Number(list.assignee_user_id))?.user
              ?.username ||
            String(list.assignee_user_id)
          }
        >
          {txt('대분류 담당', 'List owner')}:{' '}
          {list.assignee?.username ||
            members.find((m: any) => Number(m.user_id) === Number(list.assignee_user_id))?.user
              ?.username ||
            `${txt('사용자', 'User')} ${list.assignee_user_id}`}
        </Typography>
      ) : null}
      <SortableContext items={cardSortIds} strategy={verticalListSortingStrategy}>
        <Box
          sx={{
            overflow: 'visible',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            minHeight: 8,
        }}
      >
        {cards.map((c) => (
          <DraggableCard
            key={c.id}
            card={c}
              members={members}
              isCompletedList={isCompletedList}
            onOpenDetail={handleOpenCard}
              dragDisabled={!allowCardDrag}
          />
        ))}
      </Box>
      </SortableContext>

      {allowAddCard && composerOpen ? (
        <Paper
          elevation={0}
          sx={{
            mt: 0.5,
            p: 1.25,
            bgcolor: KANBAN_CARD_BG,
            borderRadius: KANBAN_CARD_RADIUS,
            border: KANBAN_CARD_BORDER,
            boxShadow: KANBAN_CARD_SHADOW,
          }}
        >
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
            size="small"
            placeholder={txt('제목', 'Title')}
            value={composerTitle}
            onChange={(e) => onComposerTitleChange(e.target.value)}
            variant="outlined"
            hiddenLabel
            sx={{ mb: 1 }}
          />
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={8}
            size="small"
            placeholder={txt('설명 (선택)', 'Description (optional)')}
            value={composerDesc}
            onChange={(e) => onComposerDescChange(e.target.value)}
            variant="outlined"
            hiddenLabel
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Button
              size="small"
              variant="contained"
              onClick={onSubmitCard}
              disabled={savingCard || !composerTitle.trim()}
              sx={{ textTransform: 'none', borderRadius: KANBAN_CONTROL_RADIUS, fontWeight: 600, boxShadow: 'none' }}
            >
              {savingCard ? <CircularProgress size={18} color="inherit" /> : txt('카드 추가', 'Add Card')}
            </Button>
            <IconButton size="small" onClick={onCloseComposer} aria-label={txt('취소', 'Cancel')} sx={{ borderRadius: KANBAN_CONTROL_RADIUS }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Paper>
      ) : allowAddCard ? (
        <Button
          fullWidth
          size="small"
          startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          onClick={() => onOpenComposer(list.id)}
          sx={{
            mt: 0.75,
            justifyContent: 'flex-start',
            color: '#5E6C84',
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.8125rem',
            py: 0.85,
            px: 1,
            borderRadius: KANBAN_CONTROL_RADIUS,
            bgcolor: 'transparent',
            '&:hover': { bgcolor: '#E6EDF5', color: '#172B4D' },
          }}
        >
          {txt('카드 추가', 'Add a card')}
        </Button>
      ) : null}
    </Paper>
  );
});

export default function WorkBoardDetailPage() {
  const theme = useTheme();
  const { boardId: boardIdParam } = useParams();
  const boardId = Number(boardIdParam);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkCardHandledRef = useRef<number | null>(null);
  const { user } = useStore();
  const { language, menus, hasMenuPermission } = useMenuStore();
  const { t, i18n } = useTranslation();
  const txt = useCallback(
    (ko: string, en: string) => {
      const lang = String(i18n.language || language || 'ko').toLowerCase();
      return lang.startsWith('en') ? en : ko;
    },
    [i18n.language, language]
  );
  const workProjectsMenuId = useMemo(
    () => findMenuIdByPath(menus, location.pathname),
    [menus, location.pathname]
  );
  const isRootUser = user?.role === 'root';
  const menuCanCreate =
    isRootUser || (workProjectsMenuId != null && hasMenuPermission(workProjectsMenuId, 'create'));
  const menuCanEdit =
    isRootUser || (workProjectsMenuId != null && hasMenuPermission(workProjectsMenuId, 'edit'));
  const menuCanDelete =
    isRootUser || (workProjectsMenuId != null && hasMenuPermission(workProjectsMenuId, 'delete'));
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const photoPreview = usePhotoPreviewOptional();

  const [board, setBoard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);
  const [activeList, setActiveList] = useState<BoardList | null>(null);

  /** 트렐로식 인라인 작성기가 열린 리스트 id */
  const [composerListId, setComposerListId] = useState<number | null>(null);
  const [composerTitle, setComposerTitle] = useState('');
  const [composerDesc, setComposerDesc] = useState('');
  const [savingCard, setSavingCard] = useState(false);
  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editingListTitle, setEditingListTitle] = useState('');
  const [listSaving, setListSaving] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListAssigneeUserId, setNewListAssigneeUserId] = useState<number | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [addListOpen, setAddListOpen] = useState(false);
  const [listSettingsOpen, setListSettingsOpen] = useState(false);
  const [listSettingsId, setListSettingsId] = useState<number | null>(null);
  const [listSettingsDescription, setListSettingsDescription] = useState('');
  const [listSettingsAssigneeUserId, setListSettingsAssigneeUserId] = useState<number | null>(null);
  const [listSettingsSaving, setListSettingsSaving] = useState(false);
  const [completedTasksOpen, setCompletedTasksOpen] = useState(false);
  const [completedTaskSearch, setCompletedTaskSearch] = useState('');
  const [completedTaskPage, setCompletedTaskPage] = useState(1);
  const [cardSearch, setCardSearch] = useState('');
  /** user 역할은 기본 ON, 토글로 전체/본인 전환 */
  const [onlyMyCards, setOnlyMyCards] = useState(() => user?.role === 'user');
  const [reopeningCardId, setReopeningCardId] = useState<number | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [memberRemovingId, setMemberRemovingId] = useState<number | null>(null);
  const [memberMenuAnchor, setMemberMenuAnchor] = useState<HTMLElement | null>(null);
  const [memberMenuTarget, setMemberMenuTarget] = useState<any | null>(null);
  const [cardDetail, setCardDetail] = useState<CardDetailState | null>(null);
  const [cardSaving, setCardSaving] = useState(false);
  const [moveBoardOptions, setMoveBoardOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [cardMoveLists, setCardMoveLists] = useState<BoardList[]>([]);
  const [cardMoveListsLoading, setCardMoveListsLoading] = useState(false);
  const [cardComments, setCardComments] = useState<BoardCardComment[]>([]);
  const [cardAttachmentUploading, setCardAttachmentUploading] = useState(false);
  const [cardAttachmentDeleting, setCardAttachmentDeleting] = useState<string | null>(null);
  const [uploadingAttachmentNames, setUploadingAttachmentNames] = useState<string[]>([]);
  const [attachmentStatusMessage, setAttachmentStatusMessage] = useState<{
    severity: 'error' | 'info' | 'success';
    text: string;
  } | null>(null);
  const cardAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [newComment, setNewComment] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<number[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentDeletingId, setCommentDeletingId] = useState<number | null>(null);
  const [replyParentId, setReplyParentId] = useState<number | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  /** 칸반 인라인으로 마지막 생성된 카드 id — 세부 화면에서 한 번 저장하기 전까지 댓글 잠금 */
  const lastQuickCreatedCardIdRef = useRef<number | null>(null);
  /** 늦게 끝난 댓글 조회가 최신 댓글 상태를 덮어쓰지 않도록 */
  const commentSyncGenRef = useRef(0);
  /** 이번 상세 진입에서 댓글을 새로 달았으면 칸반 말풍선을 빨간색으로 유지 */
  const cardCommentPostedRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 카드 클릭(상세)과 드래그 구분 — 짧게 움직이면 DnD 시작
      activationConstraint: { distance: 5 },
    })
  );

  const boardBeforeDragRef = useRef<any>(null);
  const lastKanbanOverKeyRef = useRef<string | null>(null);

  const loadBoard = useCallback(async (options?: { silent?: boolean }) => {
    if (!boardId || Number.isNaN(boardId)) return;
    const silent = options?.silent === true;
    if (!silent) setLoading(true);
    try {
      const res = await workBoardService.getBoard(boardId, { light: true });
      if (res.success) {
        setBoard(normalizeBoardData(res.data));
      } else {
        showErrorPopup(res.message || '불러올 수 없습니다.', '작업 보드');
      }
    } catch (e: any) {
      showErrorPopup(e, '작업 보드');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [boardId]);

  const patchBoardCardMeta = useCallback(
    (
      cardId: number,
      patch: {
        comments?: Array<{ id: number; created_at?: string; createdAt?: string }>;
        comment_count?: number;
        has_unread_comments?: boolean;
        attachments?: BoardCardAttachment[];
        attachment_count?: number;
      }
    ) => {
      setBoard((prev: any) => {
        if (!prev?.lists) return prev;
        return {
          ...prev,
          lists: prev.lists.map((list: BoardList) => ({
            ...list,
            cards: (list.cards || []).map((card: BoardCard) => {
              if (Number(card.id) !== cardId) return card;
              const comments = patch.comments ?? card.comments;
              const comment_count =
                patch.comment_count ??
                (Array.isArray(comments) ? comments.length : card.comment_count ?? 0);
              const attachments =
                patch.attachments !== undefined ? patch.attachments : card.attachments;
              const attachment_count =
                patch.attachment_count ??
                (patch.attachments !== undefined
                  ? patch.attachments.length
                  : countBoardCardAttachments(card.attachments, card.attachment_count));
              return {
                ...card,
                comments,
                comment_count,
                attachments,
                attachment_count,
                has_unread_comments:
                  patch.has_unread_comments !== undefined
                    ? patch.has_unread_comments
                    : card.has_unread_comments,
              };
            }),
          })),
        };
      });
    },
    []
  );

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const loadUsers = useCallback(async () => {
    const boardCompanyId =
      board?.company_id != null && board.company_id !== '' ? Number(board.company_id) : NaN;
    if (!Number.isInteger(boardCompanyId) || boardCompanyId <= 0) {
      setCompanyUsers([]);
      return;
    }
    const boardTenantId =
      board?.tenant_id != null && board.tenant_id !== '' ? Number(board.tenant_id) : null;
    try {
      const params: Record<string, string> = {};
      if ((user?.role === 'root' || user?.role === 'audit') && boardCompanyId > 0) {
        params.company_id = String(boardCompanyId);
      }
      const allUsers = await useReferenceDataStore.getState().fetchUsers(
        params.company_id ? { company_id: Number(params.company_id) } : undefined
      );
      const list = filterActiveCompanyUsers(allUsers, {
        companyId: boardCompanyId,
        tenantId: boardTenantId,
        excludeUserId: user?.id != null ? Number(user.id) : undefined,
        });
        setCompanyUsers(list);
    } catch {
      /* ignore */
    }
  }, [board?.company_id, board?.tenant_id, user?.id, user?.role]);

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    const boardLists: BoardList[] = board?.lists || [];
    boardBeforeDragRef.current = board;
    lastKanbanOverKeyRef.current = null;
    if (id.startsWith('card-')) {
      setActiveList(null);
      const cid = parseInt(id.replace('card-', ''), 10);
      for (const l of boardLists) {
        const c = (l.cards || []).find((x) => x.id === cid);
        if (c) {
          setActiveCard(c);
          return;
        }
      }
      setActiveCard(null);
      return;
    }
    if (id.startsWith('listcol-')) {
      setActiveCard(null);
      const lid = parseInt(id.replace('listcol-', ''), 10);
      const col = boardLists.find((l) => l.id === lid);
      setActiveList(col || null);
      return;
    }
    setActiveCard(null);
    setActiveList(null);
  };

  const handleDragCancel = () => {
    if (boardBeforeDragRef.current) {
      setBoard(boardBeforeDragRef.current);
      boardBeforeDragRef.current = null;
    }
    lastKanbanOverKeyRef.current = null;
    setActiveCard(null);
    setActiveList(null);
  };

  /** 드래그 중 실시간으로 칸/순서 반영 — 놓을 때만 API (검색 필터 중에도 카드 이동 가능) */
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (!menuCanEdit) return;
      const { active, over } = event;
      if (!over) return;

      const activeIdStr = String(active.id);
      const overId = String(over.id);

      if (activeIdStr.startsWith('card-')) {
        const activeCardId = parseInt(activeIdStr.replace('card-', ''), 10);
        if (!Number.isFinite(activeCardId)) return;
        setBoard((prev: any) => {
          if (!prev?.lists) return prev;
          const lists: BoardList[] = prev.lists || [];
          const target = resolveCardDropTarget(lists, activeCardId, overId);
          if (!target) return prev;
          const key = `card:${activeCardId}:${target.targetListId}:${target.targetIndex}`;
          if (lastKanbanOverKeyRef.current === key) return prev;
          const before = findCardPositionInBoard(prev, activeCardId);
          if (
            before &&
            before.listId === target.targetListId &&
            before.index === target.targetIndex
          ) {
            lastKanbanOverKeyRef.current = key;
            return prev;
          }
          lastKanbanOverKeyRef.current = key;
          return applyOptimisticCardMove(
            prev,
            activeCardId,
            target.targetListId,
            target.targetIndex
          );
        });
        return;
      }

      // 검색 중에는 보이는 카드만 필터된 상태라 대분류(열) 순서 변경은 막는다
      if (activeIdStr.startsWith('listcol-') && cardSearch.trim().length === 0) {
        const activeListId = parseInt(activeIdStr.replace('listcol-', ''), 10);
        if (!Number.isFinite(activeListId)) return;
        setBoard((prev: any) => {
          if (!prev?.lists) return prev;
          const lists: BoardList[] = prev.lists || [];
          const targetIndex = resolveListDropTargetIndex(lists, activeListId, overId);
          if (targetIndex == null) return prev;
          const key = `list:${activeListId}:${targetIndex}`;
          if (lastKanbanOverKeyRef.current === key) return prev;
          const ordered = [...lists].sort((a, b) => a.position - b.position);
          const currentIndex = ordered.findIndex((l) => l.id === activeListId);
          if (currentIndex === targetIndex) {
            lastKanbanOverKeyRef.current = key;
            return prev;
          }
          lastKanbanOverKeyRef.current = key;
          return applyOptimisticListMove(prev, activeListId, targetIndex);
        });
      }
    },
    [menuCanEdit, cardSearch]
  );

  const isKanbanDragging = Boolean(activeCard || activeList);
  const boardHScrollRef = useRef<HTMLDivElement | null>(null);
  const boardPanRef = useRef<{
    active: boolean;
    pointerId: number | null;
    lastX: number;
    lastY: number;
    moved: boolean;
  }>({ active: false, pointerId: null, lastX: 0, lastY: 0, moved: false });
  const [boardPanning, setBoardPanning] = useState(false);

  const canStartBoardPan = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    if (target.closest(BOARD_PAN_IGNORE_SELECTOR)) {
      return false;
    }
    return true;
  }, []);

  const endBoardPan = useCallback((pointerId?: number) => {
    if (pointerId != null && boardPanRef.current.pointerId !== pointerId) return;
    boardPanRef.current.active = false;
    boardPanRef.current.pointerId = null;
    boardPanRef.current.moved = false;
    setBoardPanning(false);
    document.body.style.removeProperty('user-select');
    document.body.style.removeProperty('cursor');
  }, []);

  const handleBoardPanPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // 카드 상세·드롭다운 조작 중에는 보드 팬이 클릭을 가로채지 않도록 한다
      if (cardDetail) return;
      if (e.button !== 0 || isKanbanDragging) return;
      if (!canStartBoardPan(e.target)) return;
      boardPanRef.current = {
        active: true,
        pointerId: e.pointerId,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
      };
      setBoardPanning(true);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [canStartBoardPan, cardDetail, isKanbanDragging]
  );

  const handleBoardPanPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!boardPanRef.current.active || boardPanRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - boardPanRef.current.lastX;
    const dy = e.clientY - boardPanRef.current.lastY;
    if (!boardPanRef.current.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
    boardPanRef.current.moved = true;
    boardPanRef.current.lastX = e.clientX;
    boardPanRef.current.lastY = e.clientY;
    // 좌우·상하: 칸반 스크롤 컨테이너 (뷰포트 하단 가로 스크롤)
    const hScroll = boardHScrollRef.current;
    if (!hScroll) return;
    if (dx !== 0) hScroll.scrollLeft -= dx;
    if (dy !== 0) hScroll.scrollTop -= dy;
  }, []);

  const handleBoardPanPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      endBoardPan(e.pointerId);
    },
    [endBoardPan]
  );

  useEffect(() => {
    if (!isKanbanDragging) return;
    endBoardPan();
  }, [isKanbanDragging, endBoardPan]);

  useEffect(() => {
    if (!cardDetail) return;
    endBoardPan();
  }, [cardDetail, endBoardPan]);

  useEffect(() => {
    if (!isKanbanDragging) return;
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    if (!isCoarsePointer) {
      return;
    }
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isKanbanDragging]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const clearDragOverlay = () => {
    setActiveCard(null);
    setActiveList(null);
      lastKanbanOverKeyRef.current = null;
    };
    const snapshot = boardBeforeDragRef.current;
    boardBeforeDragRef.current = null;

    if (!menuCanEdit) {
      clearDragOverlay();
      return;
    }
    const { active, over } = event;
    if (!board) {
      clearDragOverlay();
      return;
    }

    const activeIdStr = String(active.id);
    const overId = over ? String(over.id) : '';
    const lists: BoardList[] = board.lists || [];

    // 대분류(컬럼) 드래그 이동 — 검색 중에는 비활성
    if (activeIdStr.startsWith('listcol-')) {
      if (cardSearch.trim().length > 0) {
        clearDragOverlay();
        if (snapshot) setBoard(snapshot);
        return;
      }
      const activeListId = parseInt(activeIdStr.replace('listcol-', ''), 10);
      let targetIndex =
        overId ? resolveListDropTargetIndex(lists, activeListId, overId) : null;
      if (targetIndex == null) {
        const ordered = [...lists].sort((a, b) => a.position - b.position);
        const cur = ordered.findIndex((l) => l.id === activeListId);
        targetIndex = cur >= 0 ? cur : null;
      }
      if (targetIndex == null) {
        clearDragOverlay();
        if (snapshot) setBoard(snapshot);
        return;
      }

      const snapOrdered = snapshot
        ? [...(snapshot.lists || [])].sort(
            (a: BoardList, b: BoardList) => a.position - b.position
          )
        : [];
      const snapIndex = snapOrdered.findIndex((l: BoardList) => l.id === activeListId);
      if (snapIndex === targetIndex) {
        clearDragOverlay();
        return;
      }

      setBoard((p: any) => applyOptimisticListMove(p, activeListId, targetIndex!));
      clearDragOverlay();
      try {
        const res = await workBoardService.moveList(boardId, activeListId, targetIndex);
        if (!res.success) {
          if (snapshot) setBoard(snapshot);
          showErrorPopup(res.message || '대분류 이동 실패', '작업 보드');
        }
      } catch (e: any) {
        if (snapshot) setBoard(snapshot);
        showErrorPopup(e, '작업 보드');
      }
      return;
    }

    if (!activeIdStr.startsWith('card-')) {
      clearDragOverlay();
      return;
    }
    const activeCardId = parseInt(activeIdStr.replace('card-', ''), 10);

    // dragOver로 이미 맞춰진 최종 위치를 우선 — over로 한 번 더 보정
    let finalPos = findCardPositionInBoard(board, activeCardId);
    if (overId) {
      const fromOver = resolveCardDropTarget(lists, activeCardId, overId);
      if (fromOver) {
        finalPos = { listId: fromOver.targetListId, index: fromOver.targetIndex };
        setBoard((p: any) =>
          applyOptimisticCardMove(p, activeCardId, fromOver.targetListId, fromOver.targetIndex)
        );
      }
    }
    if (!finalPos) {
      clearDragOverlay();
      if (snapshot) setBoard(snapshot);
      return;
    }

    const beforeSnap = snapshot ? findCardPositionInBoard(snapshot, activeCardId) : null;
    if (
      beforeSnap &&
      beforeSnap.listId === finalPos.listId &&
      beforeSnap.index === finalPos.index
    ) {
      clearDragOverlay();
      return;
    }

    clearDragOverlay();
    try {
      const res = await workBoardService.moveCard(
        boardId,
        activeCardId,
        finalPos.listId,
        finalPos.index
      );
      if (!res.success) {
        if (snapshot) setBoard(snapshot);
        showErrorPopup(res.message || '이동 실패', '작업 보드');
        return;
      }
      if (res.data?.assignee || res.data?.reference_user_ids) {
        setBoard((p: any) =>
          applyCardMoveMetaOnBoard(p, activeCardId, {
            assignee: res.data?.assignee,
            reference_user_ids: res.data?.reference_user_ids,
          })
        );
      }
    } catch (e: any) {
      if (snapshot) setBoard(snapshot);
      showErrorPopup(e, '작업 보드');
    }
  };

  const startEditListTitleById = useCallback(
    (listId: number) => {
      if (!menuCanEdit) return;
      const list = (board?.lists || []).find((l: BoardList) => l.id === listId);
      if (list) {
        setEditingListId(list.id);
        setEditingListTitle(list.title);
      }
    },
    [board?.lists, menuCanEdit]
  );

  const openListSettingsById = useCallback(
    (listId: number) => {
      if (!menuCanEdit) return;
      const list = (board?.lists || []).find((l: BoardList) => l.id === listId);
      if (!list) return;
      setListSettingsId(list.id);
      setListSettingsDescription(list.description || '');
      setListSettingsAssigneeUserId(
        list.assignee_user_id != null
          ? Number(list.assignee_user_id)
          : list.assignee?.id != null
            ? Number(list.assignee.id)
            : null
      );
      setListSettingsOpen(true);
    },
    [board?.lists, menuCanEdit]
  );

  const saveListSettings = useCallback(async () => {
    if (!listSettingsId) return;
    if (!menuCanEdit) {
      showErrorPopup(
        txt('대분류를 수정할 권한이 없습니다.', 'You do not have permission to edit lists.'),
        txt('업무 보드', 'Work board')
      );
      return;
    }
    setListSettingsSaving(true);
    try {
      const res = await workBoardService.updateList(boardId, listSettingsId, {
        description: listSettingsDescription.trim() || null,
        assignee_user_id: listSettingsAssigneeUserId
      });
      if (!res.success) {
        showErrorPopup(res.message || txt('대분류 설정 저장 실패', 'Failed to save list settings.'), txt('업무 보드', 'Work board'));
        return;
      }
      const cascadedCount = Number(res.meta?.cascaded_card_count || 0);
      setListSettingsOpen(false);
      setListSettingsId(null);
      await loadBoard();
      if (cascadedCount > 0) {
        showSuccessToast(
          txt(
            `대분류 담당자가 변경되어 하위 카드 ${cascadedCount}건의 담당자를 갱신했습니다.`,
            `List owner updated; assignee refreshed on ${cascadedCount} card(s).`
          )
        );
      } else {
        showSuccessToast(txt('대분류 설정이 저장되었습니다.', 'List settings saved.'));
      }
    } catch (error: any) {
      showErrorPopup(error, txt('업무 보드', 'Work board'));
    } finally {
      setListSettingsSaving(false);
    }
  }, [
    boardId,
    listSettingsAssigneeUserId,
    listSettingsDescription,
    listSettingsId,
    loadBoard,
    menuCanEdit,
    txt
  ]);

  const saveListTitle = useCallback(async () => {
    if (!editingListId) return;
    if (!menuCanEdit) {
      showErrorPopup(
        txt('대분류를 수정할 권한이 없습니다.', 'You do not have permission to edit lists.'),
        txt('업무 보드', 'Work board')
      );
      return;
    }
    if (!editingListTitle.trim()) {
      showErrorPopup('대분류 제목을 입력해주세요.', '업무 보드');
      return;
    }
    setListSaving(true);
    try {
      const res = await workBoardService.updateList(boardId, editingListId, {
        title: editingListTitle.trim()
      });
      if (!res.success) {
        showErrorPopup(res.message || '대분류 제목 저장 실패', '업무 보드');
        return;
      }
      setEditingListId(null);
      setEditingListTitle('');
      await loadBoard();
    } catch (error: any) {
      showErrorPopup(error, '업무 보드');
    } finally {
      setListSaving(false);
    }
  }, [boardId, editingListId, editingListTitle, loadBoard, menuCanEdit, txt]);

  const deleteList = useCallback(
    async (listId: number, listTitle: string) => {
      if (!menuCanDelete) {
        showErrorPopup(
          txt('대분류를 삭제할 권한이 없습니다.', 'You do not have permission to delete lists.'),
          txt('업무 보드', 'Work board')
        );
        return;
      }
      showConfirm(
        txt(
          `"${listTitle}" 대분류와 하위 카드를 삭제하시겠습니까?`,
          `Delete the list "${displayBoardListTitle(listTitle, 'en')}" and all cards in it?`
        ),
        () => {
          void (async () => {
            try {
              const res = await workBoardService.deleteList(boardId, listId);
              if (res.success) {
                showSuccessToast(txt('대분류가 삭제되었습니다.', 'List deleted.'));
                if (editingListId === listId) {
                  setEditingListId(null);
                  setEditingListTitle('');
                }
                await loadBoard();
              } else {
                showErrorPopup(res.message || txt('대분류 삭제 실패', 'Failed to delete list.'), txt('업무 보드', 'Work board'));
              }
            } catch (error: any) {
              showErrorPopup(error, txt('업무 보드', 'Work board'));
            }
          })();
        },
        {
          title: txt('대분류 삭제', 'Delete list'),
          confirmText: txt('삭제', 'Delete'),
          confirmColor: 'error'
        }
      );
    },
    [boardId, showConfirm, editingListId, loadBoard, txt, menuCanDelete]
  );

  const createNewList = async () => {
    if (!menuCanCreate) {
      showErrorPopup(
        txt('대분류를 추가할 권한이 없습니다.', 'You do not have permission to add lists.'),
        txt('업무 보드', 'Work board')
      );
      return;
    }
    if (!newListTitle.trim()) {
      showErrorPopup('대분류 제목을 입력해주세요.', '업무 보드');
      return;
    }
    setCreatingList(true);
    try {
      const res = await workBoardService.createList(boardId, {
        title: newListTitle.trim(),
        description: newListDescription.trim() || null,
        assignee_user_id: newListAssigneeUserId
      });
      if (!res.success) {
        showErrorPopup(res.message || '대분류 추가 실패', '업무 보드');
        return;
      }
      setNewListTitle('');
      setNewListDescription('');
      setNewListAssigneeUserId(null);
      setAddListOpen(false);
      await loadBoard();
    } catch (error: any) {
      showErrorPopup(error, '업무 보드');
    } finally {
      setCreatingList(false);
    }
  };

  /** 카드 상세 URL (?card=) — 공유·새로고침 시 동일 작업으로 복귀 */
  const syncCardQueryParam = useCallback(
    (cardId: number | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (cardId != null && Number.isInteger(cardId) && cardId > 0) {
            if (next.get('card') === String(cardId)) return prev;
            next.set('card', String(cardId));
          } else {
            if (!next.has('card')) return prev;
            next.delete('card');
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const openCardDetail = useCallback(
    (card: BoardCard, listTitle: string, listId: number) => {
    const blockCommentsUntilDetailSave =
      lastQuickCreatedCardIdRef.current != null &&
      Number(card.id) === Number(lastQuickCreatedCardIdRef.current);
      cardCommentPostedRef.current = false;
      commentSyncGenRef.current += 1;
      deepLinkCardHandledRef.current = Number(card.id);
    setCardDetail({
      cardId: card.id,
      blockCommentsUntilDetailSave,
      title: card.title || '',
      description: normalizeRichTextHtml(card.description),
      dueDate: formatDueDate(card.due_date),
      color: card.color || '',
        assigneeUserId:
          card.assignee?.id != null
            ? Number(card.assignee.id)
            : card.assignee_user_id != null
              ? Number(card.assignee_user_id)
              : null,
      referenceUserIds: Array.isArray(card.reference_user_ids)
        ? card.reference_user_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : [],
        createdBy: card.created_by != null ? Number(card.created_by) : null,
        createdAt: resolveBoardCardCreatedAt(card),
        boardId,
        originalBoardId: boardId,
      listId,
      originalListId: listId,
        listTitle,
        attachments: normalizeBoardCardAttachments(card.attachments),
    });
      setCardMoveLists([]);
    setCardComments(sortBoardCardCommentsThreaded(card.comments || []));
      setAttachmentStatusMessage(null);
      setUploadingAttachmentNames([]);
    setNewComment('');
    setReplyParentId(null);
    setMentionedUserIds([]);
    setMentionOpen(false);
    setMentionQuery('');
    setMentionHighlightIndex(0);
      syncCardQueryParam(Number(card.id));
    },
    [boardId, syncCardQueryParam]
  );

  const loadMoveBoardOptions = useCallback(async () => {
    try {
      const params: { company_id?: number; light?: boolean } = { light: true };
      if (board?.company_id != null && Number(board.company_id) > 0) {
        params.company_id = Number(board.company_id);
      } else if (user?.company_id != null) {
        params.company_id = Number(user.company_id);
      }
      const res = await workBoardService.getBoards(params);
      if (res.success && Array.isArray(res.data)) {
        const options = res.data
          .map((b: any) => ({
            id: Number(b.id),
            name: String(b.name || '').trim() || `#${b.id}`,
          }))
          .filter((b: { id: number }) => Number.isInteger(b.id) && b.id > 0);
        if (board?.id != null && !options.some((b: { id: number }) => b.id === Number(board.id))) {
          options.unshift({
            id: Number(board.id),
            name: String(board.name || '').trim() || `#${board.id}`,
          });
        }
        setMoveBoardOptions(options);
      }
    } catch {
      setMoveBoardOptions(
        board?.id != null
          ? [{ id: Number(board.id), name: String(board.name || '').trim() || `#${board.id}` }]
          : []
      );
    }
  }, [board?.company_id, board?.id, board?.name, user?.company_id]);

  const loadListsForMoveBoard = useCallback(
    async (targetBoardId: number) => {
      if (!Number.isInteger(targetBoardId) || targetBoardId <= 0) {
        setCardMoveLists([]);
        return [] as BoardList[];
      }
      if (targetBoardId === boardId) {
        setCardMoveLists([]);
        return (board?.lists || []) as BoardList[];
      }
      setCardMoveListsLoading(true);
      try {
        const res = await workBoardService.getBoard(targetBoardId, { light: true });
        if (res.success && res.data) {
          const normalized = normalizeBoardData(res.data);
          const nextLists = [...(normalized.lists || [])].sort(
            (a: BoardList, b: BoardList) => a.position - b.position
          );
          setCardMoveLists(nextLists);
          return nextLists;
        }
        setCardMoveLists([]);
        return [] as BoardList[];
      } catch {
        setCardMoveLists([]);
        return [] as BoardList[];
      } finally {
        setCardMoveListsLoading(false);
      }
    },
    [board?.lists, boardId]
  );

  useEffect(() => {
    if (!cardDetail || !menuCanEdit) return;
    void loadMoveBoardOptions();
  }, [cardDetail?.cardId, menuCanEdit, loadMoveBoardOptions]);

  /** 알림·공유 딥링크(?card=)로 진입 시 해당 카드 상세를 자동으로 연다 (URL은 공유용으로 유지) */
  useEffect(() => {
    if (!board?.lists || loading) return;
    const rawCardId = searchParams.get('card');
    if (!rawCardId) {
      if (!cardDetail) deepLinkCardHandledRef.current = null;
      return;
    }
    const cardId = Number(rawCardId);
    if (!Number.isInteger(cardId) || cardId <= 0) return;
    if (deepLinkCardHandledRef.current === cardId) return;
    if (cardDetail?.cardId === cardId) {
      deepLinkCardHandledRef.current = cardId;
      return;
    }

    for (const list of board.lists as BoardList[]) {
      const card = (list.cards || []).find((c) => Number(c.id) === cardId);
      if (card) {
        deepLinkCardHandledRef.current = cardId;
        openCardDetail(card, list.title, list.id);
        return;
      }
    }
  }, [board, loading, searchParams, cardDetail, openCardDetail]);

  const submitCard = useCallback(async () => {
    if (!composerListId || !composerTitle.trim()) return;
    if (!menuCanCreate) {
      showErrorPopup(
        txt('카드를 추가할 권한이 없습니다.', 'You do not have permission to add cards.'),
        txt('업무 보드', 'Work board')
      );
      return;
    }
    const list = (board?.lists || []).find((l: BoardList) => l.id === composerListId);
    const listAssigneeId =
      list?.assignee?.id != null
        ? Number(list.assignee.id)
        : list?.assignee_user_id != null
          ? Number(list.assignee_user_id)
          : null;
    const defaultAssigneeId =
      listAssigneeId != null && Number.isFinite(listAssigneeId) && listAssigneeId > 0
        ? listAssigneeId
        : user?.id != null
          ? Number(user.id)
          : null;
    setSavingCard(true);
    try {
      const res = await workBoardService.createCard(boardId, composerListId, {
        title: composerTitle.trim(),
        description: composerDesc.trim() || undefined,
        ...(defaultAssigneeId != null ? { assignee_user_id: defaultAssigneeId } : {}),
      });
      if (res.success) {
        const payload = res.data as BoardCard | undefined;
        const newId = Number(payload?.id);
        const savedListId = composerListId;
        const savedTitle = composerTitle.trim();
        const savedDesc = composerDesc.trim();
        const createdAssigneeId =
          payload?.assignee?.id != null
            ? Number(payload.assignee.id)
            : payload?.assignee_user_id != null
              ? Number(payload.assignee_user_id)
              : defaultAssigneeId;
        setComposerListId(null);
        setComposerTitle('');
        setComposerDesc('');
        if (Number.isInteger(newId) && newId > 0) {
          lastQuickCreatedCardIdRef.current = newId;
          openCardDetail(
            {
              id: newId,
              title: savedTitle,
              description: savedDesc || undefined,
              position: 0,
              comments: [],
              created_at: resolveBoardCardCreatedAt(payload) || undefined,
              createdAt: resolveBoardCardCreatedAt(payload) || undefined,
              assignee_user_id: createdAssigneeId,
              assignee:
                payload?.assignee ||
                (createdAssigneeId != null
                  ? {
                      id: createdAssigneeId,
                      username:
                        list?.assignee?.username ||
                        (createdAssigneeId === Number(user?.id) ? String(user?.username || '') : ''),
                    }
                  : undefined),
            },
            list?.title ?? '',
            savedListId
          );
          await loadBoard({ silent: true });
        } else {
          await loadBoard();
        }
      } else {
        showErrorPopup(res.message || '실패', '작업 보드');
      }
    } catch (e: any) {
      showErrorPopup(e, '작업 보드');
    } finally {
      setSavingCard(false);
    }
  }, [
    board,
    boardId,
    composerListId,
    composerTitle,
    composerDesc,
    loadBoard,
    menuCanCreate,
    openCardDetail,
    txt,
    user?.id,
    user?.username,
  ]);

  const openComposer = useCallback(
    (listId: number) => {
      if (!menuCanCreate) return;
      setComposerListId(listId);
      setComposerTitle('');
      setComposerDesc('');
    },
    [menuCanCreate]
  );

  const closeComposer = useCallback(() => {
    setComposerListId(null);
    setComposerTitle('');
    setComposerDesc('');
  }, []);

  const loadCardComments = useCallback(
    async (
      cardId: number,
      options?: { markRead?: boolean; syncGen?: number; silent?: boolean }
    ) => {
      const syncGen = options?.syncGen ?? ++commentSyncGenRef.current;
      const silent = options?.silent === true;
      if (!silent) setCommentLoading(true);
      try {
        const res = await workBoardService.getCardComments(boardId, cardId);
        if (syncGen !== commentSyncGenRef.current) return;
        if (res.success) {
          const nextComments = sortBoardCardCommentsThreaded(res.data || []);
          setCardComments(nextComments);
          patchBoardCardMeta(cardId, {
            comments: nextComments.map((row) => ({ id: row.id, created_at: resolveCommentCreatedAt(row) })),
            comment_count: nextComments.length,
          });
          if (options?.markRead !== false) {
            try {
              await workBoardService.markCardCommentsRead(boardId, cardId);
              if (syncGen !== commentSyncGenRef.current) return;
              patchBoardCardMeta(cardId, { has_unread_comments: false });
            } catch {
              /* ignore read marker failures */
            }
          }
        }
      } catch (e: any) {
        if (syncGen === commentSyncGenRef.current) {
        showErrorPopup(e, '카드 댓글');
        }
      } finally {
        if (!silent && syncGen === commentSyncGenRef.current) {
        setCommentLoading(false);
        }
      }
    },
    [boardId, patchBoardCardMeta]
  );

  useEffect(() => {
    if (!cardDetail?.cardId) return;
    if (cardDetail.blockCommentsUntilDetailSave) return;
    const syncGen = ++commentSyncGenRef.current;
    void loadCardComments(cardDetail.cardId, { syncGen });
  }, [cardDetail?.cardId, cardDetail?.blockCommentsUntilDetailSave, loadCardComments]);

  const submitComment = async () => {
    if (!cardDetail?.cardId || !newComment.trim()) return;
    if (cardDetail.blockCommentsUntilDetailSave) return;
    if (!menuCanEdit) return;
    setCommentSaving(true);
    try {
      const content = newComment.trim();
      const mentionTokens = Array.from(content.matchAll(new RegExp(COMMENT_MENTION_TOKEN_RE.source, 'g'))).map(
        (match) => normalizeMentionLookupKey(String(match[1] || match[2] || ''))
      );
      const mentionFromText = memberOptions
        .filter((member) => {
          const usernameToken = normalizeMentionLookupKey(member.label);
          const useridToken = normalizeMentionLookupKey(member.userid);
          return mentionTokens.includes(usernameToken) || mentionTokens.includes(useridToken);
        })
        .map((member) => member.id);
      const mentionUserIds = Array.from(
        new Set([...mentionedUserIds, ...mentionFromText].filter((id) => id !== Number(user?.id || 0)))
      );

      const res = await workBoardService.createCardComment(
        boardId,
        cardDetail.cardId,
        content,
        mentionUserIds,
        replyParentId ?? undefined
      );
      if (res.success) {
        cardCommentPostedRef.current = true;
        commentSyncGenRef.current += 1;
        const syncGen = commentSyncGenRef.current;
        await loadCardComments(cardDetail.cardId, { markRead: false, syncGen, silent: true });
        const nextCount =
          typeof res.comment_count === 'number'
            ? res.comment_count
            : cardComments.length + 1;
        patchBoardCardMeta(cardDetail.cardId, {
          comment_count: nextCount,
          has_unread_comments: true,
        });
        setNewComment('');
        setReplyParentId(null);
        setMentionedUserIds([]);
        setMentionOpen(false);
        setMentionQuery('');
        setMentionHighlightIndex(0);
      } else {
        showErrorPopup(res.message || '댓글 등록 실패', '카드 댓글');
      }
    } catch (e: any) {
      showErrorPopup(e, '카드 댓글');
    } finally {
      setCommentSaving(false);
    }
  };

  const uploadCardAttachmentFiles = async (
    files: File[],
    cardId = cardDetail?.cardId
  ): Promise<BoardCardAttachment[] | null> => {
    if (!cardId || files.length === 0) {
      return cardDetail?.attachments || [];
    }
    const previousCount = cardDetail?.attachments?.length || 0;
    setUploadingAttachmentNames(files.map((file) => file.name));
    setAttachmentStatusMessage({
      severity: 'info',
      text: txt('첨부 파일을 업로드하는 중…', 'Uploading attachment…'),
    });
    setCardAttachmentUploading(true);
    try {
      const res = await workBoardService.uploadCardAttachments(boardId, cardId, files);
      if (!res.success) {
        const message =
          res.message || txt('첨부 업로드에 실패했습니다.', 'Failed to upload attachment.');
        setAttachmentStatusMessage({ severity: 'error', text: message });
        showErrorPopup(message, txt('카드 세부사항', 'Card details'));
        return null;
      }
      const nextAttachments = normalizeBoardCardAttachments(res.data?.attachments);
      if (nextAttachments.length <= previousCount) {
        const message = txt(
          '파일 업로드에 실패했습니다. 형식(jpg, png, gif, pdf, doc, docx, xls, xlsx)과 용량(20MB 이하)을 확인해 주세요.',
          'Upload failed. Check file type (jpg, png, gif, pdf, doc, docx, xls, xlsx) and size (max 20MB).'
        );
        setAttachmentStatusMessage({ severity: 'error', text: message });
        showErrorPopup(message, txt('카드 세부사항', 'Card details'));
        return null;
      }
      setCardDetail((prev) => (prev ? { ...prev, attachments: nextAttachments } : prev));
      patchBoardCardMeta(cardId, {
        attachments: nextAttachments,
        attachment_count: nextAttachments.length,
      });
      setAttachmentStatusMessage({
        severity: 'success',
        text: txt('첨부가 업로드되었습니다.', 'Attachment uploaded.'),
      });
      showSuccessToast(txt('첨부가 업로드되었습니다.', 'Attachment uploaded.'));
      return nextAttachments;
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        txt('첨부 업로드에 실패했습니다.', 'Failed to upload attachment.');
      setAttachmentStatusMessage({ severity: 'error', text: message });
      showErrorPopup(err, txt('카드 세부사항', 'Card details'));
      return null;
    } finally {
      setUploadingAttachmentNames([]);
      setCardAttachmentUploading(false);
    }
  };

  const handleCardAttachmentInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const input = e.target;
      const files = input.files;
      if (!files?.length) return;

      if (!cardDetail?.cardId) {
        const message = txt('카드를 먼저 저장한 뒤 첨부할 수 있습니다.', 'Save the card before attaching files.');
        setAttachmentStatusMessage({ severity: 'error', text: message });
        showErrorPopup(message, txt('카드 세부사항', 'Card details'));
        return;
      }
      if (!menuCanEdit) {
        const message = txt('첨부 파일을 올릴 권한이 없습니다.', 'You do not have permission to upload attachments.');
        setAttachmentStatusMessage({ severity: 'error', text: message });
        showErrorPopup(message, txt('카드 세부사항', 'Card details'));
        return;
      }

      const remaining =
        WORK_BOARD_CARD_MAX_ATTACHMENTS - (cardDetail.attachments?.length || 0);
      if (remaining <= 0) {
        const message = txt(
          `첨부는 최대 ${WORK_BOARD_CARD_MAX_ATTACHMENTS}개까지 가능합니다.`,
          `You can attach up to ${WORK_BOARD_CARD_MAX_ATTACHMENTS} files.`
        );
        setAttachmentStatusMessage({ severity: 'error', text: message });
        showErrorPopup(message, txt('카드 세부사항', 'Card details'));
        return;
      }

      const selected: File[] = [];
      const rejectedNames: string[] = [];
      for (const file of Array.from(files)) {
        if (selected.length >= remaining) break;
        if (!isAllowedBoardCardAttachmentFile(file)) {
          rejectedNames.push(file.name);
          continue;
        }
        if (file.size > WORK_BOARD_CARD_MAX_FILE_BYTES) {
          rejectedNames.push(file.name);
          continue;
        }
        selected.push(file);
      }

      if (selected.length === 0) {
        const message =
          rejectedNames.length > 0
            ? txt(
                `업로드할 수 없는 파일입니다: ${rejectedNames.join(', ')}`,
                `These files cannot be uploaded: ${rejectedNames.join(', ')}`
              )
            : txt(
                'jpg, png, gif, pdf, doc, docx, xls, xlsx 파일만 업로드할 수 있습니다.',
                'Only jpg, png, gif, pdf, doc, docx, xls, and xlsx files are allowed.'
              );
        setAttachmentStatusMessage({ severity: 'error', text: message });
        showErrorPopup(message, txt('카드 세부사항', 'Card details'));
        return;
      }

      await uploadCardAttachmentFiles(selected, cardDetail.cardId);
    } finally {
      e.target.value = '';
    }
  };

  const openCardAttachmentPicker = () => {
    if (
      !cardDetail?.cardId ||
      cardAttachmentUploading ||
      cardSaving ||
      !menuCanEdit ||
      (cardDetail.attachments?.length || 0) >= WORK_BOARD_CARD_MAX_ATTACHMENTS
    ) {
      return;
    }
    setAttachmentStatusMessage(null);
    cardAttachmentInputRef.current?.click();
  };

  const handleRemoveCardAttachment = async (storedName: string) => {
    if (!cardDetail?.cardId || !menuCanEdit) return;
    setCardAttachmentDeleting(storedName);
    try {
      const res = await workBoardService.deleteCardAttachment(boardId, cardDetail.cardId, storedName);
      if (res.success) {
        const nextAttachments = normalizeBoardCardAttachments(res.data?.attachments);
        setCardDetail((prev) => (prev ? { ...prev, attachments: nextAttachments } : prev));
        patchBoardCardMeta(cardDetail.cardId, {
          attachments: nextAttachments,
          attachment_count: nextAttachments.length,
        });
        await loadBoard({ silent: true });
        showSuccessToast(txt('첨부가 삭제되었습니다.', 'Attachment removed.'));
      } else {
        showErrorPopup(res.message || txt('첨부 삭제에 실패했습니다.', 'Failed to delete attachment.'), txt('카드 세부사항', 'Card details'));
      }
    } catch (err: any) {
      showErrorPopup(err, txt('카드 세부사항', 'Card details'));
    } finally {
      setCardAttachmentDeleting(null);
    }
  };

  const removeComment = async (commentId: number) => {
    if (!cardDetail?.cardId) return;
    if (!menuCanEdit) return;
    holdScrollPosition(1200);

    const prevComments = cardComments;
    // 로딩 스피너로 목록이 접히면 스크롤이 맨 위로 튀므로, 로컬에서 바로 제거
    setCardComments((prev) =>
      prev.filter((c) => c.id !== commentId && resolveCommentParentId(c) !== commentId)
    );
    setReplyParentId((prev) => (prev === commentId ? null : prev));
    setCommentDeletingId(commentId);

    try {
      const res = await workBoardService.deleteCardComment(boardId, cardDetail.cardId, commentId);
      if (res.success) {
        const nextCount =
          typeof res.comment_count === 'number'
            ? res.comment_count
            : Math.max(0, prevComments.length - 1);
        patchBoardCardMeta(cardDetail.cardId, {
          comment_count: nextCount,
          has_unread_comments: Boolean(res.has_unread_comments),
          comments: prevComments
            .filter((c) => c.id !== commentId && resolveCommentParentId(c) !== commentId)
            .map((row) => ({
              id: row.id,
              created_at: resolveCommentCreatedAt(row),
            })),
        });
      } else {
        setCardComments(prevComments);
        showErrorPopup(res.message || '댓글 삭제 실패', '카드 댓글');
      }
    } catch (e: any) {
      setCardComments(prevComments);
      showErrorPopup(e, '카드 댓글');
    } finally {
      setCommentDeletingId(null);
    }
  };

  const closeCardDetail = () => {
    if (cardDetail?.cardId) {
      const patch: {
        comments?: Array<{ id: number; created_at?: string; createdAt?: string }>;
        comment_count?: number;
        has_unread_comments?: boolean;
      } = {};
      if (cardComments.length > 0) {
        patch.comments = cardComments.map((row) => ({
          id: row.id,
          created_at: resolveCommentCreatedAt(row),
        }));
        patch.comment_count = cardComments.length;
      }
      if (cardCommentPostedRef.current) {
        patch.has_unread_comments = true;
      }
      if (Object.keys(patch).length > 0) {
        patchBoardCardMeta(cardDetail.cardId, patch);
      }
    }
    cardCommentPostedRef.current = false;
    setAttachmentStatusMessage(null);
    setUploadingAttachmentNames([]);
    deepLinkCardHandledRef.current = null;
    setCardDetail(null);
    setCardMoveLists([]);
    setCardMoveListsLoading(false);
    setCardComments([]);
    setNewComment('');
    setReplyParentId(null);
    setMentionedUserIds([]);
    setMentionOpen(false);
    setMentionQuery('');
    setMentionHighlightIndex(0);
    syncCardQueryParam(null);
  };

  const persistCardDetail = async (forcedListId?: number, successMessage?: string) => {
    if (!cardDetail) return;
    if (!menuCanEdit) {
      showErrorPopup(
        txt('카드를 수정할 권한이 없습니다.', 'You do not have permission to edit cards.'),
        txt('카드 세부사항', 'Card details')
      );
      return;
    }
    if (!cardDetail.title.trim()) {
      showErrorPopup('제목은 필수입니다.', '카드 세부사항');
      return;
    }

    const targetBoardId = Number(cardDetail.boardId) || boardId;
    const targetListId = forcedListId ?? cardDetail.listId;
    if (!targetListId || !Number.isInteger(targetListId) || targetListId <= 0) {
      showErrorPopup(
        txt('대분류를 선택해 주세요.', 'Please select a list.'),
        txt('카드 세부사항', 'Card details')
      );
      return;
    }
    const descriptionForSave = cardDetail.description;
    const boardChanged = targetBoardId !== Number(cardDetail.originalBoardId);
    const listChanged = targetListId !== cardDetail.originalListId || boardChanged;
    setCardSaving(true);
    try {
      const updateRes = await workBoardService.updateCard(boardId, cardDetail.cardId, {
        title: cardDetail.title.trim(),
        description: isRichTextEmpty(descriptionForSave) ? null : descriptionForSave,
        assignee_user_id: cardDetail.assigneeUserId,
        reference_user_ids: cardDetail.referenceUserIds,
        due_date: cardDetail.dueDate || null,
        color: cardDetail.color || null
      });

      if (!updateRes.success) {
        showErrorPopup(updateRes.message || '카드 저장에 실패했습니다.', '카드 세부사항');
        return;
      }

      if (listChanged) {
        const listsForTarget =
          targetBoardId === boardId
            ? (board?.lists || [])
            : cardMoveLists;
        const targetList = listsForTarget.find((l: BoardList) => l.id === targetListId);
        const targetIndex = targetList?.cards?.length ?? 0;
        const moveRes = await workBoardService.moveCard(
          boardId,
          cardDetail.cardId,
          targetListId,
          targetIndex,
          targetBoardId
        );
        if (!moveRes.success) {
          showErrorPopup(
            moveRes.message ||
              txt('업무/대분류 이동에 실패했습니다.', 'Failed to move the card to another board/list.'),
            txt('카드 세부사항', 'Card details')
          );
          return;
        }
      }

      await loadBoard();
      if (
        lastQuickCreatedCardIdRef.current != null &&
        lastQuickCreatedCardIdRef.current === Number(cardDetail.cardId)
      ) {
        lastQuickCreatedCardIdRef.current = null;
      }
      if (successMessage) {
        showSuccessToast(successMessage);
      } else if (boardChanged) {
        showSuccessToast(
          txt('다른 업무 보드로 카드를 이동했습니다.', 'Card moved to another work board.')
        );
      }
      closeCardDetail();
      if (boardChanged && targetBoardId !== boardId) {
        navigate(`/work/projects/${targetBoardId}?card=${cardDetail.cardId}`);
      }
    } catch (error: any) {
      showErrorPopup(error, '카드 세부사항');
    } finally {
      setCardSaving(false);
    }
  };

  const saveCardDetail = async () => {
    await persistCardDetail();
  };

  const completeTask = async () => {
    if (!cardDetail || !board) return;
    if (!menuCanEdit) {
      showErrorPopup(
        txt('업무 상태를 변경할 권한이 없습니다.', 'You do not have permission to change task status.'),
        txt('업무 완료', 'Complete task')
      );
      return;
    }
    const myMemberCt = board.members?.find((m: any) => m.user_id === user?.id);
    const isOwnerCt = myMemberCt?.role === 'owner' || user?.role === 'root';
    const assigneeUid = cardDetail.assigneeUserId != null ? Number(cardDetail.assigneeUserId) : null;
    const myUid = user?.id != null ? Number(user.id) : null;
    const isCardAssignee = assigneeUid != null && myUid != null && assigneeUid === myUid;
    if (!isOwnerCt && assigneeUid != null && !isCardAssignee) {
      showErrorPopup(
        txt(
          '업무 완료는 담당자 또는 보드 소유자만 할 수 있습니다.',
          'Only the assignee or board owner can complete this task.'
        ),
        txt('업무 완료', 'Complete task')
      );
      return;
    }

    let targetCompletedListId = completedList?.id;
    // 완료 열이 없으면 「업무 완료」 목록을 만들어 그곳으로 이동·기록
    if (!targetCompletedListId) {
      try {
        setCardSaving(true);
        const createRes = await workBoardService.createList(boardId, {
          title: txt('업무 완료', 'Done'),
        });
        if (!createRes.success || !createRes.data?.id) {
      showErrorPopup(
            createRes.message ||
              txt(
                '업무 완료 목록을 만들 수 없습니다. 보드에 「업무 완료」 목록을 추가해 주세요.',
                'Could not create a Done list. Please add a “Done” list to the board.'
              ),
            txt('업무 완료', 'Complete task')
      );
      return;
    }
        targetCompletedListId = Number(createRes.data.id);
        await loadBoard();
      } catch (error: any) {
        showErrorPopup(error, txt('업무 완료', 'Complete task'));
        return;
      } finally {
        setCardSaving(false);
      }
    }

    await persistCardDetail(
      targetCompletedListId,
      txt('업무가 완료되어 「업무 완료」 목록으로 이동했습니다.', 'Task completed and moved to the Done list.')
    );
  };

  const handleCompleteTask = () => {
    if (!cardDetail || !board) return;
    showConfirm(
      txt(
        '이 업무를 완료 처리하고 「업무 완료」 목록으로 이동하시겠습니까?',
        'Complete this task and move it to the Done list?'
      ),
      () => {
        void completeTask();
      },
      {
        title: txt('업무 완료 확인', 'Confirm task completion'),
        confirmText: txt('업무 완료', 'Complete Task'),
        cancelText: txt('취소', 'Cancel'),
        confirmColor: 'primary',
      }
    );
  };

  const handleDeleteCard = () => {
    if (!cardDetail?.cardId) return;
    if (!menuCanDelete) {
      showErrorPopup(
        txt('카드를 삭제할 권한이 없습니다.', 'You do not have permission to delete cards.'),
        txt('카드 세부사항', 'Card details')
      );
      return;
    }
    showConfirm(
      '',
      () => {
        void (async () => {
          setCardSaving(true);
          try {
            const res = await workBoardService.deleteCard(boardId, cardDetail.cardId);
            if (res.success) {
              closeCardDetail();
              await loadBoard();
              showSuccessToast(txt('카드가 삭제되었습니다.', 'Card deleted.'));
            } else {
              showErrorPopup(
                res.message || txt('카드 삭제에 실패했습니다.', 'Failed to delete card.'),
                txt('카드 세부사항', 'Card details')
              );
            }
          } catch (error: any) {
            showErrorPopup(error, txt('카드 세부사항', 'Card details'));
          } finally {
            setCardSaving(false);
          }
        })();
      },
      {
        titleKey: 'workBoards.cardDetail.deleteTitle',
        messageKey: 'workBoards.cardDetail.deleteConfirmMessage',
        confirmTextKey: 'common.delete',
        cancelTextKey: 'common.cancel',
        confirmColor: 'error',
      }
    );
  };

  const handleInvite = async () => {
    if (!selectedUsers.length) return;
    if (!menuCanEdit) {
      showErrorPopup(
        txt('멤버를 초대할 권한이 없습니다.', 'You do not have permission to invite members.'),
        txt('작업 보드', 'Work board')
      );
      return;
    }
    setInviteLoading(true);
    try {
      const settled = await Promise.allSettled(
        selectedUsers.map((member) => workBoardService.inviteMember(boardId, Number(member.id)))
      );
      let successCount = 0;
      const failedMessages: string[] = [];
      settled.forEach((entry) => {
        if (entry.status === 'fulfilled') {
          if (entry.value?.success) {
            successCount += 1;
      } else {
            failedMessages.push(String(entry.value?.message || txt('초대 실패', 'Invite failed')));
          }
          return;
        }
        failedMessages.push(String(entry.reason?.message || txt('초대 실패', 'Invite failed')));
      });

      if (successCount > 0) {
        showSuccessToast(
          successCount === 1
            ? txt('1명이 초대되었습니다.', '1 member has been invited.')
            : txt(`${successCount}명이 초대되었습니다.`, `${successCount} members have been invited.`)
        );
        setInviteOpen(false);
        setSelectedUsers([]);
        setInviteSearch('');
        await loadBoard();
      } else {
        showErrorPopup(
          failedMessages[0] || txt('초대 실패', 'Invite failed'),
          txt('작업 보드', 'Work board')
        );
      }

      if (successCount > 0 && failedMessages.length > 0) {
        showErrorPopup(
          txt('일부 사용자는 이미 초대되었거나 초대에 실패했습니다.', 'Some users were already invited or failed to be invited.'),
          txt('작업 보드', 'Work board')
        );
      }
    } catch (e: any) {
      showErrorPopup(e, txt('작업 보드', 'Work board'));
    } finally {
      setInviteLoading(false);
    }
  };

  const closeMemberMenu = useCallback(() => {
    setMemberMenuAnchor(null);
    setMemberMenuTarget(null);
  }, []);

  const handleRemoveMember = (memberUserId: number, memberName: string) => {
    if (!menuCanEdit && Number(memberUserId) !== Number(user?.id)) return;
    closeMemberMenu();
    showConfirm(
      txt(
        `"${memberName}" 님을 이 보드 멤버에서 삭제하시겠습니까?`,
        `Remove "${memberName}" from this board?`
      ),
      () => {
        void (async () => {
          setMemberRemovingId(memberUserId);
          try {
            const res = await workBoardService.removeMember(boardId, memberUserId);
            if (res.success) {
              showSuccessToast(txt('멤버가 삭제되었습니다.', 'Member removed.'));
              await loadBoard();
            } else {
              showErrorPopup(
                res.message || txt('멤버 삭제 실패', 'Failed to remove member'),
                txt('작업 보드', 'Work board')
              );
            }
          } catch (e: any) {
            showErrorPopup(e, txt('작업 보드', 'Work board'));
          } finally {
            setMemberRemovingId(null);
          }
        })();
      },
      {
        title: txt('멤버 삭제', 'Delete member'),
        confirmText: txt('삭제', 'Delete'),
        cancelText: t('common.cancel'),
        confirmColor: 'error',
      }
    );
  };

  const openMemberMenu = (event: React.MouseEvent<HTMLElement>, member: any) => {
    event.preventDefault();
    event.stopPropagation();
    setMemberMenuAnchor(event.currentTarget);
    setMemberMenuTarget(member);
  };

  // 바깥(바탕) 클릭 시 멤버 드롭메뉴 닫기 — 보드 팬/툴팁과 충돌해도 닫히도록
  useEffect(() => {
    if (!memberMenuAnchor) return;
    const onPointerDownCapture = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        closeMemberMenu();
        return;
      }
      // 앵커 아바타·메뉴 본문 안 클릭은 유지
      if (memberMenuAnchor.contains(target)) return;
      if (target.closest('.MuiMenu-paper, .MuiPopover-paper')) return;
      closeMemberMenu();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMemberMenu();
    };
    document.addEventListener('pointerdown', onPointerDownCapture, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDownCapture, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [memberMenuAnchor, closeMemberMenu]);

  const handleDeleteBoard = () => {
    const boardName = board?.name?.trim();
    const message = boardName
      ? t('workBoards.deleteConfirm.message', { name: boardName })
      : t('workBoards.deleteConfirm.messageFallback');

    const runDelete = () => {
        void (async () => {
          try {
            const res = await workBoardService.deleteBoard(boardId);
            if (res.success) {
            showSuccessPopup(t('workBoards.deleteConfirm.success'));
              navigate('/work/projects');
            } else {
            showErrorPopup(
              res.message || t('workBoards.deleteConfirm.failed'),
              t('workBoards.title')
            );
            }
          } catch (e: any) {
          showErrorPopup(e, t('workBoards.title'));
          }
        })();
    };

    // 1차: 보드 삭제 → 2차: 카드 전체 삭제 재확인
    showConfirm(
      message,
      () => {
        // ConfirmDialog가 닫힌 뒤 바로 다음 확인을 띄우기 위해 다음 tick에 호출
        window.setTimeout(() => {
          showConfirm(t('workBoards.deleteConfirm.cardsMessage'), runDelete, {
            title: t('workBoards.deleteConfirm.cardsTitle'),
            confirmText: t('common.delete'),
            cancelText: t('common.cancel'),
            confirmColor: 'error',
            messageTone: 'danger',
          });
        }, 0);
      },
      {
        title: t('workBoards.deleteConfirm.title'),
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
        confirmColor: 'error',
      }
    );
  };

  const myMember = board?.members?.find((m: any) => m.user_id === user?.id);
  const isOwner = myMember?.role === 'owner' || user?.role === 'root';
  const canManageMembers = isOwner && menuCanEdit;
  const isBoardCreator =
    board?.created_by != null && user?.id != null && Number(board.created_by) === Number(user.id);
  const canDeleteBoard = Boolean(isBoardCreator && menuCanDelete);
  const lists: BoardList[] = [...(board?.lists || [])].sort((a, b) => a.position - b.position);
  const cardDetailListOptions = useMemo(() => {
    if (!cardDetail) return lists;
    if (Number(cardDetail.boardId) === boardId) return lists;
    return cardMoveLists;
  }, [boardId, cardDetail, cardMoveLists, lists]);
  const handleCardDetailListChange = useCallback(
    (nextListId: number) => {
      const targetList = cardDetailListOptions.find((l) => l.id === nextListId);
      const listAssignee = resolveListAssigneeForCard(targetList);
      setCardDetail((prev) => {
        if (!prev) return prev;
        if (!listAssignee || prev.originalListId === nextListId) {
          return {
            ...prev,
            listId: nextListId,
            listTitle: targetList?.title || prev.listTitle,
          };
        }
        const prevAssigneeId =
          prev.assigneeUserId != null ? Number(prev.assigneeUserId) : null;
        const nextRefs = new Set(
          (prev.referenceUserIds || [])
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
        );
        if (prevAssigneeId != null && prevAssigneeId !== listAssignee.id) {
          nextRefs.add(prevAssigneeId);
        }
        nextRefs.delete(listAssignee.id);
        return {
          ...prev,
          listId: nextListId,
          listTitle: targetList?.title || prev.listTitle,
          assigneeUserId: listAssignee.id,
          referenceUserIds: Array.from(nextRefs),
        };
      });
    },
    [cardDetailListOptions]
  );
  /** 「업무 완료」 우선, 없으면 완료/Done 키워드, 그래도 없으면 마지막 열 */
  const completedList = resolveCompletedList(lists);
  const activeLists = completedList
    ? lists.filter((list) => list.id !== completedList.id)
    : lists;
  const normalizedCardSearch = cardSearch.trim().toLowerCase();
  const cardSearchActive = normalizedCardSearch.length > 0;
  const myUserId = user?.id != null ? Number(user.id) : null;
  const showOnlyMyCards = onlyMyCards;

  const isMyWorkCard = useCallback(
    (card: BoardCard) => {
      if (myUserId == null) return false;
      const assigneeId =
        card.assignee?.id != null
          ? Number(card.assignee.id)
          : card.assignee_user_id != null
            ? Number(card.assignee_user_id)
            : null;
      if (assigneeId === myUserId) return true;
      if (card.created_by != null && Number(card.created_by) === myUserId) return true;
      if (
        Array.isArray(card.reference_user_ids) &&
        card.reference_user_ids.some((id) => Number(id) === myUserId)
      ) {
        return true;
      }
      return false;
    },
    [myUserId]
  );

  const displayActiveLists = useMemo(() => {
    const boardMembers = (board?.members || []) as any[];
    return activeLists.map((list) => {
      let cards = list.cards || [];
      if (showOnlyMyCards) {
        cards = cards.filter((card) => isMyWorkCard(card));
      }
      if (cardSearchActive) {
        cards = cards.filter((card) => {
          const creator = boardMembers.find(
            (member: any) => Number(member.user_id) === Number(card.created_by)
          );
          const referenceNames = (card.reference_user_ids || []).map((rid) => {
            const m = boardMembers.find((member: any) => Number(member.user_id) === Number(rid));
            return m?.user?.username || '';
          });
          const searchable = [
            card.title,
            getPlainTextFromHtml(card.description),
            card.assignee?.username,
            creator?.user?.username,
            list.title,
            list.assignee?.username,
            ...referenceNames,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return searchable.includes(normalizedCardSearch);
        });
      }
      return { ...list, cards };
    });
  }, [
    activeLists,
    board?.lists,
    board?.members,
    cardSearchActive,
    normalizedCardSearch,
    showOnlyMyCards,
    isMyWorkCard,
  ]);
  const cardSearchMatchCount = useMemo(
    () => displayActiveLists.reduce((sum, list) => sum + (list.cards?.length || 0), 0),
    [displayActiveLists]
  );
  const completedCards = [...(completedList?.cards || [])].sort((a, b) => {
    const aTime = new Date(a.completed_at || 0).getTime();
    const bTime = new Date(b.completed_at || 0).getTime();
    if (aTime !== bTime) return bTime - aTime;
    return b.id - a.id;
  });
  const normalizedCompletedSearch = completedTaskSearch.trim().toLowerCase();
  const filteredCompletedCards = completedCards.filter((card) => {
    if (showOnlyMyCards && !isMyWorkCard(card)) return false;
    if (!normalizedCompletedSearch) return true;
    const creator = (board?.members || []).find(
      (member: any) => Number(member.user_id) === Number(card.created_by)
    );
    const searchable = [
      card.title,
      getPlainTextFromHtml(card.description),
      card.assignee?.username,
      creator?.user?.username,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(normalizedCompletedSearch);
  });
  const completedTasksPerPage = 10;
  const completedTaskPageCount = Math.max(
    1,
    Math.ceil(filteredCompletedCards.length / completedTasksPerPage)
  );
  const paginatedCompletedCards = filteredCompletedCards.slice(
    (completedTaskPage - 1) * completedTasksPerPage,
    completedTaskPage * completedTasksPerPage
  );
  const reopenTargetList =
    activeLists.find((list) => {
      const title = String(list.title || '').replace(/\s+/g, '').toLowerCase();
      return title.includes('진행') || title.includes('progress') || title.includes('doing');
    }) ?? activeLists[0];
  const isCardDetailCompleted =
    !!cardDetail && !!completedList && cardDetail.listId === completedList.id;
  const completedCardDetail = isCardDetailCompleted
    ? completedCards.find((card) => card.id === cardDetail?.cardId)
    : undefined;
  const canReopenCardDetail =
    isCardDetailCompleted &&
    (() => {
      if (isRootUser) return true;
      const uid = Number(user?.id);
      if (!uid) return false;
      const isCreator =
        cardDetail?.createdBy != null && Number(cardDetail.createdBy) === uid;
      const isAssignee =
        cardDetail?.assigneeUserId != null && Number(cardDetail.assigneeUserId) === uid;
      return isCreator || isAssignee;
    })();

  const canReopenCard = (card: BoardCard) => {
    if (isRootUser) return true;
    const uid = Number(user?.id);
    if (!uid) return false;
    const isCreator = card.created_by != null && Number(card.created_by) === uid;
    const isAssignee = card.assignee?.id != null && Number(card.assignee.id) === uid;
    return isCreator || isAssignee;
  };

  const handleReopenCard = async (card: BoardCard, fromDetail = false) => {
    if (!reopenTargetList?.id || !canReopenCard(card)) return;
    setReopeningCardId(card.id);
    try {
      const response = await workBoardService.moveCard(
        boardId,
        card.id,
        reopenTargetList.id,
        reopenTargetList.cards?.length ?? 0
      );
      if (!response.success) {
        showErrorPopup(
          response.message || txt('업무 재오픈에 실패했습니다.', 'Failed to reopen task.'),
          txt('완료된 업무', 'Completed Tasks')
        );
        return;
      }
      await loadBoard({ silent: true });
      setCompletedTaskPage(1);
      if (fromDetail) {
        closeCardDetail();
      }
      showSuccessToast(
        txt(
          `업무를 「${displayBoardListTitle(reopenTargetList.title, language)}」 목록으로 재오픈했습니다.`,
          `Task reopened in “${displayBoardListTitle(reopenTargetList.title, language)}”.`
        )
      );
    } catch (error: any) {
      showErrorPopup(error, txt('완료된 업무', 'Completed Tasks'));
    } finally {
      setReopeningCardId(null);
    }
  };
  /** 담당자가 있으면 담당자·보드 소유자·root만 완료 열로 이동 가능. 담당자 없으면 보드 멤버 누구나. */
  const assigneeUidComplete =
    cardDetail?.assigneeUserId != null ? Number(cardDetail.assigneeUserId) : null;
  const myUidComplete = user?.id != null ? Number(user.id) : null;
  const isCardAssigneeComplete =
    assigneeUidComplete != null &&
    myUidComplete != null &&
    assigneeUidComplete === myUidComplete;
  const canUserCompleteTask =
    isOwner || assigneeUidComplete === null || isCardAssigneeComplete;
  const members = useMemo(() => {
    const list = [...((board?.members || []) as any[])];
    const creatorId =
      board?.created_by != null && Number.isFinite(Number(board.created_by))
        ? Number(board.created_by)
        : null;
    if (creatorId == null) return list;
    list.sort((a, b) => {
      const aIsCreator = Number(a.user_id) === creatorId ? 0 : 1;
      const bIsCreator = Number(b.user_id) === creatorId ? 0 : 1;
      if (aIsCreator !== bIsCreator) return aIsCreator - bIsCreator;
      return Number(a.id) - Number(b.id);
    });
    return list;
  }, [board?.members, board?.created_by]);

  const resolveMemberDisplayName = useCallback(
    (userId: unknown, memberRow?: any) => {
      const uid = userId != null && userId !== '' ? Number(userId as string | number) : NaN;
      if (!Number.isFinite(uid)) return '';
      const fromMember =
        String(memberRow?.user?.username || memberRow?.user?.userid || '').trim() ||
        String(
          members.find((m: any) => Number(m.user_id) === uid)?.user?.username ||
            members.find((m: any) => Number(m.user_id) === uid)?.user?.userid ||
            ''
        ).trim();
      if (fromMember) return fromMember;
      const fromCompany = companyUsers.find((u: any) => Number(u.id) === uid);
      const companyName = String(fromCompany?.username || fromCompany?.userid || '').trim();
      if (companyName) return companyName;
      return txt(`사용자 ${uid}`, `User ${uid}`);
    },
    [members, companyUsers, txt]
  );

  const memberOptions = useMemo<MemberOption[]>(
    () =>
      members.map((m: any) => ({
        id: Number(m.user_id),
        label: resolveMemberDisplayName(m.user_id, m),
        userid: m.user?.userid || `user${m.user_id}`
      })),
    [members, resolveMemberDisplayName]
  );
  /** 이미 보드 멤버인 사용자는 초대 검색에서 제외 */
  const inviteUserOptions = useMemo(() => {
    const memberIds = new Set(members.map((m: any) => Number(m.user_id)));
    return companyUsers.filter((u: any) => !memberIds.has(Number(u.id)));
  }, [companyUsers, members]);
  const filteredInviteUsers = useMemo(() => {
    const keyword = inviteSearch.trim().toLowerCase();
    const selectedIds = new Set(selectedUsers.map((u: any) => Number(u.id)));
    const available = inviteUserOptions.filter((u: any) => !selectedIds.has(Number(u.id)));
    if (!keyword) return available.slice(0, 12);
    return available
      .filter((u: any) => {
        const name = String(u.username || '').toLowerCase();
        const userid = String(u.userid || '').toLowerCase();
        const email = String(u.email || '').toLowerCase();
        return name.includes(keyword) || userid.includes(keyword) || email.includes(keyword);
      })
      .slice(0, 12);
  }, [inviteSearch, inviteUserOptions, selectedUsers]);
  const toggleInviteUser = useCallback((userRow: any) => {
    const id = Number(userRow.id);
    setSelectedUsers((prev) => {
      if (prev.some((u: any) => Number(u.id) === id)) {
        return prev.filter((u: any) => Number(u.id) !== id);
      }
      return [...prev, userRow];
    });
  }, []);
  const mentionCandidates = useMemo<MemberOption[]>(() => {
    const keyword = mentionQuery.trim().toLowerCase();
    const assigneeId =
      cardDetail?.assigneeUserId != null ? Number(cardDetail.assigneeUserId) : null;
    const filtered = !keyword
      ? [...memberOptions]
      : memberOptions.filter((member) => {
        const normalizedName = member.label.replace(/\s+/g, '').toLowerCase();
        return (
          member.userid.toLowerCase().includes(keyword) ||
          member.label.toLowerCase().includes(keyword) ||
          normalizedName.includes(keyword)
        );
        });
    // 카드 담당자를 목록 상단에 고정 (이전에 상위 6명만 보여 담당자가 빠지던 문제)
    if (assigneeId == null) return filtered;
    return filtered.sort((a, b) => {
      if (a.id === assigneeId) return -1;
      if (b.id === assigneeId) return 1;
      return 0;
    });
  }, [memberOptions, mentionQuery, cardDetail?.assigneeUserId]);

  if (loading || !board) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (String(board.board_type || 'GENERAL').toUpperCase() === 'RECURRING') {
    return <WorkRecurringBoardPage board={board} />;
  }

  const commentsBlockedUntilSave = !!cardDetail?.blockCommentsUntilDetailSave;
  const isCommentEnabled =
    menuCanEdit &&
    !!cardDetail?.title?.trim() &&
    !!cardDetail?.listId &&
    Number(cardDetail?.cardId) > 0 &&
    !commentsBlockedUntilSave;
  const { parts: composerMentionParts, tail: composerTail } = splitComposerComment(
    newComment,
    memberOptions
  );

  const handleCommentInputChange = (value: string) => {
    setNewComment(value);
    const mentionMatch = value.match(/(?:^|\s)@([^\s@]*)$/);
    if (!mentionMatch) {
      setMentionOpen(false);
      setMentionQuery('');
      setMentionHighlightIndex(0);
      return;
    }
    setMentionOpen(true);
    setMentionQuery(mentionMatch[1] || '');
    setMentionHighlightIndex(0);
  };

  const insertMention = (candidate: { id: number; label: string; userid: string }) => {
    setNewComment((prev) =>
      prev.replace(/(?:^|\s)@[^\s@[\]]*$/, (token) => {
        const prefix = token.startsWith(' ') ? ' ' : '';
        // 저장·표시는 사용자명 기준 (@[이름] → 원형 이름 칩)
        return `${prefix}@[${candidate.label}] `;
      })
    );
    setMentionedUserIds((prev) => Array.from(new Set([...prev, candidate.id])));
    setMentionOpen(false);
    setMentionQuery('');
    setMentionHighlightIndex(0);
  };

  return (
    <Box
      data-board-pan-surface=""
      onPointerDown={handleBoardPanPointerDown}
      onPointerMove={handleBoardPanPointerMove}
      onPointerUp={handleBoardPanPointerUp}
      onPointerCancel={handleBoardPanPointerUp}
      sx={{
        p: 0,
        pb: cardDetail ? 1 : 0,
        flex: 1,
        // 카드 세부 입력 시 칸반 full-bleed 대신 일반 바디(mvsPageContentMaxWidth) 폭
        // AppLayout `& > * { width/maxWidth: 100% }` 보다 우선
        width: '100% !important',
        maxWidth: cardDetail ? `${mvsPageContentMaxWidth}px !important` : '100% !important',
        minWidth: 0,
        mx: cardDetail ? 'auto' : 0,
        alignSelf: cardDetail ? 'center' : 'stretch',
        minHeight: 0,
        height: cardDetail ? 'auto' : '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: cardDetail ? 'visible' : 'hidden',
        boxSizing: 'border-box',
        background: 'transparent',
        cursor: boardPanning ? 'grabbing' : 'default',
        touchAction: boardPanning ? 'none' : 'auto',
        '& .MuiOutlinedInput-root': {
          borderRadius: 2,
          backgroundColor: 'background.paper',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'divider'
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'text.secondary'
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'primary.main',
            borderWidth: 1
          }
        },
        '& .MuiInputBase-input::placeholder': {
          color: 'text.secondary',
          opacity: 0.75
        }
      }}
    >
      <DaeheungPageHeader
        backTo={cardDetail ? undefined : '/work/projects'}
        title={board.name}
        description={board.description?.trim() || undefined}
        actions={
          <>
        <Button
          startIcon={<CheckCircleIcon sx={{ fontSize: 18 }} />}
          variant="contained"
          color="success"
          disableElevation
          onClick={() => {
            setCompletedTaskSearch('');
            setCompletedTaskPage(1);
            setCompletedTasksOpen(true);
          }}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '8px',
            px: 2,
            bgcolor: 'success.main',
            color: '#FFFFFF',
            '&:hover': {
              bgcolor: 'success.dark',
            },
          }}
        >
          {txt('완료된 업무', 'Completed Tasks')} ({completedCards.length})
        </Button>
        {menuCanEdit && (
          <Button
            startIcon={<PersonAddIcon sx={{ fontSize: 18 }} />}
            variant="outlined"
            color="primary"
            onClick={() => {
              setSelectedUsers([]);
              setInviteSearch('');
              setInviteOpen(true);
              loadUsers();
            }}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '8px',
              px: 2,
              borderWidth: 1.5,
              borderColor: alpha(theme.palette.primary.main, 0.55),
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              color: theme.palette.primary.dark,
              '&:hover': {
                borderWidth: 1.5,
                borderColor: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
              },
            }}
          >
            {txt('멤버 초대', 'Invite Member')}
          </Button>
        )}
        {menuCanCreate && (
          <Button
            startIcon={<LibraryAddOutlinedIcon sx={{ fontSize: 18 }} />}
            variant="contained"
            color="primary"
            disableElevation
            onClick={() => {
              setNewListTitle('');
              setNewListDescription('');
              setNewListAssigneeUserId(null);
              setAddListOpen(true);
            }}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '8px',
              px: 2,
              color: '#FFFFFF',
              '&:hover': {
                boxShadow: '0 4px 10px rgba(31, 111, 115, 0.22)',
              },
            }}
          >
            {txt('대분류 추가', 'Add List')}
          </Button>
        )}
        {canDeleteBoard && (
          <Button
            color="error"
            variant="contained"
            disableElevation
            startIcon={<DeleteIcon sx={{ fontSize: 18 }} />}
            onClick={handleDeleteBoard}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '8px',
              px: 2,
              color: '#FFFFFF',
              bgcolor: theme.palette.error.main,
              '&:hover': {
                bgcolor: theme.palette.error.dark,
              },
            }}
          >
            {t('workBoards.actions.deleteBoard')}
          </Button>
        )}
          </>
        }
      />

      <Box
        sx={{
          mb: cardDetail ? 2.5 : 1.5,
          flexShrink: 0,
          px: { xs: 1.25, sm: 1.5 },
          py: { xs: 1, sm: 1.15 },
          borderRadius: '8px',
          bgcolor: KANBAN_MEMBER_PANEL_BG,
          border: KANBAN_MEMBER_PANEL_BORDER,
          boxShadow: 'none',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontSize: '0.8125rem',
              letterSpacing: '-0.01em',
              color: '#42526E',
              flexShrink: 0,
            }}
          >
            {txt('보드 멤버', 'Board Members')} · {members.length}{txt('명', '')}
          </Typography>
          <Box
                sx={{
                  display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
                  minWidth: 0,
              ml: { xs: 0, sm: 'auto' },
              mr: { xs: 0, sm: 1 },
                  width: { xs: '100%', sm: 'auto' },
              justifyContent: { xs: 'flex-start', sm: 'flex-end' },
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={onlyMyCards}
                  onChange={(e) => setOnlyMyCards(e.target.checked)}
                />
              }
              label={txt('내 업무만', 'My work only')}
                    sx={{
                mr: 0.5,
                ml: 0,
                '& .MuiFormControlLabel-label': {
                  fontSize: '0.8125rem',
                      fontWeight: 600,
                  color: '#42526E',
                  whiteSpace: 'nowrap',
                },
              }}
            />
            <TextField
              size="small"
              value={cardSearch}
              onChange={(e) => setCardSearch(e.target.value)}
              placeholder={txt(
                '카드 검색 (제목, 내용, 담당자, 참조)',
                'Search cards (title, details, assignee, reference)'
              )}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: '#475569' }} />
                  </InputAdornment>
                ),
                endAdornment: cardSearch ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      aria-label={txt('검색 지우기', 'Clear search')}
                      onClick={() => setCardSearch('')}
                      edge="end"
                    >
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{
                width: { xs: '100%', sm: 300 },
                maxWidth: '100%',
                '& .MuiOutlinedInput-root': {
                  borderRadius: KANBAN_CONTROL_RADIUS,
                  bgcolor: '#FFFFFF',
                  height: 38,
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
                  '& fieldset': {
                    borderColor: '#94A3B8',
                    borderWidth: 1.5,
                  },
                  '&:hover fieldset': {
                    borderColor: '#64748B',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: theme.palette.primary.main,
                    borderWidth: 1.5,
                  },
                },
                '& .MuiInputBase-input': {
                  color: '#0F172A',
                  fontWeight: 500,
                  fontSize: '0.8125rem',
                  '&::placeholder': {
                    color: '#64748B',
                    opacity: 1,
                  },
                },
              }}
            />
            {cardSearchActive ? (
                  <Typography
                variant="body2"
                sx={{ fontSize: '0.75rem', flexShrink: 0, color: '#475569', fontWeight: 600 }}
                  >
                {cardSearchMatchCount > 0
                  ? txt(`${cardSearchMatchCount}건`, `${cardSearchMatchCount} match(es)`)
                  : txt('검색 결과 없음', 'No matches')}
                  </Typography>
            ) : null}
                </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, flexShrink: 0 }}>
            {members.slice(0, BOARD_MEMBER_AVATAR_MAX).map((m: any, index: number) => {
              const name = resolveMemberDisplayName(m.user_id, m);
              const initial = name.trim().charAt(0).toUpperCase() || '?';
              const avatarSrc = resolveUserAvatarSrc(m.user?.avatar_url);
              const isOwnerMember = m.role === 'owner';
              const roleLabel = isOwnerMember ? txt('소유자', 'Owner') : txt('멤버', 'Member');
              const userid = m.user?.userid ? String(m.user.userid) : '';
              const menuOpenForThis =
                Boolean(memberMenuAnchor) &&
                Number(memberMenuTarget?.user_id) === Number(m.user_id);
              return (
                <Tooltip
                  key={m.id ?? m.user_id}
                  title={
                    <Box sx={{ textAlign: 'center', color: '#F8FAFC' }}>
                <Typography
                        variant="caption"
                        display="block"
                        sx={{ fontWeight: 700, color: '#F8FAFC', lineHeight: 1.35 }}
                      >
                        {name}
                </Typography>
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{ color: 'rgba(248, 250, 252, 0.88)', lineHeight: 1.35 }}
                      >
                        {roleLabel}
                        {userid ? ` · ${userid}` : ''}
                      </Typography>
                    </Box>
                  }
                  arrow
                  placement="top"
                  disableHoverListener={menuOpenForThis}
                  slotProps={{
                    tooltip: {
                      sx: {
                        bgcolor: '#1e293b',
                        color: '#F8FAFC',
                        '& .MuiTooltip-arrow': { color: '#1e293b' },
                      },
                    },
                  }}
                >
                  <Avatar
                    component="button"
                    type="button"
                    data-no-photo-preview
                    src={avatarSrc}
                    alt={name}
                    aria-label={`${name}, ${roleLabel}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpenForThis}
                    onClick={(e) => openMemberMenu(e, m)}
                    sx={{
                      width: BOARD_MEMBER_AVATAR_SIZE,
                      height: BOARD_MEMBER_AVATAR_SIZE,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: menuOpenForThis
                        ? `2px solid ${theme.palette.primary.main}`
                        : '2px solid #FFFFFF',
                        boxSizing: 'border-box',
                      ml: index === 0 ? 0 : `-${BOARD_MEMBER_AVATAR_OVERLAP_PX}px`,
                      zIndex: menuOpenForThis ? BOARD_MEMBER_AVATAR_MAX + 3 : index + 1,
                      cursor: 'pointer',
                      p: 0,
                      bgcolor: avatarSrc
                        ? 'transparent'
                        : isOwnerMember
                          ? 'primary.main'
                          : getAvatarColor(Number(m.user_id)),
                      color: '#FFFFFF',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      ...(isOwnerMember
                        ? { boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.45)}` }
                        : {}),
                      '&:hover': {
                        cursor: 'pointer',
                        zIndex: BOARD_MEMBER_AVATAR_MAX + 2,
                        boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.45)}`,
                      },
                      '& img': {
                        cursor: 'pointer',
                      },
                    }}
                  >
                    {initial}
                  </Avatar>
                </Tooltip>
              );
            })}
            {members.length > BOARD_MEMBER_AVATAR_MAX ? (
              <Tooltip
                title={members
                  .slice(BOARD_MEMBER_AVATAR_MAX)
                  .map((m: any) => resolveMemberDisplayName(m.user_id, m))
                  .join(', ')}
                arrow
                placement="top"
              >
                <Avatar
                    sx={{
                    width: BOARD_MEMBER_AVATAR_SIZE,
                    height: BOARD_MEMBER_AVATAR_SIZE,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    border: '2px solid #FFFFFF',
                      boxSizing: 'border-box',
                    ml: `-${BOARD_MEMBER_AVATAR_OVERLAP_PX}px`,
                    zIndex: BOARD_MEMBER_AVATAR_MAX + 1,
                    bgcolor: '#DFE1E6',
                    color: '#42526E',
                  }}
                >
                  +{members.length - BOARD_MEMBER_AVATAR_MAX}
                </Avatar>
              </Tooltip>
            ) : null}
                </Box>
              </Box>
        </Box>

      <Menu
        anchorEl={memberMenuAnchor}
        open={Boolean(memberMenuAnchor && memberMenuTarget)}
        onClose={closeMemberMenu}
        disableScrollLock
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          backdrop: {
            sx: { backgroundColor: 'transparent' },
          },
          paper: {
            sx: {
              borderRadius: '8px',
              minWidth: 180,
              mt: 0.75,
              border: '1px solid #E2E8F0',
              boxShadow: '0 8px 24px rgba(9, 30, 66, 0.14)',
              overflow: 'hidden',
            },
          },
        }}
      >
        {memberMenuTarget ? (() => {
          const m = memberMenuTarget;
          const name = resolveMemberDisplayName(m.user_id, m);
          const avatarSrc = resolveUserAvatarSrc(m.user?.avatar_url);
          const isOwnerMember = m.role === 'owner';
          const ownerCount = members.filter((x: any) => x.role === 'owner').length;
          const isLastOwner = isOwnerMember && ownerCount <= 1;
          const isSelf = Number(m.user_id) === Number(user?.id || 0);
          const canRemoveMember =
            (canManageMembers || isSelf) &&
            (menuCanEdit || isSelf) &&
            !isLastOwner;
          return [
            <MenuItem
              key="view-photo"
              onClick={() => {
                closeMemberMenu();
                if (avatarSrc) {
                  photoPreview?.openPhotoPreview(avatarSrc, name);
                } else {
                  showErrorPopup(
                    txt('등록된 사진이 없습니다.', 'No photo available.'),
                    txt('사진보기', 'View photo')
                  );
                }
              }}
              sx={{ py: 1.1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <PhotoOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={txt('사진보기', 'View photo')}
                primaryTypographyProps={{ fontWeight: 600, fontSize: '0.8125rem' }}
              />
            </MenuItem>,
            <MenuItem
              key="remove-member"
              onClick={() => {
                if (!canRemoveMember) return;
                handleRemoveMember(Number(m.user_id), name);
              }}
              disabled={!canRemoveMember || memberRemovingId === Number(m.user_id)}
              sx={{
                py: 1.1,
                color: canRemoveMember ? theme.palette.error.main : undefined,
                '&:hover': canRemoveMember
                  ? { bgcolor: alpha(theme.palette.error.main, 0.08) }
                  : undefined,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 36,
                  color: canRemoveMember ? 'inherit' : undefined,
                }}
              >
                {memberRemovingId === Number(m.user_id) ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <DeleteIcon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  isSelf && !canManageMembers
                    ? txt('보드 나가기', 'Leave board')
                    : txt('보드에서 삭제', 'Remove from board')
                }
                primaryTypographyProps={{ fontWeight: 600, fontSize: '0.8125rem' }}
              />
            </MenuItem>,
          ];
        })() : null}
      </Menu>

      {!cardDetail && (
        <DndContext
          sensors={sensors}
          autoScroll={{
            threshold: { x: 0.12, y: 0.12 },
            acceleration: 12,
            interval: 8,
          }}
          collisionDetection={kanbanCollisionDetection}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.Always,
            },
          }}
          onDragStart={handleDragStart}
          onDragOver={menuCanEdit ? handleDragOver : undefined}
          onDragCancel={handleDragCancel}
          onDragEnd={menuCanEdit ? handleDragEnd : () => {}}
        >
          <Box
            ref={boardHScrollRef}
            sx={{
              display: 'flex',
              flex: 1,
              minHeight: 0,
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
              overflowX: 'auto',
              overflowY: 'auto',
              cursor: boardPanning ? 'grabbing' : 'grab',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'nowrap',
                alignItems: 'flex-start',
                gap: 1.5,
                pb: 0.5,
                width: 'max-content',
                minWidth: '100%',
                minHeight: '100%',
                boxSizing: 'border-box',
              }}
            >
            <SortableContext
              items={displayActiveLists.map((l) => `listcol-${l.id}`)}
              strategy={horizontalListSortingStrategy}
            >
            {displayActiveLists.map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                members={members}
                isCompletedList={isCompletedListTitle(list.title) || completedList?.id === list.id}
                txt={txt}
                language={language}
                listTitleEditing={editingListId === list.id}
                listTitleDraft={editingListId === list.id ? editingListTitle : list.title}
                listSaving={listSaving}
                composerOpen={composerListId === list.id}
                composerTitle={composerTitle}
                composerDesc={composerDesc}
                onListTitleDraftChange={setEditingListTitle}
                onStartEditListTitle={startEditListTitleById}
                onOpenListSettings={openListSettingsById}
                onSaveListTitle={saveListTitle}
                onDeleteList={deleteList}
                onComposerTitleChange={setComposerTitle}
                onComposerDescChange={setComposerDesc}
                onOpenComposer={openComposer}
                onCloseComposer={closeComposer}
                onSubmitCard={submitCard}
                savingCard={savingCard}
                onOpenCardDetail={openCardDetail}
                allowListReorder={menuCanEdit && !cardSearchActive}
                allowCardDrag={menuCanEdit}
                allowListTitleEdit={menuCanEdit}
                allowListDelete={menuCanDelete}
                allowAddCard={menuCanCreate}
              />
            ))}
            </SortableContext>
            </Box>
          </Box>
          <DragOverlay
            adjustScale={false}
            dropAnimation={KANBAN_DROP_ANIMATION}
            modifiers={[snapCenterToCursor, restrictToWindowEdges]}
            zIndex={1500}
          >
            {activeCard ? (
              <Card
                elevation={0}
                sx={{
                  width: WORK_BOARD_COLUMN_WIDTH_PX,
                  maxWidth: WORK_BOARD_COLUMN_WIDTH_PX,
                  height: 'auto',
                  minHeight: WORK_BOARD_CARD_MIN_HEIGHT_PX,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: KANBAN_CARD_RADIUS,
                  border: 'none',
                  bgcolor: theme.palette.mode === 'light' ? KANBAN_CARD_BG : alpha(theme.palette.grey[900], 0.88),
                  boxShadow: KANBAN_CARD_HOVER_SHADOW,
                  cursor: 'grabbing',
                  touchAction: 'none',
                  transform: 'translateZ(0)',
                  willChange: 'transform',
                  overflow: 'hidden',
                }}
              >
                {activeCard.color && isHexColor(activeCard.color) ? (
                  <Box sx={{ height: 6, flexShrink: 0, bgcolor: String(activeCard.color) }} />
                ) : null}
                <CardContent
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    py: 1.15,
                    px: 1.25,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.85,
                    overflow: 'hidden',
                    '&:last-child': { pb: 1.15 },
                  }}
                >
                  <KanbanInlineTitle
                    title={activeCard.title || ''}
                    descriptionPlain={
                      activeCard.description && !isRichTextEmpty(activeCard.description)
                        ? getPlainTextFromHtml(activeCard.description)
                        : ''
                    }
                    compact
                  />
                </CardContent>
              </Card>
            ) : activeList ? (
              <Paper
                elevation={0}
                sx={{
                  width: WORK_BOARD_COLUMN_WIDTH_PX,
                  maxWidth: WORK_BOARD_COLUMN_WIDTH_PX,
                  boxSizing: 'border-box',
                  p: 1.25,
                  borderRadius: KANBAN_COLUMN_RADIUS,
                  border: KANBAN_COLUMN_BORDER,
                  bgcolor: KANBAN_COLUMN_BG,
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                  boxShadow: KANBAN_CARD_HOVER_SHADOW,
                  cursor: 'grabbing',
                  touchAction: 'none',
                  transform: 'translateZ(0)',
                  willChange: 'transform',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#172B4D', flex: 1 }}>
                    {displayBoardListTitle(activeList.title, language)}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#6B778C' }}>
                    {(activeList.cards || []).length}
                </Typography>
                </Box>
              </Paper>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {cardDetail && (
        <Paper
          elevation={0}
          sx={(theme) => {
            const custom = cardDetail.color?.trim();
            const accent = custom || theme.palette.primary.main;
            return {
              mt: 1,
              mb: 1,
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              height: 'auto',
              borderRadius: KANBAN_DETAIL_SHELL_RADIUS,
              boxShadow: '0 1px 0 #E2E8F0, 0 1px 2px rgba(15, 23, 42, 0.05)',
              overflow: 'hidden',
              border: '1px solid #E2E8F0',
              borderLeft: `4px solid ${accent}`,
              bgcolor: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            };
          }}
        >
        <Box
          sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            borderBottom: '1px solid #E2E8F0',
            bgcolor: '#FFFFFF',
              py: 1,
            px: 1.5,
          }}
        >
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
            onClick={closeCardDetail}
            sx={{
              minWidth: 0,
              px: 1.5,
              py: 0.5,
              height: 36,
              fontWeight: 700,
              fontSize: '0.875rem',
              letterSpacing: '-0.01em',
              textTransform: 'none',
              borderRadius: KANBAN_CONTROL_RADIUS,
              bgcolor: '#0F766E',
              color: '#FFFFFF',
              '&:hover': {
                bgcolor: '#0D9488',
              },
            }}
          >
            {txt('뒤로 가기', 'Back')}
          </Button>
          <Box
            sx={{
              ml: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <Typography
                variant="body2"
                component="span"
                sx={{
                  color: '#64748B',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {txt('업무 보드 변경', 'Change work board')} :
            </Typography>
              <TextField
                select
                variant="standard"
                hiddenLabel
              size="small"
                value={cardDetail?.boardId || ''}
                disabled={!menuCanEdit || cardMoveListsLoading}
                onChange={(e) => {
                  const nextBoardId = Number(e.target.value);
                  void (async () => {
                    await loadListsForMoveBoard(nextBoardId);
                    setCardDetail((prev) => {
                      if (!prev) return prev;
                      if (nextBoardId === Number(prev.originalBoardId)) {
                        const origList = (board?.lists || []).find(
                          (l: BoardList) => l.id === prev.originalListId
                        );
                        return {
                          ...prev,
                          boardId: nextBoardId,
                          listId: prev.originalListId,
                          listTitle: origList?.title ?? prev.listTitle,
                        };
                      }
                      if (nextBoardId !== prev.boardId) {
                        return {
                          ...prev,
                          boardId: nextBoardId,
                          listId: 0,
                          listTitle: '',
                        };
                      }
                      return { ...prev, boardId: nextBoardId };
                    });
                  })();
                }}
                InputProps={{ disableUnderline: true }}
                sx={{
                  minWidth: 80,
                  maxWidth: 200,
                  '& .MuiInput-root': {
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: '#64748B',
                    '&:before, &:after': { display: 'none' },
                  },
                  '& .MuiSelect-select': {
                    py: 0,
                    pr: '24px !important',
                  },
                }}
              >
                {(moveBoardOptions.length > 0
                  ? moveBoardOptions
                  : board
                    ? [{ id: Number(board.id), name: String(board.name || board.id) }]
                    : []
                ).map((opt) => (
                  <MenuItem key={opt.id} value={opt.id}>
                    {opt.name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <Typography
                variant="body2"
                component="span"
                sx={{
                  color: '#64748B',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {txt('대분류', 'List')} :
              </Typography>
              <TextField
                select
                variant="standard"
                hiddenLabel
            size="small"
                value={cardDetail?.listId || ''}
                disabled={!menuCanEdit || cardMoveListsLoading}
                onChange={(e) => handleCardDetailListChange(Number(e.target.value))}
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (selected) => {
                    if (!selected) {
                      return txt('대분류 선택', 'Select list');
                    }
                    const list = cardDetailListOptions.find((l) => l.id === Number(selected));
                    return list
                      ? displayBoardListTitle(list.title, language)
                      : String(selected);
                  },
                }}
                InputProps={{ disableUnderline: true }}
                sx={{
                  minWidth: 80,
                  maxWidth: 180,
                  '& .MuiInput-root': {
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: cardDetail?.listId ? '#64748B' : '#94A3B8',
                    '&:before, &:after': { display: 'none' },
                  },
                  '& .MuiSelect-select': {
                    py: 0,
                    pr: '24px !important',
                  },
                }}
              >
                {cardDetailListOptions.map((list) => (
                  <MenuItem key={list.id} value={list.id}>
                    {displayBoardListTitle(list.title, language)}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            {cardDetail?.createdAt ? (
              <Typography
                variant="body2"
                sx={{
                  color: '#64748B',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                {txt('작성일', 'Created')}: {formatCardCreatedAt(cardDetail.createdAt)}
              </Typography>
            ) : null}
            <IconButton
            size="small"
              onClick={closeCardDetail}
              aria-label={txt('카드 닫기', 'Close card')}
              sx={{
                ml: 0.25,
                color: '#64748B',
                borderRadius: KANBAN_CONTROL_RADIUS,
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Box
          sx={{
            pt: 1,
            px: 1.25,
            pb: 0.75,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.1,
            bgcolor: '#F8FAFC',
            overflow: 'visible',
          }}
        >
          <Box
            data-board-no-pan=""
            sx={{
              ...cardDetailFormSectionSx,
              py: 0.32,
              position: 'relative',
              zIndex: 5,
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'minmax(0, 2.15fr) minmax(0, 0.63fr) minmax(0, 1.15fr) minmax(132px, 0.52fr)',
                },
                gap: 1,
                alignItems: 'start',
              }}
            >
          <TextField
            fullWidth
            size="small"
                label={txt('제목', 'Title')}
                {...CARD_DETAIL_OUTLINED}
            variant="outlined"
            value={cardDetail?.title || ''}
            onChange={(e) =>
              setCardDetail((prev) =>
                prev ? { ...prev, title: e.target.value } : prev
              )
            }
            disabled={!menuCanEdit}
              placeholder={txt('카드 제목', 'Card Title')}
                sx={cardDetailOutlinedWhiteSx}
              />
              <TextField
                select
                fullWidth
                size="small"
                label={txt('담당자', 'Assignee')}
                {...CARD_DETAIL_OUTLINED}
                variant="outlined"
                value={cardDetail?.assigneeUserId ?? ''}
                disabled={!menuCanEdit}
                onChange={(e) =>
                  setCardDetail((prev) =>
                    prev
                      ? {
                          ...prev,
                          assigneeUserId: e.target.value === '' ? null : Number(e.target.value),
                        }
                      : prev
                  )
                }
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (selected: unknown) => {
                    if (selected === '' || selected == null) return txt('미지정', 'Unassigned');
                    return resolveMemberDisplayName(selected);
                  },
                }}
                sx={cardDetailOutlinedWhiteSx}
              >
                <MenuItem value="">{txt('미지정', 'Unassigned')}</MenuItem>
                {members.map((m: any) => (
                  <MenuItem key={m.user_id} value={Number(m.user_id)}>
                    {resolveMemberDisplayName(m.user_id, m)}
                  </MenuItem>
                ))}
              </TextField>
            <Autocomplete
              multiple
              disabled={!menuCanEdit}
              options={memberOptions}
                getOptionLabel={(option) => option.label}
                value={memberOptions.filter((option) =>
                  (cardDetail?.referenceUserIds || []).includes(option.id)
                )}
              onChange={(_event, selected) => {
                const nextIds = selected.map((item) => item.id);
                  setCardDetail((prev) =>
                    prev ? { ...prev, referenceUserIds: nextIds } : prev
                  );
              }}
              isOptionEqualToValue={(option, value) => option.id === value.id}
                slotProps={{
                  popper: {
                    sx: { zIndex: 2100 },
                  },
                }}
                renderOption={(props, option) => {
                  const { key, ...rest } = props as typeof props & { key?: React.Key };
                  return (
                    <li
                      key={key ?? option.id}
                      {...rest}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        rest.onMouseDown?.(event);
                      }}
                    >
                      {option.label}
                    </li>
                  );
                }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                    <Chip
                      size="small"
                      label={option.label}
                      {...getTagProps({ index })}
                      key={option.id}
                      sx={{ borderRadius: KANBAN_CHIP_RADIUS, fontWeight: 600, maxWidth: 96 }}
                    />
                ))
              }
              renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label={txt('참조자', 'References')}
                    {...CARD_DETAIL_OUTLINED}
                    placeholder={txt('참조할 사용자 선택', 'Select reference users')}
                    sx={{
                      ...cardDetailOutlinedWhiteSx,
                      '& .MuiOutlinedInput-root': {
                        ...(cardDetailOutlinedWhiteSx['& .MuiOutlinedInput-root'] as Record<
                          string,
                          unknown
                        >),
                        height: 'auto',
                        minHeight: 46,
                        alignItems: 'center',
                        py: 0.68,
                      },
                    }}
                  />
                )}
              />
              <TextField
                type="date"
                fullWidth
                size="small"
                label={txt('만료일', 'Due Date')}
                {...CARD_DETAIL_OUTLINED}
                variant="outlined"
                value={cardDetail?.dueDate || ''}
                disabled={!menuCanEdit}
                onChange={(e) =>
                  setCardDetail((prev) =>
                    prev ? { ...prev, dueDate: e.target.value } : prev
                  )
                }
                InputLabelProps={{ shrink: true }}
                sx={cardDetailOutlinedWhiteSx}
              />
            </Box>
          </Box>

          <Box
            sx={{
              ...cardDetailFormSectionSx,
              borderRadius: KANBAN_SURFACE_RADIUS,
            }}
          >
            <Typography
              variant="caption"
              sx={{ ...cardDetailFieldLabelSx, mb: 0.5 }}
            >
            {txt('카드 색상', 'Card Color')}
          </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
            <TextField
              type="color"
              hiddenLabel
              variant="outlined"
              size="small"
              value={cardDetail?.color || '#1976D2'}
              disabled={!menuCanEdit}
              onChange={(e) =>
                setCardDetail((prev) => (prev ? { ...prev, color: e.target.value } : prev))
              }
              sx={{
                width: 44,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: KANBAN_CONTROL_RADIUS,
                    bgcolor: '#FFFFFF',
                    p: 0.25,
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E2E8F0' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8' },
                  },
                '& input[type="color"]': {
                    borderRadius: KANBAN_CONTROL_RADIUS,
                  cursor: 'pointer',
                    minHeight: 28,
                  },
              }}
            />
            <Button
              size="small"
                variant={!cardDetail?.color ? 'contained' : 'text'}
              disabled={!menuCanEdit}
              onClick={() =>
                setCardDetail((prev) => (prev ? { ...prev, color: '' } : prev))
              }
                sx={{
                  borderRadius: KANBAN_CONTROL_RADIUS,
                  minWidth: 48,
                  fontWeight: 600,
                  bgcolor: !cardDetail?.color ? 'primary.main' : '#FFFFFF',
                  color: !cardDetail?.color ? '#FFFFFF' : 'primary.main',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: !cardDetail?.color ? 'primary.dark' : '#F8FAFC',
                    boxShadow: 'none',
                  },
                }}
            >
              {txt('기본', 'Default')}
            </Button>
            {CARD_COLOR_PRESETS.map((hex) => (
              <Button
                key={hex}
                size="small"
                  variant="text"
                disabled={!menuCanEdit}
                onClick={() =>
                  setCardDetail((prev) => (prev ? { ...prev, color: hex } : prev))
                }
                sx={{
                    minWidth: 28,
                    width: 28,
                    height: 28,
                    p: 0,
                    borderRadius: KANBAN_CONTROL_RADIUS,
                    border: 'none',
                    bgcolor: cardDetail?.color === hex ? hex : hexToRgba(hex, 0.38),
                    boxShadow: cardDetail?.color === hex ? `0 0 0 2px #FFFFFF, 0 0 0 3px ${hex}` : 'none',
                    '&:hover': { bgcolor: hex, opacity: 0.9, boxShadow: 'none' },
                }}
              />
            ))}
          </Box>
          </Box>

          <Box
            sx={{
              border: 'none',
              borderRadius: KANBAN_SURFACE_RADIUS,
              p: 0,
              minWidth: 0,
              flexShrink: 0,
              overflow: 'hidden',
              bgcolor: 'transparent',
            }}
          >
            <Typography
              variant="caption"
              sx={{ ...cardDetailFieldLabelSx, mb: 0.5, ml: 0.25 }}
            >
            {txt('설명', 'Description')}
          </Typography>
            <RichTextEditor
              readOnly={!menuCanEdit}
              value={cardDetail?.description || ''}
              onChange={(value) =>
                setCardDetail((prev) => (prev ? { ...prev, description: value } : prev))
              }
              minHeight={160}
              placeholder={txt(
                '설명을 입력하세요. 이미지 업로드, 글자 크기/색상 변경이 가능합니다.',
                'Enter description. Image upload and text size/color changes are available.'
              )}
              sx={{ borderRadius: KANBAN_CONTROL_RADIUS, width: '100%' }}
            />
          </Box>

          <Box
            sx={{
              ...cardDetailFormSectionSx,
              py: 0.32,
            }}
          >
            <Typography
              variant="caption"
              sx={{ ...cardDetailFieldLabelSx, mb: 0.5, ml: 0.25 }}
            >
              {txt('첨부파일', 'Attachments')}
            </Typography>
            <Typography variant="caption" display="block" sx={{ mb: 1, color: 'text.secondary' }}>
              {txt(
                `최대 ${WORK_BOARD_CARD_MAX_ATTACHMENTS}개, 파일당 ${WORK_BOARD_CARD_MAX_FILE_BYTES / (1024 * 1024)}MB 이하`,
                `Up to ${WORK_BOARD_CARD_MAX_ATTACHMENTS} files, max ${WORK_BOARD_CARD_MAX_FILE_BYTES / (1024 * 1024)} MB each`
              )}
            </Typography>
            {menuCanEdit ? (
              <>
                <input
                  ref={cardAttachmentInputRef}
                  type="file"
                  hidden
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx,image/*,application/pdf"
                  onChange={(e) => {
                    void handleCardAttachmentInputChange(e);
                  }}
                />
                <Button
                  variant="outlined"
                  color="inherit"
                  size="small"
                  disabled={
                    !cardDetail?.cardId ||
                    cardAttachmentUploading ||
                    cardSaving ||
                    (cardDetail.attachments?.length || 0) >= WORK_BOARD_CARD_MAX_ATTACHMENTS
                  }
                  startIcon={
                    cardAttachmentUploading ? (
                      <CircularProgress size={16} />
                    ) : (
                      <AttachFileIcon sx={{ fontSize: 18 }} />
                    )
                  }
                  onClick={openCardAttachmentPicker}
                  sx={{
                    borderRadius: KANBAN_CONTROL_RADIUS,
                    textTransform: 'none',
                    fontWeight: 600,
                    borderStyle: 'dashed',
                    borderColor: '#CBD5E1',
                  }}
                >
                  {cardAttachmentUploading
                    ? txt('업로드 중…', 'Uploading…')
                    : txt('파일 선택', 'Choose files')}
                </Button>
              </>
            ) : null}
            {attachmentStatusMessage ? (
              <Alert severity={attachmentStatusMessage.severity} sx={{ mt: 1, py: 0.25 }}>
                {attachmentStatusMessage.text}
              </Alert>
            ) : null}
            {(cardDetail?.attachments?.length || 0) > 0 || uploadingAttachmentNames.length > 0 ? (
              <List
                dense
                sx={{
                  mt: 1,
                  border: '1px solid #E2E8F0',
                  borderRadius: KANBAN_CONTROL_RADIUS,
              overflow: 'hidden',
                  bgcolor: '#FFFFFF',
                }}
              >
                {uploadingAttachmentNames.map((fileName) => (
                  <ListItem key={`uploading-${fileName}`}>
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: '#FFF7ED',
                          color: '#C2410C',
                        }}
                      >
                        <CircularProgress size={16} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={fileName}
                      secondary={txt('업로드 중…', 'Uploading…')}
                    />
                  </ListItem>
                ))}
                {(cardDetail?.attachments || []).map((attachment) => (
                  <ListItem
                    key={attachment.storedName}
                    secondaryAction={
                      menuCanEdit ? (
                        <Tooltip title={txt('삭제', 'Remove')}>
                          <span>
                            <IconButton
                              edge="end"
                              size="small"
                              disabled={cardAttachmentDeleting === attachment.storedName}
                              onClick={() => {
                                void handleRemoveCardAttachment(attachment.storedName);
                              }}
                              aria-label={txt('첨부 삭제', 'Remove attachment')}
                            >
                              {cardAttachmentDeleting === attachment.storedName ? (
                                <CircularProgress size={16} />
                              ) : (
                                <DeleteIcon fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : null
                    }
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: '#F1F5F9',
                          color: '#475569',
                        }}
                      >
                        <AttachFileIcon fontSize="small" />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box
                          component="a"
                          href={getBoardCardAttachmentUrl(attachment)}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            color: 'inherit',
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {attachment.originalName}
                        </Box>
                      }
                      secondary={formatAttachmentFileSize(attachment.size) || undefined}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {txt('첨부된 파일이 없습니다.', 'No attachments yet.')}
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              display: 'flex',
                alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {menuCanDelete ? (
                <Button
                  size="small"
                  variant="contained"
                  disableElevation
                  onClick={handleDeleteCard}
                  disabled={cardSaving || !cardDetail?.cardId}
                  sx={{
                    borderRadius: KANBAN_CONTROL_RADIUS,
                    minWidth: 104,
                    height: 40,
                    fontWeight: 700,
                    bgcolor: '#DC2626',
                    color: '#FFFFFF',
                    '&:hover': {
                      bgcolor: '#B91C1C',
                    },
                    '&.Mui-disabled': {
                      bgcolor: alpha('#DC2626', 0.35),
                      color: '#FFFFFF',
                    },
                  }}
                >
                  {txt('카드 삭제', 'Delete Card')}
                </Button>
              ) : null}
              <Tooltip
                title={
                  isCardDetailCompleted && !canReopenCardDetail
                    ? txt(
                        '담당자, 업무를 지시한 사람 또는 root만 재오픈할 수 있습니다.',
                        'Only the assignee, task creator, or root can reopen it.'
                      )
                    : ''
                }
              >
                <span style={{ display: 'inline-flex' }}>
                  <Button
                    size="small"
                    color={isCardDetailCompleted ? 'primary' : 'success'}
                    variant={isCardDetailCompleted ? 'outlined' : 'contained'}
                    disableElevation
                    onClick={() => {
                      if (isCardDetailCompleted) {
                        if (completedCardDetail) {
                          void handleReopenCard(completedCardDetail, true);
                        }
                        return;
                      }
                      handleCompleteTask();
                    }}
                    disabled={
                      isCardDetailCompleted
                        ? !canReopenCardDetail ||
                          !completedCardDetail ||
                          !reopenTargetList?.id ||
                          reopeningCardId === cardDetail?.cardId
                        : !menuCanEdit ||
                          cardSaving ||
                          !cardDetail?.title?.trim() ||
                          !canUserCompleteTask
                    }
                    sx={{
                      borderRadius: KANBAN_CONTROL_RADIUS,
                      minWidth: 120,
                      height: 40,
                      fontWeight: 700,
                      flexShrink: 0,
                      ...(isCardDetailCompleted
                        ? {
                            borderWidth: 1.5,
                            bgcolor: alpha('#1D4E7C', 0.06),
                            '&:hover': {
                              borderWidth: 1.5,
                              bgcolor: alpha('#1D4E7C', 0.12),
                            },
                          }
                        : {
                            bgcolor: 'success.main',
                            color: '#FFFFFF',
                            '&:hover': { bgcolor: 'success.dark' },
                            '&.Mui-disabled': {
                              bgcolor: alpha('#7FA88A', 0.4),
                              color: '#FFFFFF',
                            },
                          }),
                    }}
                  >
                    {reopeningCardId === cardDetail?.cardId
                      ? <CircularProgress size={16} color="inherit" />
                      : isCardDetailCompleted
                        ? txt('재오픈', 'Reopen')
                        : txt('업무 완료', 'Complete Task')}
                  </Button>
                </span>
              </Tooltip>
          </Box>
            <Button
              size="small"
              variant="contained"
              color="primary"
              disableElevation
              onClick={saveCardDetail}
              disabled={!menuCanEdit || cardSaving || !cardDetail?.title?.trim()}
              sx={{
                borderRadius: KANBAN_CONTROL_RADIUS,
                minWidth: 104,
                height: 40,
                fontWeight: 700,
                boxShadow: 'none',
                ml: 'auto',
              }}
            >
              {cardSaving ? <CircularProgress size={18} color="inherit" /> : txt('저장', 'Save')}
            </Button>
          </Box>

          <Box
            sx={{
              ...cardDetailSectionPaperSx,
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              p: 0,
              pt: 0.85,
              pb: 0,
              borderTop: '1px solid #E2E8F0',
              borderRadius: 0,
              bgcolor: 'transparent',
              boxShadow: 'none',
            }}
          >
          <Typography
            variant="caption"
            sx={{
              ...cardDetailFieldLabelSx,
              mb: 0.65,
              fontSize: '0.8125rem',
              color: '#334155',
            }}
          >
            {txt('댓글 및 활동', 'Comments & Activity')}
          </Typography>
          {commentsBlockedUntilSave ? (
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5, py: 0.5 }}>
              {txt(
                '카드 세부 내용을 저장한 후 댓글을 작성할 수 있습니다.',
                'Save the card details before writing comments.'
              )}
            </Typography>
          ) : (
            <>
          {replyParentId != null && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                mb: 0.75,
                py: 0.35,
                px: 0.25,
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                {(() => {
                  const target = cardComments.find((c) => c.id === replyParentId);
                  const name = target?.user?.username || txt('알 수 없는 사용자', 'Unknown user');
                  return txt(`${name}님에게 답글 작성 중`, `Replying to ${name}`);
                })()}
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={() => setReplyParentId(null)}
                sx={{ minWidth: 'auto', py: 0, px: 0.5, fontSize: '0.75rem' }}
              >
                {txt('취소', 'Cancel')}
              </Button>
            </Box>
          )}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'stretch',
              gap: 1,
              mb: 0.5,
            }}
          >
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 0.35,
                px: 1,
                py: 0.35,
                minHeight: 34,
                border: '1px solid #D5DCE3',
                borderRadius: KANBAN_CONTROL_RADIUS,
                bgcolor: '#FFFFFF',
                cursor: isCommentEnabled ? 'text' : 'default',
              }}
              onClick={() => {
                if (isCommentEnabled) commentInputRef.current?.focus();
              }}
            >
              {composerMentionParts.map((part, index) =>
                part.type === 'mention' ? (
                  <MentionUserIdChip
                    key={`composer-mention-${part.id ?? part.userid}-${index}`}
                    name={part.label || part.userid}
                    userId={part.id}
                    title={part.userid ? `${part.label || part.userid} (${part.userid})` : part.label}
                  />
                ) : part.text ? (
                  <Typography
                    key={`composer-text-${index}`}
                    component="span"
                    sx={{
                      fontSize: '0.875rem',
                      color: '#1E293B',
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {part.text}
                  </Typography>
                ) : null
              )}
              <InputBase
              fullWidth
                multiline
                minRows={1}
                maxRows={6}
              inputRef={commentInputRef}
                placeholder={
                  composerMentionParts.length === 0
                    ? txt('댓글을 입력하세요 (Alt+Enter 줄바꿈)', 'Write a comment (Alt+Enter for new line)')
                    : undefined
                }
                value={composerTail}
              disabled={!isCommentEnabled}
                onChange={(e) =>
                  handleCommentInputChange(joinComposerComment(composerMentionParts, e.target.value))
                }
                sx={{
                  flex: 1,
                  minWidth: 96,
                  alignSelf: 'center',
                  fontSize: '0.875rem',
                  color: '#1E293B',
                  lineHeight: 1.45,
                  '& .MuiInputBase-input': {
                    py: 0.5,
                    '&::placeholder': {
                      color: '#94A3B8',
                      opacity: 1,
                    },
                  },
                  '&.Mui-disabled': {
                    WebkitTextFillColor: '#94A3B8',
                  },
              }}
              onKeyDown={(e) => {
                  if (
                    e.key === 'Backspace' &&
                    !composerTail &&
                    composerMentionParts.length > 0 &&
                    !mentionOpen
                  ) {
                    e.preventDefault();
                    const nextParts = [...composerMentionParts];
                    const removed = nextParts.pop();
                    if (removed?.type === 'mention' && removed.id != null) {
                      setMentionedUserIds((prev) => prev.filter((id) => id !== removed.id));
                      handleCommentInputChange(joinComposerComment(nextParts, ''));
                    } else if (removed?.type === 'text') {
                      handleCommentInputChange(joinComposerComment(nextParts, removed.text));
                    }
                    return;
                  }
                if (mentionOpen && mentionCandidates.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setMentionHighlightIndex((prev) => (prev + 1) % mentionCandidates.length);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                      setMentionHighlightIndex(
                        (prev) => (prev - 1 + mentionCandidates.length) % mentionCandidates.length
                      );
                    return;
                  }
                    if (e.key === 'Enter' && !e.altKey && !e.shiftKey) {
                    e.preventDefault();
                    const candidate = mentionCandidates[mentionHighlightIndex] || mentionCandidates[0];
                    if (candidate) {
                      insertMention(candidate);
                    }
                    return;
                  }
                  if (e.key === 'Escape') {
                    setMentionOpen(false);
                    return;
                  }
                }
                  // Alt+Enter / Shift+Enter → 줄바꿈 (기본 동작 유지)
                  if (e.key === 'Enter' && (e.altKey || e.shiftKey)) {
                    return;
                  }
                  if (e.key === 'Enter') {
                  e.preventDefault();
                  void submitComment();
                }
              }}
            />
            </Box>
            <Popper
              open={mentionOpen && mentionCandidates.length > 0}
              anchorEl={commentInputRef.current}
              placement="top-start"
              sx={{
                zIndex: 2000,
                width: Math.max(commentInputRef.current?.clientWidth || 0, 280)
              }}
            >
              <Paper variant="outlined" sx={{ mt: 0.5, maxHeight: 280, overflowY: 'auto' }}>
                {mentionCandidates.map((candidate, index) => (
                  <MenuItem
                    key={candidate.id}
                    selected={index === mentionHighlightIndex}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      insertMention(candidate);
                    }}
                    sx={{ gap: 1, py: 0.75 }}
                  >
                    <MentionUserIdChip
                      name={candidate.label}
                      userId={candidate.id}
                      title={candidate.userid ? `${candidate.label} (${candidate.userid})` : candidate.label}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                        {candidate.label}
                      </Typography>
                      {candidate.userid ? (
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                          {candidate.userid}
                        </Typography>
                      ) : null}
                    </Box>
                  </MenuItem>
                ))}
              </Paper>
            </Popper>
            <Button
              size="small"
              variant="contained"
              onClick={submitComment}
              disabled={!isCommentEnabled || commentSaving || !newComment.trim()}
              sx={{
                minWidth: 72,
                px: 1.25,
                height: 'auto',
                minHeight: 34,
                color: '#FFFFFF',
                '&:hover': {
                  bgcolor: 'primary.dark',
                boxShadow: 'none',
                },
                '&.Mui-disabled': {
                  bgcolor: '#E2E8F0',
                  color: '#64748B',
                },
              }}
            >
              {commentSaving ? <CircularProgress size={18} color="inherit" /> : txt('댓글', 'Comment')}
            </Button>
          </Box>
          {!isCommentEnabled && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {txt('먼저 제목/대분류 등 기본 정보를 입력해 주세요.', 'Please fill in required fields such as title/list first.')}
            </Typography>
          )}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            {commentLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.25 }}>
                <CircularProgress size={20} />
              </Box>
            ) : cardComments.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4, px: 0.25, py: 1 }}>
                {txt('아직 댓글이 없습니다.', 'No comments yet.')}
              </Typography>
            ) : (
              (() => {
                const rootCandidates = cardComments.filter((c) => resolveCommentParentId(c) == null);
                const rootIdSet = new Set(rootCandidates.map((c) => c.id));
                const repliesByParent = new Map<number, BoardCardComment[]>();
                const orphanReplies: BoardCardComment[] = [];
                for (const c of cardComments) {
                  const pid = resolveCommentParentId(c);
                  if (pid == null) continue;
                  if (!rootIdSet.has(pid)) {
                    orphanReplies.push(c);
                    continue;
                  }
                  if (!repliesByParent.has(pid)) repliesByParent.set(pid, []);
                  repliesByParent.get(pid)!.push(c);
                }
                const roots = [...rootCandidates, ...orphanReplies];

                const commentActionBtnSx = {
                  minWidth: 'auto',
                  minHeight: 0,
                  py: 0.1,
                  px: 0.45,
                  fontSize: '0.72rem',
                  lineHeight: 1.3,
                  textTransform: 'none' as const,
                };

                const formatCommentDateTimeParts = (
                  value?: string | null
                ): { date: string; time: string } => {
                  const raw = String(value || '').trim();
                  if (!raw) {
                    return {
                      date: txt('날짜 없음', 'No date'),
                      time: txt('시간 없음', 'No time'),
                    };
                  }
                  const d = new Date(raw);
                  if (Number.isNaN(d.getTime())) {
                    return { date: raw, time: '' };
                  }
                  const locale = language === 'ko' ? 'ko-KR' : 'en-US';
                  return {
                    date: d.toLocaleDateString(locale, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    }),
                    time: d.toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  };
                };

                const renderCommentRow = (comment: BoardCardComment, allowReply: boolean) => {
                const canDelete =
                  menuCanEdit && (isOwner || comment.user_id === user?.id || user?.role === 'root');
                  const { date: commentDate, time: commentTime } = formatCommentDateTimeParts(
                    resolveCommentCreatedAt(comment)
                  );
                  const commentUserId =
                    comment.user?.id != null
                      ? Number(comment.user.id)
                      : comment.user_id != null
                        ? Number(comment.user_id)
                        : 0;
                  const memberAvatar =
                    commentUserId > 0
                      ? members.find((m: any) => Number(m.user_id) === commentUserId)?.user
                          ?.avatar_url
                      : null;
                  const avatarSrc = resolveUserAvatarSrc(
                    comment.user?.avatar_url ?? memberAvatar ?? null
                  );
                  const displayName =
                    comment.user?.username || txt('알 수 없는 사용자', 'Unknown user');
                  const initial = (displayName || '?').trim().charAt(0).toUpperCase() || '?';
                return (
                    <Box sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        display: 'flex',
                          alignItems: 'center',
                        gap: 0.75,
                          minWidth: 0,
                      }}
                    >
                        <Avatar
                          src={avatarSrc}
                          alt={displayName}
                        sx={{
                            width: 22,
                            height: 22,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            bgcolor: avatarSrc
                              ? 'transparent'
                              : commentUserId > 0
                                ? getAvatarColor(commentUserId)
                                : '#64748B',
                            flexShrink: 0,
                          }}
                        >
                          {initial}
                        </Avatar>
                        <Typography
                          variant="caption"
                          component="div"
                          sx={{
                            lineHeight: 1.35,
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            color: '#1565C0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {displayName}
                        </Typography>
                      </Box>
                        <Typography
                          variant="body2"
                        component="div"
                          sx={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          lineHeight: 1.4,
                          mt: 0.25,
                          ml: '30px',
                          fontSize: '0.8125rem',
                          color: '#1E293B',
                        }}
                      >
                        {renderCommentWithMentions(comment.content || '', memberOptions)}
                        </Typography>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          flexWrap: 'wrap',
                          gap: 0.35,
                          mt: 0.25,
                          rowGap: 0.15,
                        }}
                      >
                        {allowReply && isCommentEnabled ? (
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => {
                              setReplyParentId(comment.id);
                              commentInputRef.current?.focus();
                            }}
                            sx={commentActionBtnSx}
                          >
                            {txt('답글', 'Reply')}
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            size="small"
                            color="error"
                            onClick={() => {
                              void removeComment(comment.id);
                            }}
                            disabled={commentDeletingId === comment.id}
                            sx={commentActionBtnSx}
                          >
                            {commentDeletingId === comment.id
                              ? txt('삭제 중...', 'Deleting...')
                              : txt('삭제', 'Delete')}
                          </Button>
                        ) : null}
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          component="span"
                          sx={{
                            lineHeight: 1.35,
                            fontSize: '0.7rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {commentDate}
                        </Typography>
                        {commentTime ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="span"
                            sx={{
                              lineHeight: 1.35,
                              fontSize: '0.7rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {commentTime}
                          </Typography>
                        ) : null}
                      </Box>
                    </Box>
                  );
                };

                return roots.map((comment, threadIndex) => {
                  const replies = repliesByParent.get(comment.id) || [];
                  return (
                    <Box
                      key={comment.id}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.3,
                        pt: threadIndex === 0 ? 0.1 : 0.55,
                        borderTop: threadIndex === 0 ? 'none' : '1px solid #EEF2F6',
                      }}
                    >
                      <Box sx={{ py: 0.3, px: 0.15 }}>{renderCommentRow(comment, true)}</Box>
                      {replies.map((reply) => (
                        <Box
                          key={reply.id}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '16px 1fr',
                            columnGap: 0.4,
                            ml: 1.75,
                            py: 0.25,
                            pl: 0.4,
                            borderLeft: '2px solid #CBD5E1',
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'center',
                              pt: 0.2,
                              color: '#94A3B8',
                              lineHeight: 1,
                            }}
                            aria-hidden
                          >
                            <SubdirectoryArrowRightIcon sx={{ fontSize: 14 }} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>{renderCommentRow(reply, false)}</Box>
                        </Box>
                      ))}
                  </Box>
                );
                });
              })()
            )}
          </Box>
            </>
          )}
          </Box>
        </Box>
      </Paper>
      )}

      <Dialog
        open={addListOpen}
        onClose={() => {
          if (!creatingList) {
            setAddListOpen(false);
            setNewListTitle('');
            setNewListDescription('');
            setNewListAssigneeUserId(null);
          }
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{txt('대분류 추가', 'Add List')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {txt(
              '새 열(대분류) 이름·설명·담당자를 입력하세요. 담당자는 선택 사항입니다.',
              'Enter a name, optional description, and optional list owner for the new list.'
            )}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            hiddenLabel
            size="small"
            value={newListTitle}
            onChange={(e) => setNewListTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !creatingList && newListTitle.trim()) {
                e.preventDefault();
                void createNewList();
              }
            }}
            placeholder={txt('대분류 이름', 'List name')}
            sx={{ mb: 1.25, '& .MuiOutlinedInput-root': { borderRadius: KANBAN_CONTROL_RADIUS } }}
          />
          <TextField
            fullWidth
            hiddenLabel
            size="small"
            value={newListDescription}
            onChange={(e) => setNewListDescription(e.target.value)}
            placeholder={txt('설명 (선택)', 'Description (optional)')}
            sx={{ mb: 1.25, '& .MuiOutlinedInput-root': { borderRadius: KANBAN_CONTROL_RADIUS } }}
          />
          <TextField
            select
            fullWidth
            hiddenLabel
            size="small"
            value={newListAssigneeUserId ?? ''}
            onChange={(e) =>
              setNewListAssigneeUserId(e.target.value === '' ? null : Number(e.target.value))
            }
            SelectProps={{
              displayEmpty: true,
              renderValue: (selected: unknown) => {
                if (selected === '' || selected == null) {
                  return txt('대분류 담당자 (선택)', 'List owner (optional)');
                }
                return resolveMemberDisplayName(selected);
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': { borderRadius: KANBAN_CONTROL_RADIUS },
              '& .MuiSelect-select': {
                color: newListAssigneeUserId == null ? 'text.secondary' : 'text.primary',
              },
            }}
          >
            <MenuItem value="">{txt('미지정', 'Unassigned')}</MenuItem>
            {members.map((m: any) => (
              <MenuItem key={m.user_id} value={Number(m.user_id)}>
                {resolveMemberDisplayName(m.user_id, m)}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              if (!creatingList) {
                setAddListOpen(false);
                setNewListTitle('');
                setNewListDescription('');
                setNewListAssigneeUserId(null);
              }
            }}
            disabled={creatingList}
          >
            {txt('취소', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => void createNewList()}
            disabled={creatingList || !newListTitle.trim()}
          >
            {creatingList ? <CircularProgress size={22} /> : txt('추가', 'Add')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={listSettingsOpen}
        onClose={() => {
          if (!listSettingsSaving) {
            setListSettingsOpen(false);
            setListSettingsId(null);
          }
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{txt('대분류 설정', 'List settings')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {txt(
              '설명과 대분류 담당자를 설정할 수 있습니다. 담당자는 비워둘 수 있습니다.',
              'Set description and optional list owner. Owner can be left empty.'
            )}
          </Typography>
          <TextField
            fullWidth
            hiddenLabel
            size="small"
            value={listSettingsDescription}
            onChange={(e) => setListSettingsDescription(e.target.value)}
            placeholder={txt('설명 (선택)', 'Description (optional)')}
            sx={{ mb: 1.25, '& .MuiOutlinedInput-root': { borderRadius: KANBAN_CONTROL_RADIUS } }}
          />
          <TextField
            select
            fullWidth
            hiddenLabel
            size="small"
            value={listSettingsAssigneeUserId ?? ''}
            onChange={(e) =>
              setListSettingsAssigneeUserId(e.target.value === '' ? null : Number(e.target.value))
            }
            SelectProps={{
              displayEmpty: true,
              renderValue: (selected: unknown) => {
                if (selected === '' || selected == null) {
                  return txt('대분류 담당자 (선택)', 'List owner (optional)');
                }
                return resolveMemberDisplayName(selected);
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': { borderRadius: KANBAN_CONTROL_RADIUS },
              '& .MuiSelect-select': {
                color: listSettingsAssigneeUserId == null ? 'text.secondary' : 'text.primary',
              },
            }}
          >
            <MenuItem value="">{txt('미지정', 'Unassigned')}</MenuItem>
            {members.map((m: any) => (
              <MenuItem key={m.user_id} value={Number(m.user_id)}>
                {resolveMemberDisplayName(m.user_id, m)}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              if (!listSettingsSaving) {
                setListSettingsOpen(false);
                setListSettingsId(null);
              }
            }}
            disabled={listSettingsSaving}
          >
            {txt('취소', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => void saveListSettings()}
            disabled={listSettingsSaving}
          >
            {listSettingsSaving ? <CircularProgress size={22} /> : txt('저장', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={completedTasksOpen}
        onClose={() => !reopeningCardId && setCompletedTasksOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {txt('완료된 업무', 'Completed Tasks')} ({completedCards.length})
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            fullWidth
            size="small"
            value={completedTaskSearch}
            onChange={(event) => {
              setCompletedTaskSearch(event.target.value);
              setCompletedTaskPage(1);
            }}
            placeholder={txt(
              '업무명, 내용, 담당자, 작업 지시자 검색',
              'Search title, details, assignee, or creator'
            )}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                bgcolor: '#FFFFFF',
              },
            }}
          />
          {filteredCompletedCards.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {completedTaskSearch.trim()
                  ? txt('검색 결과가 없습니다.', 'No completed tasks match your search.')
                  : txt('완료된 업무가 없습니다.', 'There are no completed tasks.')}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {paginatedCompletedCards.map((card) => {
                const creator = members.find(
                  (member: any) => Number(member.user_id) === Number(card.created_by)
                );
                const creatorName =
                  creator?.user?.username ||
                  (card.created_by ? `${txt('사용자', 'User')} ${card.created_by}` : '-');
                const reopenAllowed = canReopenCard(card);
                return (
                  <Box
                    key={card.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!completedList) return;
                      setCompletedTasksOpen(false);
                      openCardDetail(card, completedList.title, completedList.id);
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && completedList) {
                        event.preventDefault();
                        setCompletedTasksOpen(false);
                        openCardDetail(card, completedList.title, completedList.id);
                      }
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: '8px',
                      bgcolor: '#FAFBFC',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: '#F4F8FA',
                      },
                      '&:focus-visible': {
                        outline: '2px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <CheckCircleIcon sx={{ color: 'success.main', flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={700} noWrap>
                        {card.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {txt('작업 지시자', 'Created by')}: {creatorName}
                        {card.completed_at
                          ? ` · ${txt('완료', 'Completed')}: ${formatDateTime(card.completed_at)}`
                          : ''}
                      </Typography>
                    </Box>
                    <Tooltip
                      title={
                        reopenAllowed
                          ? txt('업무를 다시 진행 상태로 이동합니다.', 'Move this task back to active work.')
                          : txt(
                              '담당자, 업무를 지시한 사람 또는 root만 재오픈할 수 있습니다.',
                              'Only the assignee, task creator, or root can reopen it.'
                            )
                      }
                    >
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={
                            !reopenAllowed ||
                            !reopenTargetList?.id ||
                            reopeningCardId === card.id
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleReopenCard(card);
                          }}
                          sx={{ minWidth: 88, borderRadius: '10px', fontWeight: 600 }}
                        >
                          {reopeningCardId === card.id
                            ? <CircularProgress size={16} />
                            : txt('재오픈', 'Reopen')}
                        </Button>
                      </span>
                    </Tooltip>
                  </Box>
                );
              })}
              {completedTaskPageCount > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5 }}>
                  <Pagination
                    count={completedTaskPageCount}
                    page={Math.min(completedTaskPage, completedTaskPageCount)}
                    onChange={(_event, page) => setCompletedTaskPage(page)}
                    color="primary"
                    size="small"
                  />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCompletedTasksOpen(false)}
            disabled={reopeningCardId !== null}
          >
            {txt('닫기', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={inviteOpen}
        onClose={() => !inviteLoading && setInviteOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{txt('같은 회사 사용자 초대', 'Invite a user from same company')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="subtitle2" sx={{ display: 'block', mb: 0.75, fontWeight: 600, fontSize: '0.875rem' }}>
            {txt('사용자 검색', 'Search User')}
          </Typography>
          <TextField
            fullWidth
            size="small"
            autoFocus
            value={inviteSearch}
            onChange={(e) => setInviteSearch(e.target.value)}
            placeholder={txt('이름 또는 아이디', 'Name or User ID')}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: '#64748B' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 1.25,
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                bgcolor: '#FFFFFF',
              },
            }}
          />
          {selectedUsers.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.25 }}>
              {selectedUsers.map((u: any) => (
                <Chip
                  key={u.id}
                  size="small"
                  label={`${u.username || u.userid} (${u.userid})`}
                  onDelete={() => toggleInviteUser(u)}
                  sx={{ borderRadius: '6px', fontWeight: 600 }}
                />
              ))}
            </Box>
          ) : null}
          <Paper
            variant="outlined"
            sx={{
              maxHeight: 280,
              overflowY: 'auto',
              borderRadius: '8px',
              borderColor: '#E2E8F0',
            }}
          >
            {filteredInviteUsers.length === 0 ? (
              <Typography
                variant="body2"
                sx={{ px: 2, py: 2, color: '#64748B', textAlign: 'center' }}
              >
                {txt('초대할 사용자가 없습니다.', 'No users available to invite.')}
              </Typography>
            ) : (
              filteredInviteUsers.map((u: any) => {
                const selected = selectedUsers.some((s: any) => Number(s.id) === Number(u.id));
                return (
                  <MenuItem
                    key={u.id}
                    selected={selected}
                    onClick={() => toggleInviteUser(u)}
                    sx={{
                      py: 1.1,
                      px: 1.5,
                      borderBottom: '1px solid #F1F5F9',
                      '&:last-of-type': { borderBottom: 'none' },
                    }}
                  >
                    <ListItemText
                      primary={u.username || u.userid}
                      secondary={u.userid}
                      primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                      secondaryTypographyProps={{ fontSize: '0.75rem' }}
                    />
                    {selected ? (
                      <CheckIcon sx={{ fontSize: 18, color: 'primary.main', ml: 1 }} />
                    ) : null}
                  </MenuItem>
                );
              })
            )}
          </Paper>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {txt(
              '이 보드가 속한 회사의 활성 사용자 중, 아직 멤버가 아닌 사용자만 표시됩니다.',
              'Only active users from this board’s company who are not already members are shown.'
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)} disabled={inviteLoading}>
            {txt('닫기', 'Close')}
          </Button>
          <Button variant="contained" onClick={handleInvite} disabled={inviteLoading || selectedUsers.length === 0}>
            {inviteLoading ? <CircularProgress size={22} /> : txt('초대', 'Invite')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        titleKey={dialogState.titleKey}
        message={dialogState.message}
        messageKey={dialogState.messageKey}
        confirmText={dialogState.confirmText}
        confirmTextKey={dialogState.confirmTextKey}
        cancelText={dialogState.cancelText}
        cancelTextKey={dialogState.cancelTextKey}
        confirmColor={dialogState.confirmColor}
        messageTone={dialogState.messageTone}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Box>
  );
}
