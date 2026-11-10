import React, { useEffect, useMemo, useState } from 'react';
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
  TextField,
  FormControl,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Pagination,
  InputAdornment,
  Grid,
  Chip,
  CircularProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import ExcelJS from 'exceljs';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsKpiCardSx,
  mvsBodyCardSx,
  mvsBodyPrimaryBtnSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyListZoneSx,
  mvsBodyPaginationSx,
  mvsSearchFieldSx,
  mvsFilterFieldHeightSx,
  mvsTableScrollSx,
  mvsTableHeadHighlightSx,
  mvsTableBodyRowSx,
} from '../../theme/daeheungLayout';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  RestartAlt as ResetIcon,
  FileDownload as FileDownloadIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';
import { accountingService } from '../../services/api';
import { UTILS } from '../../constants';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';
import {
  calculateDepreciation,
  type DepreciationMethod,
  type DepreciationScheduleRow,
  type DepreciationSummary,
} from '../../utils/assetDepreciation';
import { addSheetFromAoA, downloadExcelWorkbook } from '../../utils/excelExportStyle';

type AssetStatus = 'active' | 'maintenance' | 'disposed' | 'lost' | 'transferred';

interface Asset {
  id: number;
  asset_code: string;
  name: string;
  category: string;
  subcategory: string;
  purchase_date: string;
  purchase_price: number;
  salvage_value: number;
  current_value: number;
  depreciation_rate: number;
  accumulated_depreciation: number;
  location: string;
  status: AssetStatus;
  maintenance_date?: string;
  next_maintenance?: string;
  warranty_expiry?: string;
  description?: string;
  vendor?: string;
  serial_number?: string;
  assigned_to?: string;
  department?: string;
  useful_life?: number;
  depreciation_method?: DepreciationMethod;
}

const ASSET_MENU_ROUTES = ['/accounting/assets', '/accounting'] as const;

const assetCategories = [
  { value: 'IT Equipment', subCategories: ['Computer', 'Server', 'Network', 'Printer', 'Monitor', 'Other IT'] },
  { value: 'Office Supplies', subCategories: ['Printer', 'Copier', 'Fax', 'Phone', 'Chair', 'Desk', 'Other Office'] },
  { value: 'Furniture', subCategories: ['Desk', 'Chair', 'Cabinet', 'Meeting Table', 'Sofa', 'Other Furniture'] },
  { value: 'Vehicle', subCategories: ['Passenger', 'Cargo', 'Other Vehicle'] },
  { value: 'Machinery', subCategories: ['Production', 'Manufacturing', 'Other Machinery'] },
  { value: 'Other', subCategories: ['Other Asset'] },
];

const emptyForm = {
  asset_code: '',
  name: '',
  category: '',
  subcategory: '',
  purchase_date: new Date().toISOString().split('T')[0],
  purchase_price: 0,
  salvage_value: 0,
  depreciation_rate: 0,
  location: '',
  status: 'active' as AssetStatus,
  maintenance_date: '',
  next_maintenance: '',
  warranty_expiry: '',
  description: '',
  vendor: '',
  serial_number: '',
  assigned_to: '',
  department: '',
  useful_life: 5,
  depreciation_method: 'straight_line' as DepreciationMethod,
};

const formatCurrency = (value: number) => UTILS.formatCurrency(value);

const methodLabel = (method?: DepreciationMethod) => {
  switch (method) {
    case 'declining_balance':
      return '정률법';
    case 'units_of_production':
      return '생산량비례법(정액 처리)';
    default:
      return '정액법';
  }
};

