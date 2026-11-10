import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  AssignmentIndOutlined as AssignmentIndOutlinedIcon,
  DeleteOutline as DeleteOutlineIcon,
  DragIndicator as DragIndicatorIcon,
  EditOutlined as EditOutlinedIcon,
  FlagOutlined as FlagOutlinedIcon,
  MoreVert as MoreVertIcon,
  PersonAddAlt1 as PersonAddAlt1Icon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { workAssigneeListService } from '../../services/api';
import { showErrorPopup } from '../../utils/errorHandler';
import { useMenuStore, useStore } from '../../store';
import { filterActiveCompanyUsers, useReferenceDataStore } from '../../store/referenceDataStore';
import { findMenuIdByPath } from '../../utils/findMenuByPath';
import { canAccessMinsubOnlyWorkMenus } from '../../utils/canAccessSystemLoginHistory';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { mvsFilterFieldHeightSx, mvsPageRootFullBleedSx, mvsSearchFieldSx } from '../../theme/daeheungLayout';

type CompanyUserOption = {
  id: number;
  name: string;
  title: string;
  email: string;
  label: string;
};

type PartnerOption = {
  id: number;
  name: string;
  businessType: string;
  label: string;
};

function resolveUserTitle(u: any): string {
  const fromEntity = u?.positionEntity?.name || u?.position_entity?.name;
  if (fromEntity) return String(fromEntity).trim();
  if (u?.position) return String(u.position).trim();
  return '';
}

function toCompanyUserOption(u: any): CompanyUserOption {
  const name = String(u?.username || u?.userid || '').trim();
  const email = String(u?.email || '').trim();
  const title = resolveUserTitle(u);
  const label = [name, title, email].filter(Boolean).join(' · ');
  return {
    id: Number(u.id),
    name,
    title,
    email,
    label: label || name || String(u.id),
  };
}

function toPartnerOption(p: any): PartnerOption | null {
  const id = Number(p?.id);
  const name = String(p?.company_name || p?.name || '').trim();
  if (!Number.isInteger(id) || id <= 0 || !name) return null;
  const businessType = String(p?.business_type || '').trim();
  return {
    id,
    name,
    businessType,
    label: businessType ? `${name} (${businessType})` : name,
  };
}

const ROUTE = '/work/assignee-list';
const COLUMN_BG = '#F1F5F9';
const COLUMN_BORDER = '1px solid #E2E8F0';
const HEADER_ACCENT = '#0F766E';
const HIGHLIGHT_RED = '#DC2626';

type AssigneeItem = {
  id: number;
  assignee_id: number;
  partner_id?: number | null;
  name: string;
  note?: string | null;
  is_highlighted: boolean;
  sort_order: number;
};

type Assignee = {
  id: number;
  user_id?: number | null;
  name: string;
  title?: string | null;
  email?: string | null;
  sort_order: number;
  items?: AssigneeItem[];
};

const itemDragId = (id: number) => `item-${id}`;
const colDropId = (id: number) => `col-${id}`;
const parseItemId = (value: string | number) => {
  const m = String(value).match(/^item-(\d+)$/);
  return m ? Number(m[1]) : null;
};
const parseColId = (value: string | number) => {
  const m = String(value).match(/^col-(\d+)$/);
  return m ? Number(m[1]) : null;
};

