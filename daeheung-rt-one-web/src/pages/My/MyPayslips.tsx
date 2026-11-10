import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Download, Search } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import { buildPayslipPdfFilename } from '../HR/payrollPayslipPdf';
import {
  mvsBodyListTableSx,
  mvsBodyListZoneSx,
  mvsBodyOutlinedBtnSx,
  mvsBodyPrimaryBtnSx,
  mvsFilterFieldHeightSx,
  mvsFilterToolbarSx,
  mvsOutlinedLabelProps,
  mvsPageRootSx,
  mvsSearchFieldSx,
  mvsTableBodyRowSx,
  mvsTableHeadHighlightSx,
  mvsTableScrollSx,
} from '../../theme/daeheungLayout';
import { useTranslation } from 'react-i18next';
import { payrollService } from '../../services/api';

type MyPayslipRow = {
  id: number;
  payroll_period: string;
  employee_name?: string | null;
  recipient_email?: string;
  emp_id?: string | null;
  net_salary?: number | string | null;
  sent_at?: string;
  created_at?: string;
};

const filterFieldSx = { ...mvsSearchFieldSx, ...mvsFilterFieldHeightSx } as const;

const listStateBoxSx = {
  ...mvsBodyListTableSx,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  py: { xs: 6, sm: 8 },
  px: 3,
  gap: 1.5,
} as const;