const mapAsset = (asset: any): Asset => ({
  id: asset.id,
  asset_code: asset.asset_code || '',
  name: asset.name || '',
  category: asset.category || '',
  subcategory: asset.subcategory || '',
  purchase_date: asset.purchase_date || '',
  purchase_price: Number(asset.purchase_price) || 0,
  salvage_value: Number(asset.salvage_value) || 0,
  current_value: Number(asset.current_value) || 0,
  depreciation_rate: Number(asset.depreciation_rate) || 0,
  accumulated_depreciation: Number(asset.accumulated_depreciation) || 0,
  location: asset.location || '',
  status: (asset.status || 'active') as AssetStatus,
  maintenance_date: asset.maintenance_date || '',
  next_maintenance: asset.next_maintenance || '',
  warranty_expiry: asset.warranty_expiry || '',
  description: asset.description || '',
  vendor: asset.vendor || '',
  serial_number: asset.serial_number || '',
  assigned_to: asset.assigned_to || '',
  department: asset.department || '',
  useful_life: Number(asset.useful_life) || 5,
  depreciation_method: (asset.depreciation_method || 'straight_line') as DepreciationMethod,
});

const depreciationInputFromAsset = (asset: Pick<
  Asset,
  | 'purchase_price'
  | 'salvage_value'
  | 'useful_life'
  | 'depreciation_rate'
  | 'purchase_date'
  | 'depreciation_method'
>) => ({
  purchasePrice: Number(asset.purchase_price) || 0,
  salvageValue: Number(asset.salvage_value) || 0,
  usefulLife: Number(asset.useful_life) || 0,
  depreciationRate: Number(asset.depreciation_rate) || 0,
  purchaseDate: asset.purchase_date,
  depreciationMethod: asset.depreciation_method || 'straight_line',
});

const scheduleSheetRows = (
  asset: Pick<Asset, 'asset_code' | 'name' | 'purchase_date' | 'purchase_price' | 'salvage_value' | 'useful_life' | 'depreciation_method' | 'depreciation_rate'>,
  summary: DepreciationSummary
): Array<Array<string | number>> => {
  const headerMeta: Array<Array<string | number>> = [
    ['자산코드', asset.asset_code],
    ['자산명', asset.name],
    ['취득일', asset.purchase_date || ''],
    ['취득가', asset.purchase_price],
    ['잔존가치', asset.salvage_value],
    ['내용연수(년)', asset.useful_life || 0],
    ['상각방법', methodLabel(asset.depreciation_method)],
    ['상각률(%)', summary.depreciationRate],
    ['경과년수', summary.yearsElapsed],
    ['현재장부가', summary.currentValue],
    ['누적상각', summary.accumulatedDepreciation],
    [],
    ['연차', '연도', '기초장부가', '당기상각', '누적상각', '기말장부가'],
  ];
  const rows = summary.schedule.map((row: DepreciationScheduleRow) => [
    row.year,
    row.yearLabel,
    row.openingBookValue,
    row.depreciation,
    row.accumulatedDepreciation,
    row.closingBookValue,
  ]);
  return [...headerMeta, ...rows];
};

const assetFilterFieldSx = {
  ...(mvsSearchFieldSx as Record<string, unknown>),
  ...mvsFilterFieldHeightSx,
} as const;

const bodyCardTableContainerSx = {
  ...mvsTableScrollSx,
  width: '100%',
  maxWidth: '100%',
} as const;

const listStateInlineSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  py: 6,
  px: 2,
} as const;

