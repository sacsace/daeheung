import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Avatar,
  Tooltip,
  Alert,
  Snackbar,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsKpiCardSx,
  mvsBodyCardSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyListZoneSx,
  mvsBodyListTableSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsTableScrollSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
} from '../../theme/daeheungLayout';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CalendarToday as CalendarIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  Close as CloseIcon,
  VisibilityOutlined as VisibilityOutlinedIcon,
  Save as SaveIcon,
  CategoryOutlined as CategoryOutlinedIcon,
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import { api } from '../../services/api';
import { useMenuStore } from '../../store';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { downloadUploadFile, fetchUploadObjectUrl } from '../../utils/uploadUrl';

interface Contract {
  id: number;
  customer_id: number | null;
  customer_name?: string;
  contract_number: string;
  title: string;
  description?: string;
  contract_type?: string;
  contract_value: number;
  start_date: string;
  end_date: string;
  status: string;
  attachments?: string[];
  created_at: string;
  updated_at: string;
}

interface ContractTypeItem {
  id: number;
  code: string;
  name: string;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
}

interface Customer {
  id: number;
  name: string;
  business_number?: string;
  ceo_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  industry?: string;
}

/** DB `menus.route` — `App.tsx`의 `/customers/contracts` */
const CONTRACT_MENU_ROUTES = ['/customers/contracts', '/sales', '/customers'];

function normalizeCustomerMatchKey(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\bprivate\s+limited\b\.?/g, '')
    .replace(/\bpvt\.?\s*ltd\.?\b/g, '')
    .replace(/[,\s]+$/g, '')
    .trim();
}

function findCustomerByName(customers: Customer[], rawName: string): Customer | null {
  const key = normalizeCustomerMatchKey(rawName);
  if (!key) return null;
  const exact = customers.find((c) => normalizeCustomerMatchKey(c.name) === key);
  if (exact) return exact;
  const starts = customers.filter((c) => normalizeCustomerMatchKey(c.name).startsWith(key));
  if (starts.length === 1) return starts[0];
  const includes = customers.filter((c) => {
    const n = normalizeCustomerMatchKey(c.name);
    return n.includes(key) || key.includes(n);
  });
  return includes.length === 1 ? includes[0] : null;
}

