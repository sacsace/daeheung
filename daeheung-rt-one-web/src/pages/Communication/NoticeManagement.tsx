import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Alert,
  Snackbar,
  InputAdornment,
  Divider,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Pagination,
  DialogContentText,
  Tabs,
  Tab,
  CircularProgress,
  Switch,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  LinearProgress
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsBodyCardSx,
  mvsBodyFilterWrapSx,
  mvsBodyListTableSx,
  mvsBodyListZoneSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPaginationSx,
  mvsBodyPrimaryBtnSx,
  mvsFilterFieldHeightSx,
  mvsOutlinedLabelProps,
  mvsPageRootSx,
  mvsSearchFieldSx,
  mvsTableBodyRowSx,
  mvsTableHeadHighlightSx,
  mvsTableScrollSx } from '../../theme/daeheungLayout';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Flag as PriorityIcon,
  Download as DownloadIcon,
  RestartAlt as ResetIcon,
  AttachFile as AttachFileIcon,
  Warning as WarningIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  FormatAlignLeft as FormatAlignLeftIcon,
  FormatAlignCenter as FormatAlignCenterIcon,
  FormatAlignRight as FormatAlignRightIcon,
  Image as ImageIcon,
  FormatColorText as FormatColorTextIcon,
  PushPin as PushPinIcon
} from '@mui/icons-material';
import { useStore } from '../../store';
import {
  noticeService,
  userUiPreferencesService,
  companyCalendarScheduleService,
  type CompanyCalendarScheduleItem,
  type PublicPersonalCalendarScheduleItem
} from '../../services/api';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { getUploadUrl } from '../../utils/uploadUrl';
import { useTranslation } from 'react-i18next';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table as TableExtension } from '@tiptap/extension-table';
import { TableRow as TableRowExtension } from '@tiptap/extension-table-row';
import { TableCell as TableCellExtension } from '@tiptap/extension-table-cell';
import { TableHeader as TableHeaderExtension } from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';

interface NoticePollOption {
  id: number;
  label: string;
  sortOrder: number;
  voteCount: number;
}

interface NoticePoll {
  id: number;
  noticeId: number;
  question: string;
  opensAt: string | null;
  closesAt: string | null;
  isNotYetOpen?: boolean;
  isClosed: boolean;
  canVote?: boolean;
  totalVotes: number;
  hasVoted: boolean;
  myVoteOptionId: number | null;
  options: NoticePollOption[];
}

interface Notice {
  id: number;
  title: string;
  content: string;
  category: 'general' | 'urgent' | 'maintenance' | 'policy' | 'event';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'draft' | 'published' | 'archived';
  isPublic: boolean;
  targetAudience: 'all' | 'employees' | 'managers' | 'specific';
  author: string;
  authorId: number;
  authorAvatarUrl?: string | null;
  createdAt: string;
  publishedAt?: string;
  expiresAt?: string;
  attachments?: string[];
  readCount: number;
  views: number;
  isPinned?: boolean;
  hasPoll?: boolean;
  poll?: NoticePoll | null;
}

interface CalendarScheduleItem {
  id: string;
  title: string;
  type: 'normal' | 'company_holiday';
  isPublic?: boolean;
}

type CalendarDisplayLabel = {
  id: string;
  title: string;
  style: 'company_holiday' | 'company' | 'personal' | 'public_personal';
};

const CompanyHolidayStarIcon: React.FC<{ color: string }> = ({ color }) => (
  <Box
    component="svg"
    viewBox="0 0 24 24"
    sx={{
      width: 14,
      height: 14,
      display: 'inline-block',
      transform: 'rotate(-12deg)'
    }}
  >
    <path
      d="M12 2.8L14.8 9.2L21.6 9.8L16.3 14.3L17.9 21L12 17.3L6.1 21L7.7 14.3L2.4 9.8L9.2 9.2L12 2.8Z"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Box>
);

// 이미지 리사이즈 가능한 확장
const ResizableImage = Image.extend({
  group: 'block',
  inline: false,
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width'),
        renderHTML: attributes => {
          if (!attributes.width) {
            return {};
          }
          return {
            width: attributes.width,
            style: `width: ${attributes.width}px; height: auto; display: block;` };
        } },
      height: {
        default: null,
        parseHTML: element => element.getAttribute('height'),
        renderHTML: attributes => {
          if (!attributes.height) {
            return {};
          }
          return {
            height: attributes.height };
        } } };
  } });

/** 연간 스케줄표 달력 표시 크기 (기준 대비 약 20% 확대) */
const YEARLY_CALENDAR_SCALE = 1.2;
const ycsRem = (rem: number) => `${rem * YEARLY_CALENDAR_SCALE}rem`;
const ycsSp = (u: number) => u * YEARLY_CALENDAR_SCALE;