const AssetManagement: React.FC = () => {
  const { dialogState, showConfirm, handleConfirm, handleCancel } = useConfirmDialog();
  const { canCreate, canEdit, canDelete } = useMenuRoutePermissionFlags(ASSET_MENU_ROUTES);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({ search: '', category: 'all', status: 'all' });
  const [page, setPage] = useState(1);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [scheduleAsset, setScheduleAsset] = useState<Asset | null>(null);
  const [scheduleSummary, setScheduleSummary] = useState<DepreciationSummary | null>(null);
  const [exporting, setExporting] = useState(false);

  const itemsPerPage = 15;

  const formPreview = useMemo(
    () =>
      calculateDepreciation({
        purchasePrice: Number(formData.purchase_price) || 0,
        salvageValue: Number(formData.salvage_value) || 0,
        usefulLife: Number(formData.useful_life) || 0,
        depreciationRate: Number(formData.depreciation_rate) || 0,
        purchaseDate: formData.purchase_date,
        depreciationMethod: formData.depreciation_method,
      }),
    [formData]
  );

  const filteredAssets = useMemo(() => {
    let list = [...assets];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (asset) =>
          asset.asset_code.toLowerCase().includes(q) ||
          asset.name.toLowerCase().includes(q) ||
          asset.serial_number?.toLowerCase().includes(q) ||
          asset.location.toLowerCase().includes(q)
      );
    }

    if (filters.category !== 'all') {
      list = list.filter((asset) => asset.category === filters.category);
    }

    if (filters.status !== 'all') {
      list = list.filter((asset) => asset.status === filters.status);
    }

    return list;
  }, [assets, filters]);

  const paginatedAssets = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredAssets.slice(start, start + itemsPerPage);
  }, [filteredAssets, page]);

  const summary = useMemo(() => {
    const totalCount = filteredAssets.length;
    const activeCount = filteredAssets.filter((asset) => asset.status === 'active').length;
    const totalPurchase = filteredAssets.reduce((sum, asset) => sum + Number(asset.purchase_price || 0), 0);
    const totalCurrent = filteredAssets.reduce((sum, asset) => sum + Number(asset.current_value || 0), 0);
    const totalAccum = filteredAssets.reduce(
      (sum, asset) => sum + Number(asset.accumulated_depreciation || 0),
      0
    );
    return { totalCount, activeCount, totalPurchase, totalCurrent, totalAccum };
  }, [filteredAssets]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const response = await accountingService.getAssets();
      if (response.success) {
        const list = Array.isArray(response.data) ? response.data : [];
        setAssets(list.map(mapAsset));
      } else {
        setAssets([]);
        setError(response.message || '자산 목록을 불러오지 못했습니다.');
      }
    } catch {
      setError('자산 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const handleCreate = () => {
    setSelectedAsset(null);
    setFormData({ ...emptyForm });
    setOpenDialog(true);
  };

  const handleEdit = (asset: Asset) => {
    setSelectedAsset(asset);
    setFormData({
      asset_code: asset.asset_code,
      name: asset.name,
      category: asset.category,
      subcategory: asset.subcategory,
      purchase_date: asset.purchase_date,
      purchase_price: asset.purchase_price,
      salvage_value: asset.salvage_value,
      depreciation_rate: asset.depreciation_rate,
      location: asset.location,
      status: asset.status,
      maintenance_date: asset.maintenance_date || '',
      next_maintenance: asset.next_maintenance || '',
      warranty_expiry: asset.warranty_expiry || '',
      description: asset.description || '',
      vendor: asset.vendor || '',
      serial_number: asset.serial_number || '',
      assigned_to: asset.assigned_to || '',
      department: asset.department || '',
      useful_life: Number(asset.useful_life) || 5,
      depreciation_method: (asset.depreciation_method || 'straight_line') as DepreciationMethod,
    });
    setOpenDialog(true);
  };

  const openSchedule = (asset: Asset) => {
    const summaryData = calculateDepreciation(depreciationInputFromAsset(asset));
    setScheduleAsset(asset);
    setScheduleSummary(summaryData);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.category || !formData.purchase_date) {
      setError('필수 항목(자산명, 분류, 취득일)을 입력해주세요.');
      return;
    }

    const resolvedAssetCode = formData.asset_code.trim() || `AST-${Date.now().toString().slice(-6)}`;
    const depreciation = calculateDepreciation({
      purchasePrice: Number(formData.purchase_price) || 0,
      salvageValue: Number(formData.salvage_value) || 0,
      usefulLife: Number(formData.useful_life) || 0,
      depreciationRate: Number(formData.depreciation_rate) || 0,
      purchaseDate: formData.purchase_date,
      depreciationMethod: formData.depreciation_method,
    });

    const payload = {
      ...formData,
      asset_code: resolvedAssetCode,
      purchase_price: Number(formData.purchase_price) || 0,
      salvage_value: Number(formData.salvage_value) || 0,
      depreciation_rate: depreciation.depreciationRate,
      useful_life: Number(formData.useful_life) || 0,
      current_value: depreciation.currentValue,
      accumulated_depreciation: depreciation.accumulatedDepreciation,
    };

    try {
      if (selectedAsset) {
        const response = await accountingService.updateAsset(selectedAsset.id, payload);
        if (!response.success) throw new Error(response.message || 'Update failed');
        setSuccess('자산 정보를 수정했습니다.');
      } else {
        const response = await accountingService.createAsset(payload);
        if (!response.success) throw new Error(response.message || 'Create failed');
        setSuccess('자산을 등록했습니다.');
      }
      setOpenDialog(false);
      setSelectedAsset(null);
      await loadAssets();
    } catch {
      setError('자산 저장에 실패했습니다.');
    }
  };

  const handleDelete = (id: number) => {
    showConfirm(
      '이 자산을 삭제하시겠습니까?',
      () => {
        void (async () => {
          try {
            const response = await accountingService.deleteAsset(id);
            if (!response.success) throw new Error(response.message || 'Delete failed');
            setSuccess('자산을 삭제했습니다.');
            await loadAssets();
          } catch {
            setError('자산 삭제에 실패했습니다.');
          }
        })();
      },
      { title: '삭제 확인', confirmColor: 'error', confirmText: '삭제', cancelText: '취소' }
    );
  };

  const downloadSingleSchedule = async (asset: Asset, summaryData?: DepreciationSummary) => {
    const data = summaryData || calculateDepreciation(depreciationInputFromAsset(asset));
    const workbook = new ExcelJS.Workbook();
    addSheetFromAoA(workbook, '감가상각표', scheduleSheetRows(asset, data));
    await downloadExcelWorkbook(workbook, `감가상각표_${asset.asset_code || asset.id}.xlsx`);
  };

  const downloadAllSchedules = async () => {
    if (!filteredAssets.length) {
      setError('다운로드할 자산이 없습니다.');
      return;
    }
    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const indexRows: Array<Array<string | number>> = [
        ['자산코드', '자산명', '분류', '취득일', '취득가', '잔존가치', '내용연수', '상각방법', '상각률(%)', '누적상각', '현재장부가'],
      ];

      filteredAssets.forEach((asset) => {
        const data = calculateDepreciation(depreciationInputFromAsset(asset));
        indexRows.push([
          asset.asset_code,
          asset.name,
          asset.category,
          asset.purchase_date || '',
          asset.purchase_price,
          asset.salvage_value,
          asset.useful_life || 0,
          methodLabel(asset.depreciation_method),
          data.depreciationRate,
          data.accumulatedDepreciation,
          data.currentValue,
        ]);
      });
      addSheetFromAoA(workbook, '자산요약', indexRows);

      filteredAssets.forEach((asset, idx) => {
        const data = calculateDepreciation(depreciationInputFromAsset(asset));
        const sheetName = `${idx + 1}_${(asset.asset_code || `A${asset.id}`).slice(0, 20)}`;
        addSheetFromAoA(workbook, sheetName, scheduleSheetRows(asset, data));
      });

      const today = new Date().toISOString().slice(0, 10);
      await downloadExcelWorkbook(workbook, `자산_감가상각표_${today}.xlsx`);
      setSuccess('감가상각표를 다운로드했습니다.');
    } catch {
      setError('감가상각표 다운로드에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  };

  const getStatusLabel = (status: AssetStatus) => {
    switch (status) {
      case 'active':
        return '사용중';
      case 'maintenance':
        return '점검중';
      case 'disposed':
        return '폐기';
      case 'lost':
        return '분실';
      case 'transferred':
        return '이관';
      default:
        return status;
    }
  };

  const getStatusColor = (status: AssetStatus) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'maintenance':
        return 'warning';
      case 'disposed':
        return 'error';
      case 'lost':
        return 'default';
      case 'transferred':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ ...mvsPageRootSx }}>
      <DaeheungPageHeader
        title="자산 관리"
        description="회사 자산을 등록·수정·삭제하고, 감가상각을 계산하며 상각표를 다운로드합니다."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mb: 3 }} alignItems="stretch">
        {[
          { label: '자산 수', value: `${summary.totalCount}건` },
          { label: '사용중', value: `${summary.activeCount}건`, color: 'success.main' },
          { label: '총 취득가', value: formatCurrency(summary.totalPurchase) },
          { label: '누적상각', value: formatCurrency(summary.totalAccum) },
          { label: '총 장부가', value: formatCurrency(summary.totalCurrent) },
        ].map((kpi) => (
          <Grid key={kpi.label} size={{ xs: 12, sm: 6, md: 4, lg: 'grow' }} sx={{ display: 'flex' }}>
            <Card elevation={0} sx={{ ...mvsKpiCardSx, width: '100%', height: '100%' }}>
              <CardContent sx={{ py: 2.25, px: 2.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {kpi.label}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ mt: 0.75, fontWeight: 700, color: kpi.color || 'inherit' }}
                >
                  {kpi.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 3 }}>
        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            pt: 2,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button
              variant="outlined"
              disableElevation
              startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <FileDownloadIcon fontSize="small" />}
              onClick={() => void downloadAllSchedules()}
              disabled={exporting || filteredAssets.length === 0}
              sx={mvsBodyOutlinedBtnSx}
            >
              감가상각표 다운로드
            </Button>
            <Button
              variant="outlined"
              disableElevation
              startIcon={<ResetIcon fontSize="small" />}
              onClick={() => setFilters({ search: '', category: 'all', status: 'all' })}
              sx={mvsBodyOutlinedBtnSx}
            >
              초기화
            </Button>
          </Box>
          {canCreate && (
            <Button
              variant="contained"
              disableElevation
              startIcon={<AddIcon fontSize="small" />}
              onClick={handleCreate}
              sx={mvsBodyPrimaryBtnSx}
            >
              자산 등록
            </Button>
          )}
        </Box>
        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 2,
            bgcolor: '#FFFFFF',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' },
            gap: 2,
            alignItems: 'flex-end',
          }}
        >
          <TextField
            fullWidth
            size="small"
            label="검색"
            placeholder="코드/자산명/시리얼/위치 검색"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={assetFilterFieldSx}
          />
          <TextField
            fullWidth
            size="small"
            select
            label="분류"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            InputLabelProps={{ shrink: true }}
            SelectProps={{ displayEmpty: true }}
            sx={assetFilterFieldSx}
          >
            <MenuItem value="all">전체 분류</MenuItem>
            {assetCategories.map((cat) => (
              <MenuItem key={cat.value} value={cat.value}>
                {cat.value}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            size="small"
            select
            label="상태"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as AssetStatus | 'all' })}
            InputLabelProps={{ shrink: true }}
            SelectProps={{ displayEmpty: true }}
            sx={assetFilterFieldSx}
          >
            <MenuItem value="all">전체 상태</MenuItem>
            <MenuItem value="active">사용중</MenuItem>
            <MenuItem value="maintenance">점검중</MenuItem>
            <MenuItem value="disposed">폐기</MenuItem>
            <MenuItem value="lost">분실</MenuItem>
            <MenuItem value="transferred">이관</MenuItem>
          </TextField>
        </Box>
      </Card>

      <Card elevation={0} sx={mvsBodyCardSx}>
        <Box sx={{ ...mvsBodyListZoneSx, mt: 0, pb: 0 }}>
          {loading ? (
            <Box sx={listStateInlineSx}>
              <CircularProgress size={28} />
            </Box>
          ) : filteredAssets.length === 0 ? (
            <Box sx={listStateInlineSx}>
              <Typography variant="body2" color="text.secondary">
                자산 데이터가 없습니다.
              </Typography>
            </Box>
          ) : (
            <>
              <TableContainer sx={bodyCardTableContainerSx}>
                <Table
                  size="small"
                  sx={{
                    tableLayout: 'fixed',
                    width: '100%',
                    borderCollapse: 'collapse',
                    bgcolor: 'transparent',
                    '& .MuiTableCell-root': {
                      borderLeft: 'none',
                      borderRight: 'none',
                      borderTop: 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    },
                  }}
                >
                  <TableHead sx={mvsTableHeadHighlightSx}>
                    <TableRow>
                      <TableCell sx={{ width: '12%' }}>코드</TableCell>
                      <TableCell sx={{ width: '18%' }}>자산명</TableCell>
                      <TableCell sx={{ width: '12%' }}>분류</TableCell>
                      <TableCell sx={{ width: '10%' }}>취득일</TableCell>
                      <TableCell sx={{ width: '12%' }}>취득가</TableCell>
                      <TableCell sx={{ width: '12%' }}>장부가</TableCell>
                      <TableCell sx={{ width: '10%' }}>상태</TableCell>
                      <TableCell align="center" sx={{ width: '14%' }}>
                        관리
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={mvsTableBodyRowSx}>
                    {paginatedAssets.map((asset) => (
                      <TableRow key={asset.id} hover>
                        <TableCell>{asset.asset_code}</TableCell>
                        <TableCell>{asset.name}</TableCell>
                        <TableCell>{asset.category}</TableCell>
                        <TableCell>{asset.purchase_date}</TableCell>
                        <TableCell>{formatCurrency(asset.purchase_price)}</TableCell>
                        <TableCell>{formatCurrency(asset.current_value)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={getStatusLabel(asset.status)}
                            color={
                              getStatusColor(asset.status) as
                                | 'default'
                                | 'primary'
                                | 'secondary'
                                | 'error'
                                | 'info'
                                | 'success'
                                | 'warning'
                            }
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.25 }}>
                            <Tooltip title="감가상각표">
                              <IconButton size="small" onClick={() => openSchedule(asset)}>
                                <TableChartIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {canEdit && (
                              <Tooltip title="수정">
                                <IconButton size="small" onClick={() => handleEdit(asset)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {canDelete && (
                              <Tooltip title="삭제">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDelete(asset.id)}
                                  sx={{
                                    color: 'text.secondary',
                                    '&:hover': { color: 'error.main', bgcolor: 'error.50' },
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {filteredAssets.length > itemsPerPage && (
                <Box sx={mvsBodyPaginationSx}>
                  <Pagination
                    count={Math.ceil(filteredAssets.length / itemsPerPage)}
                    page={page}
                    onChange={(_, value) => setPage(value)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </Box>
      </Card>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedAsset ? '자산 수정' : '자산 등록'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  코드
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={formData.asset_code}
                  onChange={(e) => setFormData({ ...formData, asset_code: e.target.value })}
                  placeholder="비우면 자동 생성"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  자산명 *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  분류 *
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value, subcategory: '' })}
                  >
                    <MenuItem value="">선택</MenuItem>
                    {assetCategories.map((cat) => (
                      <MenuItem key={cat.value} value={cat.value}>
                        {cat.value}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  하위 분류
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={formData.subcategory}
                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                    disabled={!formData.category}
                  >
                    <MenuItem value="">선택</MenuItem>
                    {assetCategories
                      .find((cat) => cat.value === formData.category)
                      ?.subCategories.map((sub) => (
                        <MenuItem key={sub} value={sub}>
                          {sub}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  취득일 *
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  취득가
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: Number(e.target.value) || 0 })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  잔존가치
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={formData.salvage_value}
                  onChange={(e) => setFormData({ ...formData, salvage_value: Number(e.target.value) || 0 })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  내용연수(년)
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={formData.useful_life}
                  onChange={(e) => setFormData({ ...formData, useful_life: Number(e.target.value) || 0 })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  감가상각 방식
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={formData.depreciation_method}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        depreciation_method: e.target.value as DepreciationMethod,
                      })
                    }
                  >
                    <MenuItem value="straight_line">정액법</MenuItem>
                    <MenuItem value="declining_balance">정률법</MenuItem>
                    <MenuItem value="units_of_production">생산량비례법(정액 처리)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  상각률(% · 비우면 자동)
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  value={formData.depreciation_rate}
                  onChange={(e) => setFormData({ ...formData, depreciation_rate: Number(e.target.value) || 0 })}
                  helperText={`적용 상각률 ${formPreview.depreciationRate}% · 연간 ${formatCurrency(formPreview.annualDepreciation)}`}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  위치
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  상태
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as AssetStatus })}
                  >
                    <MenuItem value="active">사용중</MenuItem>
                    <MenuItem value="maintenance">점검중</MenuItem>
                    <MenuItem value="disposed">폐기</MenuItem>
                    <MenuItem value="lost">분실</MenuItem>
                    <MenuItem value="transferred">이관</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  담당자
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  부서
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  설명
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    bgcolor: '#F8FAFC',
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                    gap: 1.5,
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      현재 장부가
                    </Typography>
                    <Typography variant="body1" fontWeight={700}>
                      {formatCurrency(formPreview.currentValue)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      누적 상각
                    </Typography>
                    <Typography variant="body1" fontWeight={700}>
                      {formatCurrency(formPreview.accumulatedDepreciation)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      경과 년수
                    </Typography>
                    <Typography variant="body1" fontWeight={700}>
                      {formPreview.yearsElapsed}년
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>취소</Button>
          <Button variant="contained" onClick={handleSave} sx={mvsBodyPrimaryBtnSx}>
            저장
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(scheduleAsset && scheduleSummary)}
        onClose={() => {
          setScheduleAsset(null);
          setScheduleSummary(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          감가상각표 {scheduleAsset ? `· ${scheduleAsset.asset_code} ${scheduleAsset.name}` : ''}
        </DialogTitle>
        <DialogContent dividers>
          {scheduleAsset && scheduleSummary && (
            <Box>
              <Box
                sx={{
                  mb: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' },
                  gap: 1.5,
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    상각방법
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {methodLabel(scheduleAsset.depreciation_method)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    상각률
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {scheduleSummary.depreciationRate}%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    현재 장부가
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatCurrency(scheduleSummary.currentValue)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    누적 상각
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {formatCurrency(scheduleSummary.accumulatedDepreciation)}
                  </Typography>
                </Box>
              </Box>
              {scheduleSummary.schedule.length === 0 ? (
                <Alert severity="info">취득가·내용연수를 입력하면 감가상각표가 생성됩니다.</Alert>
              ) : (
                <TableContainer sx={{ maxHeight: 420 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>연차</TableCell>
                        <TableCell>연도</TableCell>
                        <TableCell align="right">기초장부가</TableCell>
                        <TableCell align="right">당기상각</TableCell>
                        <TableCell align="right">누적상각</TableCell>
                        <TableCell align="right">기말장부가</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scheduleSummary.schedule.map((row) => (
                        <TableRow key={row.year}>
                          <TableCell>{row.year}</TableCell>
                          <TableCell>{row.yearLabel}</TableCell>
                          <TableCell align="right">{formatCurrency(row.openingBookValue)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.depreciation)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.accumulatedDepreciation)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.closingBookValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setScheduleAsset(null);
              setScheduleSummary(null);
            }}
          >
            닫기
          </Button>
          {scheduleAsset && scheduleSummary && (
            <Button
              variant="contained"
              startIcon={<FileDownloadIcon />}
              onClick={() => void downloadSingleSchedule(scheduleAsset, scheduleSummary)}
              sx={mvsBodyPrimaryBtnSx}
            >
              Excel 다운로드
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar open={!!error} autoHideDuration={4000} onClose={() => setError('')}>
        <Alert onClose={() => setError('')} severity="error">
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={!!success} autoHideDuration={3000} onClose={() => setSuccess('')}>
        <Alert onClose={() => setSuccess('')} severity="success">
          {success}
        </Alert>
      </Snackbar>

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
    </Box>
  );
};

export default AssetManagement;