function SortableItemCell({
  item,
  canEdit,
  canDelete,
  onEdit,
  onToggleHighlight,
  onDelete,
}: {
  item: AssigneeItem;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (item: AssigneeItem) => void;
  onToggleHighlight: (item: AssigneeItem) => void;
  onDelete: (item: AssigneeItem) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: itemDragId(item.id),
    disabled: !canEdit,
    data: { type: 'item', item },
  });
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const highlighted = Boolean(item.is_highlighted);

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        minHeight: 40,
        minWidth: 0,
        width: '100%',
        px: 1,
        py: 0.75,
        mb: 0.75,
        borderRadius: '8px',
        border: '1px solid',
        borderColor: highlighted
          ? alpha(HIGHLIGHT_RED, 0.35)
          : theme.palette.mode === 'light'
            ? 'rgba(15, 23, 42, 0.08)'
            : alpha(theme.palette.common.white, 0.1),
        bgcolor: highlighted ? alpha(HIGHLIGHT_RED, 0.12) : '#FFFFFF',
        color: 'text.primary',
        opacity: isDragging ? 0.55 : 1,
        transform: isDragging ? CSS.Transform.toString(transform) : undefined,
        transition: isDragging ? transition : undefined,
        boxShadow: 'none',
        '&:hover .item-actions': { opacity: 1 },
      }}
    >
      {canEdit && (
        <Box
          {...attributes}
          {...listeners}
          sx={{
            display: 'flex',
            cursor: 'grab',
            color: 'text.disabled',
            flexShrink: 0,
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: '1rem' }} />
        </Box>
      )}
      <Typography
        component="div"
        sx={{
          flex: 1,
          minWidth: 0,
          fontSize: '0.8125rem',
          fontWeight: 500,
          lineHeight: 1.35,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          cursor: canEdit ? 'pointer' : 'default',
          color: highlighted ? HIGHLIGHT_RED : 'text.primary',
        }}
        onDoubleClick={() => canEdit && onEdit(item)}
        title={item.note || item.name}
      >
        {item.name}
      </Typography>
      {(canEdit || canDelete) && (
        <>
          <IconButton
            className="item-actions"
            size="small"
            sx={{
              opacity: { xs: 1, sm: 0 },
              p: 0.35,
              width: 28,
              height: 28,
              color: 'text.secondary',
            }}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <MoreVertIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            MenuListProps={{ dense: true }}
          >
            {canEdit && (
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  onEdit(item);
                }}
              >
                <EditOutlinedIcon sx={{ fontSize: 16, mr: 1 }} /> {t('common.edit')}
              </MenuItem>
            )}
            {canEdit && (
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  onToggleHighlight(item);
                }}
              >
                <FlagOutlinedIcon sx={{ fontSize: 16, mr: 1 }} />
                {item.is_highlighted
                  ? t('workAssigneeList.actions.highlightedOn')
                  : t('workAssigneeList.actions.highlightedOff')}
              </MenuItem>
            )}
            {canDelete && (
              <MenuItem
                onClick={() => {
                  setMenuAnchor(null);
                  onDelete(item);
                }}
                sx={{ color: 'error.main' }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 16, mr: 1 }} /> {t('common.delete')}
              </MenuItem>
            )}
          </Menu>
        </>
      )}
    </Box>
  );
}

function AssigneeColumn({
  assignee,
  canEdit,
  canCreate,
  canDelete,
  onEditAssignee,
  onDeleteAssignee,
  onAddItem,
  onEditItem,
  onToggleHighlight,
  onDeleteItem,
}: {
  assignee: Assignee;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onEditAssignee: (a: Assignee) => void;
  onDeleteAssignee: (a: Assignee) => void;
  onAddItem: (assigneeId: number) => void;
  onEditItem: (item: AssigneeItem) => void;
  onToggleHighlight: (item: AssigneeItem) => void;
  onDeleteItem: (item: AssigneeItem) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const items = assignee.items || [];
  const { setNodeRef, isOver } = useDroppable({
    id: colDropId(assignee.id),
    data: { type: 'column', assigneeId: assignee.id },
  });
  const {
    attributes,
    listeners,
    setNodeRef: setSortRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `assignee-${assignee.id}`,
    disabled: !canEdit,
    data: { type: 'assignee', assignee },
  });
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const setColumnRef = (node: HTMLElement | null) => {
    setSortRef(node);
    setNodeRef(node);
  };

  return (
    <Box
      ref={setColumnRef}
      sx={{
        minWidth: 0,
        height: '100%',
        display: 'flex',
        transform: isDragging ? CSS.Transform.toString(transform) : undefined,
        transition: isDragging ? transition : undefined,
        opacity: isDragging ? 0.55 : 1,
      }}
    >
      <Card
        elevation={0}
        sx={{
          flex: 1,
          width: '100%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: '8px',
          border: COLUMN_BORDER,
          bgcolor: isOver ? alpha(theme.palette.primary.main, 0.06) : COLUMN_BG,
          boxShadow: 'none',
        }}
      >
      <Box
        sx={{
          px: 1.35,
          py: 1.15,
          minHeight: 72,
          bgcolor: HEADER_ACCENT,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0.75,
        }}
      >
        {canEdit && (
          <Tooltip title={t('workAssigneeList.actions.reorder')}>
            <IconButton
              size="small"
              {...attributes}
              {...listeners}
              sx={{
                width: 28,
                height: 28,
                color: '#fff',
                bgcolor: alpha('#fff', 0.14),
                cursor: 'grab',
                flexShrink: 0,
                '&:hover': { bgcolor: alpha('#fff', 0.22) },
              }}
            >
              <DragIndicatorIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Tooltip>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '0.9rem',
              lineHeight: 1.35,
              letterSpacing: '-0.02em',
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={assignee.name}
          >
            {assignee.name}
          </Typography>
          <Typography
            sx={{
              mt: 0.25,
              fontSize: '0.72rem',
              lineHeight: 1.35,
              color: alpha('#fff', 0.88),
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={assignee.title || undefined}
          >
            {assignee.title || '\u00A0'}
          </Typography>
          <Typography
            sx={{
              mt: 0.15,
              fontSize: '0.72rem',
              lineHeight: 1.35,
              color: alpha('#fff', 0.88),
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={assignee.email || undefined}
          >
            {assignee.email || '\u00A0'}
          </Typography>
        </Box>
        {(canEdit || canDelete) && (
          <>
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{
                width: 28,
                height: 28,
                color: '#fff',
                bgcolor: alpha('#fff', 0.14),
                flexShrink: 0,
                '&:hover': { bgcolor: alpha('#fff', 0.22) },
              }}
            >
              <MoreVertIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              MenuListProps={{ dense: true }}
            >
              {canEdit && (
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    onEditAssignee(assignee);
                  }}
                >
                  <EditOutlinedIcon sx={{ fontSize: 16, mr: 1 }} /> {t('workAssigneeList.dialog.editAssignee')}
                </MenuItem>
              )}
              {canDelete && (
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    onDeleteAssignee(assignee);
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16, mr: 1 }} /> {t('common.delete')}
                </MenuItem>
              )}
            </Menu>
          </>
        )}
      </Box>

      <Box sx={{ p: 1.15, flex: 1, minHeight: 120, display: 'flex', flexDirection: 'column' }}>
        <SortableContext items={items.map((i) => itemDragId(i.id))} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableItemCell
              key={item.id}
              item={item}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={onEditItem}
              onToggleHighlight={onToggleHighlight}
              onDelete={onDeleteItem}
            />
          ))}
        </SortableContext>
        {canCreate && (
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: '1rem !important' }} />}
            onClick={() => onAddItem(assignee.id)}
            sx={{
              mt: 0.25,
              alignSelf: 'stretch',
              justifyContent: 'flex-start',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8125rem',
              color: 'text.secondary',
              borderRadius: '8px',
              px: 1,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                color: 'primary.main',
              },
            }}
          >
            {t('workAssigneeList.dialog.addCompany')}
          </Button>
        )}
      </Box>
      </Card>
    </Box>
  );
}

const WorkAssigneeListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useStore();
  const { menus, hasMenuPermission } = useMenuStore();
  const menuId = useMemo(() => findMenuIdByPath(menus, ROUTE), [menus]);
  const isRoot = user?.role === 'root';
  const canCreate = isRoot || (menuId != null && hasMenuPermission(menuId, 'create'));
  const canEdit = isRoot || (menuId != null && hasMenuPermission(menuId, 'edit'));
  const canDelete = isRoot || (menuId != null && hasMenuPermission(menuId, 'delete'));
  const [accessChecked, setAccessChecked] = useState(false);
  const [canAccessPage, setCanAccessPage] = useState(false);

  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeItem, setActiveItem] = useState<AssigneeItem | null>(null);

  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState<Assignee | null>(null);
  const [assigneeForm, setAssigneeForm] = useState({ name: '', title: '', email: '' });
  const [selectedCompanyUser, setSelectedCompanyUser] = useState<CompanyUserOption | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUserOption[]>([]);
  const [loadingCompanyUsers, setLoadingCompanyUsers] = useState(false);
  const [savingAssignee, setSavingAssignee] = useState(false);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemAssigneeId, setItemAssigneeId] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<AssigneeItem | null>(null);
  const [itemForm, setItemForm] = useState({ name: '', note: '', is_highlighted: false });
  const [selectedPartner, setSelectedPartner] = useState<PartnerOption | null>(null);
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [savingItem, setSavingItem] = useState(false);

  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const allowed = await canAccessMinsubOnlyWorkMenus(user);
      if (cancelled) return;
      setCanAccessPage(allowed);
      setAccessChecked(true);
      if (!allowed) navigate('/', { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  const load = useCallback(async () => {
    if (!canAccessPage) return;
    setLoading(true);
    try {
      const res = await workAssigneeListService.getList(
        user?.company_id != null ? { company_id: user.company_id } : undefined
      );
      if (res?.success) {
        const list = Array.isArray(res.data) ? res.data : [];
        setAssignees(
          list.map((a: Assignee) => ({
            ...a,
            items: [...(a.items || [])].sort((x, y) => x.sort_order - y.sort_order || x.id - y.id),
          }))
        );
      } else {
        setAssignees([]);
        showErrorPopup(res?.message || t('workAssigneeList.errors.loadFailed'), t('workAssigneeList.title'));
      }
    } catch (e: any) {
      setAssignees([]);
      showErrorPopup(e, t('workAssigneeList.title'));
    } finally {
      setLoading(false);
    }
  }, [t, user?.company_id, canAccessPage]);

  useEffect(() => {
    if (accessChecked && canAccessPage) load();
  }, [accessChecked, canAccessPage, load]);

  const filteredAssignees = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return assignees;
    return assignees
      .map((a) => {
        const assigneeHit =
          String(a.name || '')
            .toLowerCase()
            .includes(q) ||
          String(a.title || '')
            .toLowerCase()
            .includes(q) ||
          String(a.email || '')
            .toLowerCase()
            .includes(q);
        const matchedItems = (a.items || []).filter(
          (item) =>
            String(item.name || '')
              .toLowerCase()
              .includes(q) ||
            String(item.note || '')
              .toLowerCase()
              .includes(q)
        );
        if (assigneeHit) return a;
        if (matchedItems.length === 0) return null;
        return { ...a, items: matchedItems };
      })
      .filter((a): a is Assignee => a != null);
  }, [assignees, searchTerm]);

  const loadCompanyUsers = useCallback(async (): Promise<CompanyUserOption[]> => {
    const companyId = user?.company_id != null ? Number(user.company_id) : NaN;
    if (!Number.isInteger(companyId) || companyId <= 0) {
      setCompanyUsers([]);
      return [];
    }
    setLoadingCompanyUsers(true);
    try {
      const params =
        user?.role === 'root' || user?.role === 'audit'
          ? { company_id: companyId }
          : undefined;
      const allUsers = await useReferenceDataStore.getState().fetchUsers(params);
      const list = filterActiveCompanyUsers(allUsers, {
        companyId,
        tenantId: user?.tenant_id != null ? Number(user.tenant_id) : null,
      })
        .map(toCompanyUserOption)
        .filter((o) => Number.isInteger(o.id) && o.id > 0 && o.name);
      setCompanyUsers(list);
      return list;
    } catch {
      setCompanyUsers([]);
      return [];
    } finally {
      setLoadingCompanyUsers(false);
    }
  }, [user?.company_id, user?.role, user?.tenant_id]);

  const openCreateAssignee = () => {
    setEditingAssignee(null);
    setAssigneeForm({ name: '', title: '', email: '' });
    setSelectedCompanyUser(null);
    setAssigneeDialogOpen(true);
    void loadCompanyUsers();
  };

  const openEditAssignee = (a: Assignee) => {
    setEditingAssignee(a);
    setAssigneeForm({
      name: a.name || '',
      title: a.title || '',
      email: a.email || '',
    });
    setSelectedCompanyUser(null);
    setAssigneeDialogOpen(true);
    void (async () => {
      const users = await loadCompanyUsers();
      const byId =
        a.user_id != null
          ? users.find((u) => u.id === Number(a.user_id))
          : null;
      const byEmail = !byId && a.email
        ? users.find((u) => u.email.toLowerCase() === String(a.email).trim().toLowerCase())
        : null;
      setSelectedCompanyUser(byId || byEmail || null);
    })();
  };

  const availableCompanyUsers = useMemo(() => {
    const takenEmails = new Set(
      assignees
        .filter((a) => !editingAssignee || a.id !== editingAssignee.id)
        .map((a) => String(a.email || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const takenNames = new Set(
      assignees
        .filter((a) => !editingAssignee || a.id !== editingAssignee.id)
        .map((a) => String(a.name || '').trim().toLowerCase())
        .filter(Boolean)
    );
    return companyUsers.filter((u) => {
      const email = u.email.toLowerCase();
      const name = u.name.toLowerCase();
      if (email && takenEmails.has(email)) return false;
      if (!email && name && takenNames.has(name)) return false;
      return true;
    });
  }, [assignees, companyUsers, editingAssignee]);

  const applyCompanyUser = (option: CompanyUserOption | null) => {
    setSelectedCompanyUser(option);
    if (!option) return;
    setAssigneeForm({
      name: option.name,
      title: option.title,
      email: option.email,
    });
  };

  const saveAssignee = async () => {
    if (!assigneeForm.name.trim()) {
      showErrorPopup(t('workAssigneeList.errors.nameRequired'), t('workAssigneeList.title'));
      return;
    }
    setSavingAssignee(true);
    try {
      if (editingAssignee) {
        const res = await workAssigneeListService.updateAssignee(editingAssignee.id, {
          name: assigneeForm.name.trim(),
          title: assigneeForm.title.trim() || null,
          email: assigneeForm.email.trim() || null,
          user_id: selectedCompanyUser?.id ?? null,
        });
        if (!res.success) throw new Error(res.message);
      } else {
        const res = await workAssigneeListService.createAssignee({
          name: assigneeForm.name.trim(),
          title: assigneeForm.title.trim() || undefined,
          email: assigneeForm.email.trim() || undefined,
          user_id: selectedCompanyUser?.id,
          company_id: user?.company_id,
        });
        if (!res.success) throw new Error(res.message);
      }
      setAssigneeDialogOpen(false);
      await load();
    } catch (e: any) {
      showErrorPopup(e, t('workAssigneeList.title'));
    } finally {
      setSavingAssignee(false);
    }
  };

  const confirmDeleteAssignee = (a: Assignee) => {
    showConfirm(
      t('workAssigneeList.confirm.deleteAssigneeBody', { name: a.name }),
      () => {
        void (async () => {
          try {
            const res = await workAssigneeListService.deleteAssignee(a.id);
            if (!res.success) throw new Error(res.message);
            await load();
          } catch (e: any) {
            showErrorPopup(e, t('workAssigneeList.title'));
          }
        })();
      },
      {
        title: t('workAssigneeList.confirm.deleteAssigneeTitle'),
        confirmColor: 'error',
      }
    );
  };

  const loadPartners = useCallback(async (): Promise<PartnerOption[]> => {
    const companyId = user?.company_id != null ? Number(user.company_id) : NaN;
    setLoadingPartners(true);
    try {
      const partners = await useReferenceDataStore.getState().fetchPartners();
      const list = (partners || [])
        .filter((p: any) => {
          if (!Number.isInteger(companyId) || companyId <= 0) return true;
          return Number(p.company_id) === companyId;
        })
        .map(toPartnerOption)
        .filter((p: PartnerOption | null): p is PartnerOption => p != null)
        .sort((a: PartnerOption, b: PartnerOption) => a.name.localeCompare(b.name, 'ko'));
      setPartnerOptions(list);
      return list;
    } catch {
      setPartnerOptions([]);
      return [];
    } finally {
      setLoadingPartners(false);
    }
  }, [user?.company_id]);

  const openAddItem = (assigneeId: number) => {
    setItemAssigneeId(assigneeId);
    setEditingItem(null);
    setItemForm({ name: '', note: '', is_highlighted: false });
    setSelectedPartner(null);
    setItemDialogOpen(true);
    void loadPartners();
  };

  const openEditItem = (item: AssigneeItem) => {
    setItemAssigneeId(item.assignee_id);
    setEditingItem(item);
    setItemForm({
      name: item.name || '',
      note: item.note || '',
      is_highlighted: Boolean(item.is_highlighted),
    });
    setSelectedPartner(null);
    setItemDialogOpen(true);
    void (async () => {
      const list = await loadPartners();
      const name = String(item.name || '').trim().toLowerCase();
      if (!name) return;
      setSelectedPartner(list.find((p) => p.name.toLowerCase() === name) || null);
    })();
  };

  const applyPartner = (option: PartnerOption | string | null) => {
    if (option == null) {
      setSelectedPartner(null);
      return;
    }
    if (typeof option === 'string') {
      setSelectedPartner(null);
      setItemForm((f) => ({ ...f, name: option }));
      return;
    }
    setSelectedPartner(option);
    setItemForm((f) => ({ ...f, name: option.name }));
  };

  const assignedClientNames = useMemo(() => {
    const map = new Map<string, { assigneeName: string; itemId: number }>();
    for (const a of assignees) {
      for (const item of a.items || []) {
        const key = String(item.name || '').trim().toLowerCase();
        if (!key) continue;
        map.set(key, { assigneeName: a.name, itemId: item.id });
      }
    }
    return map;
  }, [assignees]);

  const availablePartners = useMemo(() => {
    return partnerOptions.filter((p) => {
      const key = p.name.trim().toLowerCase();
      const taken = assignedClientNames.get(key);
      if (!taken) return true;
      if (editingItem && taken.itemId === editingItem.id) return true;
      return false;
    });
  }, [partnerOptions, assignedClientNames, editingItem]);

  const findClientConflict = (name: string) => {
    const key = name.trim().toLowerCase();
    if (!key) return null;
    const taken = assignedClientNames.get(key);
    if (!taken) return null;
    if (editingItem && taken.itemId === editingItem.id) return null;
    return taken;
  };

  const saveItem = async () => {
    if (!itemForm.name.trim() || itemAssigneeId == null) {
      showErrorPopup(t('workAssigneeList.errors.companyRequired'), t('workAssigneeList.title'));
      return;
    }
    const conflict = findClientConflict(itemForm.name);
    if (conflict) {
      showErrorPopup(
        t('workAssigneeList.errors.companyDuplicate', { name: conflict.assigneeName }),
        t('workAssigneeList.title')
      );
      return;
    }
    setSavingItem(true);
    try {
      if (editingItem) {
        const res = await workAssigneeListService.updateItem(editingItem.id, {
          name: itemForm.name.trim(),
          note: itemForm.note.trim() || null,
          is_highlighted: itemForm.is_highlighted,
          partner_id: selectedPartner?.id ?? null,
        });
        if (!res.success) throw new Error(res.message);
      } else {
        const res = await workAssigneeListService.createItem(itemAssigneeId, {
          name: itemForm.name.trim(),
          note: itemForm.note.trim() || undefined,
          is_highlighted: itemForm.is_highlighted,
          partner_id: selectedPartner?.id,
        });
        if (!res.success) throw new Error(res.message);
      }
      setItemDialogOpen(false);
      await load();
    } catch (e: any) {
      showErrorPopup(e, t('workAssigneeList.title'));
    } finally {
      setSavingItem(false);
    }
  };

  const toggleHighlight = async (item: AssigneeItem) => {
    try {
      const res = await workAssigneeListService.updateItem(item.id, {
        is_highlighted: !item.is_highlighted,
      });
      if (!res.success) throw new Error(res.message);
      setAssignees((prev) =>
        prev.map((a) => ({
          ...a,
          items: (a.items || []).map((i) =>
            i.id === item.id ? { ...i, is_highlighted: !i.is_highlighted } : i
          ),
        }))
      );
    } catch (e: any) {
      showErrorPopup(e, t('workAssigneeList.title'));
    }
  };

  const confirmDeleteItem = (item: AssigneeItem) => {
    showConfirm(
      t('workAssigneeList.confirm.deleteItemBody', { name: item.name }),
      () => {
        void (async () => {
          try {
            const res = await workAssigneeListService.deleteItem(item.id);
            if (!res.success) throw new Error(res.message);
            await load();
          } catch (e: any) {
            showErrorPopup(e, t('workAssigneeList.title'));
          }
        })();
      },
      {
        title: t('workAssigneeList.confirm.deleteItemTitle'),
        confirmColor: 'error',
      }
    );
  };

  const findItemLocation = (itemId: number) => {
    for (const a of assignees) {
      const idx = (a.items || []).findIndex((i) => i.id === itemId);
      if (idx >= 0) return { assigneeId: a.id, index: idx, item: a.items![idx] };
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const itemId = parseItemId(event.active.id);
    if (itemId != null) {
      const loc = findItemLocation(itemId);
      setActiveItem(loc?.item || null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !canEdit) return;
    const activeItemId = parseItemId(active.id);
    if (activeItemId == null) return;

    const overItemId = parseItemId(over.id);
    const overColId = parseColId(over.id) ?? (overItemId != null ? findItemLocation(overItemId)?.assigneeId : null);
    if (overColId == null) return;

    setAssignees((prev) => {
      const from = (() => {
        for (const a of prev) {
          const idx = (a.items || []).findIndex((i) => i.id === activeItemId);
          if (idx >= 0) return { assigneeId: a.id, index: idx };
        }
        return null;
      })();
      if (!from || from.assigneeId === overColId) return prev;

      const next = prev.map((a) => ({ ...a, items: [...(a.items || [])] }));
      const source = next.find((a) => a.id === from.assigneeId);
      const target = next.find((a) => a.id === overColId);
      if (!source || !target) return prev;
      const [moved] = source.items!.splice(from.index, 1);
      if (!moved) return prev;
      moved.assignee_id = overColId;
      let toIndex = target.items!.length;
      if (overItemId != null) {
        const oi = target.items!.findIndex((i) => i.id === overItemId);
        if (oi >= 0) toIndex = oi;
      }
      target.items!.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over || !canEdit) return;

    // 담당자 컬럼 순서
    if (String(active.id).startsWith('assignee-') && String(over.id).startsWith('assignee-')) {
      const activeId = Number(String(active.id).replace('assignee-', ''));
      const overId = Number(String(over.id).replace('assignee-', ''));
      if (activeId === overId) return;
      const oldIndex = assignees.findIndex((a) => a.id === activeId);
      const newIndex = assignees.findIndex((a) => a.id === overId);
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(assignees, oldIndex, newIndex);
      setAssignees(next);
      try {
        const res = await workAssigneeListService.moveAssignee(activeId, newIndex);
        if (!res.success) throw new Error(res.message);
      } catch (e: any) {
        showErrorPopup(e, t('workAssigneeList.title'));
        await load();
      }
      return;
    }

    const itemId = parseItemId(active.id);
    if (itemId == null) return;

    // 같은 컬럼 내 순서 변경
    const overItemId = parseItemId(over.id);
    if (overItemId != null && overItemId !== itemId) {
      setAssignees((prev) => {
        const next = prev.map((a) => ({ ...a, items: [...(a.items || [])] }));
        for (const a of next) {
          const from = a.items!.findIndex((i) => i.id === itemId);
          const to = a.items!.findIndex((i) => i.id === overItemId);
          if (from >= 0 && to >= 0) {
            a.items = arrayMove(a.items!, from, to);
            break;
          }
        }
        return next;
      });
    }

    // state 반영 후 위치 계산을 위해 한 틱 뒤 대신, 위에서 계산한 결과로 즉시 찾기
    const locAfter = (() => {
      // 동기적으로 최신 순서를 계산
      let list = assignees.map((a) => ({ ...a, items: [...(a.items || [])] }));
      if (overItemId != null && overItemId !== itemId) {
        for (const a of list) {
          const from = a.items!.findIndex((i) => i.id === itemId);
          const to = a.items!.findIndex((i) => i.id === overItemId);
          if (from >= 0 && to >= 0) {
            a.items = arrayMove(a.items!, from, to);
            break;
          }
        }
      }
      for (const a of list) {
        const idx = a.items!.findIndex((i) => i.id === itemId);
        if (idx >= 0) return { assigneeId: a.id, index: idx };
      }
      return findItemLocation(itemId);
    })();

    if (!locAfter) {
      await load();
      return;
    }

    try {
      const res = await workAssigneeListService.moveItem(itemId, {
        assignee_id: locAfter.assigneeId,
        index: locAfter.index,
      });
      if (!res.success) throw new Error(res.message);
    } catch (e: any) {
      showErrorPopup(e, t('workAssigneeList.title'));
      await load();
    }
  };

  if (!accessChecked || !canAccessPage) {
    return (
      <Box sx={{ ...mvsPageRootFullBleedSx, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={mvsPageRootFullBleedSx}>
      <DaeheungPageHeader
        title={t('workAssigneeList.title')}
        description={t('workAssigneeList.description')}
        actions={
          canCreate ? (
            <Button
              variant="contained"
              disableElevation
              startIcon={<PersonAddAlt1Icon sx={{ fontSize: 20 }} />}
              onClick={openCreateAssignee}
              sx={{
                flexShrink: 0,
                borderRadius: '8px',
                px: 2.5,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {t('workAssigneeList.actions.addAssignee')}
            </Button>
          ) : undefined
        }
      />

      {!loading && assignees.length > 0 ? (
        <Box
          sx={{
            mb: 2,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(220px, 360px) auto' },
            gap: 1.5,
            alignItems: 'center',
          }}
        >
          <TextField
            size="small"
            fullWidth
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('workAssigneeList.search.boardPlaceholder')}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              ...mvsSearchFieldSx,
              ...mvsFilterFieldHeightSx,
            }}
          />
          {searchTerm.trim() ? (
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {t('workAssigneeList.search.boardResult', {
                count: filteredAssignees.reduce((n, a) => n + (a.items?.length || 0), 0),
                columns: filteredAssignees.length,
              })}
            </Typography>
          ) : null}
        </Box>
      ) : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : assignees.length === 0 ? (
        <Box
          sx={{
            py: 6,
            px: 3,
            textAlign: 'center',
            borderRadius: '8px',
            border: '1px dashed #CBD5E1',
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
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
              color: 'primary.main',
            }}
          >
            <AssignmentIndOutlinedIcon sx={{ fontSize: '1.75rem' }} />
          </Box>
          <Typography color="text.secondary" sx={{ fontSize: '0.9375rem', lineHeight: 1.65, mb: 2.5 }}>
            {t('workAssigneeList.empty')}
          </Typography>
          {canCreate && (
            <Button
              variant="contained"
              disableElevation
              startIcon={<PersonAddAlt1Icon />}
              onClick={openCreateAssignee}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 2.5 }}
            >
              {t('workAssigneeList.actions.addAssignee')}
            </Button>
          )}
        </Box>
      ) : filteredAssignees.length === 0 ? (
        <Box
          sx={{
            py: 5,
            px: 3,
            textAlign: 'center',
            borderRadius: '8px',
            border: '1px dashed #CBD5E1',
            bgcolor: 'transparent',
          }}
        >
          <Typography color="text.secondary" sx={{ fontSize: '0.9375rem', lineHeight: 1.65 }}>
            {t('workAssigneeList.search.noBoardResults')}
          </Typography>
        </Box>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredAssignees.map((a) => `assignee-${a.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            <Box
              sx={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: { xs: 1.5, sm: 1.75 },
                alignItems: 'stretch',
              }}
            >
              {filteredAssignees.map((assignee) => (
                <AssigneeColumn
                  key={assignee.id}
                  assignee={assignee}
                  canEdit={canEdit}
                  canCreate={canCreate}
                  canDelete={canDelete}
                  onEditAssignee={openEditAssignee}
                  onDeleteAssignee={confirmDeleteAssignee}
                  onAddItem={openAddItem}
                  onEditItem={openEditItem}
                  onToggleHighlight={toggleHighlight}
                  onDeleteItem={confirmDeleteItem}
                />
              ))}
            </Box>
          </SortableContext>
          <DragOverlay>
            {activeItem ? (
              <Box
                sx={{
                  maxWidth: 260,
                  minHeight: 40,
                  display: 'flex',
                  alignItems: 'center',
                  px: 1.25,
                  borderRadius: '8px',
                  border: '1px solid rgba(15, 23, 42, 0.12)',
                  bgcolor: activeItem.is_highlighted ? alpha(HIGHLIGHT_RED, 0.12) : '#fff',
                  color: activeItem.is_highlighted ? HIGHLIGHT_RED : 'text.primary',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {activeItem.name}
              </Box>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      <Dialog open={assigneeDialogOpen} onClose={() => setAssigneeDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {editingAssignee
            ? t('workAssigneeList.dialog.editAssignee')
            : t('workAssigneeList.dialog.addAssignee')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              options={availableCompanyUsers}
              loading={loadingCompanyUsers}
              value={selectedCompanyUser}
              onChange={(_, value) => applyCompanyUser(value)}
              getOptionLabel={(option) => option.label}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              filterOptions={(options, state) => {
                const q = state.inputValue.trim().toLowerCase();
                if (!q) return options;
                return options.filter(
                  (o) =>
                    o.name.toLowerCase().includes(q) ||
                    o.title.toLowerCase().includes(q) ||
                    o.email.toLowerCase().includes(q) ||
                    o.label.toLowerCase().includes(q)
                );
              }}
              noOptionsText={
                loadingCompanyUsers
                  ? t('common.loading')
                  : t('workAssigneeList.search.noUsers')
              }
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {option.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[option.title, option.email].filter(Boolean).join(' · ') || '—'}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('workAssigneeList.search.userLabel')}
                  placeholder={t('workAssigneeList.search.userPlaceholder')}
                  helperText={t('workAssigneeList.search.userHint')}
                  autoFocus={!editingAssignee}
                />
              )}
            />
            <TextField
              label={t('workAssigneeList.fields.name')}
              value={assigneeForm.name}
              onChange={(e) => {
                setSelectedCompanyUser(null);
                setAssigneeForm((f) => ({ ...f, name: e.target.value }));
              }}
              required
              fullWidth
              autoFocus={Boolean(editingAssignee)}
            />
            <TextField
              label={t('workAssigneeList.fields.title')}
              value={assigneeForm.title}
              onChange={(e) => {
                setSelectedCompanyUser(null);
                setAssigneeForm((f) => ({ ...f, title: e.target.value }));
              }}
              fullWidth
            />
            <TextField
              label={t('workAssigneeList.fields.email')}
              value={assigneeForm.email}
              onChange={(e) => {
                setSelectedCompanyUser(null);
                setAssigneeForm((f) => ({ ...f, email: e.target.value }));
              }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssigneeDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveAssignee} disabled={savingAssignee}>
            {savingAssignee ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={itemDialogOpen} onClose={() => setItemDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {editingItem ? t('workAssigneeList.dialog.editCompany') : t('workAssigneeList.dialog.addCompany')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Autocomplete
              freeSolo
              options={availablePartners}
              loading={loadingPartners}
              value={selectedPartner}
              inputValue={itemForm.name}
              onChange={(_, value) => applyPartner(value)}
              onInputChange={(_, value, reason) => {
                if (reason === 'input' || reason === 'clear') {
                  setSelectedPartner(null);
                  setItemForm((f) => ({ ...f, name: value }));
                }
              }}
              getOptionLabel={(option) =>
                typeof option === 'string' ? option : option.name
              }
              isOptionEqualToValue={(a, b) => a.id === b.id}
              filterOptions={(options, state) => {
                const q = state.inputValue.trim().toLowerCase();
                if (!q) return options;
                return options.filter(
                  (o) =>
                    o.name.toLowerCase().includes(q) ||
                    o.businessType.toLowerCase().includes(q) ||
                    o.label.toLowerCase().includes(q)
                );
              }}
              noOptionsText={
                loadingPartners
                  ? t('common.loading')
                  : t('workAssigneeList.search.noPartners')
              }
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {option.name}
                    </Typography>
                    {option.businessType ? (
                      <Typography variant="caption" color="text.secondary">
                        {option.businessType}
                      </Typography>
                    ) : null}
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('workAssigneeList.fields.companyName')}
                  placeholder={t('workAssigneeList.search.partnerPlaceholder')}
                  helperText={t('workAssigneeList.search.partnerHint')}
                  required
                  autoFocus
                />
              )}
            />
            <TextField
              label={t('workAssigneeList.fields.note')}
              value={itemForm.note}
              onChange={(e) => setItemForm((f) => ({ ...f, note: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <Button
              variant={itemForm.is_highlighted ? 'contained' : 'outlined'}
              color="error"
              onClick={() => setItemForm((f) => ({ ...f, is_highlighted: !f.is_highlighted }))}
              sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
            >
              {itemForm.is_highlighted
                ? t('workAssigneeList.actions.highlightedOn')
                : t('workAssigneeList.actions.highlightedOff')}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={saveItem} disabled={savingItem}>
            {savingItem ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        message={dialogState.message}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Box>
  );
};

export default WorkAssigneeListPage;