/** 내 정보·업무 > 급여 명세서 — MVS Body 리스트 패턴 */
const MyPayslips: React.FC = () => {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const txt = (ko: string, en: string) => (isEn ? en : ko);

  const [rows, setRows] = useState<MyPayslipRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('');
  const [q, setQ] = useState('');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{
    open: boolean;
    loading: boolean;
    url: string;
    error: string;
    title: string;
    row: MyPayslipRow | null;
  }>({ open: false, loading: false, url: '', error: '', title: '', row: null });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await payrollService.getMyPayslips({
        period: period.trim() || undefined,
        q: q.trim() || undefined,
      });
      if (!res?.success) throw new Error(res?.message || 'load failed');
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setRows([]);
      setError(
        e?.response?.data?.message ||
          e?.message ||
          txt('급여 명세서를 불러오지 못했습니다.', 'Failed to load payslips.')
      );
    } finally {
      setLoading(false);
    }
  }, [period, q, isEn]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (preview.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview.url]);

  const closePreview = () => {
    setPreview((prev) => {
      if (prev.url) URL.revokeObjectURL(prev.url);
      return { open: false, loading: false, url: '', error: '', title: '', row: null };
    });
  };

  const openPreview = async (row: MyPayslipRow) => {
    setPreview((prev) => {
      if (prev.url) URL.revokeObjectURL(prev.url);
      return {
        open: true,
        loading: true,
        url: '',
        error: '',
        title: buildPayslipPdfFilename(row.payroll_period, row.employee_name).replace(/\.pdf$/i, ''),
        row,
      };
    });
    try {
      const blob = await payrollService.downloadMyPayslip(row.id);
      const pdfBlob =
        blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      setPreview((prev) => ({ ...prev, loading: false, url, error: '' }));
    } catch (e: any) {
      const message =
        e?.message ||
        txt(
          '명세서 파일이 없습니다. 급여 관리에서 명세서를 다시 발송해 주세요.',
          'Payslip file is missing. Please resend it from Payroll Management.'
        );
      setPreview((prev) => ({
        ...prev,
        loading: false,
        url: '',
        error: message,
      }));
      setError(message);
    }
  };

  const handleDownload = async (
    id: number,
    payrollPeriod: string,
    employeeName?: string | null
  ) => {
    setDownloadingId(id);
    try {
      const blob = await payrollService.downloadMyPayslip(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildPayslipPdfFilename(payrollPeriod, employeeName);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          txt('다운로드에 실패했습니다.', 'Download failed.')
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const formatMoney = (v: number | string | null | undefined) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return `INR ${Math.floor(n).toLocaleString('en-IN')}`;
  };

  const formatDate = (v?: string) => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(isEn ? 'en-IN' : 'ko-KR');
  };

  const headSx =
    typeof mvsTableHeadHighlightSx === 'function'
      ? mvsTableHeadHighlightSx(theme)
      : mvsTableHeadHighlightSx;
  const bodyRowSx =
    typeof mvsTableBodyRowSx === 'function' ? mvsTableBodyRowSx(theme) : mvsTableBodyRowSx;

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={txt('급여 명세서', 'My Payslips')}
        description={txt(
          '인사 담당자가 「급여 명세서 보내기」로 발송한 명세서만 표시됩니다. 급여 생성·마감만으로는 여기에 나타나지 않습니다. 행을 클릭해 미리보거나 PDF로 다운로드하세요.',
          'Only payslips sent by HR via “Send Payslips” appear here. Finalizing payroll alone does not add them. Click a row to preview or download the PDF.'
        )}
      />

      <Box sx={mvsFilterToolbarSx}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'center',
          }}
        >
          <TextField
            size="small"
            label={txt('급여월', 'Pay month')}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="YYYY-MM"
            sx={{ ...filterFieldSx, width: { xs: '100%', sm: 160 } }}
            {...mvsOutlinedLabelProps}
          />
          <TextField
            size="small"
            label={txt('검색', 'Search')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={txt('급여월·사번', 'Period / Emp ID')}
            sx={{ ...filterFieldSx, minWidth: { xs: '100%', sm: 220 }, flex: { sm: 1 } }}
            {...mvsOutlinedLabelProps}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load();
            }}
          />
          <Button
            variant="contained"
            disableElevation
            startIcon={<Search />}
            onClick={() => void load()}
            disabled={loading}
            sx={mvsBodyPrimaryBtnSx}
          >
            {txt('조회', 'Search')}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Box sx={mvsBodyListZoneSx}>
        {loading ? (
          <Box sx={listStateBoxSx}>
            <CircularProgress size={36} />
            <Typography variant="body2" color="text.secondary">
              {txt('급여 명세서를 불러오는 중...', 'Loading payslips...')}
            </Typography>
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={listStateBoxSx}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, letterSpacing: '-0.01em', color: 'text.primary' }}
            >
              {txt('저장된 급여 명세서가 없습니다.', 'No payslips saved.')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480 }}>
              {txt(
                '급여 관리에서 해당 월을 「급여 생성 완료」한 뒤, 「급여 명세서 보내기」로 메일을 발송해야 이 목록에 추가됩니다.',
                'After HR finalizes the pay month in Payroll Management, they must use “Send Payslips” before entries appear here.'
              )}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ ...mvsBodyListTableSx, ...mvsTableScrollSx }}>
            <Table
              size="small"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                bgcolor: 'transparent',
                '& .MuiTableCell-root': {
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderTop: 'none',
                },
              }}
            >
              <TableHead
                sx={{
                  ...(headSx as object),
                  '& .MuiTableCell-head': {
                    py: 0.75,
                    px: { xs: 1, sm: 1.25 },
                    whiteSpace: 'nowrap',
                  },
                }}
              >
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{txt('급여월', 'Period')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{txt('사번', 'Emp ID')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{txt('성명', 'Name')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    {txt('실수령액', 'Net')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{txt('발송일시', 'Sent at')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">
                    {txt('다운로드', 'Download')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody sx={bodyRowSx}>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    onClick={() => void openPreview(row)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.payroll_period || '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.emp_id || '—'}</TableCell>
                    <TableCell
                      sx={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 220,
                      }}
                    >
                      {row.employee_name || '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney(row.net_salary)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                      {formatDate(row.sent_at || row.created_at)}
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={
                          downloadingId === row.id ? (
                            <CircularProgress size={14} color="inherit" />
                          ) : (
                            <Download fontSize="small" />
                          )
                        }
                        disabled={downloadingId === row.id}
                        onClick={() => void handleDownload(row.id, row.payroll_period, row.employee_name)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 600,
                          fontSize: '0.8125rem',
                          borderColor: '#CBD5E1',
                          color: '#334155',
                          minHeight: 32,
                          px: 1.25,
                          '&:hover': { borderColor: '#94A3B8', bgcolor: '#F1F5F9' },
                        }}
                      >
                        PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Dialog open={preview.open} onClose={closePreview} maxWidth="md" fullWidth scroll="paper">
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05rem', pb: 1 }}>
          {preview.title || txt('급여 명세서', 'Payslip')}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, bgcolor: '#F1F5F9', minHeight: { xs: 360, sm: 520 } }}>
          {preview.loading ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                minHeight: { xs: 360, sm: 520 },
              }}
            >
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary">
                {txt('명세서를 불러오는 중...', 'Loading payslip...')}
              </Typography>
            </Box>
          ) : preview.error ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1.5,
                minHeight: { xs: 360, sm: 520 },
                px: 3,
                textAlign: 'center',
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#334155' }}>
                {txt('미리보기를 표시할 수 없습니다', 'Preview unavailable')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                {preview.error}
              </Typography>
            </Box>
          ) : preview.url ? (
            <Box
              component="iframe"
              title={preview.title}
              src={preview.url}
              sx={{
                display: 'block',
                width: '100%',
                height: { xs: '60vh', sm: '70vh' },
                border: 0,
                bgcolor: '#FFFFFF',
              }}
            />
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5, gap: 1 }}>
          <Button size="small" onClick={closePreview} sx={mvsBodyOutlinedBtnSx}>
            {txt('닫기', 'Close')}
          </Button>
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={
              preview.row && downloadingId === preview.row.id ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <Download fontSize="small" />
              )
            }
            disabled={!preview.row || !preview.url || downloadingId === preview.row?.id}
            onClick={() => {
              if (!preview.row) return;
              void handleDownload(
                preview.row.id,
                preview.row.payroll_period,
                preview.row.employee_name
              );
            }}
            sx={mvsBodyPrimaryBtnSx}
          >
            {txt('PDF 다운로드', 'Download PDF')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MyPayslips;
