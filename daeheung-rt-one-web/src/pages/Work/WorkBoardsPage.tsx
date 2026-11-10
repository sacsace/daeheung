import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  CircularProgress,
  Chip,
  Stack,
  Tooltip,
  IconButton,
  Autocomplete,
} from '@mui/material';
import FormFieldLabeled from '../../components/Common/FormFieldLabeled';
import {
  Add as AddIcon,
  DragIndicator as DragIndicatorIcon,
  EditOutlined as EditOutlinedIcon,
  EventRepeatOutlined as EventRepeatOutlinedIcon,
  GroupsOutlined as GroupsOutlinedIcon,
  RadioButtonChecked as RadioCheckedIcon,
  RadioButtonUnchecked as RadioUncheckedIcon,
  ViewKanbanOutlined as ViewKanbanOutlinedIcon
} from '@mui/icons-material';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTheme, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { workBoardService } from '../../services/api';
import { getUploadUrl } from '../../utils/uploadUrl';
import { showErrorPopup } from '../../utils/errorHandler';
import {
  companySelectListboxSlotProps,
  companySelectNowrapSx,
  shortCompanyName,
} from '../../utils/companyDisplayName';
import { useMenuStore, useStore } from '../../store';
import { useReferenceDataStore } from '../../store/referenceDataStore';
import { findMenuIdByPath } from '../../utils/findMenuByPath';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { mvsFilterFieldHeightSx, mvsOutlinedLabelProps, mvsPageRootFullBleedSx, mvsSearchFieldSx } from '../../theme/daeheungLayout';

/** 보드 색상 — 채도를 낮춘 시스템 톤에 가깝게 */
const BOARD_COLOR_OPTIONS = [
  '#0A84FF',
  '#34C759',
  '#FF9F0A',
  '#BF5AF2',
  '#FF453A',
  '#64D2FF',
  '#5E5CE6',
  '#8E8E93'
] as const;

const isHexColor = (value?: string | null) => Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));

const getBoardAccentColor = (board: any, fallbackColor: string) => {
  const color = typeof board?.board_color === 'string' ? board.board_color.trim() : '';
  if (isHexColor(color)) {
    return color.toUpperCase();
  }
  return fallbackColor;
};

const getContrastText = (hex: string) => {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#0F172A' : '#FFFFFF';
};

const getMemberInitial = (member: any) => {
  const label =
    member?.user?.username ||
    member?.user?.userid ||
    member?.user?.email ||
    '';
  const trimmed = String(label).trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
};

const getMemberAvatarSrc = (member: any) => {
  const resolved = getUploadUrl(member?.user?.avatar_url);
  return resolved || undefined;
};

const getMemberLabel = (member: any) =>
  member?.user?.username || member?.user?.userid || member?.user?.email || '';

type BoardType = 'GENERAL' | 'RECURRING';

const normalizeBoardType = (value: unknown): BoardType =>
  String(value || 'GENERAL').toUpperCase() === 'RECURRING' ? 'RECURRING' : 'GENERAL';

type SortableBoardCardProps = {
  board: any;
  themePrimaryColor: string;
  t: (key: string, options?: Record<string, unknown>) => string;
  isEn: boolean;
  navigate: (path: string) => void;
  onEdit: (board: any) => void;
  canEdit: boolean;
};