// HTML 태그 제거 함수
const stripHtmlTags = (html: string): string => {
  if (!html) return '';
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

const NOTICE_MENU_ROUTES = ['/my/notices', '/communication/notice', '/communication/notices'];

const NoticeManagement: React.FC = () => {
  const theme = useTheme();
  const { user } = useStore();
  const { i18n, t } = useTranslation();
  const noticeMenuFlags = useMenuRoutePermissionFlags(NOTICE_MENU_ROUTES);
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();

  /** 메뉴 `수정`(can_edit)이 있을 때만 — 본인 글이어도 등록만 있으면 수정 UI는 숨김(정책). admin/root는 메뉴 수정권한으로 허용 */
  const canUserEditNotice = (n: Notice | null) => {
    if (!n || !user) return false;
    if (!noticeMenuFlags.canEdit) return false;
    if (user.role === 'root' || user.role === 'admin') return true;
    const aid = Number((n as any).authorId ?? (n as any).author_id);
    return Number.isFinite(aid) && Number(user.id) === aid;
  };

  const isNoticeAuthor = (n: Notice | null) => {
    if (!n || !user) return false;
    const aid = Number((n as any).authorId ?? (n as any).author_id);
    return Number.isFinite(aid) && Number(user.id) === aid;
  };

  const isEn = i18n.language === 'en';
  const txt = (ko: string, en: string) => (isEn ? en : ko);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'view' | 'edit'>('list');
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(15);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState<Notice | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState(0); // 0: 공지사항, 1: 연간 스케줄표, 2: 연간 스케줄 관리
  const [currentDate, setCurrentDate] = useState(new Date()); // 달력 현재 날짜
  const [customSchedules, setCustomSchedules] = useState<Record<string, CalendarScheduleItem[]>>({});
  const [companySchedules, setCompanySchedules] = useState<CompanyCalendarScheduleItem[]>([]);
  const [publicPersonalSchedules, setPublicPersonalSchedules] = useState<PublicPersonalCalendarScheduleItem[]>([]);
  const [companySchedulesLoading, setCompanySchedulesLoading] = useState(false);
  const [companyScheduleForm, setCompanyScheduleForm] = useState({
    scheduleDate: '',
    title: '',
    isHoliday: false
  });
  const [editingCompanyScheduleId, setEditingCompanyScheduleId] = useState<number | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<Date | null>(null);
  const [newScheduleTitle, setNewScheduleTitle] = useState('');
  const [scheduleIsPublic, setScheduleIsPublic] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableHasHeader] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    status: 'draft' as 'draft' | 'published' | 'archived',
    isPublic: true,
    targetAudience: 'all' as 'all' | 'employees' | 'managers' | 'specific',
    isPinned: false, // 고정하기
    attachments: [] as string[]
  });
  const [pollForm, setPollForm] = useState({
    enabled: false,
    question: '',
    options: ['', ''] as string[],
    opensAt: '',
    closesAt: '',
  });
  const [selectedPollOptionId, setSelectedPollOptionId] = useState<number | null>(null);
  const [pollVoting, setPollVoting] = useState(false);
  const [addPollOnView, setAddPollOnView] = useState(false);
  const skipSchedulePersistRef = useRef(true);
  const [scheduleStorageReady, setScheduleStorageReady] = useState(false);

  // Tiptap 에디터 설정
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      ResizableImage.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'resizable-image',
          style: 'display: block; margin: 12px auto; max-width: 100%; clear: both;' } }),
      TableExtension.configure({
        resizable: true }),
      TableRowExtension,
      TableHeaderExtension,
      TableCellExtension,
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({
        types: ['heading', 'paragraph', 'image'],
        defaultAlignment: 'left' }),
    ],
    content: formData.content,
    onUpdate: ({ editor }: { editor: any }) => {
      setFormData({ ...formData, content: editor.getHTML() });
    },
    editorProps: {
      handlePaste: (view: any, event: ClipboardEvent) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const result = e.target?.result as string;
                  if (result && editor) {
                    editor.chain()
                      .focus()
                      .setImage({ src: result })
                      .run();
                  }
                };
                reader.readAsDataURL(file);
              }
              return true;
            }
          }
        }
        
        // 엑셀/구글 시트에서 복사한 HTML 테이블 처리
        const htmlData = event.clipboardData?.getData('text/html');
        const textData = event.clipboardData?.getData('text/plain');
        
        if (htmlData && htmlData.includes('<table') && editor) {
          event.preventDefault();
          editor.chain()
            .focus()
            .insertContent(htmlData)
            .run();
          return true;
        } else if (textData && textData.includes('\t') && editor) {
          // 탭으로 구분된 텍스트 (엑셀 복사 시)
          event.preventDefault();
          const lines = textData.split('\n').filter(line => line.trim());
          if (lines.length > 0) {
            const rows = lines.map(line => line.split('\t').map(cell => cell.trim()));
            const maxCols = Math.max(...rows.map(row => row.length), 1);
            
            if (rows.length > 0 && maxCols > 0) {
              let tableHTML = '<table><tbody>';
              rows.forEach((row) => {
                tableHTML += '<tr>';
                for (let i = 0; i < maxCols; i++) {
                  const cellText = row[i] || '';
                  tableHTML += `<td>${cellText}</td>`;
                }
                tableHTML += '</tr>';
              });
              tableHTML += '</tbody></table>';
              
              editor.chain()
                .focus()
                .insertContent(tableHTML)
                .run();
              
              return true;
            }
          }
        }
        
        return false;
      } } });

  // formData.content가 변경되면 에디터 내용 업데이트
  useEffect(() => {
    if (editor && formData.content !== editor.getHTML()) {
      editor.commands.setContent(formData.content || '');
    }
  }, [formData.content, editor]);

  const toDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!user?.id) {
      setScheduleStorageReady(false);
      setCustomSchedules({});
      return;
    }

    let cancelled = false;
    setScheduleStorageReady(false);
    skipSchedulePersistRef.current = true;

    userUiPreferencesService
      .get()
      .then((data) => {
        if (cancelled) return;
        const raw = data.calendarSchedules || {};
        const sanitized: Record<string, CalendarScheduleItem[]> = {};
        Object.entries(raw).forEach(([dateKey, value]) => {
          if (!Array.isArray(value)) return;
          const list: CalendarScheduleItem[] = value
            .filter((item: any) => item && typeof item.title === 'string')
            .map((item: any) => ({
              id: String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
              title: String(item.title).trim(),
              type: (item.type === 'company_holiday' ? 'company_holiday' : 'normal') as 'normal' | 'company_holiday',
              ...(item.isPublic === true || item.is_public === true ? { isPublic: true } : {})
            }))
            .filter((item) => item.title.length > 0);
          if (list.length > 0) sanitized[dateKey] = list;
        });
        setCustomSchedules(sanitized);
        requestAnimationFrame(() => {
          setScheduleStorageReady(true);
          setTimeout(() => {
            skipSchedulePersistRef.current = false;
          }, 400);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setCustomSchedules({});
          requestAnimationFrame(() => {
            setScheduleStorageReady(true);
            setTimeout(() => {
              skipSchedulePersistRef.current = false;
            }, 400);
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !scheduleStorageReady || skipSchedulePersistRef.current) return;
    const t = window.setTimeout(() => {
      userUiPreferencesService.patch({ calendarSchedules: customSchedules }).catch(() => {});
    }, 500);
    return () => window.clearTimeout(t);
  }, [user?.id, customSchedules, scheduleStorageReady]);

  const loadCompanyAndPublicSchedules = useCallback(async () => {
    if (noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead) {
      setCompanySchedules([]);
      setPublicPersonalSchedules([]);
      return;
    }
    setCompanySchedulesLoading(true);
    try {
      const [companyRes, publicRes] = await Promise.all([
        companyCalendarScheduleService.list(),
        companyCalendarScheduleService.listPublicPersonal()
      ]);
      setCompanySchedules(Array.isArray(companyRes?.data) ? companyRes.data : []);
      setPublicPersonalSchedules(Array.isArray(publicRes?.data) ? publicRes.data : []);
    } catch {
      setCompanySchedules([]);
      setPublicPersonalSchedules([]);
    } finally {
      setCompanySchedulesLoading(false);
    }
  }, [noticeMenuFlags.canRead, noticeMenuFlags.menusLoading]);

  useEffect(() => {
    if (noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead) return;
    void loadCompanyAndPublicSchedules();
  }, [loadCompanyAndPublicSchedules, noticeMenuFlags.canRead, noticeMenuFlags.menusLoading]);

  useEffect(() => {
    if ((activeTab === 1 || activeTab === 2) && noticeMenuFlags.canRead && !noticeMenuFlags.menusLoading) {
      void loadCompanyAndPublicSchedules();
    }
  }, [activeTab, loadCompanyAndPublicSchedules, noticeMenuFlags.canRead, noticeMenuFlags.menusLoading]);

  const companySchedulesByDate = useMemo(() => {
    const map: Record<string, CompanyCalendarScheduleItem[]> = {};
    companySchedules.forEach((item) => {
      const key = item.scheduleDate;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [companySchedules]);

  const publicPersonalByDate = useMemo(() => {
    const map: Record<string, PublicPersonalCalendarScheduleItem[]> = {};
    publicPersonalSchedules.forEach((item) => {
      const key = item.scheduleDate;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [publicPersonalSchedules]);

  const getCalendarDisplayLabels = useCallback(
    (dateKey: string): CalendarDisplayLabel[] => {
      const companyItems = companySchedulesByDate[dateKey] || [];
      const personalItems = customSchedules[dateKey] || [];
      const publicItems = publicPersonalByDate[dateKey] || [];
      const labels: CalendarDisplayLabel[] = [
        ...companyItems.map((item) => ({
          id: `co-${item.id}`,
          title: item.title,
          style: (item.isHoliday ? 'company_holiday' : 'company') as CalendarDisplayLabel['style']
        })),
        ...personalItems.map((item) => ({
          id: `me-${item.id}`,
          title: item.title,
          style: (item.type === 'company_holiday' ? 'company_holiday' : 'personal') as CalendarDisplayLabel['style']
        })),
        ...publicItems.map((item) => ({
          id: item.id,
          title: `${item.title} (${item.ownerName})`,
          style: 'public_personal' as const
        }))
      ];
      return labels;
    },
    [companySchedulesByDate, customSchedules, publicPersonalByDate]
  );

  const resetCompanyScheduleForm = () => {
    setCompanyScheduleForm({ scheduleDate: '', title: '', isHoliday: false });
    setEditingCompanyScheduleId(null);
  };

  const handleSaveCompanySchedule = async () => {
    if (!noticeMenuFlags.canRead) return;
    const title = companyScheduleForm.title.trim();
    const scheduleDate = companyScheduleForm.scheduleDate.trim();
    if (!title || !scheduleDate) {
      setError(txt('날짜와 내용을 입력하세요.', 'Please enter date and title.'));
      return;
    }
    try {
      if (editingCompanyScheduleId != null) {
        await companyCalendarScheduleService.update(editingCompanyScheduleId, {
          scheduleDate,
          title,
          isHoliday: companyScheduleForm.isHoliday
        });
        setSuccess(txt('회사 스케줄이 수정되었습니다.', 'Company schedule updated.'));
      } else {
        await companyCalendarScheduleService.create({
          scheduleDate,
          title,
          isHoliday: companyScheduleForm.isHoliday
        });
        setSuccess(txt('회사 스케줄이 등록되었습니다.', 'Company schedule created.'));
      }
      resetCompanyScheduleForm();
      await loadCompanyAndPublicSchedules();
    } catch (err: any) {
      setError(err.response?.data?.message || txt('회사 스케줄 저장에 실패했습니다.', 'Failed to save company schedule.'));
    }
  };

  const handleEditCompanySchedule = (item: CompanyCalendarScheduleItem) => {
    setEditingCompanyScheduleId(item.id);
    setCompanyScheduleForm({
      scheduleDate: item.scheduleDate,
      title: item.title,
      isHoliday: Boolean(item.isHoliday)
    });
  };

  const handleDeleteCompanySchedule = (item: CompanyCalendarScheduleItem) => {
    showConfirm(
      txt('이 회사 스케줄을 삭제하시겠습니까?', 'Delete this company schedule?'),
      async () => {
        try {
          await companyCalendarScheduleService.remove(item.id);
          setSuccess(txt('회사 스케줄이 삭제되었습니다.', 'Company schedule deleted.'));
          if (editingCompanyScheduleId === item.id) resetCompanyScheduleForm();
          await loadCompanyAndPublicSchedules();
        } catch (err: any) {
          setError(err.response?.data?.message || txt('회사 스케줄 삭제에 실패했습니다.', 'Failed to delete company schedule.'));
        }
      },
      {
        title: txt('스케줄 삭제', 'Delete Schedule'),
        confirmColor: 'error',
        confirmText: txt('삭제', 'Delete')
      }
    );
  };

  const openScheduleDialog = (date: Date) => {
    setSelectedScheduleDate(date);
    setNewScheduleTitle('');
    setScheduleIsPublic(false);
    setScheduleDialogOpen(true);
  };

  const closeScheduleDialog = () => {
    setScheduleDialogOpen(false);
    setSelectedScheduleDate(null);
    setNewScheduleTitle('');
    setScheduleIsPublic(false);
  };

  const handleAddSchedule = () => {
    if (!selectedScheduleDate) return;
    const title = newScheduleTitle.trim();
    if (!title) return;

    const dateKey = toDateKey(selectedScheduleDate);
    setCustomSchedules((prev) => {
      const existing = prev[dateKey] || [];
      return {
        ...prev,
        [dateKey]: [
          ...existing,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title,
            type: 'normal',
            ...(scheduleIsPublic ? { isPublic: true } : {})
          }
        ]
      };
    });
    setNewScheduleTitle('');
    setScheduleIsPublic(false);
  };

  const handleDeleteSchedule = (dateKey: string, scheduleId: string) => {
    setCustomSchedules((prev) => {
      const existing = prev[dateKey] || [];
      const updated = existing.filter((item) => item.id !== scheduleId);
      if (updated.length === 0) {
        const { [dateKey]: _deleted, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [dateKey]: updated
      };
    });
  };

  const loadData = useCallback(async () => {
    if (noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead) {
      setNotices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await noticeService.getNotices({
        page,
        limit: itemsPerPage,
        search: searchTerm,
        status: statusFilter
      });
      
      if (response.success && response.data) {
        setNotices(response.data);
        if (response.pagination) {
          setTotalPages(response.pagination.totalPages || 1);
        }
      } else {
        setNotices([]);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || '데이터를 불러오는데 실패했습니다.');
      setNotices([]);
    } finally {
      setLoading(false);
    }
  }, [itemsPerPage, noticeMenuFlags.canRead, noticeMenuFlags.menusLoading, page, searchTerm, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'draft':
        return <Chip label={txt('임시저장', 'Draft')} color="default" size="small" />;
      case 'published':
        return <Chip label={txt('게시됨', 'Published')} color="success" size="small" />;
      case 'archived':
        return <Chip label={txt('보관됨', 'Archived')} color="info" size="small" />;
      default:
        return <Chip label={txt('알 수 없음', 'Unknown')} color="default" size="small" />;
    }
  };

  const getTargetAudienceLabel = (audience: string) => {
    switch (audience) {
      case 'all':
        return txt('전체', 'All');
      case 'employees':
        return txt('직원', 'Employees');
      case 'managers':
        return txt('관리자', 'Managers');
      case 'specific':
        return txt('특정 대상', 'Specific');
      default:
        return txt('알 수 없음', 'Unknown');
    }
  };

  const handleViewNotice = async (notice: Notice) => {
    try {
      // 상세 정보 로드 (조회수 증가를 위해)
      const response = await noticeService.getNotice(notice.id);
      if (response.success) {
        setSelectedNotice(response.data);
        setSelectedPollOptionId(response.data?.poll?.myVoteOptionId ?? null);
        setAddPollOnView(false);
        setPollForm({ enabled: false, question: '', options: ['', ''], opensAt: '', closesAt: '' });
        setViewMode('view');
      } else {
        setError('공지사항을 불러오는데 실패했습니다.');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || '공지사항을 불러오는데 실패했습니다.');
      // 에러가 발생해도 기본 정보로 표시
      setSelectedNotice(notice);
      setViewMode('view');
    }
  };

  const handleEditNotice = (notice: Notice) => {
    if (!canUserEditNotice(notice)) return;
    setSelectedNotice(notice);
    // 에디터 내용 설정을 위해 먼저 formData 설정
    const editFormData = {
      title: notice.title,
      content: notice.content,
      status: 'published' as 'draft' | 'published' | 'archived',
      isPublic: notice.isPublic,
      targetAudience: notice.targetAudience,
      isPinned: (notice as any).isPinned || false, // 고정하기
      attachments: notice.attachments || []
    };
    setFormData(editFormData);
    
    // 에디터가 있으면 내용 설정
    if (editor) {
      editor.commands.setContent(notice.content || '');
    }
    
    // 같은 페이지에서 수정 모드로 전환
    setIsEditing(true);
    setViewMode('edit');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setViewMode('view');
    // 원래 데이터로 복원
    if (selectedNotice) {
      if (editor) {
        editor.commands.setContent(selectedNotice.content || '');
      }
    }
  };

  const handleSaveEdit = async () => {
    try {
      if (!selectedNotice || !canUserEditNotice(selectedNotice)) {
        setError(isEn ? 'You do not have permission to edit notices.' : '공지사항을 수정할 권한이 없습니다.');
        return;
      }
      const contentText = editor ? editor.getText().trim() : formData.content.trim();
      if (!formData.title.trim() || !contentText) {
        setError('제목과 내용은 필수입니다.');
        return;
      }

      if (!selectedNotice) return;

      const noticeData = {
        title: formData.title,
        content: formData.content,
        status: 'published', // 저장 시 자동으로 게시됨
        isPublic: true, // 항상 공개
        targetAudience: formData.targetAudience,
        isPinned: formData.isPinned, // 고정하기
        attachments: formData.attachments
      };

      const response = await noticeService.updateNotice(selectedNotice.id, noticeData);
      if (response.success) {
        setSuccess('공지사항이 수정되었습니다.');
        setIsEditing(false);
        setViewMode('view');
        // 업데이트된 데이터 다시 로드
        const updatedResponse = await noticeService.getNotice(selectedNotice.id);
        if (updatedResponse.success) {
          setSelectedNotice(updatedResponse.data);
        }
        loadData();
      } else {
        setError(response.message || '수정 중 오류가 발생했습니다.');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || '수정 중 오류가 발생했습니다.');
    }
  };

  const handleOpenCreateDialog = () => {
    if (!noticeMenuFlags.canCreate) {
      setError(isEn ? 'You do not have permission to create notices.' : '공지사항을 등록할 권한이 없습니다.');
      return;
    }
    setSelectedNotice(null);
    setFormData({
      title: '',
      content: '',
      status: 'published', // 저장 시 자동으로 게시됨
      isPublic: true,
      targetAudience: 'all',
      isPinned: false, // 고정하기
      attachments: []
    });
    setPollForm({ enabled: false, question: '', options: ['', ''], opensAt: '', closesAt: '' });
    setOpenDialog(true);
  };

  const handleVotePoll = async () => {
    if (!selectedNotice || selectedPollOptionId == null) {
      setError(txt('선택지를 고른 뒤 투표하세요.', 'Select an option before voting.'));
      return;
    }
    try {
      setPollVoting(true);
      const response = await noticeService.votePoll(selectedNotice.id, selectedPollOptionId);
      if (response.success) {
        setSelectedNotice({
          ...selectedNotice,
          hasPoll: true,
          poll: response.data
        });
        setSuccess(txt('투표가 반영되었습니다. 결과는 익명입니다.', 'Your vote was recorded. Results are anonymous.'));
      } else {
        setError(response.message || txt('투표에 실패했습니다.', 'Vote failed.'));
      }
    } catch (error: any) {
      setError(error.response?.data?.message || txt('투표에 실패했습니다.', 'Vote failed.'));
    } finally {
      setPollVoting(false);
    }
  };

  const handleCreatePollOnView = async () => {
    if (!selectedNotice) return;
    if (!isNoticeAuthor(selectedNotice) && user?.role !== 'root' && user?.role !== 'admin') {
      setError(txt('투표를 등록할 권한이 없습니다.', 'You cannot create a poll on this notice.'));
      return;
    }
    const cleaned = pollForm.options.map((o) => o.trim()).filter(Boolean);
    if (!pollForm.question.trim() || cleaned.length < 2) {
      setError(txt('질문과 선택지 2개 이상이 필요합니다.', 'Question and at least 2 options are required.'));
      return;
    }
    try {
      const response = await noticeService.createPoll(selectedNotice.id, {
        question: pollForm.question.trim(),
        options: cleaned,
        opensAt: pollForm.opensAt ? new Date(pollForm.opensAt).toISOString() : null,
        closesAt: pollForm.closesAt ? new Date(pollForm.closesAt).toISOString() : null,
      });
      if (response.success) {
        setSelectedNotice({ ...selectedNotice, hasPoll: true, poll: response.data });
        setAddPollOnView(false);
        setPollForm({ enabled: false, question: '', options: ['', ''], opensAt: '', closesAt: '' });
        setSuccess(txt('투표가 등록되었습니다.', 'Poll created.'));
      } else {
        setError(response.message || txt('투표 등록에 실패했습니다.', 'Failed to create poll.'));
      }
    } catch (error: any) {
      setError(error.response?.data?.message || txt('투표 등록에 실패했습니다.', 'Failed to create poll.'));
    }
  };

  const handleSaveNotice = async () => {
    try {
      const contentText = editor ? editor.getText().trim() : formData.content.trim();
      if (!formData.title.trim() || !contentText) {
        setError('제목과 내용은 필수입니다.');
        return;
      }

      const noticeData: any = {
        title: formData.title,
        content: formData.content,
        status: 'published', // 저장 시 자동으로 게시됨
        isPublic: true, // 항상 공개
        targetAudience: formData.targetAudience,
        isPinned: formData.isPinned, // 고정하기
        attachments: formData.attachments
      };

      if (!selectedNotice && pollForm.enabled) {
        const cleaned = pollForm.options.map((o) => o.trim()).filter(Boolean);
        if (!pollForm.question.trim() || cleaned.length < 2) {
          setError(txt('투표 질문과 선택지 2개 이상이 필요합니다.', 'Poll needs a question and at least 2 options.'));
          return;
        }
        noticeData.poll = {
          enabled: true,
          question: pollForm.question.trim(),
          options: cleaned,
          opensAt: pollForm.opensAt ? new Date(pollForm.opensAt).toISOString() : null,
          closesAt: pollForm.closesAt ? new Date(pollForm.closesAt).toISOString() : null,
        };
      }

      if (selectedNotice) {
        if (!canUserEditNotice(selectedNotice)) {
          setError(isEn ? 'You do not have permission to edit notices.' : '공지사항을 수정할 권한이 없습니다.');
          return;
        }
        // 수정
        const response = await noticeService.updateNotice(selectedNotice.id, noticeData);
        if (response.success) {
          setSuccess('공지사항이 수정되었습니다.');
          setOpenDialog(false);
          setSelectedNotice(null);
          loadData();
        } else {
          setError(response.message || '수정 중 오류가 발생했습니다.');
        }
      } else {
        if (!noticeMenuFlags.canCreate) {
          setError(isEn ? 'You do not have permission to create notices.' : '공지사항을 등록할 권한이 없습니다.');
          return;
        }
        // 생성
        const response = await noticeService.createNotice(noticeData);
        if (response.success) {
          setSuccess('공지사항이 작성되었습니다.');
          setOpenDialog(false);
          setSelectedNotice(null);
          setPollForm({ enabled: false, question: '', options: ['', ''], opensAt: '', closesAt: '' });
          loadData();
        } else {
          setError(response.message || '작성 중 오류가 발생했습니다.');
        }
      }
    } catch (error: any) {
      setError(error.response?.data?.message || '저장 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteNotice = (notice: Notice) => {
    if (!noticeMenuFlags.canDelete) {
      setError(isEn ? 'You do not have permission to delete notices.' : '공지사항을 삭제할 권한이 없습니다.');
      return;
    }
    setNoticeToDelete(notice);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteNotice = async () => {
    if (!noticeToDelete) return;
    if (!noticeMenuFlags.canDelete) {
      setError(isEn ? 'You do not have permission to delete notices.' : '공지사항을 삭제할 권한이 없습니다.');
      return;
    }

    try {
      const response = await noticeService.deleteNotice(noticeToDelete.id);
      if (response.success) {
        setSuccess('공지사항이 성공적으로 삭제되었습니다.');
        setDeleteDialogOpen(false);
        setNoticeToDelete(null);
        loadData();
      } else {
        setError(response.message || '삭제 중 오류가 발생했습니다.');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || '삭제 중 오류가 발생했습니다.');
    }
  };

  const getGoodFriday = (year: number): Date => {
    // Gregorian Easter Sunday 계산(Anonymous Gregorian algorithm)
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    const easterSunday = new Date(year, month - 1, day);
    const goodFriday = new Date(easterSunday);
    goodFriday.setDate(easterSunday.getDate() - 2);
    return goodFriday;
  };

  const getIndianHolidayMap = (year: number): Record<string, string[]> => {
    const holidayMap: Record<string, string[]> = {};
    const addHoliday = (date: Date, name: string) => {
      const key = toDateKey(date);
      holidayMap[key] = [...(holidayMap[key] || []), name];
    };
    const addYearHoliday = (targetYear: number, month: number, day: number, name: string) => {
      if (year === targetYear) {
        addHoliday(new Date(targetYear, month, day), name);
      }
    };

    // 고정 공휴일
    addHoliday(new Date(year, 0, 1), 'New Year');
    addHoliday(new Date(year, 0, 26), 'Republic Day');
    addHoliday(new Date(year, 0, 14), 'Makar Sankranti');
    addHoliday(new Date(year, 4, 1), 'Labour Day');
    addHoliday(new Date(year, 7, 15), 'Independence Day');
    addHoliday(new Date(year, 9, 2), 'Gandhi Jayanti');
    addHoliday(new Date(year, 3, 14), 'Dr. Ambedkar Jayanti');
    addHoliday(new Date(year, 11, 25), 'Christmas');

    // 변동 공휴일
    addHoliday(getGoodFriday(year), 'Good Friday');

    const pongalDates: Record<number, [number, number]> = {
      2024: [0, 15],
      2025: [0, 14],
      2026: [0, 14],
      2027: [0, 15],
      2028: [0, 15]
    };
    const diwaliDates: Record<number, [number, number]> = {
      2024: [9, 31],
      2025: [9, 20],
      2026: [10, 8],
      2027: [9, 29],
      2028: [9, 17]
    };

    if (pongalDates[year]) {
      const [month, day] = pongalDates[year];
      addHoliday(new Date(year, month, day), 'Pongal');
    }

    if (diwaliDates[year]) {
      const [month, day] = diwaliDates[year];
      addHoliday(new Date(year, month, day), 'Diwali');
    }

    // 연도별 주요 인도 축제/명절 (변동일)
    addYearHoliday(2024, 2, 8, 'Maha Shivaratri');
    addYearHoliday(2024, 2, 25, 'Holi');
    addYearHoliday(2024, 3, 11, 'Eid-ul-Fitr');
    addYearHoliday(2024, 3, 17, 'Ram Navami');
    addYearHoliday(2024, 3, 21, 'Mahavir Jayanti');
    addYearHoliday(2024, 4, 23, 'Buddha Purnima');
    addYearHoliday(2024, 5, 17, 'Eid-ul-Adha');
    addYearHoliday(2024, 6, 17, 'Muharram');
    addYearHoliday(2024, 7, 19, 'Raksha Bandhan');
    addYearHoliday(2024, 7, 26, 'Janmashtami');
    addYearHoliday(2024, 8, 7, 'Ganesh Chaturthi');
    addYearHoliday(2024, 8, 15, 'Onam');
    addYearHoliday(2024, 8, 16, 'Milad-un-Nabi');
    addYearHoliday(2024, 9, 12, 'Dussehra');
    addYearHoliday(2024, 10, 7, 'Chhath Puja');
    addYearHoliday(2024, 10, 15, 'Guru Nanak Jayanti');

    addYearHoliday(2025, 1, 26, 'Maha Shivaratri');
    addYearHoliday(2025, 2, 14, 'Holi');
    addYearHoliday(2025, 2, 31, 'Eid-ul-Fitr');
    addYearHoliday(2025, 3, 10, 'Mahavir Jayanti');
    addYearHoliday(2025, 4, 12, 'Buddha Purnima');
    addYearHoliday(2025, 5, 7, 'Eid-ul-Adha');
    addYearHoliday(2025, 6, 6, 'Muharram');
    addYearHoliday(2025, 7, 9, 'Raksha Bandhan');
    addYearHoliday(2025, 7, 16, 'Janmashtami');
    addYearHoliday(2025, 7, 27, 'Ganesh Chaturthi');
    addYearHoliday(2025, 8, 5, 'Onam');
    addYearHoliday(2025, 8, 5, 'Milad-un-Nabi');
    addYearHoliday(2025, 9, 2, 'Dussehra');
    addYearHoliday(2025, 9, 28, 'Chhath Puja');
    addYearHoliday(2025, 10, 5, 'Guru Nanak Jayanti');

    addYearHoliday(2026, 1, 15, 'Maha Shivaratri');
    addYearHoliday(2026, 2, 4, 'Holi');
    addYearHoliday(2026, 2, 21, 'Eid-ul-Fitr');
    addYearHoliday(2026, 2, 26, 'Ram Navami');
    addYearHoliday(2026, 3, 2, 'Mahavir Jayanti');
    addYearHoliday(2026, 4, 1, 'Buddha Purnima');
    addYearHoliday(2026, 4, 27, 'Eid-ul-Adha');
    addYearHoliday(2026, 5, 26, 'Muharram');
    addYearHoliday(2026, 7, 28, 'Raksha Bandhan');
    addYearHoliday(2026, 8, 4, 'Janmashtami');
    addYearHoliday(2026, 8, 14, 'Ganesh Chaturthi');
    addYearHoliday(2026, 7, 26, 'Onam');
    addYearHoliday(2026, 7, 25, 'Milad-un-Nabi');
    addYearHoliday(2026, 9, 20, 'Dussehra');
    addYearHoliday(2026, 10, 17, 'Chhath Puja');
    addYearHoliday(2026, 10, 24, 'Guru Nanak Jayanti');

    addYearHoliday(2027, 2, 24, 'Holi');
    addYearHoliday(2027, 2, 11, 'Eid-ul-Fitr');
    addYearHoliday(2027, 3, 15, 'Ram Navami');
    addYearHoliday(2027, 3, 18, 'Mahavir Jayanti');
    addYearHoliday(2027, 4, 20, 'Buddha Purnima');
    addYearHoliday(2027, 5, 17, 'Eid-ul-Adha');
    addYearHoliday(2027, 6, 16, 'Muharram');
    addYearHoliday(2027, 7, 18, 'Raksha Bandhan');
    addYearHoliday(2027, 7, 25, 'Janmashtami');
    addYearHoliday(2027, 8, 4, 'Ganesh Chaturthi');
    addYearHoliday(2027, 8, 15, 'Onam');
    addYearHoliday(2027, 8, 15, 'Milad-un-Nabi');
    addYearHoliday(2027, 9, 10, 'Dussehra');
    addYearHoliday(2027, 10, 6, 'Chhath Puja');
    addYearHoliday(2027, 10, 14, 'Guru Nanak Jayanti');

    addYearHoliday(2028, 2, 13, 'Holi');
    addYearHoliday(2028, 1, 29, 'Maha Shivaratri');
    addYearHoliday(2028, 2, 1, 'Eid-ul-Fitr');
    addYearHoliday(2028, 3, 3, 'Ram Navami');
    addYearHoliday(2028, 3, 7, 'Mahavir Jayanti');
    addYearHoliday(2028, 4, 9, 'Buddha Purnima');
    addYearHoliday(2028, 4, 6, 'Eid-ul-Adha');
    addYearHoliday(2028, 5, 5, 'Muharram');
    addYearHoliday(2028, 7, 7, 'Raksha Bandhan');
    addYearHoliday(2028, 7, 13, 'Janmashtami');
    addYearHoliday(2028, 7, 23, 'Ganesh Chaturthi');
    addYearHoliday(2028, 8, 2, 'Onam');
    addYearHoliday(2028, 8, 4, 'Milad-un-Nabi');
    addYearHoliday(2028, 8, 29, 'Dussehra');
    addYearHoliday(2028, 9, 26, 'Chhath Puja');
    addYearHoliday(2028, 10, 2, 'Guru Nanak Jayanti');

    return holidayMap;
  };

  const getHolidayNames = (date: Date): string[] => {
    const holidayMap = getIndianHolidayMap(date.getFullYear());
    return holidayMap[toDateKey(date)] || [];
  };

  const getHolidayDisplayName = (name: string): string => {
    const holidayNameMap: Record<string, { ko: string; en: string }> = {
      'New Year': { ko: '신정', en: 'New Year' },
      'Republic Day': { ko: '공화국의 날', en: 'Republic Day' },
      'Makar Sankranti': { ko: '마카르 산크란티', en: 'Makar Sankranti' },
      'Pongal': { ko: '퐁갈', en: 'Pongal' },
      'Labour Day': { ko: '노동절', en: 'Labour Day' },
      'Independence Day': { ko: '독립기념일', en: 'Independence Day' },
      'Gandhi Jayanti': { ko: '간디 탄생일', en: 'Gandhi Jayanti' },
      'Dr. Ambedkar Jayanti': { ko: '암베드카르 탄생일', en: 'Dr. Ambedkar Jayanti' },
      'Christmas': { ko: '크리스마스', en: 'Christmas' },
      'Good Friday': { ko: '성금요일', en: 'Good Friday' },
      'Diwali': { ko: '디왈리', en: 'Diwali' },
      'Maha Shivaratri': { ko: '마하 시바라트리', en: 'Maha Shivaratri' },
      'Holi': { ko: '홀리', en: 'Holi' },
      'Eid-ul-Fitr': { ko: '이드 알피트르', en: 'Eid-ul-Fitr' },
      'Ram Navami': { ko: '라마 나바미', en: 'Ram Navami' },
      'Mahavir Jayanti': { ko: '마하비르 자얀티', en: 'Mahavir Jayanti' },
      'Buddha Purnima': { ko: '부처님 오신 날', en: 'Buddha Purnima' },
      'Eid-ul-Adha': { ko: '이드 알아드하', en: 'Eid-ul-Adha' },
      'Muharram': { ko: '무하람', en: 'Muharram' },
      'Raksha Bandhan': { ko: '락샤 반단', en: 'Raksha Bandhan' },
      'Janmashtami': { ko: '잔마슈타미', en: 'Janmashtami' },
      'Ganesh Chaturthi': { ko: '가네쉬 차투르티', en: 'Ganesh Chaturthi' },
      'Onam': { ko: '오남', en: 'Onam' },
      'Milad-un-Nabi': { ko: '밀라드 운 나비', en: 'Milad-un-Nabi' },
      'Dussehra': { ko: '두세라', en: 'Dussehra' },
      'Chhath Puja': { ko: '차트 푸자', en: 'Chhath Puja' },
      'Guru Nanak Jayanti': { ko: '구루 나낙 탄생일', en: 'Guru Nanak Jayanti' }
    };

    const mapped = holidayNameMap[name];
    if (!mapped) return name;
    return isEn ? mapped.en : `${mapped.ko} (${mapped.en})`;
  };

  const isHoliday = (date: Date): boolean => getHolidayNames(date).length > 0;

  const getComplianceLabels = (date: Date): Array<{ id: string; label: string; color: string }> => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const labels: string[] = [];

    // 월별 신고
    if (day === 7) labels.push('TDS');
    if (day === 11) labels.push('GST-R1');
    if (day === 20) labels.push('GST-3B');
    if (day === 15) labels.push('PF');
    if (day === 15) labels.push('ESI');
    if (day === 20) labels.push('Professional Tax');
    if (day === 7) labels.push('ECB');

    // 분기별 신고
    if ([3, 6, 9, 12].includes(month) && day === 15) labels.push('Advance Tax');
    if ([7, 10, 1, 5].includes(month) && day === 31) labels.push('TDS Return');
    if ([4, 7, 10, 1].includes(month) && day === 13) labels.push('GST-R1 (Quarterly)');
    if ([4, 7, 10, 1].includes(month) && day === 22) labels.push('GST-3B (Quarterly)');
    if ([1, 4, 7, 10].includes(month) && day === 1) labels.push('Board Meeting');

    // 연도별 신고
    if (month === 9 && day === 30) labels.push('DIR-3 KYC');
    if (month === 4 && day === 30) labels.push('Professional Tax Annual Return');
    if (month === 5 && day === 30) labels.push('SFT');
    if (month === 7 && day === 20) labels.push('FLA');
    if (month === 9 && day === 30) labels.push('Audit of Financial Statement');
    if (month === 9 && day === 30) labels.push('ITR');
    if (month === 10 && day === 30) labels.push('ROC AOC-4/MGT-7');
    if (month === 11 && day === 30) labels.push('Transfer Pricing Audit Report');
    if (month === 12 && day === 31) labels.push('GST-9/GST Audit');

    return labels.map((label) => ({
      id: `compliance-${month}-${day}-${label}`,
      label,
      color: 'info.main'
    }));
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 0 || day === 6; // 일요일 또는 토요일
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 해당 월의 첫 번째 날과 마지막 날
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 첫 번째 날의 요일 (0 = 일요일)
    const startDay = firstDay.getDay();
    
    // 달력에 표시할 날짜 배열
    const days: (Date | null)[] = [];
    
    // 이전 달의 마지막 날들 (빈 칸 채우기)
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthLastDay - i));
    }
    
    // 현재 달의 날짜들
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day));
    }
    
    // 다음 달의 첫 날들 (빈 칸 채우기, 총 42개 셀)
    const remainingCells = 42 - days.length;
    for (let day = 1; day <= remainingCells; day++) {
      days.push(new Date(year, month + 1, day));
    }
    
    const weekDays = isEn ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['일', '월', '화', '수', '목', '금', '토'];
    
    const cellBorder = alpha(theme.palette.divider, 0.65);
    const mutedOtherMonth = alpha(theme.palette.grey[500], 0.1);

    return (
      <Box
        sx={{
          width: '100%',
          maxWidth: '100%',
          maxHeight: { xs: 'calc(100vh - 200px)', sm: 'calc(100vh - 220px)' },
          overflowY: 'auto',
          pr: { xs: 0.5, sm: 1 },
          boxSizing: 'border-box' }}
      >
        {/* 요일 헤더 */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 0.75,
            mb: 1.25,
            px: 0.25 }}
        >
          {weekDays.map((day, index) => (
            <Box
              key={day}
              sx={{
                textAlign: 'center',
                py: 1,
                borderRadius: '10px',
                bgcolor: alpha(theme.palette.grey[500], 0.06) }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontSize: ycsRem(0.72),
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  color:
                    index === 0 || index === 6
                      ? alpha(theme.palette.error.main, 0.92)
                      : alpha(theme.palette.text.primary, 0.72) }}
              >
                {day}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* 달력 그리드 */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 0.75,
            px: 0.25 }}
        >
          {days.map((date, index) => {
            if (!date) return null;

            const isCurrentMonth = date.getMonth() === month;
            const isHolidayDate = isHoliday(date);
            const holidayNames = getHolidayNames(date);
            const isTodayDate = isToday(date);
            const isWeekendDate = isWeekend(date);
            const dateKey = toDateKey(date);
            const displayLabels = getCalendarDisplayLabels(dateKey);
            const complianceLabels = getComplianceLabels(date);
            const hasCompanyHoliday =
              displayLabels.some((item) => item.style === 'company_holiday') ||
              (companySchedulesByDate[dateKey] || []).some((item) => item.isHoliday);

            const isWeekendOnly = isWeekendDate && !isHolidayDate;

            const cellBg = isTodayDate
              ? theme.palette.primary.main
              : isHolidayDate
                ? alpha(theme.palette.error.main, 0.1)
                : isWeekendOnly
                  ? alpha(theme.palette.primary.main, 0.07)
                  : !isCurrentMonth
                    ? mutedOtherMonth
                    : theme.palette.background.paper;

            const cellFg = !isCurrentMonth
              ? alpha(theme.palette.text.primary, 0.38)
              : isTodayDate
                ? theme.palette.primary.contrastText
                : isHolidayDate
                  ? alpha(theme.palette.error.main, 0.95)
                  : isWeekendDate
                    ? alpha(theme.palette.error.main, 0.85)
                    : theme.palette.text.primary;

            return (
              <Box key={index} sx={{ minWidth: 0, boxSizing: 'border-box' }}>
                <Box
                  sx={{
                    aspectRatio: '3 / 2',
                    border: `1px solid ${cellBorder}`,
                    borderRadius: '8px',
                    p: ycsSp(0.4),
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    bgcolor: cellBg,
                    color: cellFg,
                    cursor: 'pointer',
                    boxShadow: isTodayDate ? `0 2px 12px ${alpha(theme.palette.primary.main, 0.35)}` : 'none',
                    transition: 'background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      bgcolor: isTodayDate
                        ? theme.palette.primary.dark
                        : isHolidayDate
                          ? alpha(theme.palette.error.main, 0.16)
                          : isWeekendOnly
                            ? alpha(theme.palette.primary.main, 0.12)
                            : alpha(theme.palette.grey[500], 0.08),
                      color: isTodayDate ? theme.palette.primary.contrastText : theme.palette.text.primary,
                      boxShadow: isTodayDate ? `0 4px 16px ${alpha(theme.palette.primary.main, 0.4)}` : undefined } }}
                  onClick={() => openScheduleDialog(date)}
                >
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: ycsSp(0.25) }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: hasCompanyHoliday ? 700 : isTodayDate || isHolidayDate ? 600 : 500,
                        fontSize: ycsRem(0.78),
                        letterSpacing: '-0.02em',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: hasCompanyHoliday ? Math.round(22 * YEARLY_CALENDAR_SCALE) : 'auto',
                        height: hasCompanyHoliday ? Math.round(22 * YEARLY_CALENDAR_SCALE) : 'auto',
                        px: hasCompanyHoliday ? ycsSp(0.4) : 0,
                        borderRadius: hasCompanyHoliday ? '50%' : 0,
                        border: hasCompanyHoliday ? `${Math.round(2 * YEARLY_CALENDAR_SCALE)}px solid` : 'none',
                        borderColor: hasCompanyHoliday ? (isTodayDate ? alpha('#fff', 0.85) : 'warning.dark') : 'transparent',
                        bgcolor: hasCompanyHoliday && !isTodayDate ? alpha(theme.palette.warning.main, 0.95) : 'transparent',
                        color: hasCompanyHoliday && !isTodayDate
                          ? theme.palette.common.white
                          : isTodayDate && !hasCompanyHoliday
                            ? theme.palette.primary.contrastText
                            : undefined,
                        lineHeight: 1 }}
                    >
                      {date.getDate()}
                    </Typography>
                    {hasCompanyHoliday && (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: ycsSp(0.1) }}>
                        <CompanyHolidayStarIcon color={isTodayDate ? '#FFFFFF' : '#FF1744'} />
                        <CompanyHolidayStarIcon color={isTodayDate ? '#FFFFFF' : '#FF1744'} />
                      </Box>
                    )}
                  </Box>
                  {holidayNames.length > 0 && (
                    <Box sx={{ mt: ycsSp(0.15), display: 'flex', flexDirection: 'column', gap: ycsSp(0.1) }}>
                      {holidayNames.slice(0, 2).map((name) => (
                        <Typography
                          key={`${dateKey}-${name}`}
                          variant="caption"
                          sx={{
                            fontSize: ycsRem(0.58),
                            color: isTodayDate ? alpha('#fff', 0.95) : alpha(theme.palette.error.main, 0.92),
                            fontWeight: 600,
                            lineHeight: 1.25,
                            letterSpacing: '0.01em' }}
                        >
                          {getHolidayDisplayName(name)}
                        </Typography>
                      ))}
                      {holidayNames.length > 2 && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: ycsRem(0.56),
                            color: isTodayDate ? alpha('#fff', 0.95) : alpha(theme.palette.error.main, 0.92),
                            fontWeight: 600,
                            lineHeight: 1.25 }}
                        >
                          +{holidayNames.length - 2}
                        </Typography>
                      )}
                    </Box>
                  )}
                  {displayLabels.length > 0 && (
                    <Box sx={{ mt: ycsSp(0.3), display: 'flex', flexDirection: 'column', gap: ycsSp(0.2) }}>
                      {displayLabels.slice(0, 2).map((item) => (
                        <Typography
                          key={`${dateKey}-${item.id}`}
                          variant="caption"
                          sx={{
                            fontSize: item.style === 'company_holiday' ? ycsRem(0.66) : ycsRem(0.6),
                            color: isTodayDate
                              ? 'white'
                              : item.style === 'company_holiday'
                                ? 'common.white'
                                : item.style === 'public_personal'
                                  ? 'secondary.main'
                                  : item.style === 'company'
                                    ? 'info.main'
                                    : 'primary.main',
                            fontWeight: 600,
                            lineHeight: 1.2,
                            letterSpacing: '0.01em',
                            bgcolor:
                              item.style === 'company_holiday'
                                ? isTodayDate
                                  ? alpha('#fff', 0.22)
                                  : alpha(theme.palette.warning.dark, 0.92)
                                : 'transparent',
                            px: item.style === 'company_holiday' ? ycsSp(0.35) : 0,
                            borderRadius: item.style === 'company_holiday' ? '8px' : 0,
                            display: 'inline-flex',
                            alignSelf: 'flex-start'
                          }}
                        >
                          {item.title}
                        </Typography>
                      ))}
                      {displayLabels.length > 2 && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: ycsRem(0.6),
                            color: isTodayDate ? alpha('#fff', 0.95) : alpha(theme.palette.primary.main, 0.9),
                            fontWeight: 600 }}
                        >
                          +{displayLabels.length - 2}
                        </Typography>
                      )}
                    </Box>
                  )}
                  {complianceLabels.length > 0 && (
                    <Box sx={{ mt: ycsSp(0.2), display: 'flex', flexDirection: 'column', gap: ycsSp(0.1) }}>
                      {complianceLabels.slice(0, 2).map((item) => (
                        <Typography
                          key={`${dateKey}-${item.id}`}
                          variant="caption"
                          sx={{
                            fontSize: ycsRem(0.56),
                            color: item.color,
                            fontWeight: 600,
                            lineHeight: 1.2,
                            letterSpacing: '0.01em' }}
                        >
                          {item.label}
                        </Typography>
                      ))}
                      {complianceLabels.length > 2 && (
                        <Typography variant="caption" sx={{ fontSize: ycsRem(0.56), color: 'info.main', fontWeight: 600 }}>
                          +{complianceLabels.length - 2}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  if ((viewMode === 'view' || viewMode === 'edit') && selectedNotice) {
    return (
      <Box sx={{ ...mvsPageRootSx }}>
        <DaeheungPageHeader
          title={txt('공지사항 상세', 'Notice Detail')}
          actions={
            <Button
              variant="outlined"
              onClick={() => {
                setViewMode('list');
                setIsEditing(false);
              }}
            >
              {txt('목록으로', 'Back to List')}
            </Button>
          }
        />

        <Card>
          <CardContent>
            {isEditing ? (
              // 수정 모드
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 500 }}>
                    {txt('제목 *', 'Title *')}
                  </Typography>
                  <TextField
                    fullWidth
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    size="small"
                    placeholder={txt("제목을 입력하세요", "Enter a title")}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1.5,
                        bgcolor: 'background.paper' }
                    }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 500 }}>
                      {txt('대상 *', 'Audience *')}
                    </Typography>
                    <FormControl fullWidth size="small">
                      <Select
                        value={formData.targetAudience}
                        onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value as any })}
                        sx={{
                          borderRadius: 1.5,
                          bgcolor: 'background.paper' }}
                      >
                        <MenuItem value="all">{txt("전체", "All")}</MenuItem>
                        <MenuItem value="employees">{txt("직원", "Employees")}</MenuItem>
                        <MenuItem value="managers">{txt("관리자", "Managers")}</MenuItem>
                        <MenuItem value="specific">{txt("특정 대상", "Specific")}</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', pt: 3 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.isPinned}
                          onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                          color="primary"
                        />
                      }
                      label={txt("고정하기", "Pin to top")}
                    />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 500 }}>
                    {txt('내용 *', 'Content *')}
                  </Typography>
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      overflow: 'hidden',
                      bgcolor: 'background.paper',
                      '& .ProseMirror': {
                        minHeight: '300px',
                        padding: 2,
                        outline: 'none',
                        '& p.is-editor-empty:first-child::before': {
                          content: isEn ? '"Enter content..."' : '"내용을 입력하세요..."',
                          float: 'left',
                          color: '#adb5bd',
                          pointerEvents: 'none',
                          height: 0
                        },
                        '& img': {
                          maxWidth: '100%',
                          height: 'auto',
                          display: 'block',
                          margin: '12px auto',
                          cursor: 'pointer'
                        },
                        '& table': {
                          borderCollapse: 'collapse',
                          width: '100%',
                          margin: '16px 0',
                          '& td, & th': {
                            border: '1px solid #ddd',
                            padding: '8px',
                            textAlign: 'left'
                          },
                          '& th': {
                            backgroundColor: '#f2f2f2',
                            fontWeight: 'bold'
                          }
                        },
                        '& [style*="font-size"]': {
                          // fontSize 스타일 지원
                        },
                        '& span[style*="font-size"]': {
                          // span 태그의 fontSize 스타일 지원
                        },
                        '& p[style*="font-size"]': {
                          // p 태그의 fontSize 스타일 지원
                        }
                      }
                    }}
                  >
                    {/* 툴바 */}
                    {editor && (
                      <Box sx={{
                        borderBottom: '1px solid',
                        borderColor: 'grey.300',
                        bgcolor: 'grey.50',
                        p: 1,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.5
                      }}>
                        <Button
                          size="small"
                          variant={editor.isActive('bold') ? 'contained' : 'text'}
                          onClick={() => editor.chain().focus().toggleBold().run()}
                          sx={{ minWidth: 'auto', px: 1 }}
                        >
                          <strong>B</strong>
                        </Button>
                        <Button
                          size="small"
                          variant={editor.isActive('italic') ? 'contained' : 'text'}
                          onClick={() => editor.chain().focus().toggleItalic().run()}
                          sx={{ minWidth: 'auto', px: 1 }}
                        >
                          <em>I</em>
                        </Button>
                        <Button
                          size="small"
                          variant={editor.isActive('underline') ? 'contained' : 'text'}
                          onClick={() => editor.chain().focus().toggleUnderline().run()}
                          sx={{ minWidth: 'auto', px: 1 }}
                        >
                          <u>U</u>
                        </Button>
                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <Select
                            value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === 'p') {
                                editor.chain().focus().setParagraph().run();
                              } else {
                                editor.chain().focus().toggleHeading({ level: parseInt(value.replace('h', '')) as 1 | 2 | 3 }).run();
                              }
                            }}
                            sx={{ height: 32 }}
                          >
                            <MenuItem value="p">본문</MenuItem>
                            <MenuItem value="h1">제목1</MenuItem>
                            <MenuItem value="h2">제목2</MenuItem>
                            <MenuItem value="h3">제목3</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                          <Select
                            value="14px"
                            onChange={(e) => {
                              const fontSize = e.target.value;
                              // 현재 선택된 텍스트가 있으면 해당 텍스트에 적용, 없으면 다음 입력에 적용
                              editor.chain().focus().setMark('textStyle', { fontSize }).run();
                            }}
                            sx={{ height: 32 }}
                          >
                            <MenuItem value="12px">12px</MenuItem>
                            <MenuItem value="14px">14px</MenuItem>
                            <MenuItem value="16px">16px</MenuItem>
                            <MenuItem value="18px">18px</MenuItem>
                            <MenuItem value="24px">24px</MenuItem>
                          </Select>
                        </FormControl>
                        <Tooltip title="텍스트 색상">
                          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                            <IconButton
                              size="small"
                              sx={{
                                minWidth: 'auto',
                                px: 1,
                                position: 'relative'
                              }}
                            >
                              <FormatColorTextIcon fontSize="small" />
                            </IconButton>
                            <input
                              type="color"
                              value={editor.getAttributes('textStyle').color || '#000000'}
                              onChange={(e) => {
                                editor.chain().focus().setColor(e.target.value).run();
                              }}
                              style={{
                                position: 'absolute',
                                opacity: 0,
                                width: '100%',
                                height: '100%',
                                cursor: 'pointer',
                                top: 0,
                                left: 0
                              }}
                            />
                          </Box>
                        </Tooltip>
                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                        <Tooltip title="왼쪽 정렬">
                          <IconButton
                            size="small"
                            color={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'}
                            onClick={() => editor.chain().focus().setTextAlign('left').run()}
                          >
                            <FormatAlignLeftIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="가운데 정렬">
                          <IconButton
                            size="small"
                            color={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'}
                            onClick={() => editor.chain().focus().setTextAlign('center').run()}
                          >
                            <FormatAlignCenterIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="오른쪽 정렬">
                          <IconButton
                            size="small"
                            color={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'}
                            onClick={() => editor.chain().focus().setTextAlign('right').run()}
                          >
                            <FormatAlignRightIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                        <Tooltip title="이미지 삽입">
                          <IconButton
                            size="small"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.setAttribute('type', 'file');
                              input.setAttribute('accept', 'image/*');
                              input.click();
                              input.onchange = () => {
                                const file = input.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (e) => {
                                    const result = e.target?.result as string;
                                    if (result) {
                                      editor.chain()
                                        .focus()
                                        .setImage({ src: result })
                                        .run();
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              };
                            }}
                          >
                            <ImageIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="표 삽입">
                          <IconButton
                            size="small"
                            onClick={() => setTableDialogOpen(true)}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="파일 첨부">
                          <IconButton
                            size="small"
                            component="label"
                          >
                            <AttachFileIcon fontSize="small" />
                            <input
                              type="file"
                              hidden
                              multiple
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                const fileNames = files.map(f => f.name);
                                setAttachedFiles([...attachedFiles, ...files]);
                                // formData의 attachments에도 파일명 추가
                                setFormData({
                                  ...formData,
                                  attachments: [...formData.attachments, ...fileNames]
                                });
                              }}
                            />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                    {/* 에디터 */}
                    <EditorContent editor={editor} />
                  </Box>
                  {(attachedFiles.length > 0 || formData.attachments.length > 0) && (
                    <Box sx={{ mt: 1 }}>
                      {attachedFiles.map((file, index) => (
                        <Chip
                          key={`file-${index}`}
                          label={file.name}
                          onDelete={() => {
                            const newFiles = attachedFiles.filter((_, i) => i !== index);
                            setAttachedFiles(newFiles);
                            // formData에서도 제거
                            const fileNames = newFiles.map(f => f.name);
                            setFormData({ ...formData, attachments: fileNames });
                          }}
                          sx={{ mr: 1, mb: 1 }}
                          size="small"
                        />
                      ))}
                      {formData.attachments.filter(name => !attachedFiles.some(f => f.name === name)).map((fileName, index) => (
                        <Chip
                          key={`attachment-${index}`}
                          label={fileName}
                          onDelete={() => {
                            setFormData({
                              ...formData,
                              attachments: formData.attachments.filter((_, i) => i !== index)
                            });
                          }}
                          sx={{ mr: 1, mb: 1 }}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            ) : (
              // 보기 모드
              <>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h4" fontWeight="bold" gutterBottom>
                    {stripHtmlTags(selectedNotice.title)}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    {getStatusChip(selectedNotice.status)}
                    {(selectedNotice as any).isPinned && (
                      <Chip label={txt("고정", "Pinned")} color="warning" size="small" icon={<PriorityIcon />} />
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      {txt('대상', 'Audience')}: {getTargetAudienceLabel(selectedNotice.targetAudience)} •
                    </Typography>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                      <Avatar
                        src={getUploadUrl(selectedNotice.authorAvatarUrl) || undefined}
                        alt={selectedNotice.author}
                        sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: '0.75rem' }}
                      >
                        {(selectedNotice.author || '?').charAt(0)}
                      </Avatar>
                      <Typography variant="body2" color="text.secondary">
                        {txt('작성자', 'Author')}: {selectedNotice.author}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      • {txt('작성일', 'Created')}: {selectedNotice.createdAt}
                      {selectedNotice.publishedAt && ` • ${txt('게시일', 'Published')}: ${selectedNotice.publishedAt}`}
                    </Typography>
                  </Box>
                  {isNoticeAuthor(selectedNotice) && !noticeMenuFlags.canEdit && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      {isEn
                        ? 'You wrote this notice, but your account does not have the notice menu “Edit” permission. Enable Edit (or ask an admin) in Menu Permission Management — “Register” alone does not allow editing.'
                        : '본인이 작성한 공지이지만, 메뉴 권한에 공지사항「수정」이 없습니다. 메뉴권한관리에서 해당 사용자에 수정을 허용해 주세요. 「등록」만으로는 수정할 수 없습니다.'}
                    </Alert>
                  )}
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box 
                  sx={{ 
                    mb: 3,
                    '& p': {
                      margin: '0.5em 0',
                      lineHeight: 1.8
                    },
                    '& img': {
                      maxWidth: '100%',
                      height: 'auto',
                      display: 'block',
                      margin: '12px auto'
                    },
                    '& table': {
                      borderCollapse: 'collapse',
                      width: '100%',
                      margin: '16px 0',
                      '& td, & th': {
                        border: '1px solid #ddd',
                        padding: '8px',
                        textAlign: 'left'
                      },
                      '& th': {
                        backgroundColor: '#f2f2f2',
                        fontWeight: 'bold'
                      }
                    },
                    '& h1, & h2, & h3': {
                      margin: '0.8em 0 0.4em 0',
                      fontWeight: 'bold'
                    },
                    '& ul, & ol': {
                      paddingLeft: '1.5em',
                      margin: '0.5em 0'
                    }
                  }}
                  dangerouslySetInnerHTML={{ __html: selectedNotice.content }}
                />
              </>
            )}

            {!isEditing && selectedNotice.poll && (
              <Box
                sx={{
                  mt: 3,
                  mb: 2,
                  border: '1px solid #B4B4B4',
                  borderLeft: '4px solid #F9A825',
                  bgcolor: '#FFFDF5',
                  p: 2
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {txt('투표', 'Poll')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                  {txt('익명 · 1인 1표', 'Anonymous · one vote per user')}
                  {selectedNotice.poll.isNotYetOpen
                    ? ` · ${txt('시작 전', 'Not started')}`
                    : selectedNotice.poll.isClosed
                      ? ` · ${txt('마감', 'Closed')}`
                      : ` · ${txt('진행 중', 'Open')}`}
                  {` · ${txt('총', 'Total')} ${selectedNotice.poll.totalVotes}${txt('표', ' votes')}`}
                </Typography>
                {(selectedNotice.poll.opensAt || selectedNotice.poll.closesAt) && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {txt('투표 기간', 'Voting period')}:{' '}
                    {selectedNotice.poll.opensAt
                      ? new Date(selectedNotice.poll.opensAt).toLocaleString(isEn ? 'en-US' : 'ko-KR')
                      : txt('즉시', 'Immediate')}
                    {' ~ '}
                    {selectedNotice.poll.closesAt
                      ? new Date(selectedNotice.poll.closesAt).toLocaleString(isEn ? 'en-US' : 'ko-KR')
                      : txt('기한 없음', 'No end')}
                  </Typography>
                )}
                <Typography variant="body1" sx={{ mb: 1.5, fontWeight: 500 }}>
                  {selectedNotice.poll.question}
                </Typography>

                {(selectedNotice.poll.canVote ??
                  (!selectedNotice.poll.hasVoted &&
                    !selectedNotice.poll.isClosed &&
                    !selectedNotice.poll.isNotYetOpen)) ? (
                  <Box>
                    <RadioGroup
                      value={selectedPollOptionId ?? ''}
                      onChange={(e) => setSelectedPollOptionId(Number(e.target.value))}
                    >
                      {selectedNotice.poll.options.map((opt) => (
                        <FormControlLabel
                          key={opt.id}
                          value={opt.id}
                          control={<Radio size="small" />}
                          label={opt.label}
                        />
                      ))}
                    </RadioGroup>
                    <Button
                      variant="contained"
                      size="small"
                      disableElevation
                      onClick={handleVotePoll}
                      disabled={pollVoting || selectedPollOptionId == null}
                      sx={{ ...mvsBodyPrimaryBtnSx, mt: 1 }}
                    >
                      {pollVoting ? txt('투표 중…', 'Voting…') : txt('투표하기', 'Vote')}
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {selectedNotice.poll.isNotYetOpen && !selectedNotice.poll.hasVoted ? (
                      <Typography variant="body2" color="text.secondary">
                        {txt(
                          '투표 시작 전에는 투표할 수 없습니다.',
                          'Voting is not available before the start time.'
                        )}
                      </Typography>
                    ) : null}
                    {selectedNotice.poll.isClosed && !selectedNotice.poll.hasVoted ? (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {txt('마감되어 투표할 수 없습니다.', 'This poll is closed.')}
                      </Typography>
                    ) : null}
                    {(selectedNotice.poll.hasVoted || selectedNotice.poll.isClosed) &&
                      selectedNotice.poll.options.map((opt) => {
                      const pct =
                        selectedNotice.poll!.totalVotes > 0
                          ? Math.round((opt.voteCount / selectedNotice.poll!.totalVotes) * 100)
                          : 0;
                      const isMine = selectedNotice.poll!.myVoteOptionId === opt.id;
                      return (
                        <Box key={opt.id}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                            <Typography variant="body2" sx={{ fontWeight: isMine ? 600 : 400 }}>
                              {opt.label}
                              {isMine ? ` (${txt('내 선택', 'Your choice')})` : ''}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {opt.voteCount}
                              {txt('표', '')} ({pct}%)
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{
                              height: 8,
                              borderRadius: 0,
                              bgcolor: '#E8E8E8',
                              '& .MuiLinearProgress-bar': { bgcolor: isMine ? '#4CAF50' : '#9E9E9E' }
                            }}
                          />
                        </Box>
                      );
                    })}
                    {selectedNotice.poll.isNotYetOpen &&
                      !selectedNotice.poll.hasVoted &&
                      selectedNotice.poll.options.map((opt) => (
                        <Typography key={opt.id} variant="body2" sx={{ pl: 0.5 }}>
                          · {opt.label}
                        </Typography>
                      ))}
                  </Box>
                )}
              </Box>
            )}

            {!isEditing &&
              !selectedNotice.poll &&
              (isNoticeAuthor(selectedNotice) || user?.role === 'root' || user?.role === 'admin') &&
              noticeMenuFlags.canCreate && (
                <Box sx={{ mt: 2, mb: 2, border: '1px dashed #B4B4B4', p: 2 }}>
                  {!addPollOnView ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setAddPollOnView(true);
                        setPollForm({
                          enabled: true,
                          question: '',
                          options: ['', ''],
                          opensAt: '',
                          closesAt: '',
                        });
                      }}
                      sx={mvsBodyOutlinedBtnSx}
                    >
                      {txt('투표 추가', 'Add poll')}
                    </Button>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Typography variant="subtitle2">{txt('투표 등록', 'Create poll')}</Typography>
                      <TextField
                        size="small"
                        fullWidth
                        label={txt('질문', 'Question')}
                        value={pollForm.question}
                        onChange={(e) => setPollForm({ ...pollForm, question: e.target.value })}
                      />
                      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        <TextField
                          size="small"
                          type="datetime-local"
                          label={txt('투표 시작', 'Voting starts')}
                          value={pollForm.opensAt}
                          onChange={(e) => setPollForm({ ...pollForm, opensAt: e.target.value })}
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1, minWidth: 220 }}
                        />
                        <TextField
                          size="small"
                          type="datetime-local"
                          label={txt('투표 마감', 'Voting ends')}
                          value={pollForm.closesAt}
                          onChange={(e) => setPollForm({ ...pollForm, closesAt: e.target.value })}
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1, minWidth: 220 }}
                        />
                      </Box>
                      {pollForm.options.map((opt, idx) => (
                        <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
                          <TextField
                            size="small"
                            fullWidth
                            label={`${txt('선택지', 'Option')} ${idx + 1}`}
                            value={opt}
                            onChange={(e) => {
                              const next = [...pollForm.options];
                              next[idx] = e.target.value;
                              setPollForm({ ...pollForm, options: next });
                            }}
                          />
                          {pollForm.options.length > 2 && (
                            <Button
                              size="small"
                              onClick={() =>
                                setPollForm({
                                  ...pollForm,
                                  options: pollForm.options.filter((_, i) => i !== idx)
                                })
                              }
                            >
                              {txt('삭제', 'Remove')}
                            </Button>
                          )}
                        </Box>
                      ))}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          onClick={() =>
                            setPollForm({ ...pollForm, options: [...pollForm.options, ''] })
                          }
                        >
                          {txt('선택지 추가', 'Add option')}
                        </Button>
                        <Button size="small" variant="contained" disableElevation onClick={handleCreatePollOnView}>
                          {txt('등록', 'Create')}
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            setAddPollOnView(false);
                            setPollForm({
                              enabled: false,
                              question: '',
                              options: ['', ''],
                              opensAt: '',
                              closesAt: '',
                            });
                          }}
                        >
                          {txt('취소', 'Cancel')}
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

            {selectedNotice.attachments && selectedNotice.attachments.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>{txt("첨부파일", "Attachments")}</Typography>
                <List>
                  {selectedNotice.attachments.map((attachment, index) => (
                    <ListItem 
                      key={index}
                      sx={{ 
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'action.hover'
                        }
                      }}
                      onClick={() => {
                        // 첨부파일 다운로드 또는 열기
                        // 실제 파일 URL이 있다면 여기서 처리
                                              }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <AttachFileIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText 
                        primary={attachment}
                        secondary={txt("클릭하여 다운로드", "Click to download")}
                      />
                      <IconButton
                        edge="end"
                        onClick={(e) => {
                          e.stopPropagation();
                          // 다운로드 로직
                        }}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
              {!isEditing && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {txt('조회수', 'Views')}: {selectedNotice.views}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {txt('읽음', 'Read')}: {selectedNotice.readCount}
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 1 }}>
                {isEditing ? (
                  <>
                    <Button
                      variant="outlined"
                      onClick={handleCancelEdit}
                    >
                      {txt('취소', 'Cancel')}
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSaveEdit}
                    >
                      {txt('저장', 'Save')}
                    </Button>
                  </>
                ) : (
                  canUserEditNotice(selectedNotice) && (
                    <Button
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() => handleEditNotice(selectedNotice)}
                    >
                      {txt('수정', 'Edit')}
                    </Button>
                  )
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const listStateBoxSx = {
    ...mvsBodyListTableSx,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    py: { xs: 6, sm: 8 },
    px: 3,
    gap: 1.5 } as const;

  const cellEllipsisSx = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 0 } as const;

  const noticeTableSx = {
    width: '100%',
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    bgcolor: 'transparent',
    '& .MuiTableCell-root': {
      borderLeft: 'none',
      borderRight: 'none',
      borderTop: 'none' } } as const;

  const filterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setPage(1);
  };

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={txt('공지사항', 'Notice Board')}
        description={txt('중요한 공지사항과 업무 관련 정보를 확인하는 페이지입니다.', 'This page shows important notices and work-related updates.')}
      />

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            px: { xs: 0.5, sm: 1 },
            minHeight: 48,
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              bgcolor: 'primary.main' },
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              letterSpacing: '0.01em',
              minHeight: 48,
              py: 1.5,
              color: 'text.secondary',
              '&.Mui-selected': {
                color: 'primary.main' } } }}
        >
          <Tab label={txt('공지사항', 'Notices')} disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead} />
          <Tab
            label={txt('연간 스케줄표', 'Yearly Schedule')}
            disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead}
          />
          <Tab
            label={txt('연간 스케줄 관리', 'Yearly Schedule Management')}
            disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead}
          />
        </Tabs>
      </Card>

      {!noticeMenuFlags.menusLoading && !noticeMenuFlags.canRead && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('common.menuNoView')}
        </Alert>
      )}

      {/* 탭별 컨텐츠 */}
      {activeTab === 0 && (
        <>
      {/* 필터 및 검색 */}
      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 0 }}>
        <Box sx={mvsBodyFilterWrapSx}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'minmax(0, 2fr) minmax(0, 1fr) auto auto' },
              gap: 2,
              alignItems: 'flex-end' }}
          >
            <TextField
              fullWidth
              size="small"
              label={txt('검색', 'Search')}
              placeholder={txt('제목, 내용, 작성자 검색', 'Search title, content, author')}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead}
              sx={filterFieldSx}
              {...mvsOutlinedLabelProps}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary', opacity: 0.85, fontSize: '1.125rem' }} />
                  </InputAdornment>
                ) }}
            />
            <FormControl
              fullWidth
              size="small"
              disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead}
              sx={filterFieldSx}
            >
              <InputLabel shrink>{txt('상태', 'Status')}</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(String(e.target.value))}
                label={txt('상태', 'Status')}
              >
                <MenuItem value="">{txt('전체', 'All')}</MenuItem>
                <MenuItem value="published">{txt('게시됨', 'Published')}</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<ResetIcon fontSize="small" />}
              onClick={handleResetFilters}
              disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead}
              sx={{ ...mvsBodyOutlinedBtnSx, height: 40, whiteSpace: 'nowrap' }}
            >
              {t('common.reset')}
            </Button>
            <Tooltip title={t('common.menuNoCreate')} disableHoverListener={noticeMenuFlags.menusLoading || noticeMenuFlags.canCreate}>
              <span style={{ display: 'block' }}>
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<AddIcon fontSize="small" />}
                  onClick={handleOpenCreateDialog}
                  disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canCreate}
                  sx={{ ...mvsBodyPrimaryBtnSx, height: 40, whiteSpace: 'nowrap' }}
                >
                  {txt('새 공지사항', 'New Notice')}
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Card>

          {/* 공지사항 목록 */}
          <Box sx={mvsBodyListZoneSx}>
              {loading ? (
                <Box sx={listStateBoxSx}>
                  <CircularProgress size={36} />
                  <Typography variant="body2" color="text.secondary">
                    {t('common.loading')}
                  </Typography>
                </Box>
              ) : notices.length === 0 ? (
                <Box sx={listStateBoxSx}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}>
                    {txt('공지사항이 없습니다.', 'No notices found.')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                    {searchTerm || statusFilter
                      ? txt('검색 조건에 맞는 공지가 없습니다. 필터를 초기화해 보세요.', 'No notices match your filters. Try resetting.')
                      : txt('새 공지사항을 등록해 보세요.', 'Create a new notice to get started.')}
                  </Typography>
                  {!searchTerm && !statusFilter && (
                    <Button
                      variant="contained"
                      disableElevation
                      startIcon={<AddIcon fontSize="small" />}
                      onClick={handleOpenCreateDialog}
                      disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canCreate}
                      sx={mvsBodyPrimaryBtnSx}
                    >
                      {txt('새 공지사항', 'New Notice')}
                    </Button>
                  )}
                </Box>
              ) : (
                <>
                <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
                  <Table size="small" sx={noticeTableSx}>
                    <TableHead sx={mvsTableHeadHighlightSx}>
                      <TableRow>
                        <TableCell width="42%">{txt('제목', 'Title')}</TableCell>
                        <TableCell width="22%">{txt('작성자', 'Author')}</TableCell>
                        <TableCell width="16%">{txt('발행일', 'Published Date')}</TableCell>
                        <TableCell width="10%">{txt('조회수', 'Views')}</TableCell>
                        <TableCell width="10%" align="right">{txt('작업', 'Action')}</TableCell>
                      </TableRow>
                    </TableHead>
            <TableBody sx={mvsTableBodyRowSx}>
              {[...notices].sort((a, b) => {
                const aPinned = (a as any).isPinned ? 1 : 0;
                const bPinned = (b as any).isPinned ? 1 : 0;
                return bPinned - aPinned;
              }).map((notice) => (
                <TableRow 
                  key={notice.id} 
                  hover
                  onClick={() => handleViewNotice(notice)}
                  sx={{
                    cursor: 'pointer',
                    ...(notice.hasPoll || (notice as any).hasPoll
                      ? {
                          bgcolor: '#FFF8E1',
                          borderLeft: '3px solid #F9A825',
                          '&:hover': { bgcolor: '#FFF3C4' },
                        }
                      : {}),
                  }}
                >
                  <TableCell sx={cellEllipsisSx}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        {(notice as any).isPinned && (
                          <Chip 
                            label={txt('고정', 'Pinned')} 
                            color="warning" 
                            size="small" 
                            icon={<PushPinIcon sx={{ fontSize: '0.875rem' }} />}
                            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, flexShrink: 0 }}
                          />
                        )}
                        {notice.priority === 'urgent' && (
                          <WarningIcon sx={{ fontSize: 18, color: 'error.main', flexShrink: 0 }} />
                        )}
                        <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ minWidth: 0 }}>
                          {stripHtmlTags(notice.title)}
                        </Typography>
                        {(notice.hasPoll || (notice as any).hasPoll) && (
                          <Chip
                            size="small"
                            label={txt('투표', 'Poll')}
                            sx={{
                              flexShrink: 0,
                              height: 20,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              borderRadius: 0,
                              bgcolor: '#F9A825',
                              color: '#212121',
                            }}
                          />
                        )}
                        {notice.attachments && notice.attachments.length > 0 && (
                          <Tooltip title={txt(`첨부파일 ${notice.attachments.length}개`, `${notice.attachments.length} attachment(s)`)}>
                            <AttachFileIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                          </Tooltip>
                        )}
                    </Box>
                  </TableCell>
                  <TableCell sx={cellEllipsisSx}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Avatar
                        src={getUploadUrl(notice.authorAvatarUrl) || undefined}
                        alt={notice.author}
                        sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem', flexShrink: 0 }}
                      >
                        {(notice.author || '?').charAt(0)}
                      </Avatar>
                      <Typography variant="body2" noWrap>{notice.author}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={cellEllipsisSx}>
                    <Typography variant="body2" noWrap>
                      {notice.publishedAt
                        ? new Date(notice.publishedAt).toLocaleDateString(
                            isEn ? 'en-US' : 'ko-KR',
                            { year: 'numeric', month: '2-digit', day: '2-digit' }
                          )
                        : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={cellEllipsisSx}>
                    <Typography variant="body2" noWrap>
                      {isEn ? `${notice.views}` : `${notice.views}회`}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Tooltip title={noticeMenuFlags.menusLoading || !noticeMenuFlags.canDelete ? t('common.menuNoDelete') : txt('삭제', 'Delete')}>
                        <span style={{ display: 'inline-flex' }}>
                          <IconButton
                            size="small"
                            disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canDelete}
                            onClick={() => handleDeleteNotice(notice)}
                            sx={{
                              color: alpha(theme.palette.text.secondary, theme.palette.mode === 'light' ? 0.72 : 1),
                              borderRadius: '10px',
                              transition: 'color 0.15s ease, background-color 0.15s ease',
                              '&:hover': {
                                color: 'error.main',
                                bgcolor: alpha(theme.palette.error.main, 0.12) } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
                    </TableBody>
                  </Table>
                </TableContainer>

              <Box sx={mvsBodyPaginationSx}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(_, value) => setPage(value)}
                    color="primary"
                    shape="rounded"
                    sx={{ '& .MuiPaginationItem-root': { borderRadius: '10px', fontWeight: 600 } }}
                  />
              </Box>
                </>
              )}
          </Box>
        </>
      )}

      {/* 연간 스케줄표 탭 */}
      {activeTab === 1 && (
        <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
          <CardContent sx={{ py: 2, px: { xs: 2, sm: 2.5 }, '&:last-child': { pb: 2 } }}>
            <Box
              sx={{
                mb: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1.5 }}
            >
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, fontSize: '1.0625rem', letterSpacing: '-0.015em', color: 'text.primary' }}
              >
                {txt('연간 스케줄표', 'Yearly Schedule')}
              </Typography>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  flexWrap: 'wrap',
                  px: 1,
                  py: 0.5,
                  borderRadius: '8px',
                  bgcolor: alpha(theme.palette.grey[500], 0.08),
                  border: `1px solid ${alpha(theme.palette.divider, 0.65)}` }}
              >
                <IconButton
                  onClick={() => {
                    const prevMonth = new Date(currentDate);
                    prevMonth.setMonth(prevMonth.getMonth() - 1);
                    setCurrentDate(prevMonth);
                  }}
                  size="small"
                  aria-label="previous month"
                  sx={{ borderRadius: '10px' }}
                >
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
                <Typography
                  variant="subtitle2"
                  sx={{
                    minWidth: 148,
                    textAlign: 'center',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    letterSpacing: '0.01em',
                    color: 'text.primary' }}
                >
                  {isEn
                    ? `${currentDate.toLocaleString('en-US', { month: 'long' })} ${currentDate.getFullYear()}`
                    : `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`}
                </Typography>
                <IconButton
                  onClick={() => {
                    const nextMonth = new Date(currentDate);
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    setCurrentDate(nextMonth);
                  }}
                  size="small"
                  aria-label="next month"
                  sx={{ borderRadius: '10px' }}
                >
                  <ChevronRightIcon fontSize="small" />
                </IconButton>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setCurrentDate(new Date())}
                  sx={{
                    ml: 0.5,
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    px: 1.5,
                    py: 0.5,
                    borderColor: alpha(theme.palette.divider, 0.95) }}
                >
                  {txt('오늘', 'Today')}
                </Button>
              </Box>
            </Box>
            {renderCalendar()}
          </CardContent>
        </Card>
      )}

      {/* 연간 스케줄 관리 탭 */}
      {activeTab === 2 && (
        <Box sx={mvsBodyListZoneSx}>
          <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
            <CardContent sx={{ py: 2, px: { xs: 2, sm: 2.5 }, '&:last-child': { pb: 2 } }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 600, fontSize: '1.0625rem', letterSpacing: '-0.015em', color: 'text.primary', mb: 2 }}
              >
                {editingCompanyScheduleId != null
                  ? txt('회사 스케줄 수정', 'Edit Company Schedule')
                  : txt('회사 스케줄 등록', 'Add Company Schedule')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '160px minmax(0, 1fr) auto auto' },
                  gap: 1.5,
                  alignItems: 'center',
                  mb: 2
                }}
              >
                <TextField
                  type="date"
                  size="small"
                  label={txt('날짜', 'Date')}
                  value={companyScheduleForm.scheduleDate}
                  onChange={(e) => setCompanyScheduleForm((prev) => ({ ...prev, scheduleDate: e.target.value }))}
                  disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead}
                  sx={filterFieldSx}
                  {...mvsOutlinedLabelProps}
                  InputLabelProps={{
                    ...mvsOutlinedLabelProps.InputLabelProps,
                    shrink: true,
                  }}
                />
                <TextField
                  size="small"
                  label={txt('내용', 'Title / Content')}
                  value={companyScheduleForm.title}
                  onChange={(e) => setCompanyScheduleForm((prev) => ({ ...prev, title: e.target.value }))}
                  disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead}
                  sx={filterFieldSx}
                  {...mvsOutlinedLabelProps}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={companyScheduleForm.isHoliday}
                      onChange={(e) => setCompanyScheduleForm((prev) => ({ ...prev, isHoliday: e.target.checked }))}
                      color="warning"
                      disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead}
                    />
                  }
                  label={txt('휴일', 'Holiday')}
                />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    disableElevation
                    onClick={() => void handleSaveCompanySchedule()}
                    disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead}
                    sx={{ ...mvsBodyPrimaryBtnSx, height: 40, whiteSpace: 'nowrap' }}
                  >
                    {editingCompanyScheduleId != null ? txt('수정', 'Update') : txt('등록', 'Add')}
                  </Button>
                  {editingCompanyScheduleId != null && (
                    <Button
                      variant="outlined"
                      onClick={resetCompanyScheduleForm}
                      sx={{ ...mvsBodyOutlinedBtnSx, height: 40 }}
                    >
                      {txt('취소', 'Cancel')}
                    </Button>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>

          {companySchedulesLoading ? (
            <Box sx={listStateBoxSx}>
              <CircularProgress size={36} />
              <Typography variant="body2" color="text.secondary">
                {t('common.loading')}
              </Typography>
            </Box>
          ) : companySchedules.length === 0 ? (
            <Box sx={listStateBoxSx}>
              <Typography variant="body2" color="text.secondary">
                {txt('등록된 회사 스케줄이 없습니다.', 'No company schedules found.')}
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
              <Table size="small" sx={noticeTableSx}>
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell width="18%">{txt('날짜', 'Date')}</TableCell>
                    <TableCell width="52%">{txt('내용', 'Title / Content')}</TableCell>
                    <TableCell width="12%">{txt('휴일', 'Holiday')}</TableCell>
                    <TableCell width="18%" align="right">{txt('작업', 'Actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={mvsTableBodyRowSx}>
                  {[...companySchedules]
                    .sort((a, b) =>
                      a.scheduleDate === b.scheduleDate
                        ? a.title.localeCompare(b.title)
                        : a.scheduleDate.localeCompare(b.scheduleDate)
                    )
                    .map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell sx={cellEllipsisSx}>{item.scheduleDate}</TableCell>
                        <TableCell sx={cellEllipsisSx}>{item.title}</TableCell>
                        <TableCell sx={cellEllipsisSx}>
                          {item.isHoliday ? txt('예', 'Yes') : txt('아니오', 'No')}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            aria-label={txt('수정', 'Edit')}
                            onClick={() => handleEditCompanySchedule(item)}
                            disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={txt('삭제', 'Delete')}
                            onClick={() => handleDeleteCompanySchedule(item)}
                            disabled={noticeMenuFlags.menusLoading || !noticeMenuFlags.canRead}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* 공지사항 작성/수정 다이얼로그 */}
      <Dialog 
        open={openDialog} 
        onClose={() => {
          setOpenDialog(false);
          setSelectedNotice(null);
        }} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ pb: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6" fontWeight={600}>
            {selectedNotice ? txt('공지사항 수정', 'Edit Notice') : txt('공지사항 작성', 'New Notice')}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 500 }}>
                {txt('제목 *', 'Title *')}
              </Typography>
              <TextField
                fullWidth
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                size="small"
                placeholder={txt("제목을 입력하세요", "Enter a title")}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1.5,
                    bgcolor: 'background.paper' }
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 500 }}>
                  {txt('대상 *', 'Audience *')}
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value as any })}
                    sx={{
                      borderRadius: 1.5,
                      bgcolor: 'background.paper' }}
                  >
                    <MenuItem value="all">{txt("전체", "All")}</MenuItem>
                    <MenuItem value="employees">{txt("직원", "Employees")}</MenuItem>
                    <MenuItem value="managers">{txt("관리자", "Managers")}</MenuItem>
                    <MenuItem value="specific">{txt("특정 대상", "Specific")}</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', pt: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isPinned}
                      onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                      color="primary"
                    />
                  }
                  label={txt("고정하기", "Pin to top")}
                />
              </Box>
            </Box>

            {!selectedNotice && (
              <Box sx={{ border: '1px solid #B4B4B4', p: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={pollForm.enabled}
                      onChange={(e) =>
                        setPollForm({
                          ...pollForm,
                          enabled: e.target.checked,
                          options: pollForm.options.length >= 2 ? pollForm.options : ['', '']
                        })
                      }
                      size="small"
                    />
                  }
                  label={txt('투표 포함 (익명 · 1인 1표)', 'Include poll (anonymous · 1 vote per user)')}
                />
                {pollForm.enabled && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
                      label={txt('투표 질문', 'Poll question')}
                      value={pollForm.question}
                      onChange={(e) => setPollForm({ ...pollForm, question: e.target.value })}
                    />
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                      <TextField
                        size="small"
                        type="datetime-local"
                        label={txt('투표 시작', 'Voting starts')}
                        value={pollForm.opensAt}
                        onChange={(e) => setPollForm({ ...pollForm, opensAt: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1, minWidth: 220 }}
                        helperText={txt('비우면 즉시 시작', 'Empty = start immediately')}
                      />
                      <TextField
                        size="small"
                        type="datetime-local"
                        label={txt('투표 마감', 'Voting ends')}
                        value={pollForm.closesAt}
                        onChange={(e) => setPollForm({ ...pollForm, closesAt: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1, minWidth: 220 }}
                        helperText={txt('비우면 기한 없음', 'Empty = no deadline')}
                      />
                    </Box>
                    {pollForm.options.map((opt, idx) => (
                      <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          size="small"
                          fullWidth
                          label={`${txt('선택지', 'Option')} ${idx + 1}`}
                          value={opt}
                          onChange={(e) => {
                            const next = [...pollForm.options];
                            next[idx] = e.target.value;
                            setPollForm({ ...pollForm, options: next });
                          }}
                        />
                        {pollForm.options.length > 2 && (
                          <Button
                            size="small"
                            onClick={() =>
                              setPollForm({
                                ...pollForm,
                                options: pollForm.options.filter((_, i) => i !== idx)
                              })
                            }
                          >
                            {txt('삭제', 'Remove')}
                          </Button>
                        )}
                      </Box>
                    ))}
                    <Button
                      size="small"
                      onClick={() => setPollForm({ ...pollForm, options: [...pollForm.options, ''] })}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      {txt('선택지 추가', 'Add option')}
                    </Button>
                  </Box>
                )}
              </Box>
            )}

            <Box>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 500 }}>
                {txt('내용 *', 'Content *')}
              </Typography>
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                  bgcolor: 'background.paper',
                  '& .ProseMirror': {
                    minHeight: '300px',
                    padding: 2,
                    outline: 'none',
                    '& p.is-editor-empty:first-child::before': {
                      content: isEn ? '"Enter content..."' : '"내용을 입력하세요..."',
                      float: 'left',
                      color: '#adb5bd',
                      pointerEvents: 'none',
                      height: 0
                    },
                    '& img': {
                      maxWidth: '100%',
                      height: 'auto',
                      display: 'block',
                      margin: '12px auto',
                      cursor: 'pointer'
                    },
                    '& table': {
                      borderCollapse: 'collapse',
                      width: '100%',
                      margin: '16px 0',
                      '& td, & th': {
                        border: '1px solid #ddd',
                        padding: '8px',
                        textAlign: 'left'
                      },
                      '& th': {
                        backgroundColor: '#f2f2f2',
                        fontWeight: 'bold'
                      }
                    },
                    '& [style*="font-size"]': {
                      // fontSize 스타일 지원
                    },
                    '& span[style*="font-size"]': {
                      // span 태그의 fontSize 스타일 지원
                    },
                    '& p[style*="font-size"]': {
                      // p 태그의 fontSize 스타일 지원
                    }
                  }
                }}
              >
                {/* 툴바 */}
                {editor && (
                  <Box sx={{
                    borderBottom: '1px solid',
                    borderColor: 'grey.300',
                    bgcolor: 'grey.50',
                    p: 1,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5
                  }}>
                    <Button
                      size="small"
                      variant={editor.isActive('bold') ? 'contained' : 'text'}
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      sx={{ minWidth: 'auto', px: 1 }}
                    >
                      <strong>B</strong>
                    </Button>
                    <Button
                      size="small"
                      variant={editor.isActive('italic') ? 'contained' : 'text'}
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      sx={{ minWidth: 'auto', px: 1 }}
                    >
                      <em>I</em>
                    </Button>
                    <Button
                      size="small"
                      variant={editor.isActive('underline') ? 'contained' : 'text'}
                      onClick={() => editor.chain().focus().toggleUnderline().run()}
                      sx={{ minWidth: 'auto', px: 1 }}
                    >
                      <u>U</u>
                    </Button>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <FormControl size="small" sx={{ minWidth: 100 }}>
                      <Select
                        value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === 'p') {
                            editor.chain().focus().setParagraph().run();
                          } else {
                            editor.chain().focus().toggleHeading({ level: parseInt(value.replace('h', '')) as 1 | 2 | 3 }).run();
                          }
                        }}
                        sx={{ height: 32 }}
                      >
                        <MenuItem value="p">본문</MenuItem>
                        <MenuItem value="h1">제목1</MenuItem>
                        <MenuItem value="h2">제목2</MenuItem>
                        <MenuItem value="h3">제목3</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value="14px"
                        onChange={(e) => {
                          const fontSize = e.target.value;
                          // 현재 선택된 텍스트가 있으면 해당 텍스트에 적용, 없으면 다음 입력에 적용
                          editor.chain().focus().setMark('textStyle', { fontSize }).run();
                        }}
                        sx={{ height: 32 }}
                      >
                        <MenuItem value="12px">12px</MenuItem>
                        <MenuItem value="14px">14px</MenuItem>
                        <MenuItem value="16px">16px</MenuItem>
                        <MenuItem value="18px">18px</MenuItem>
                        <MenuItem value="24px">24px</MenuItem>
                      </Select>
                    </FormControl>
                    <Tooltip title="텍스트 색상">
                      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                        <IconButton
                          size="small"
                          sx={{
                            minWidth: 'auto',
                            px: 1,
                            position: 'relative'
                          }}
                        >
                          <FormatColorTextIcon fontSize="small" />
                        </IconButton>
                        <input
                          type="color"
                          value={editor.getAttributes('textStyle').color || '#000000'}
                          onChange={(e) => {
                            editor.chain().focus().setColor(e.target.value).run();
                          }}
                          style={{
                            position: 'absolute',
                            opacity: 0,
                            width: '100%',
                            height: '100%',
                            cursor: 'pointer',
                            top: 0,
                            left: 0
                          }}
                        />
                      </Box>
                    </Tooltip>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <Tooltip title="왼쪽 정렬">
                      <IconButton
                        size="small"
                        color={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'}
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                      >
                        <FormatAlignLeftIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="가운데 정렬">
                      <IconButton
                        size="small"
                        color={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'}
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                      >
                        <FormatAlignCenterIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="오른쪽 정렬">
                      <IconButton
                        size="small"
                        color={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'}
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                      >
                        <FormatAlignRightIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <Tooltip title="이미지 삽입">
                      <IconButton
                        size="small"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.setAttribute('type', 'file');
                          input.setAttribute('accept', 'image/*');
                          input.click();
                          input.onchange = () => {
                            const file = input.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                const result = e.target?.result as string;
                                if (result) {
                                  editor.chain()
                                    .focus()
                                    .setImage({ src: result })
                                    .run();
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          };
                        }}
                      >
                        <ImageIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="표 삽입">
                      <IconButton
                        size="small"
                        onClick={() => setTableDialogOpen(true)}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="파일 첨부">
                      <IconButton
                        size="small"
                        component="label"
                      >
                        <AttachFileIcon fontSize="small" />
                        <input
                          type="file"
                          hidden
                          multiple
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setAttachedFiles([...attachedFiles, ...files]);
                          }}
                        />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
                {/* 에디터 */}
                <EditorContent editor={editor} />
              </Box>
              {attachedFiles.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  {attachedFiles.map((file, index) => (
                    <Chip
                      key={index}
                      label={file.name}
                      onDelete={() => {
                        setAttachedFiles(attachedFiles.filter((_, i) => i !== index));
                      }}
                      sx={{ mr: 1, mb: 1 }}
                      size="small"
                    />
                  ))}
                </Box>
              )}
            </Box>
            
            {/* 표 생성 다이얼로그 */}
            <Dialog 
              open={tableDialogOpen} 
              onClose={() => setTableDialogOpen(false)}
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle>표 만들기</DialogTitle>
              <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                  <TextField
                    label="행 수"
                    type="number"
                    value={tableRows}
                    onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                    inputProps={{ min: 1, max: 20 }}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="열 수"
                    type="number"
                    value={tableCols}
                    onChange={(e) => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                    inputProps={{ min: 1, max: 20 }}
                    fullWidth
                    size="small"
                  />
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setTableDialogOpen(false)}>{txt('취소', 'Cancel')}</Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    if (editor) {
                      editor.chain().focus().insertTable({
                        rows: tableRows,
                        cols: tableCols,
                        withHeaderRow: tableHasHeader }).run();
                      setTableDialogOpen(false);
                    }
                  }}
                >
                  삽입
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: 1, borderColor: 'divider' }}>
          <Button 
            onClick={() => {
              setOpenDialog(false);
              setSelectedNotice(null);
            }}
            variant="outlined"
            sx={{ borderRadius: 1.5 }}
          >
            {txt('취소', 'Cancel')}
          </Button>
          <Button 
            onClick={handleSaveNotice}
            variant="contained"
            sx={{ borderRadius: 1.5 }}
          >
            {selectedNotice ? txt('수정', 'Save') : txt('작성', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={scheduleDialogOpen}
        onClose={closeScheduleDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {txt('일정 입력', 'Schedule Input')}
          {selectedScheduleDate && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
              {selectedScheduleDate.toLocaleDateString(isEn ? 'en-US' : 'ko-KR')}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              value={newScheduleTitle}
              onChange={(e) => setNewScheduleTitle(e.target.value)}
              placeholder={txt('일정을 입력하세요', 'Enter a schedule')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSchedule();
                }
              }}
            />
            <Button variant="contained" onClick={handleAddSchedule}>
              {txt('추가', 'Add')}
            </Button>
          </Box>
          <FormControlLabel
            sx={{ mb: 1.5 }}
            control={
              <Switch
                checked={scheduleIsPublic}
                onChange={(e) => setScheduleIsPublic(e.target.checked)}
                color="primary"
              />
            }
            label={txt('공개 (모든 사용자가 볼 수 있음)', 'Public (visible to all users)')}
          />

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {txt('내 일정', 'My schedules')}
          </Typography>
          <List sx={{ p: 0, mb: 2 }}>
            {selectedScheduleDate && (customSchedules[toDateKey(selectedScheduleDate)] || []).length > 0 ? (
              (customSchedules[toDateKey(selectedScheduleDate)] || []).map((item) => (
                <ListItem
                  key={item.id}
                  disableGutters
                  secondaryAction={
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleDeleteSchedule(toDateKey(selectedScheduleDate), item.id)}
                    >
                      {txt('삭제', 'Delete')}
                    </Button>
                  }
                  sx={{
                    py: 0.75,
                    px: 0.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {item.isPublic && (
                          <Chip
                            size="small"
                            label={txt('공개', 'Public')}
                            sx={{ height: 22 }}
                          />
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.title}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))
            ) : (
              <ListItem sx={{ px: 0, py: 1 }}>
                <ListItemText
                  primary={
                    <Typography variant="body2" color="text.secondary">
                      {txt('등록된 개인 일정이 없습니다.', 'No personal schedules for this date.')}
                    </Typography>
                  }
                />
              </ListItem>
            )}
          </List>

          {selectedScheduleDate && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {txt('회사 스케줄', 'Company schedules')}
              </Typography>
              <List sx={{ p: 0, mb: 2 }}>
                {(companySchedulesByDate[toDateKey(selectedScheduleDate)] || []).length > 0 ? (
                  (companySchedulesByDate[toDateKey(selectedScheduleDate)] || []).map((item) => (
                    <ListItem
                      key={`co-dialog-${item.id}`}
                      disableGutters
                      sx={{ py: 0.75, px: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            {item.isHoliday && (
                              <Chip size="small" color="warning" label={txt('휴일', 'Holiday')} sx={{ height: 22 }} />
                            )}
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {item.title}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))
                ) : (
                  <ListItem sx={{ px: 0, py: 1 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body2" color="text.secondary">
                          {txt('회사 스케줄이 없습니다.', 'No company schedules for this date.')}
                        </Typography>
                      }
                    />
                  </ListItem>
                )}
              </List>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {txt('다른 사용자 공개 일정', 'Other users\' public schedules')}
              </Typography>
              <List sx={{ p: 0 }}>
                {(publicPersonalByDate[toDateKey(selectedScheduleDate)] || []).length > 0 ? (
                  (publicPersonalByDate[toDateKey(selectedScheduleDate)] || []).map((item) => (
                    <ListItem
                      key={item.id}
                      disableGutters
                      sx={{ py: 0.75, px: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {item.title} ({item.ownerName})
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))
                ) : (
                  <ListItem sx={{ px: 0, py: 1 }}>
                    <ListItemText
                      primary={
                        <Typography variant="body2" color="text.secondary">
                          {txt('공개된 다른 사용자 일정이 없습니다.', 'No public schedules from other users.')}
                        </Typography>
                      }
                    />
                  </ListItem>
                )}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeScheduleDialog}>
            {txt('닫기', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError('')}
      >
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setNoticeToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          pb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <WarningIcon sx={{ color: 'error.main', fontSize: 28 }} />
          <Typography variant="h6" fontWeight={600}>
            {txt('공지사항 삭제 확인', 'Confirm delete notice')}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <DialogContentText sx={{ mb: 2, fontSize: '1rem' }}>
            {txt('정말로 이 공지사항을 삭제하시겠습니까?', 'Are you sure you want to delete this notice?')}
          </DialogContentText>
          {noticeToDelete && (
            <Box sx={{ 
              p: 2, 
              bgcolor: 'grey.50', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'grey.200'
            }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {txt('제목', 'Title')}
              </Typography>
              <Typography variant="body1" fontWeight={500} sx={{ mb: 2 }}>
                {noticeToDelete.title}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {txt('작성자', 'Author')}
              </Typography>
              <Typography variant="body2">
                {noticeToDelete.author}
              </Typography>
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            {txt('이 작업은 되돌릴 수 없습니다. 삭제된 공지사항은 복구할 수 없습니다.', 'This cannot be undone. Deleted notices cannot be restored.')}
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false);
              setNoticeToDelete(null);
            }}
            variant="outlined"
            sx={{ borderRadius: 1.5, textTransform: 'none', px: 3 }}
          >
            {txt('취소', 'Cancel')}
          </Button>
          <Button
            onClick={confirmDeleteNotice}
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            sx={{ borderRadius: 1.5, textTransform: 'none', px: 3 }}
          >
            {txt('삭제', 'Delete')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        confirmColor={dialogState.confirmColor}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess('')}
      >
        <Alert onClose={() => setSuccess('')} severity="success">
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default NoticeManagement;