/** HTML date input(YYYY-MM-DD)용 — ISO/타임존 문자열에서도 날짜만 추출 */
function toDateInputValue(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toContractUploadPath(filePath: string): string {
  const raw = String(filePath || '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  if (raw.startsWith('/uploads/')) return raw;
  if (raw.startsWith('uploads/')) return `/${raw}`;
  return `/uploads/${raw.replace(/^\/+/, '')}`;
}

function attachmentFileName(filePath: string): string {
  const parts = String(filePath || '').replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || filePath;
}

function isPreviewableAttachment(filePath: string): boolean {
  const name = attachmentFileName(filePath).toLowerCase();
  return /\.(pdf|png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

const ContractManagement: React.FC = () => {
  const theme = useTheme();
  const { language, loading: menusLoading } = useMenuStore();
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const txt = useCallback((ko: string, en: string) => (language === 'en' ? en : ko), [language]);
  const dateLocale = language === 'en' ? 'en-US' : 'ko-KR';
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contractTypes, setContractTypes] = useState<ContractTypeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [contractTypeFilter, setContractTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'view'>('create');
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typeDraftName, setTypeDraftName] = useState('');
  const [typeDraftCode, setTypeDraftCode] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editingTypeCode, setEditingTypeCode] = useState('');
  const [editingTypeName, setEditingTypeName] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // 폼 데이터
  const [formData, setFormData] = useState({
    customer_id: '',
    contract_number: '',
    title: '',
    description: '',
    contract_value: '',
    contract_type: 'sales',
    start_date: '',
    end_date: '',
    status: 'active',
    attachments: [] as string[]
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [attachmentPreview, setAttachmentPreview] = useState<{
    url: string;
    label: string;
    kind: 'pdf' | 'image' | 'other';
    path: string;
  } | null>(null);
  const [attachmentBusyPath, setAttachmentBusyPath] = useState<string | null>(null);

  const menuFlags = useMenuRoutePermissionFlags(CONTRACT_MENU_ROUTES);

  const loadContracts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/contracts');
      const rows = (response.data.data || []).map((row: any) => ({
        ...row,
        contract_type: row.contract_type || 'sales',
        contract_value: Number(row.contract_value ?? row.value ?? 0),
        attachments: Array.isArray(row.attachments) ? row.attachments : []
      }));
      setContracts(rows);
    } catch (error) {
      showSnackbar(txt('계약 목록을 불러오는 중 오류가 발생했습니다.', 'Failed to load contracts.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [txt]);

  const loadCustomers = useCallback(async () => {
    try {
      const response = await api.get('/customers');
      const rows = (response.data.data || []).filter((customer: any) => {
        if (customer?.source_type && customer.source_type !== 'customer') return false;
        if (typeof customer?.id === 'number' && customer.id >= 1000000000) return false;
        return true;
      });
      setCustomers(rows);
    } catch {
      /* ignore */
    }
  }, []);

  const loadContractTypes = useCallback(async () => {
    try {
      setTypesLoading(true);
      const response = await api.get('/contracts/types');
      const rows: ContractTypeItem[] = Array.isArray(response.data?.data) ? response.data.data : [];
      setContractTypes(rows);
      setFormData((prev) => {
        if (rows.some((r) => r.code === prev.contract_type)) return prev;
        const fallback = rows[0]?.code || 'sales';
        return { ...prev, contract_type: fallback };
      });
    } catch {
      showSnackbar(
        txt('계약 구분을 불러오는 중 오류가 발생했습니다.', 'Failed to load contract types.'),
        'error'
      );
    } finally {
      setTypesLoading(false);
    }
  }, [txt]);

  useEffect(() => {
    if (menusLoading) return;
    void loadContracts();
    void loadCustomers();
    void loadContractTypes();
  }, [menusLoading, loadContracts, loadCustomers, loadContractTypes]);

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const openTypeDialog = () => {
    setTypeDialogOpen(true);
    setTypeDraftName('');
    setTypeDraftCode('');
    setEditingTypeId(null);
    setEditingTypeName('');
    setEditingTypeCode('');
    void loadContractTypes();
  };

  const handleCreateContractType = async () => {
    const name = typeDraftName.trim();
    if (!name) return;
    const code = typeDraftCode.trim();
    try {
      setTypesLoading(true);
      const res = await api.post('/contracts/types', {
        name,
        ...(code ? { code } : {}),
      });
      if (res.data?.success === false) {
        showSnackbar(
          res.data?.message || txt('계약 구분 등록에 실패했습니다.', 'Failed to create contract type.'),
          'error'
        );
        return;
      }
      setTypeDraftName('');
      setTypeDraftCode('');
      showSnackbar(txt('계약 구분이 등록되었습니다.', 'Contract type created.'), 'success');
      await loadContractTypes();
    } catch (err: any) {
      showSnackbar(
        err?.response?.data?.message ||
          txt('계약 구분 등록에 실패했습니다.', 'Failed to create contract type.'),
        'error'
      );
    } finally {
      setTypesLoading(false);
    }
  };

  const handleUpdateContractType = async (id: number, isSystem: boolean) => {
    const name = editingTypeName.trim();
    if (!name) return;
    const code = editingTypeCode.trim();
    if (!isSystem && !code) {
      showSnackbar(txt('코드를 입력하세요.', 'Enter a code.'), 'error');
      return;
    }
    try {
      setTypesLoading(true);
      const res = await api.put(`/contracts/types/${id}`, {
        name,
        ...(isSystem ? {} : { code }),
      });
      if (res.data?.success === false) {
        showSnackbar(
          res.data?.message || txt('계약 구분 수정에 실패했습니다.', 'Failed to update contract type.'),
          'error'
        );
        return;
      }
      setEditingTypeId(null);
      setEditingTypeName('');
      setEditingTypeCode('');
      showSnackbar(txt('계약 구분이 수정되었습니다.', 'Contract type updated.'), 'success');
      await loadContractTypes();
    } catch (err: any) {
      showSnackbar(
        err?.response?.data?.message ||
          txt('계약 구분 수정에 실패했습니다.', 'Failed to update contract type.'),
        'error'
      );
    } finally {
      setTypesLoading(false);
    }
  };

  const handleDeleteContractType = (row: ContractTypeItem) => {
    if (row.is_system) {
      showSnackbar(
        txt('기본 구분은 삭제할 수 없습니다. 이름만 수정하세요.', 'Default types cannot be deleted. Rename only.'),
        'error'
      );
      return;
    }
    showConfirm(
      txt(
        `"${row.name}" 구분을 삭제하시겠습니까? (비활성화됩니다)`,
        `Delete type "${row.name}"? (It will be deactivated.)`
      ),
      () => {
        void (async () => {
          try {
            setTypesLoading(true);
            const res = await api.delete(`/contracts/types/${row.id}`);
            if (res.data?.success === false) {
              showSnackbar(
                res.data?.message ||
                  txt('계약 구분 삭제에 실패했습니다.', 'Failed to delete contract type.'),
                'error'
              );
              return;
            }
            setContractTypes((prev) => prev.filter((item) => item.id !== row.id));
            showSnackbar(txt('계약 구분이 삭제되었습니다.', 'Contract type deleted.'), 'success');
            await loadContractTypes();
          } catch (err: any) {
            showSnackbar(
              err?.response?.data?.message ||
                txt('계약 구분 삭제에 실패했습니다.', 'Failed to delete contract type.'),
              'error'
            );
          } finally {
            setTypesLoading(false);
          }
        })();
      },
      { title: txt('계약 구분 삭제', 'Delete contract type') }
    );
  };

  const closeAttachmentPreview = useCallback(() => {
    setAttachmentPreview((prev) => {
      if (prev?.url.startsWith('blob:')) {
        URL.revokeObjectURL(prev.url);
      }
      return null;
    });
  }, []);

  const openAttachmentPreview = useCallback(
    async (filePath: string) => {
      const uploadPath = toContractUploadPath(filePath);
      const label = attachmentFileName(filePath);
      if (!uploadPath) return;
      setAttachmentBusyPath(filePath);
      try {
        const lower = label.toLowerCase();
        const isPdf = lower.endsWith('.pdf');
        const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(lower);
        const objectUrl = await fetchUploadObjectUrl(
          uploadPath,
          isPdf ? { forceMime: 'application/pdf' } : undefined
        );
        setAttachmentPreview({
          url: objectUrl,
          label,
          kind: isPdf ? 'pdf' : isImage ? 'image' : 'other',
          path: uploadPath,
        });
      } catch {
        showSnackbar(
          txt('첨부파일을 열 수 없습니다.', 'Unable to open the attachment.'),
          'error'
        );
      } finally {
        setAttachmentBusyPath(null);
      }
    },
    [txt]
  );

  const handleDownloadAttachment = useCallback(
    async (filePath: string) => {
      const uploadPath = toContractUploadPath(filePath);
      const label = attachmentFileName(filePath);
      if (!uploadPath) return;
      setAttachmentBusyPath(filePath);
      try {
        await downloadUploadFile(uploadPath, label);
      } catch {
        showSnackbar(
          txt('첨부파일 다운로드에 실패했습니다.', 'Failed to download the attachment.'),
          'error'
        );
      } finally {
        setAttachmentBusyPath(null);
      }
    },
    [txt]
  );

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleStatusFilter = (event: any) => {
    setStatusFilter(event.target.value);
  };

  const handleDateFilter = (event: any) => {
    setDateFilter(event.target.value);
  };

  const handleContractTypeFilter = (event: any) => {
    setContractTypeFilter(event.target.value);
  };

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id.toString() === String(formData.customer_id)) || null,
    [customers, formData.customer_id]
  );

  const customerNameById = useMemo(() => {
    const map = new Map<number, string>();
    customers.forEach((c) => {
      if (c?.id != null) map.set(Number(c.id), String(c.name || ''));
    });
    return map;
  }, [customers]);

  const resolveContractCustomerName = useCallback(
    (contract: Contract): string => {
      const fromApi = String(contract.customer_name || '').trim();
      if (fromApi) return fromApi;
      if (contract.customer_id != null) {
        return customerNameById.get(Number(contract.customer_id)) || '';
      }
      return '';
    },
    [customerNameById]
  );

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contract.contract_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resolveContractCustomerName(contract).toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contract.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    const matchesType = contractTypeFilter === 'all' || (contract.contract_type || 'sales') === contractTypeFilter;
    
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const now = new Date();
      const startDate = new Date(contract.start_date);
      const endDate = new Date(contract.end_date);
      
      switch (dateFilter) {
        case 'active':
          matchesDate = startDate <= now && endDate >= now;
          break;
        case 'expired':
          matchesDate = endDate < now;
          break;
        case 'upcoming':
          matchesDate = startDate > now;
          break;
        case 'expiring_soon':
          const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          matchesDate = endDate <= thirtyDaysFromNow && endDate >= now;
          break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });

  const applyCustomerToForm = useCallback(
    (customer: Customer | null, nextTitle?: string) => {
      setFormData((prev) => ({
        ...prev,
        title: nextTitle !== undefined ? nextTitle : prev.title,
        customer_id: customer ? customer.id.toString() : '',
      }));
    },
    []
  );

  const handleContractTitleInput = useCallback(
    (rawTitle: string) => {
      const matched = findCustomerByName(customers, rawTitle);
      setFormData((prev) => ({
        ...prev,
        title: rawTitle,
        // 계약명으로 고객이 확정되면 자동 연결. 매칭이 없으면 기존 선택을 유지(수동 선택 가능).
        customer_id: matched ? matched.id.toString() : prev.customer_id,
      }));
    },
    [customers]
  );

  const handleCustomerSelect = useCallback(
    (customerId: string) => {
      const customer = customers.find((c) => c.id.toString() === customerId) || null;
      setFormData((prev) => {
        const prevCustomer = customers.find((c) => c.id.toString() === String(prev.customer_id));
        const titleLooksLikePrevCustomer =
          !prev.title.trim() ||
          (!!prevCustomer &&
            normalizeCustomerMatchKey(prev.title) === normalizeCustomerMatchKey(prevCustomer.name));
        return {
          ...prev,
          customer_id: customerId,
          title:
            customer && titleLooksLikePrevCustomer
              ? customer.name
              : prev.title,
        };
      });
    },
    [customers]
  );

  const handleCreateContract = () => {
    if (!menuFlags.canCreate) {
      showSnackbar(
        txt('계약을 등록할 권한이 없습니다.', 'You do not have permission to register contracts.'),
        'error'
      );
      return;
    }
    setFormData({
      customer_id: '',
      contract_number: '',
      title: '',
      description: '',
      contract_value: '',
      contract_type: contractTypes[0]?.code || 'sales',
      start_date: '',
      end_date: '',
      status: 'active',
      attachments: []
    });
    setSelectedFiles([]);
    setDialogMode('create');
    setDialogOpen(true);
  };

  const handleEditContract = (contract: Contract) => {
    if (!menuFlags.canEdit) {
      showSnackbar(txt('계약을 수정할 권한이 없습니다.', 'You do not have permission to edit contracts.'), 'error');
      return;
    }
    setFormData({
      customer_id: contract.customer_id ? contract.customer_id.toString() : '',
      contract_number: contract.contract_number,
      title: contract.title,
      description: contract.description || '',
      contract_value: contract.contract_value.toString(),
      contract_type: contract.contract_type || 'sales',
      start_date: toDateInputValue(contract.start_date),
      end_date: toDateInputValue(contract.end_date),
      status: contract.status,
      attachments: Array.isArray(contract.attachments) ? contract.attachments : []
    });
    setSelectedFiles([]);
    setSelectedContract(contract);
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const handleViewContract = (contract: Contract) => {
    if (!menuFlags.canRead) {
      showSnackbar(txt('계약을 조회할 권한이 없습니다.', 'You do not have permission to view contracts.'), 'error');
      return;
    }
    setFormData({
      customer_id: contract.customer_id ? contract.customer_id.toString() : '',
      contract_number: contract.contract_number,
      title: contract.title,
      description: contract.description || '',
      contract_value: contract.contract_value.toString(),
      contract_type: contract.contract_type || 'sales',
      start_date: toDateInputValue(contract.start_date),
      end_date: toDateInputValue(contract.end_date),
      status: contract.status,
      attachments: Array.isArray(contract.attachments) ? contract.attachments : []
    });
    setSelectedFiles([]);
    setSelectedContract(contract);
    setDialogMode('view');
    setDialogOpen(true);
  };

  const handleSaveContract = async () => {
    if (dialogMode === 'create' && !menuFlags.canCreate) {
      showSnackbar(
        txt('계약을 등록할 권한이 없습니다.', 'You do not have permission to register contracts.'),
        'error'
      );
      return;
    }
    if (dialogMode === 'edit' && !menuFlags.canEdit) {
      showSnackbar(txt('계약을 수정할 권한이 없습니다.', 'You do not have permission to edit contracts.'), 'error');
      return;
    }
    try {
      const data = {
        ...formData,
        customer_id: formData.customer_id ? parseInt(formData.customer_id, 10) : null,
        contract_value: parseFloat(formData.contract_value),
        attachments: formData.attachments
      };

      if (dialogMode === 'create') {
        const createResponse = await api.post('/contracts', data);
        const createdContractId = createResponse.data?.data?.id;
        if (createdContractId && selectedFiles.length > 0) {
          const form = new FormData();
          selectedFiles.forEach((file) => form.append('files', file));
          await api.post(`/contracts/${createdContractId}/upload-files`, form, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
        showSnackbar(txt('계약이 성공적으로 등록되었습니다.', 'Contract created.'), 'success');
      } else if (dialogMode === 'edit' && selectedContract) {
        await api.put(`/contracts/${selectedContract.id}`, data);
        if (selectedFiles.length > 0) {
          const form = new FormData();
          selectedFiles.forEach((file) => form.append('files', file));
          await api.post(`/contracts/${selectedContract.id}/upload-files`, form, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
        showSnackbar(txt('계약이 성공적으로 수정되었습니다.', 'Contract updated.'), 'success');
      }
      
      setDialogOpen(false);
      setSelectedFiles([]);
      setSelectedContract(null);
      await loadContracts();
    } catch (error) {
      showSnackbar(txt('계약 저장 중 오류가 발생했습니다.', 'Failed to save contract.'), 'error');
    }
  };

  const handleDeleteContract = (contract: Contract) => {
    if (!menuFlags.canDelete) {
      showSnackbar(txt('계약을 삭제할 권한이 없습니다.', 'You do not have permission to delete contracts.'), 'error');
      return;
    }
    showConfirm(
      txt(`'${contract.title}' 계약을 삭제하시겠습니까?`, `Delete contract '${contract.title}'?`),
      () => {
        void (async () => {
          try {
            await api.delete(`/contracts/${contract.id}`);
            setContracts((prev) => prev.filter((row) => row.id !== contract.id));
            if (selectedContract?.id === contract.id) {
              setDialogOpen(false);
              setSelectedContract(null);
            }
            showSnackbar(txt('계약이 성공적으로 삭제되었습니다.', 'Contract deleted.'), 'success');
            await loadContracts();
          } catch (error) {
            showSnackbar(txt('계약 삭제 중 오류가 발생했습니다.', 'Failed to delete contract.'), 'error');
          }
        })();
      },
      {
        title: txt('삭제 확인', 'Confirm delete'),
        confirmColor: 'error',
        confirmText: txt('삭제', 'Delete'),
        cancelText: txt('취소', 'Cancel')
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'expired': return 'error';
      case 'suspended': return 'warning';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return txt('활성', 'Active');
      case 'inactive':
        return txt('비활성', 'Inactive');
      case 'expired':
        return txt('만료', 'Expired');
      case 'suspended':
        return txt('정지', 'Suspended');
      default:
        return status;
    }
  };

  const getContractStatus = (contract: Contract) => {
    const now = new Date();
    const startDate = new Date(contract.start_date);
    const endDate = new Date(contract.end_date);

    if (endDate < now) return { status: 'expired', text: txt('만료됨', 'Expired'), color: 'error' };
    if (startDate > now) return { status: 'upcoming', text: txt('시작 예정', 'Upcoming'), color: 'info' };

    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (endDate <= thirtyDaysFromNow)
      return { status: 'expiring_soon', text: txt('만료 임박', 'Expiring soon'), color: 'warning' };

    return { status: 'active', text: txt('진행중', 'In progress'), color: 'success' };
  };

  const contractTypeLabel = (type?: string) => {
    const code = type || 'sales';
    const found = contractTypes.find((row) => row.code === code);
    if (found) return found.name;
    if (code === 'sales') return txt('매출 계약', 'Sales contract');
    if (code === 'purchase_lease') return txt('매입(구매/임대)', 'Purchase / lease');
    return code;
  };

  const selectedContractTypeCode =
    contractTypes.find((row) => row.code === formData.contract_type)?.code ||
    contractTypes[0]?.code ||
    '';

  const getTotalValue = () => {
    return contracts
      .filter(contract => contract.status === 'active')
      .reduce((sum, contract) => sum + contract.contract_value, 0);
  };

  const getActiveContracts = () => {
    return contracts.filter(contract => {
      const now = new Date();
      const startDate = new Date(contract.start_date);
      const endDate = new Date(contract.end_date);
      return startDate <= now && endDate >= now;
    }).length;
  };

  const getExpiringSoonContracts = () => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return contracts.filter(contract => {
      const endDate = new Date(contract.end_date);
      return endDate <= thirtyDaysFromNow && endDate >= now;
    }).length;
  };

  const softChipSx = (tone: 'default' | 'info' | 'warning' | 'success' | 'error' | 'primary' | 'secondary') => {
    const light = theme.palette.mode === 'light';
    if (tone === 'default') {
      return {
        height: 26,
        borderRadius: '8px',
        fontWeight: 600,
        fontSize: '0.6875rem',
        border: `1px solid ${light ? 'rgba(15, 23, 42, 0.12)' : theme.palette.divider}`,
        bgcolor: light ? 'rgba(0, 0, 0, 0.02)' : alpha(theme.palette.common.white, 0.06),
        color: 'text.secondary',
      } as const;
    }
    const main =
      tone === 'primary'
        ? theme.palette.primary.main
        : tone === 'secondary'
          ? theme.palette.secondary.main
          : theme.palette[tone].main;
    const dark =
      tone === 'primary'
        ? theme.palette.primary.dark
        : tone === 'secondary'
          ? theme.palette.secondary.dark
          : theme.palette[tone].dark;
    return {
      height: 26,
      borderRadius: '8px',
      fontWeight: 600,
      fontSize: '0.6875rem',
      border: `1px solid ${alpha(main, light ? 0.3 : 0.42)}`,
      bgcolor: alpha(main, light ? 0.08 : 0.12),
      color: dark,
    } as const;
  };

  const lifecycleChipSx = (color: string) => {
    if (color === 'success') return softChipSx('success');
    if (color === 'warning') return softChipSx('warning');
    if (color === 'error') return softChipSx('error');
    if (color === 'info') return softChipSx('info');
    return softChipSx('default');
  };

  const contractFilterFieldSx = {
    ...mvsSearchFieldSx,
    ...mvsFilterFieldHeightSx,
  } as const;

  /** 계약 등록·수정 다이얼로그 — 입력 필 톤 + 아웃라인 라벨 잘림 방지 */
  const contractDialogFormSx = {
    color: 'text.primary',
    overflow: 'visible',
    alignItems: 'flex-start',
    '& > .MuiGrid-root': {
      overflow: 'visible',
    },
    '& .MuiFormControl-root': {
      overflow: 'visible',
      width: '100%',
    },
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      minHeight: 56,
      bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.1 : 0.05),
      transition: theme.transitions.create(['background-color', 'box-shadow'], { duration: 150 }),
      '&:hover': {
        bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.14 : 0.08),
      },
      '&.Mui-focused': {
        bgcolor: 'background.paper',
        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
      },
      '& fieldset': {
        borderColor: alpha(theme.palette.divider, 0.9),
      },
      '&.Mui-disabled': {
        bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.06 : 0.04),
      },
      '&.MuiInputBase-multiline': {
        minHeight: 'auto',
      },
    },
    '& .MuiOutlinedInput-input::placeholder': {
      color: theme.palette.text.secondary,
      opacity: 1,
    },
    '& .MuiInputLabel-root': {
      fontSize: '0.875rem',
      lineHeight: 1.25,
      maxWidth: 'calc(100% - 24px)',
      '&.MuiInputLabel-shrink': {
        transform: 'translate(14px, -9px) scale(0.85)',
        backgroundColor: theme.palette.background.paper,
        px: 0.5,
      },
    },
    '& .MuiFormHelperText-root': {
      mt: 0.75,
      mx: 0,
      fontSize: '0.875rem',
      lineHeight: 1.45,
      letterSpacing: '-0.01em',
      color: 'text.secondary',
    },
  };

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title={txt('계약 관리', 'Contract management')}
        actions={
          <>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon sx={{ fontSize: 18 }} />}
            onClick={() => {
              void loadContracts();
              void loadContractTypes();
            }}
            disabled={loading || menusLoading || !menuFlags.canRead}
            sx={mvsBodyOutlinedBtnSx}
          >
            {txt('새로고침', 'Refresh')}
          </Button>
          <Button
            variant="outlined"
            startIcon={<CategoryOutlinedIcon sx={{ fontSize: 18 }} />}
            onClick={openTypeDialog}
            disabled={menusLoading || !menuFlags.canRead}
            sx={mvsBodyOutlinedBtnSx}
          >
            {txt('계약 구분', 'Contract types')}
          </Button>
          <Tooltip
            title={
              !menuFlags.canCreate && !menusLoading
                ? txt('등록 권한이 없습니다.', 'No permission to create.')
                : ''
            }
          >
            <span>
              <Button
                variant="contained"
                color="primary"
                disableElevation
                startIcon={<AddIcon sx={{ fontSize: 20 }} />}
                onClick={handleCreateContract}
                disabled={menusLoading || !menuFlags.canCreate}
                sx={mvsBodyPrimaryBtnSx}
              >
                {txt('계약 등록', 'Register contract')}
              </Button>
            </span>
          </Tooltip>
          </>
        }
      />

      {/* 통계 카드 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.02em' }}>
                {txt('총 계약 수', 'Total contracts')}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}>
                {contracts.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.02em' }}>
                {txt('진행중 계약', 'In progress')}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 600, letterSpacing: '-0.02em', color: 'success.dark' }}>
                {getActiveContracts()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.02em' }}>
                {txt('만료 임박', 'Expiring soon')}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 600, letterSpacing: '-0.02em', color: 'warning.dark' }}>
                {getExpiringSoonContracts()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card elevation={0} sx={mvsKpiCardSx}>
            <CardContent sx={{ py: 2.25, px: 2.5, '&:last-child': { pb: 2.25 } }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.02em' }}>
                {txt('총 계약 가치', 'Total contract value')}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 600, letterSpacing: '-0.02em', color: 'text.primary' }}>
                Rs. {getTotalValue().toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 필터 및 검색 */}
      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 2,
            bgcolor: '#FFFFFF',
            ...contractFilterFieldSx,
          }}
        >
          <Grid container spacing={2} alignItems="flex-end">
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                size="small"
                label={txt('검색', 'Search')}
                placeholder={txt(
                  '계약명, 고객명으로 검색...',
                  'Search by title or customer…'
                )}
                value={searchTerm}
                onChange={handleSearch}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={contractFilterFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth size="small" sx={contractFilterFieldSx}>
                <InputLabel shrink>{txt('상태', 'Status')}</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={handleStatusFilter}
                  label={txt('상태', 'Status')}
                >
                  <MenuItem value="all">{txt('전체', 'All')}</MenuItem>
                  <MenuItem value="active">{txt('활성', 'Active')}</MenuItem>
                  <MenuItem value="inactive">{txt('비활성', 'Inactive')}</MenuItem>
                  <MenuItem value="expired">{txt('만료', 'Expired')}</MenuItem>
                  <MenuItem value="suspended">{txt('정지', 'Suspended')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth size="small" sx={contractFilterFieldSx}>
                <InputLabel shrink>{txt('계약 구분', 'Contract type')}</InputLabel>
                <Select
                  value={contractTypeFilter}
                  onChange={handleContractTypeFilter}
                  label={txt('계약 구분', 'Contract type')}
                >
                  <MenuItem value="all">{txt('전체', 'All')}</MenuItem>
                  {contractTypes.map((row) => (
                    <MenuItem key={row.id} value={row.code}>
                      {row.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <FormControl fullWidth size="small" sx={contractFilterFieldSx}>
                <InputLabel shrink>{txt('기간', 'Period')}</InputLabel>
                <Select
                  value={dateFilter}
                  onChange={handleDateFilter}
                  label={txt('기간', 'Period')}
                >
                  <MenuItem value="all">{txt('전체', 'All')}</MenuItem>
                  <MenuItem value="active">{txt('진행중', 'In progress')}</MenuItem>
                  <MenuItem value="expired">{txt('만료됨', 'Ended')}</MenuItem>
                  <MenuItem value="upcoming">{txt('시작 예정', 'Upcoming')}</MenuItem>
                  <MenuItem value="expiring_soon">{txt('만료 임박', 'Expiring soon')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      </Card>

      {/* 계약 목록 테이블 */}
      <Box sx={mvsBodyListZoneSx}>
        <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
          <Table
            size="small"
            sx={{
              borderCollapse: 'collapse',
              bgcolor: 'transparent',
              '& .MuiTableCell-root': {
                borderLeft: 'none',
                borderRight: 'none',
                borderTop: 'none',
              },
            }}
          >
            <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  <TableCell>{txt('계약명', 'Title')}</TableCell>
                  <TableCell>{txt('고객', 'Customer')}</TableCell>
                  <TableCell>{txt('계약 구분', 'Type')}</TableCell>
                  <TableCell>{txt('계약 가치', 'Value')}</TableCell>
                  <TableCell>{txt('계약 기간', 'Period')}</TableCell>
                  <TableCell>{txt('계약 상태', 'Lifecycle')}</TableCell>
                  <TableCell>{txt('상태', 'Status')}</TableCell>
                  <TableCell>{txt('등록일', 'Created')}</TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>{txt('작업', 'Actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={mvsTableBodyRowSx}>
                {filteredContracts.map((contract) => {
                  const contractStatus = getContractStatus(contract);
                  return (
                    <TableRow
                      key={contract.id}
                      onClick={menuFlags.canRead ? () => handleViewContract(contract) : undefined}
                      sx={{ cursor: menuFlags.canRead ? 'pointer' : 'default' }}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {contract.title}
                          </Typography>
                          {contract.description && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              {contract.description.length > 50 
                                ? `${contract.description.substring(0, 50)}...` 
                                : contract.description}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const customerName = resolveContractCustomerName(contract);
                          return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              bgcolor: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.08)' : alpha(theme.palette.common.white, 0.12),
                              color: theme.palette.mode === 'light' ? 'rgba(15, 23, 42, 0.75)' : theme.palette.grey[200],
                            }}
                          >
                            {customerName.charAt(0) || 'C'}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {customerName || txt('고객 정보 없음', 'No customer')}
                          </Typography>
                        </Box>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={contractTypeLabel(contract.contract_type)}
                          sx={softChipSx(
                            (contract.contract_type || 'sales') === 'sales' ? 'primary' : 'default'
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                          Rs. {contract.contract_value.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CalendarIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                            <Typography variant="caption">
                              {new Date(contract.start_date).toLocaleDateString(dateLocale)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <ScheduleIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                            <Typography variant="caption">
                              {new Date(contract.end_date).toLocaleDateString(dateLocale)}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={contractStatus.text} size="small" sx={lifecycleChipSx(contractStatus.color)} />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusText(contract.status)}
                          size="small"
                          sx={lifecycleChipSx(getStatusColor(contract.status))}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(contract.created_at).toLocaleDateString(dateLocale)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                          <Tooltip
                            title={
                              !menuFlags.canEdit && !menusLoading
                                ? txt('계약을 수정할 권한이 없습니다.', 'No permission to edit contracts.')
                                : txt('수정', 'Edit')
                            }
                            disableHoverListener={menusLoading || menuFlags.canEdit}
                          >
                            <span>
                              <IconButton
                                size="small"
                                disabled={menusLoading || !menuFlags.canEdit}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleEditContract(contract);
                                }}
                                sx={{
                                  color: 'text.secondary',
                                  borderRadius: '10px',
                                  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip
                            title={
                              !menuFlags.canDelete && !menusLoading
                                ? txt('계약을 삭제할 권한이 없습니다.', 'No permission to delete contracts.')
                                : txt('삭제', 'Delete')
                            }
                            disableHoverListener={menusLoading || menuFlags.canDelete}
                          >
                            <span>
                              <IconButton
                                size="small"
                                disabled={menusLoading || !menuFlags.canDelete}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteContract(contract);
                                }}
                                sx={{
                                  color: 'text.secondary',
                                  borderRadius: '10px',
                                  '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
        </TableContainer>
      </Box>

      {/* 계약 등록/수정 다이얼로그 */}
      <Dialog
        open={dialogOpen}
        onClose={() => {
          closeAttachmentPreview();
          setDialogOpen(false);
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '8px' } }}
      >
        <DialogTitle
          sx={{
            pt: 2.5,
            px: 3,
            pb: 1.25,
            fontSize: '1.125rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'text.primary',
          }}
        >
          {dialogMode === 'create' && txt('새 계약 등록', 'New contract')}
          {dialogMode === 'edit' && txt('계약 수정', 'Edit contract')}
          {dialogMode === 'view' && txt('계약 보기', 'View contract')}
        </DialogTitle>
        <DialogContent
          sx={{
            px: 3,
            /* MUI 기본: DialogTitle 다음 DialogContent padding-top:0 → 라벨 잘림 */
            pt: '28px !important',
            pb: 2.5,
            overflowX: 'hidden',
            overflowY: 'auto',
          }}
        >
          <Grid
            container
            spacing={{ xs: 2.5, sm: 3 }}
            sx={{ mt: 0, pt: 1.25, width: '100%', ...contractDialogFormSx }}
          >
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                freeSolo
                options={customers}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
                filterOptions={(options, state) => {
                  const q = normalizeCustomerMatchKey(state.inputValue);
                  if (!q) return options.slice(0, 40);
                  return options
                    .filter((opt) => normalizeCustomerMatchKey(opt.name).includes(q))
                    .slice(0, 40);
                }}
                value={selectedCustomer}
                inputValue={formData.title}
                onInputChange={(_event, value, reason) => {
                  if (reason === 'reset' && dialogMode === 'view') return;
                  if (reason === 'input' || reason === 'clear') {
                    handleContractTitleInput(value);
                  }
                }}
                onChange={(_event, value) => {
                  if (typeof value === 'string') {
                    handleContractTitleInput(value);
                    return;
                  }
                  if (value) {
                    applyCustomerToForm(value, value.name);
                    return;
                  }
                  applyCustomerToForm(null, '');
                }}
                disabled={dialogMode === 'view'}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={txt('계약명', 'Title')}
                    required
                    placeholder={txt(
                      '계약명 입력 또는 고객사명 선택',
                      'Enter title or pick a customer'
                    )}
                    helperText={txt(
                      '고객사명을 입력·선택하면 아래 고객 정보가 자동으로 채워집니다.',
                      'Typing or selecting a customer name auto-fills customer details below.'
                    )}
                    InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete
                options={customers}
                value={selectedCustomer}
                disabled={dialogMode === 'view'}
                getOptionLabel={(option) => option.name || ''}
                isOptionEqualToValue={(option, value) => Number(option.id) === Number(value.id)}
                filterOptions={(options, state) => {
                  const q = normalizeCustomerMatchKey(state.inputValue);
                  if (!q) return options.slice(0, 80);
                  return options
                    .filter((opt) => {
                      const name = normalizeCustomerMatchKey(opt.name);
                      const phone = String(opt.phone || '').replace(/\s+/g, '');
                      const email = String(opt.email || '').toLowerCase();
                      const biz = String(opt.business_number || '').replace(/\s+/g, '');
                      const raw = normalizeCustomerMatchKey(state.inputValue);
                      return (
                        name.includes(q) ||
                        phone.includes(raw.replace(/\s+/g, '')) ||
                        email.includes(raw) ||
                        biz.includes(raw.replace(/\s+/g, ''))
                      );
                    })
                    .slice(0, 80);
                }}
                onChange={(_event, value) => {
                  handleCustomerSelect(value ? String(value.id) : '');
                }}
                slotProps={{
                  popper: {
                    sx: { zIndex: (t) => t.zIndex.modal + 1 },
                  },
                }}
                renderOption={(props, option) => {
                  const { key, ...rest } = props as typeof props & { key?: React.Key };
                  return (
                    <li key={key ?? option.id} {...rest}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35 }}>
                          {option.name}
                        </Typography>
                        {(option.phone || option.email) && (
                          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                            {[option.phone, option.email].filter(Boolean).join(' · ')}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={txt('고객(선택)', 'Customer (optional)')}
                    placeholder={txt('고객명·전화·이메일 검색', 'Search name, phone, or email')}
                    helperText={txt(
                      '입력하면 고객을 검색할 수 있습니다. 비우면 고객 없음.',
                      'Type to search customers. Clear for no linked customer.'
                    )}
                    InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={txt('고객사 정보', 'Customer details')}
                value={
                  selectedCustomer
                    ? [
                        selectedCustomer.name,
                        [
                          selectedCustomer.ceo_name
                            ? `${txt('대표', 'CEO')}: ${selectedCustomer.ceo_name}`
                            : '',
                          selectedCustomer.phone || '',
                          selectedCustomer.email || '',
                        ]
                          .filter(Boolean)
                          .join(' · '),
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : ''
                }
                placeholder={txt(
                  '고객을 선택하면 정보가 표시됩니다.',
                  'Select a customer to show details.'
                )}
                InputLabelProps={{ shrink: true }}
                inputProps={{ readOnly: true }}
                /* 왼쪽 helperText와 같은 높이로 상단·하단 라인 정렬 */
                helperText={txt(
                  '입력하면 고객을 검색할 수 있습니다. 비우면 고객 없음.',
                  'Type to search customers. Clear for no linked customer.'
                )}
                FormHelperTextProps={{
                  sx: { visibility: 'hidden', userSelect: 'none' },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    cursor: 'default',
                  },
                  '& .MuiOutlinedInput-input': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={txt('계약 가치 (INR)', 'Contract value (INR)')}
                type="number"
                value={formData.contract_value}
                onChange={(e) => setFormData({ ...formData, contract_value: e.target.value })}
                disabled={dialogMode === 'view'}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel shrink id="contract-type-label">
                  {txt('계약 구분', 'Contract type')}
                </InputLabel>
                <Select
                  labelId="contract-type-label"
                  value={selectedContractTypeCode}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      contract_type: String(e.target.value),
                    }))
                  }
                  label={txt('계약 구분', 'Contract type')}
                  notched
                  disabled={dialogMode === 'view' || contractTypes.length === 0}
                  MenuProps={{
                    /* Dialog 포커스 트랩 안에서 메뉴 클릭이 먹히도록 포털 비활성 */
                    disablePortal: true,
                    PaperProps: { sx: { maxHeight: 280 } },
                  }}
                >
                  {contractTypes.map((row) => (
                    <MenuItem key={row.id} value={row.code}>
                      {row.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={txt('계약 시작일', 'Start date')}
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                disabled={dialogMode === 'view'}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label={txt('계약 종료일', 'End date')}
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                disabled={dialogMode === 'view'}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel shrink>{txt('상태', 'Status')}</InputLabel>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  label={txt('상태', 'Status')}
                  notched
                  disabled={dialogMode === 'view'}
                >
                  <MenuItem value="active">{txt('활성', 'Active')}</MenuItem>
                  <MenuItem value="inactive">{txt('비활성', 'Inactive')}</MenuItem>
                  <MenuItem value="expired">{txt('만료', 'Expired')}</MenuItem>
                  <MenuItem value="suspended">{txt('정지', 'Suspended')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label={txt('계약 설명', 'Description')}
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={dialogMode === 'view'}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button
                variant="outlined"
                color="inherit"
                component="label"
                startIcon={<AttachFileIcon sx={{ fontSize: 18 }} />}
                disabled={
                  dialogMode === 'view' ||
                  (dialogMode === 'create' && !menuFlags.canCreate) ||
                  (dialogMode === 'edit' && !menuFlags.canEdit)
                }
                sx={{
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 600,
                  borderStyle: 'dashed',
                  borderColor: alpha(theme.palette.text.primary, 0.22),
                  color: 'text.primary',
                  bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.08 : 0.04),
                  '&:hover': {
                    borderColor: alpha(theme.palette.primary.main, 0.45),
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.06),
                  },
                }}
              >
                {txt('계약서 파일 첨부', 'Attach files')}
                <input
                  hidden
                  type="file"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    setSelectedFiles(files);
                  }}
                />
              </Button>
              {selectedFiles.length > 0 && (
                <Typography variant="body2" sx={{ mt: 1.25, color: 'text.secondary', letterSpacing: '-0.01em' }}>
                  {txt('선택 파일:', 'Selected:')} {selectedFiles.map((file) => file.name).join(', ')}
                </Typography>
              )}
              {Array.isArray(formData.attachments) && formData.attachments.length > 0 && (
                <Box
                  sx={{
                    mt: 1.25,
                    p: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.75,
                    borderRadius: '8px',
                    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                    bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.06 : 0.03),
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '-0.01em' }}>
                    {txt('기존 첨부파일', 'Existing attachments')}
                  </Typography>
                  {formData.attachments.map((filePath) => {
                    const label = attachmentFileName(filePath);
                    const busy = attachmentBusyPath === filePath;
                    const canPreview = isPreviewableAttachment(filePath);
                    return (
                      <Box
                        key={filePath}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          minWidth: 0,
                        }}
                      >
                        <Button
                          size="small"
                          variant="text"
                          disabled={busy}
                          onClick={() => {
                            if (canPreview) {
                              void openAttachmentPreview(filePath);
                            } else {
                              void handleDownloadAttachment(filePath);
                            }
                          }}
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            justifyContent: 'flex-start',
                            textTransform: 'none',
                            fontWeight: 500,
                            fontSize: '0.8125rem',
                            letterSpacing: '-0.01em',
                            color: 'primary.main',
                            px: 0.5,
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {label}
                          </Box>
                        </Button>
                        {busy ? (
                          <CircularProgress size={16} sx={{ mx: 0.75 }} />
                        ) : (
                          <>
                            {canPreview ? (
                              <Tooltip title={txt('미리보기', 'Preview')}>
                                <IconButton
                                  size="small"
                                  aria-label={txt('미리보기', 'Preview')}
                                  onClick={() => void openAttachmentPreview(filePath)}
                                >
                                  <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                            ) : null}
                            <Tooltip title={txt('다운로드', 'Download')}>
                              <IconButton
                                size="small"
                                aria-label={txt('다운로드', 'Download')}
                                onClick={() => void handleDownloadAttachment(filePath)}
                              >
                                <DownloadIcon sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            py: 2.5,
            gap: 1,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
            bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.06 : 0.03),
          }}
        >
          <Box sx={{ flex: 1 }} />
          <Button
            onClick={() => {
              closeAttachmentPreview();
              setDialogOpen(false);
            }}
            sx={mvsBodyOutlinedBtnSx}
          >
            {dialogMode === 'view' ? txt('닫기', 'Close') : txt('취소', 'Cancel')}
          </Button>
          {dialogMode === 'view' && menuFlags.canEdit && selectedContract ? (
            <Button
              variant="contained"
              disableElevation
              startIcon={<EditIcon sx={{ fontSize: 18 }} />}
              sx={mvsBodyPrimaryBtnSx}
              onClick={() => {
                if (!menuFlags.canEdit) {
                  showSnackbar(
                    txt('계약을 수정할 권한이 없습니다.', 'You do not have permission to edit contracts.'),
                    'error'
                  );
                  return;
                }
                setSelectedFiles([]);
                setDialogMode('edit');
              }}
            >
              {txt('수정하기', 'Edit')}
            </Button>
          ) : null}
          {dialogMode !== 'view' &&
            ((dialogMode === 'create' && menuFlags.canCreate) ||
              (dialogMode === 'edit' && menuFlags.canEdit)) && (
              <Button
                onClick={() => void handleSaveContract()}
                variant="contained"
                disableElevation
                sx={mvsBodyPrimaryBtnSx}
              >
                {dialogMode === 'create' ? txt('등록', 'Register') : txt('수정', 'Update')}
              </Button>
            )}
        </DialogActions>
      </Dialog>

      <Dialog
        open={typeDialogOpen}
        onClose={() => setTypeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          {txt('계약 구분 관리', 'Manage contract types')}
        </DialogTitle>
        <DialogContent sx={{ pt: '20px !important', pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.875rem' }}>
            {txt(
              '계약 등록·필터에 사용할 구분을 등록·수정·삭제합니다. 기본 구분은 삭제할 수 없습니다.',
              'Add, edit, or remove types used in contract forms and filters. Default types cannot be deleted.'
            )}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              label={txt('구분명', 'Type name')}
              value={typeDraftName}
              onChange={(e) => setTypeDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreateContractType();
                }
              }}
              disabled={!menuFlags.canCreate || typesLoading}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1.2, minWidth: 160 }}
            />
            <TextField
              size="small"
              label={txt('코드', 'Code')}
              value={typeDraftCode}
              onChange={(e) => setTypeDraftCode(e.target.value)}
              placeholder={txt('비우면 자동 생성', 'Auto if empty')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreateContractType();
                }
              }}
              disabled={!menuFlags.canCreate || typesLoading}
              InputLabelProps={{ shrink: true }}
              inputProps={{ spellCheck: false }}
              sx={{
                flex: 1,
                minWidth: 140,
                '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.8125rem' },
              }}
            />
            <Button
              variant="contained"
              disableElevation
              startIcon={<AddIcon sx={{ fontSize: 18 }} />}
              onClick={() => void handleCreateContractType()}
              disabled={!menuFlags.canCreate || !typeDraftName.trim() || typesLoading}
              sx={mvsBodyPrimaryBtnSx}
            >
              {txt('등록', 'Add')}
            </Button>
          </Box>
          <Box sx={mvsBodyListZoneSx}>
            <TableContainer sx={{ ...mvsBodyListTableSx, maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell>{txt('구분명', 'Name')}</TableCell>
                    <TableCell>{txt('코드', 'Code')}</TableCell>
                    <TableCell align="center">{txt('종류', 'Kind')}</TableCell>
                    <TableCell align="right">{txt('작업', 'Actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {typesLoading && contractTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <CircularProgress size={24} />
                      </TableCell>
                    </TableRow>
                  ) : contractTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        {txt('등록된 구분이 없습니다.', 'No contract types yet.')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    contractTypes.map((row) => (
                      <TableRow key={row.id} sx={mvsTableBodyRowSx}>
                        <TableCell>
                          {editingTypeId === row.id ? (
                            <TextField
                              size="small"
                              value={editingTypeName}
                              onChange={(e) => setEditingTypeName(e.target.value)}
                              fullWidth
                              autoFocus
                            />
                          ) : (
                            row.name
                          )}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.8125rem',
                            color: 'text.secondary',
                            minWidth: 140,
                          }}
                        >
                          {editingTypeId === row.id ? (
                            <TextField
                              size="small"
                              value={editingTypeCode}
                              onChange={(e) => setEditingTypeCode(e.target.value)}
                              fullWidth
                              disabled={row.is_system}
                              title={
                                row.is_system
                                  ? txt('기본 구분 코드는 변경할 수 없습니다.', 'Default type codes cannot be changed.')
                                  : undefined
                              }
                              inputProps={{ spellCheck: false }}
                              sx={{
                                '& .MuiInputBase-input': {
                                  fontFamily: 'monospace',
                                  fontSize: '0.8125rem',
                                },
                              }}
                            />
                          ) : (
                            row.code
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {row.is_system
                            ? txt('기본', 'Default')
                            : txt('사용자', 'Custom')}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'inline-flex', gap: 0.25 }}>
                            {editingTypeId === row.id ? (
                              <>
                                <Tooltip title={txt('저장', 'Save')}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={() => void handleUpdateContractType(row.id, row.is_system)}
                                      disabled={
                                        !editingTypeName.trim() ||
                                        (!row.is_system && !editingTypeCode.trim()) ||
                                        typesLoading ||
                                        !menuFlags.canEdit
                                      }
                                    >
                                      <SaveIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Tooltip title={txt('취소', 'Cancel')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setEditingTypeId(null);
                                      setEditingTypeName('');
                                      setEditingTypeCode('');
                                    }}
                                  >
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            ) : (
                              <>
                                <Tooltip title={txt('수정', 'Edit')}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      disabled={!menuFlags.canEdit || typesLoading}
                                      onClick={() => {
                                        setEditingTypeId(row.id);
                                        setEditingTypeName(row.name);
                                        setEditingTypeCode(row.code);
                                      }}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                {!row.is_system ? (
                                  <Tooltip title={txt('삭제', 'Delete')}>
                                    <span>
                                      <IconButton
                                        size="small"
                                        disabled={!menuFlags.canDelete || typesLoading}
                                        onClick={() => handleDeleteContractType(row)}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                ) : null}
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setTypeDialogOpen(false)} sx={mvsBodyOutlinedBtnSx}>
            {txt('닫기', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(attachmentPreview)}
        onClose={closeAttachmentPreview}
        maxWidth="lg"
        fullWidth
        sx={{ zIndex: (t) => t.zIndex.modal + 2 }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            pr: 1,
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {attachmentPreview?.label || txt('첨부파일 미리보기', 'Attachment preview')}
          </Typography>
          <IconButton aria-label={txt('닫기', 'Close')} onClick={closeAttachmentPreview}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'stretch',
            bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.12 : 0.06),
            minHeight: 320,
            p: 1.5,
          }}
        >
          {attachmentPreview?.kind === 'pdf' ? (
            <Box
              component="iframe"
              title={attachmentPreview.label}
              src={attachmentPreview.url}
              sx={{
                width: '100%',
                minHeight: '70vh',
                border: 'none',
                borderRadius: '4px',
                bgcolor: '#FFFFFF',
              }}
            />
          ) : attachmentPreview?.kind === 'image' ? (
            <Box
              component="img"
              src={attachmentPreview.url}
              alt={attachmentPreview.label}
              sx={{
                maxWidth: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '4px',
                mx: 'auto',
              }}
            />
          ) : attachmentPreview ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              {txt(
                '이 형식은 미리보기를 지원하지 않습니다. 다운로드해 주세요.',
                'Preview is not supported for this file type. Please download it.'
              )}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
          <Button onClick={closeAttachmentPreview} sx={mvsBodyOutlinedBtnSx}>
            {txt('닫기', 'Close')}
          </Button>
          {attachmentPreview ? (
            <Button
              variant="contained"
              disableElevation
              startIcon={<DownloadIcon />}
              sx={mvsBodyPrimaryBtnSx}
              onClick={() => void handleDownloadAttachment(attachmentPreview.path)}
            >
              {txt('다운로드', 'Download')}
            </Button>
          ) : null}
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

      {/* 스낵바 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ContractManagement;