const SortableBoardCard: React.FC<SortableBoardCardProps> = ({
  board,
  themePrimaryColor,
  t,
  isEn,
  navigate,
  onEdit,
  canEdit
}) => {
  const theme = useTheme();
  const accent = getBoardAccentColor(board, themePrimaryColor);
  const headerText = getContrastText(accent);
  const members = Array.isArray(board.members) ? board.members : [];
  const previewMembers = members.slice(0, 4);
  const boardType = normalizeBoardType(board.board_type);
  const isRecurring = boardType === 'RECURRING';
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: board.id,
    disabled: !canEdit
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.72 : 1,
    zIndex: isDragging ? 4 : undefined
  };

  const cardBg = theme.palette.mode === 'light' ? '#FFFFFF' : alpha(theme.palette.grey[900], 0.96);
  const description = String(board.description || '').trim();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      elevation={0}
      sx={{
        width: '100%',
        minHeight: 158,
        borderRadius: '8px',
        border: '1px solid',
        borderColor: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.08)' : alpha(theme.palette.common.white, 0.1),
        backgroundColor: cardBg,
        boxShadow: 'none',
        overflow: 'hidden',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        '&:hover': {
          borderColor: alpha(accent, 0.5),
          '& .board-card-actions': { opacity: 1 },
        },
      }}
    >
      <CardActionArea
        onClick={() => navigate(`/work/projects/${board.id}`)}
        sx={{
          height: '100%',
          alignItems: 'stretch',
          display: 'flex',
          flexDirection: 'column',
          '&:hover .MuiCardActionArea-focusHighlight': { opacity: 0.04 },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            px: 1.65,
            py: 1.35,
            minHeight: 50,
            bgcolor: accent,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
          }}
        >
          {isRecurring ? (
            <EventRepeatOutlinedIcon sx={{ fontSize: '1rem', color: headerText, opacity: 0.88, mt: 0.1 }} />
          ) : (
            <ViewKanbanOutlinedIcon sx={{ fontSize: '1rem', color: headerText, opacity: 0.88, mt: 0.1 }} />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                lineHeight: 1.35,
                letterSpacing: '-0.02em',
                fontSize: '0.9rem',
                color: headerText,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {board.name}
            </Typography>
            <Typography
              sx={{
                mt: 0.35,
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: headerText,
                opacity: 0.88,
                letterSpacing: '0.01em',
              }}
            >
              {isRecurring
                ? t('workBoards.boardTypes.recurring')
                : t('workBoards.boardTypes.general')}
            </Typography>
          </Box>
          <Box
            className="board-card-actions"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              opacity: { xs: 1, sm: 0 },
              transition: 'opacity 0.18s ease',
              flexShrink: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {canEdit && (
              <>
                <Tooltip title={isEn ? 'Reorder' : '순서 변경'}>
                  <IconButton
                    size="small"
                    aria-label={isEn ? 'Reorder' : '순서 변경'}
                    {...attributes}
                    {...listeners}
                    sx={{
                      width: 28,
                      height: 28,
                      color: headerText,
                      bgcolor: alpha(headerText, 0.12),
                      touchAction: 'pan-y',
                      cursor: 'grab',
                      '&:hover': { bgcolor: alpha(headerText, 0.2) },
                    }}
                  >
                    <DragIndicatorIcon sx={{ fontSize: '1rem' }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={isEn ? 'Edit' : '수정'}>
                  <IconButton
                    size="small"
                    aria-label={isEn ? 'Edit' : '수정'}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(board);
                    }}
                    sx={{
                      width: 28,
                      height: 28,
                      color: headerText,
                      bgcolor: alpha(headerText, 0.12),
                      '&:hover': { bgcolor: alpha(headerText, 0.2) },
                    }}
                  >
                    <EditOutlinedIcon sx={{ fontSize: '0.95rem' }} />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        </Box>

        <CardContent
          sx={{
            flex: 1,
            py: 1.65,
            px: 1.65,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.15,
            '&:last-child': { pb: 1.65 },
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              minHeight: '2.5em',
              lineHeight: 1.5,
              fontSize: '0.78rem',
              fontWeight: 400,
              opacity: description ? 0.92 : 0.55,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {description || t('workBoards.noDescription')}
          </Typography>

          <Box
            sx={{
              mt: 'auto',
              pt: 1,
              borderTop: '1px solid',
              borderColor: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.06)' : alpha(theme.palette.common.white, 0.08),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            {members.length > 0 ? (
              <AvatarGroup
                max={4}
                sx={{
                  '& .MuiAvatar-root': {
                    width: 26,
                    height: 26,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    border: `2px solid ${cardBg}`,
                  },
                }}
              >
                {previewMembers.map((member: any) => (
                  <Tooltip title={getMemberLabel(member)} key={member.id ?? member.user_id}>
                    <Avatar
                      src={getMemberAvatarSrc(member)}
                      alt={getMemberLabel(member) || getMemberInitial(member)}
                      sx={{
                        bgcolor: getMemberAvatarSrc(member)
                          ? 'transparent'
                          : alpha(accent, 0.88),
                        color: getContrastText(accent),
                      }}
                    >
                      {getMemberInitial(member)}
                    </Avatar>
                  </Tooltip>
                ))}
              </AvatarGroup>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.disabled' }}>
                <GroupsOutlinedIcon sx={{ fontSize: '1.05rem' }} />
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                  {isEn ? 'No members' : '멤버 없음'}
                </Typography>
              </Box>
            )}
            <Chip
              size="small"
              label={t('workBoards.memberCount', { count: members.length })}
              sx={{
                height: 24,
                fontWeight: 600,
                fontSize: '0.65rem',
                letterSpacing: '-0.01em',
                borderRadius: '999px',
                bgcolor: theme.palette.mode === 'light' ? '#F1F5F9' : alpha(theme.palette.common.white, 0.06),
                color: 'text.secondary',
                '& .MuiChip-label': { px: 1.1 },
              }}
            />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

const WORK_PROJECTS_ROUTE = '/work/projects';

const WorkBoardsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useStore();
  const { menus, hasMenuPermission } = useMenuStore();
  const workMenuId = useMemo(() => findMenuIdByPath(menus, WORK_PROJECTS_ROUTE), [menus]);
  const isRootUser = user?.role === 'root';
  const canSelectCompany = false;
  const canCreateBoard = isRootUser || (workMenuId != null && hasMenuPermission(workMenuId, 'create'));
  const canEditBoard = isRootUser || (workMenuId != null && hasMenuPermission(workMenuId, 'edit'));
  const themePrimaryColor = isHexColor(theme.palette.primary.main)
    ? theme.palette.primary.main.toUpperCase()
    : BOARD_COLOR_OPTIONS[0];
  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingBoardId, setEditingBoardId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [boardType, setBoardType] = useState<BoardType>('GENERAL');
  const [boardColor, setBoardColor] = useState<string>(themePrimaryColor);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(() =>
    user?.company_id != null && Number(user.company_id) > 0 ? Number(user.company_id) : 0
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /** root/audit: 0=전체 회사, >0=특정 회사. 그 외: 로그인 회사 */
  const effectiveCompanyId = useMemo(() => {
    if (canSelectCompany) {
      if (selectedCompanyId == null || selectedCompanyId === 0) return null;
      return Number.isFinite(selectedCompanyId) ? selectedCompanyId : null;
    }
    return user?.company_id != null ? Number(user.company_id) : null;
  }, [canSelectCompany, selectedCompanyId, user?.company_id]);

  useEffect(() => {
    if (!canSelectCompany) return;
    const userCompanyId = user?.company_id != null ? Number(user.company_id) : NaN;
    if (Number.isFinite(userCompanyId) && userCompanyId > 0) {
      setSelectedCompanyId((prev) => (prev == null ? userCompanyId : prev));
    }
    let cancelled = false;
    setCompaniesLoading(true);
    (async () => {
      try {
        const store = useReferenceDataStore.getState();
        const list = await store.fetchCompanies();
        if (cancelled) return;
        let scoped = Array.isArray(list) ? list : [];
        // 목록이 비었거나 로그인 회사가 없으면 단건 조회로 보강
        if (
          Number.isFinite(userCompanyId) &&
          userCompanyId > 0 &&
          !scoped.some((c: any) => Number(c.id) === userCompanyId)
        ) {
          const one = await store.fetchCompanyById(userCompanyId);
          if (one && !cancelled) {
            scoped = [{ ...one, id: Number(one.id) }, ...scoped];
          }
        }
        if (cancelled) return;
        setCompanies(scoped);
        setSelectedCompanyId((prev) => {
          if (prev === 0) return 0;
          if (prev != null && prev > 0 && scoped.some((c: any) => Number(c.id) === Number(prev))) {
            return Number(prev);
          }
          if (Number.isFinite(userCompanyId) && scoped.some((c: any) => Number(c.id) === userCompanyId)) {
            return userCompanyId;
          }
          return 0;
        });
      } catch (e: any) {
        if (!cancelled) showErrorPopup(e, t('workBoards.title'));
      } finally {
        if (!cancelled) setCompaniesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canSelectCompany, t, user?.company_id]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workBoardService.getBoards({
        light: true,
        ...(canSelectCompany && effectiveCompanyId != null ? { company_id: effectiveCompanyId } : {}),
      });
      if (res.success) {
        setBoards(res.data || []);
      } else {
        showErrorPopup(res.message || t('workBoards.errors.loadListFailed'), t('workBoards.title'));
      }
    } catch (e: any) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, canSelectCompany, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmitBoard = async () => {
    if (!name.trim()) return;
    if (editingBoardId && !canEditBoard) {
      showErrorPopup(isEn ? 'You do not have permission to edit boards.' : '보드를 수정할 권한이 없습니다.', t('workBoards.title'));
      return;
    }
    if (!editingBoardId && !canCreateBoard) {
      showErrorPopup(isEn ? 'You do not have permission to create boards.' : '보드를 만들 권한이 없습니다.', t('workBoards.title'));
      return;
    }
    if (!editingBoardId && isRootUser && (effectiveCompanyId == null || effectiveCompanyId <= 0)) {
      showErrorPopup(
        isEn ? 'Select a company before creating a board.' : '보드를 만들려면 회사를 선택해주세요.',
        t('workBoards.title')
      );
      return;
    }
    setSaving(true);
    try {
      const trimmedDesc = description.trim();
      /** 수정 시: undefined는 JSON에서 키가 빠져 서버가 설명을 갱신하지 못함 — null/문자열로 항상 전달 */

      if (editingBoardId) {
        const updateRes = await workBoardService.updateBoard(editingBoardId, {
          name: name.trim(),
          description: trimmedDesc === '' ? null : trimmedDesc,
          board_color: boardColor
        });
        if (updateRes.success) {
          setOpen(false);
          setEditingBoardId(null);
          await load();
        } else {
          showErrorPopup(updateRes.message || t('workBoards.errors.createFailed'), t('workBoards.title'));
        }
      } else {
        const createRes = await workBoardService.createBoard({
          name: name.trim(),
          description: trimmedDesc === '' ? undefined : trimmedDesc,
          board_color: boardColor,
          board_type: boardType,
          ...(isRootUser && effectiveCompanyId != null ? { company_id: effectiveCompanyId } : {}),
        });
        if (createRes.success && createRes.data?.id) {
          setOpen(false);
          setName('');
          setDescription('');
          setBoardType('GENERAL');
          setBoardColor(themePrimaryColor);
          navigate(`/work/projects/${createRes.data.id}`);
        } else {
          showErrorPopup(createRes.message || t('workBoards.errors.createFailed'), t('workBoards.title'));
        }
      }
    } catch (e: any) {
      showErrorPopup(e, t('workBoards.title'));
    } finally {
      setSaving(false);
    }
  };

  const openCreateDialog = () => {
    if (isRootUser && (effectiveCompanyId == null || effectiveCompanyId <= 0)) {
      showErrorPopup(
        isEn ? 'Select a company before creating a board.' : '보드를 만들려면 회사를 선택해주세요.',
        t('workBoards.title')
      );
      return;
    }
    setEditingBoardId(null);
    setName('');
    setDescription('');
    setBoardType('GENERAL');
    setBoardColor(themePrimaryColor);
    setOpen(true);
  };

  const companyFilterOptions = useMemo(() => {
    const allLabel = isEn ? 'All companies' : '전체 회사';
    const list = companies
      .map((c: any) => ({
        id: Number(c.id),
        name: shortCompanyName(c.name || c.company_name) || `#${c.id}`,
      }))
      .filter((c) => Number.isFinite(c.id) && c.id > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    return [{ id: 0, name: allLabel }, ...list];
  }, [companies, isEn]);

  const selectedCompanyOption = useMemo(() => {
    const id =
      selectedCompanyId === 0 || selectedCompanyId == null
        ? 0
        : Number(selectedCompanyId) > 0
          ? Number(selectedCompanyId)
          : 0;
    return companyFilterOptions.find((o) => o.id === id) ?? companyFilterOptions[0] ?? null;
  }, [companyFilterOptions, selectedCompanyId]);

  const companySelectField =
    canSelectCompany ? (
      <Autocomplete
        options={companyFilterOptions}
        value={selectedCompanyOption}
        onChange={(_, next) => {
          if (!next || next.id === 0) setSelectedCompanyId(0);
          else setSelectedCompanyId(Number(next.id));
        }}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        disableClearable={Boolean(selectedCompanyOption)}
        disabled={companiesLoading}
        slotProps={companySelectListboxSlotProps}
        sx={{
          minWidth: { xs: '100%', sm: 220 },
          maxWidth: { xs: '100%', sm: 280 },
          alignSelf: { xs: 'stretch', sm: 'flex-end' },
          mt: 1.25,
          ...mvsSearchFieldSx,
          ...mvsFilterFieldHeightSx,
          ...companySelectNowrapSx,
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            size="small"
            label={t('workBoards.filters.company')}
            placeholder={
              companiesLoading
                ? t('common.loading')
                : t('workBoards.filters.searchCompany')
            }
            {...mvsOutlinedLabelProps}
            sx={{
              ...mvsSearchFieldSx,
              ...mvsFilterFieldHeightSx,
              ...companySelectNowrapSx,
              overflow: 'visible',
              '& .MuiFormLabel-root': {
                overflow: 'visible',
                maxWidth: 'none',
                lineHeight: 1.2,
              },
            }}
          />
        )}
      />
    ) : null;

  const openEditDialog = (board: any) => {
    setEditingBoardId(board.id);
    setName(board.name || '');
    setDescription(board.description || '');
    setBoardType(normalizeBoardType(board.board_type));
    setBoardColor(getBoardAccentColor(board, themePrimaryColor));
    setOpen(true);
  };

  const handleBoardDragEnd = async (event: DragEndEvent) => {
    if (!canEditBoard) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = Number(active.id);
    const overId = Number(over.id);
    const activeBoard = boards.find((b) => b.id === activeId);
    const overBoard = boards.find((b) => b.id === overId);
    if (!activeBoard || !overBoard || activeBoard.company_id !== overBoard.company_id) return;

    const sameCo = boards.filter((b) => b.company_id === activeBoard.company_id);
    const oldIndex = sameCo.findIndex((b) => b.id === activeId);
    const newIndex = sameCo.findIndex((b) => b.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(sameCo, oldIndex, newIndex);
    let ri = 0;
    const merged = boards.map((b) => (b.company_id === activeBoard.company_id ? reordered[ri++] : b));
    setBoards(merged);

    try {
      const res = await workBoardService.moveBoard(activeId, newIndex);
      if (!res.success) {
        showErrorPopup(res.message || t('workBoards.errors.reorderFailed'), t('workBoards.title'));
        await load();
      }
    } catch (e: any) {
      showErrorPopup(e, t('workBoards.title'));
      await load();
    }
  };

  return (
    <Box sx={{ ...mvsPageRootFullBleedSx, flex: 1, border: 'none', overflow: 'visible' }}>
      <DaeheungPageHeader
        title={t('workBoards.title')}
        description={t('workBoards.description')}
        actions={
          isRootUser || canCreateBoard ? (
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1.25,
                alignItems: 'flex-end',
                justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                overflow: 'visible',
                pt: 0.5,
              }}
            >
              {companySelectField}
              {canCreateBoard ? (
                <Button
                  variant="contained"
                  disableElevation
                  startIcon={<AddIcon sx={{ fontSize: 20 }} />}
                  onClick={openCreateDialog}
                  sx={{
                    flexShrink: 0,
                    height: 40,
                    borderRadius: '8px',
                    px: 2.5,
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  {t('workBoards.actions.newBoard')}
                </Button>
              ) : null}
            </Box>
          ) : undefined
        }
      />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            <CircularProgress />
          </Box>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={canEditBoard ? handleBoardDragEnd : () => {}}
          >
            <SortableContext items={boards.map((b) => b.id)} strategy={rectSortingStrategy}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(auto-fill, minmax(220px, 1fr))',
                    lg: 'repeat(auto-fill, minmax(240px, 1fr))',
                  },
                  gap: { xs: 1.75, sm: 2 },
                  alignItems: 'stretch',
                }}
              >
                {boards.map((b) => (
                  <SortableBoardCard
                    key={b.id}
                    board={b}
                    themePrimaryColor={themePrimaryColor}
                    t={t}
                    isEn={isEn}
                    navigate={navigate}
                    onEdit={openEditDialog}
                    canEdit={canEditBoard}
                  />
                ))}
                {canCreateBoard && boards.length > 0 && (
                  <Card
                    elevation={0}
                    onClick={openCreateDialog}
                    sx={{
                      minHeight: 158,
                      borderRadius: '8px',
                      border: '1px dashed',
                      borderColor: theme.palette.mode === 'light' ? '#CBD5E1' : alpha(theme.palette.common.white, 0.22),
                      bgcolor: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: alpha(theme.palette.common.white, 0.45),
                      },
                    }}
                  >
                    <Stack alignItems="center" spacing={0.85} sx={{ px: 1.75, py: 2.25, textAlign: 'center' }}>
                      <Box
                        sx={{
                        width: 34,
                        height: 34,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        }}
                      >
                        <AddIcon sx={{ fontSize: '1.25rem' }} />
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: 'text.primary' }}>
                        {t('workBoards.actions.newBoard')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 200, lineHeight: 1.5 }}>
                        {isEn ? 'Add another board for your team' : '팀과 함께 쓸 보드를 추가합니다'}
                      </Typography>
                    </Stack>
                  </Card>
                )}
                {boards.length === 0 && (
                  <Box
                    sx={{
                      gridColumn: '1 / -1',
                      py: 6,
                      px: 3,
                      textAlign: 'center',
                      borderRadius: '8px',
                      border: `1px dashed ${theme.palette.mode === 'light' ? '#CBD5E1' : alpha(theme.palette.common.white, 0.2)}`,
                      bgcolor: 'transparent',
                    }}
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        mx: 'auto',
                        mb: 2,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                      }}
                    >
                      <ViewKanbanOutlinedIcon sx={{ fontSize: '1.75rem' }} />
                    </Box>
                    <Typography color="text.secondary" sx={{ fontSize: '0.9375rem', lineHeight: 1.65, mb: 2.5 }}>
                      {t('workBoards.empty.noBoards')}
                    </Typography>
                    {canCreateBoard && (
                      <Button
                        variant="contained"
                        disableElevation
                        startIcon={<AddIcon />}
                        onClick={openCreateDialog}
                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 2.5 }}
                      >
                        {t('workBoards.actions.newBoard')}
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            </SortableContext>
          </DndContext>
        )}

      <Dialog
        open={open}
        onClose={() => {
          if (saving) return;
          setOpen(false);
          setEditingBoardId(null);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '8px' } }}
      >
        <DialogTitle sx={{ pt: 2.5, px: 3, pb: 1, fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          {editingBoardId ? (isEn ? 'Edit Board' : '보드 수정') : t('workBoards.dialog.newBoardTitle')}
        </DialogTitle>
        <DialogContent sx={{ pt: 1, px: 3, pb: 1 }}>
          <Stack spacing={2.5}>
            <FormFieldLabeled
              autoFocus
              fieldLabel={t('workBoards.fields.boardName')}
              requiredMark
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('workBoards.placeholders.boardName')}
            />
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                {t('workBoards.fields.boardType')}
                {!editingBoardId ? (
                  <Box component="span" sx={{ color: 'error.main', ml: 0.25 }}>
                    *
                  </Box>
                ) : null}
              </Typography>
              {editingBoardId ? (
                <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                  {boardType === 'RECURRING'
                    ? t('workBoards.boardTypes.recurring')
                    : t('workBoards.boardTypes.general')}
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {(
                    [
                      {
                        value: 'GENERAL' as BoardType,
                        title: t('workBoards.boardTypes.general'),
                        hint: t('workBoards.boardTypes.generalHint'),
                        icon: <ViewKanbanOutlinedIcon sx={{ fontSize: 20 }} />,
                      },
                      {
                        value: 'RECURRING' as BoardType,
                        title: t('workBoards.boardTypes.recurring'),
                        hint: t('workBoards.boardTypes.recurringHint'),
                        icon: <EventRepeatOutlinedIcon sx={{ fontSize: 20 }} />,
                      },
                    ] as const
                  ).map((opt) => {
                    const selected = boardType === opt.value;
                    return (
                      <Box
                        key={opt.value}
                        component="button"
                        type="button"
                        onClick={() => setBoardType(opt.value)}
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1.25,
                          textAlign: 'left',
                          m: 0,
                          p: 1.25,
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: selected ? 'primary.main' : 'divider',
                          bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
                          cursor: 'pointer',
                          font: 'inherit',
                          color: 'inherit',
                          '&:hover': {
                            borderColor: selected ? 'primary.main' : alpha(theme.palette.primary.main, 0.4),
                          },
                        }}
                      >
                        <Box sx={{ mt: 0.15, color: selected ? 'primary.main' : 'text.secondary' }}>
                          {selected ? (
                            <RadioCheckedIcon sx={{ fontSize: 20 }} />
                          ) : (
                            <RadioUncheckedIcon sx={{ fontSize: 20 }} />
                          )}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Box sx={{ color: 'text.secondary', display: 'flex' }}>{opt.icon}</Box>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>{opt.title}</Typography>
                          </Box>
                          <Typography sx={{ mt: 0.35, fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.45 }}>
                            {opt.hint}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
            <FormFieldLabeled
              fieldLabel={t('workBoards.fields.descriptionOptional')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('workBoards.placeholders.description')}
              multiline
              minRows={3}
            />
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                {isEn ? 'Board Color' : '보드 색상'}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {[themePrimaryColor, ...BOARD_COLOR_OPTIONS.filter((color) => color !== themePrimaryColor)].map((color) => {
                  const selected = boardColor === color;
                  return (
                    <Tooltip title={color} key={color}>
                      <Button
                        onClick={() => setBoardColor(color)}
                        sx={{
                          minWidth: 0,
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          p: 0,
                          border: selected ? `2px solid ${theme.palette.text.primary}` : '1px solid',
                          borderColor: selected ? theme.palette.text.primary : alpha(theme.palette.divider, 0.9),
                          backgroundColor: color,
                          boxShadow: selected ? `0 0 0 3px ${alpha(color, 0.35)}` : 'none',
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => {
              setOpen(false);
              setEditingBoardId(null);
            }}
            disabled={saving}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600 }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmitBoard}
            variant="contained"
            disableElevation
            disabled={saving || !name.trim()}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 2.5 }}
          >
            {saving ? <CircularProgress size={22} /> : editingBoardId ? (isEn ? 'Save' : '저장') : t('workBoards.actions.create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkBoardsPage;
