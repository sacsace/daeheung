import React, { useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { CloudUpload as UploadIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import AccountingCompanyBar from '../../components/Accounting/AccountingCompanyBar';
import { useAccountingCompany } from '../../hooks/useAccountingCompany';
import { useGlAccounts, type GlAccountOption } from '../../hooks/useGlAccounts';
import { accountingService } from '../../services/api';
import {
  mvsBodyCardSx,
  mvsBodyPrimaryBtnSx,
  mvsPageRootSx,
  mvsTableHeadHighlightSx,
} from '../../theme/daeheungLayout';

/** Keep in sync with server default `SAP_IMPORT_MAX_MB` (2048 = 2GB) */
const SAP_IMPORT_MAX_BYTES = 2048 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = ['xlsx', 'xls', 'csv'];
const WIZARD_STEPS = ['파일 업로드', '컬럼 확인', '매핑', '오류 검토', '전표 미리보기', '변환 완료'];

type Inspection = {
  fileName: string;
  sheetName: string;
  headers: string[];
};

type AmountMode = 'separate_columns' | 'amount_indicator';

type SapPreview = {
  totalRows: number;
  totalDocuments: number;
  validDocuments: number;
  warningCount: number;
  errorCount: number;
  issues: Array<{
    code: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
    rowNumber?: number;
    field?: string;
    message: string;
    suggestedAction?: string;
  }>;
};

type SapImportMapping = {
  id: number;
  mapping_type: 'gl' | 'party' | 'gst';
  source_code?: string | null;
  source_name?: string | null;
  target_account_id?: number | null;
  status: 'suggested' | 'approved' | 'rejected' | 'inactive';
  confidence_score?: string | null;
};

const MAPPING_FIELDS: Array<{ key: string; label: string; required?: boolean; hints: string[] }> = [
  { key: 'companyCode', label: 'Company Code', required: true, hints: ['company code', 'bukrs'] },
  { key: 'fiscalYear', label: 'Fiscal Year', required: true, hints: ['fiscal year', 'gjahr'] },
  { key: 'documentNumber', label: 'Document Number', required: true, hints: ['document number', 'belnr'] },
  { key: 'postingDate', label: 'Posting Date', hints: ['posting date', 'budat'] },
  { key: 'glAccountCode', label: 'SAP GL Account Code', hints: ['g/l account', 'gl account', 'hkont'] },
  { key: 'glAccountName', label: 'SAP GL Account Name', hints: ['g/l account name', 'gl account name', 'account name'] },
  { key: 'vendorCode', label: 'Vendor Code', hints: ['vendor code', 'lifnr'] },
  { key: 'vendorName', label: 'Vendor Name', hints: ['vendor name', 'vendor'] },
  { key: 'lineText', label: 'Line Text', hints: ['line text', 'item text', 'sgtxt'] },
];

const getSuggestedMapping = (headers: string[]): Record<string, string> =>
  Object.fromEntries(
    MAPPING_FIELDS.flatMap((field) => {
      const header = headers.find((candidate) => {
        const normalized = candidate.trim().toLowerCase();
        return field.hints.some((hint) => normalized === hint || normalized.includes(hint));
      });
      return header ? [[field.key, header]] : [];
    })
  );

const SapImport: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    canSelectCompany,
    companies,
    selectedCompanyId,
    effectiveCompanyId,
    selectedCompanyName,
    changeCompany,
  } = useAccountingCompany();
  const { ledgerAccounts } = useGlAccounts(true, effectiveCompanyId);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [amountMode, setAmountMode] = useState<AmountMode>('separate_columns');
  const [preview, setPreview] = useState<SapPreview | null>(null);
  const [savedMappings, setSavedMappings] = useState<SapImportMapping[]>([]);
  const [sourceGlCode, setSourceGlCode] = useState('');
  const [selectedTargetAccount, setSelectedTargetAccount] = useState<GlAccountOption | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const inspectFile = async () => {
    if (!file) {
      setError('먼저 SAP Excel 또는 CSV 파일을 선택하세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await accountingService.inspectSapImport(file, {
        company_id: effectiveCompanyId || undefined,
      });
      setInspection(response.data);
      setMapping(getSuggestedMapping(response.data.headers));
      setPreview(null);
    } catch (requestError: any) {
      setInspection(null);
      setError(requestError?.response?.data?.message || '파일 컬럼을 확인하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const chooseFile = (selected: File | undefined) => {
    setError('');
    setInspection(null);
    setPreview(null);
    if (!selected) return;
    const extension = selected.name.split('.').pop()?.toLowerCase() || '';
    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      setError('XLSX, XLS 또는 CSV 파일만 업로드할 수 있습니다.');
      return;
    }
    if (selected.size > SAP_IMPORT_MAX_BYTES) {
      setError('파일 크기는 2GB 이하여야 합니다.');
      return;
    }
    setFile(selected);
  };

  const previewImport = async () => {
    if (!file || !inspection) return;
    const missing = ['companyCode', 'fiscalYear', 'documentNumber'].filter((key) => !mapping[key]);
    const hasGlMapping = Boolean(mapping.glAccountCode || mapping.glAccountName);
    const amountFields = amountMode === 'separate_columns'
      ? Boolean(mapping.debit && mapping.credit)
      : Boolean(mapping.amount && mapping.debitCreditIndicator);
    if (missing.length || !hasGlMapping || !amountFields) {
      setError('필수 문서 키, GL Account, 금액 컬럼을 모두 매핑하세요.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await accountingService.previewSapImport(
        file,
        {
          columnMapping: mapping,
          documentGroupKeys: ['companyCode', 'fiscalYear', 'documentNumber'],
          amountMode,
          debitCreditConfig: amountMode === 'amount_indicator'
            ? { debitIndicators: ['S'], creditIndicators: ['H'] }
            : undefined,
        },
        { company_id: effectiveCompanyId || undefined }
      );
      setPreview(response.data);
      const mappingsResponse = await accountingService.getSapImportMappings({
        company_id: effectiveCompanyId || undefined,
        mappingType: 'gl',
      });
      setSavedMappings(Array.isArray(mappingsResponse.data) ? mappingsResponse.data : []);
    } catch (requestError: any) {
      setPreview(null);
      setError(requestError?.response?.data?.message || 'SAP 파일 검증에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const activeStep = preview ? 3 : inspection ? 2 : 0;

  const saveGlMapping = async () => {
    if (!sourceGlCode.trim() || !selectedTargetAccount) {
      setError('SAP GL Code와 연결할 MVS 원장을 선택하세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await accountingService.createSapImportMapping(
        {
          mappingType: 'gl',
          sourceCode: sourceGlCode,
          targetId: selectedTargetAccount.id,
        },
        effectiveCompanyId || undefined
      );
      setSourceGlCode('');
      setSelectedTargetAccount(null);
      const response = await accountingService.getSapImportMappings({
        company_id: effectiveCompanyId || undefined,
        mappingType: 'gl',
      });
      setSavedMappings(Array.isArray(response.data) ? response.data : []);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'SAP GL 매핑 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const approveMapping = async (mappingId: number) => {
    if (!approvalReason.trim()) {
      setError('승인 사유를 입력하세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await accountingService.approveSapImportMapping(
        mappingId,
        approvalReason,
        effectiveCompanyId || undefined
      );
      setApprovalReason('');
      setSavedMappings((previous) => previous.map((mapping) =>
        mapping.id === mappingId ? { ...mapping, status: 'approved' } : mapping
      ));
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'SAP 매핑 승인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title="SAP Data 불러오기"
        description="SAP Excel/CSV를 검토한 뒤 MVS 임시 전표로 변환합니다."
      />
      <AccountingCompanyBar
        canSelectCompany={canSelectCompany}
        companies={companies}
        selectedCompanyId={selectedCompanyId}
        selectedCompanyName={selectedCompanyName}
        onChangeCompany={changeCompany}
      />

      <Paper elevation={0} sx={{ ...mvsBodyCardSx, p: { xs: 1.25, sm: 2 }, mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'stretch', minWidth: 0, overflowX: 'auto' }}>
          {WIZARD_STEPS.map((label, index) => {
            const current = index === activeStep;
            const completed = index < activeStep;
            return (
              <Box
                key={label}
                sx={{
                  minWidth: { xs: 116, sm: 138 },
                  flex: 1,
                  px: 1,
                  py: 0.75,
                  border: '1px solid',
                  borderColor: current ? 'primary.main' : completed ? '#70AD47' : '#B4B4B4',
                  borderLeftWidth: index === 0 ? 1 : 0,
                  bgcolor: current ? '#C6EFCE' : '#FFFFFF',
                  color: current ? 'text.primary' : 'text.secondary',
                  fontSize: '0.75rem',
                  fontWeight: current ? 700 : 500,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}
              >
                {completed ? <CheckCircleIcon sx={{ fontSize: 15, mr: 0.45, verticalAlign: 'text-bottom' }} /> : null}
                {index + 1}. {label}
              </Box>
            );
          })}
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ ...mvsBodyCardSx, p: { xs: 1.5, sm: 2 }, borderRadius: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.35 }}>
          1. SAP 파일 업로드
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          지원 형식: XLSX, XLS, CSV · 최대 2GB. 파일은 컬럼 확인 후 서버에 보관하지 않습니다.
        </Typography>

        {error ? <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert> : null}
        <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1 }}>
          <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => fileInputRef.current?.click()}>
            파일 선택
          </Button>
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />
          <Typography variant="body2" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : '선택된 파일 없음'}
          </Typography>
          <Button
            variant="contained"
            disableElevation
            sx={{ ...mvsBodyPrimaryBtnSx, ml: { xs: 0, sm: 'auto' } }}
            onClick={() => void inspectFile()}
            disabled={!file || loading}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : '컬럼 확인'}
          </Button>
        </Box>
      </Paper>

      {inspection ? (
        <Paper elevation={0} sx={{ ...mvsBodyCardSx, mt: 1.5, p: { xs: 1.5, sm: 2 }, borderRadius: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            2. 컬럼 확인
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
            {inspection.fileName} · 시트: {inspection.sheetName} · {inspection.headers.length}개 컬럼
          </Typography>
          <Table size="small" sx={{ border: '1px solid #B4B4B4', '& .MuiTableCell-root': { borderColor: '#B4B4B4' } }}>
            <TableHead sx={mvsTableHeadHighlightSx}>
              <TableRow>
                <TableCell width={80}>순서</TableCell>
                <TableCell>원본 SAP 컬럼</TableCell>
                <TableCell>매핑 상태</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inspection.headers.map((header, index) => (
                <TableRow key={header}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{header}</TableCell>
                  <TableCell>{Object.values(mapping).includes(header) ? '선택됨' : '미선택'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 2.5, mb: 0.5 }}>
            3. 표준 필드 매핑
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
            원본 파일은 수정하지 않습니다. 여기서 선택한 연결값만 검증과 전표 변환에 사용됩니다.
          </Typography>
          <Table size="small" sx={{ border: '1px solid #B4B4B4', '& .MuiTableCell-root': { borderColor: '#B4B4B4' } }}>
            <TableHead sx={mvsTableHeadHighlightSx}>
              <TableRow>
                <TableCell width="42%">MVS 표준 필드</TableCell>
                <TableCell>원본 SAP 컬럼</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {MAPPING_FIELDS.map((field) => (
                <TableRow key={field.key}>
                  <TableCell>
                    {field.label}{field.required ? <Box component="span" sx={{ color: 'error.main', ml: 0.4 }}>*</Box> : null}
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      fullWidth
                      displayEmpty
                      value={mapping[field.key] || ''}
                      onChange={(event) => {
                        setMapping((previous) => ({ ...previous, [field.key]: String(event.target.value) }));
                        setPreview(null);
                      }}
                    >
                      <MenuItem value=""><em>매핑하지 않음</em></MenuItem>
                      {inspection.headers.map((header) => <MenuItem key={header} value={header}>{header}</MenuItem>)}
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>
                  <FormControl size="small" fullWidth>
                    <InputLabel id="sap-amount-mode-label">금액 방식</InputLabel>
                    <Select
                      labelId="sap-amount-mode-label"
                      label="금액 방식"
                      value={amountMode}
                      onChange={(event) => {
                        setAmountMode(event.target.value as AmountMode);
                        setPreview(null);
                      }}
                    >
                      <MenuItem value="separate_columns">Debit / Credit 별도 컬럼</MenuItem>
                      <MenuItem value="amount_indicator">Amount + Debit/Credit Indicator</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  {amountMode === 'separate_columns' ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {(['debit', 'credit'] as const).map((key) => (
                        <Select
                          key={key}
                          size="small"
                          fullWidth
                          displayEmpty
                          value={mapping[key] || ''}
                          onChange={(event) => setMapping((previous) => ({ ...previous, [key]: String(event.target.value) }))}
                        >
                          <MenuItem value=""><em>{key === 'debit' ? 'Debit' : 'Credit'} 선택</em></MenuItem>
                          {inspection.headers.map((header) => <MenuItem key={header} value={header}>{header}</MenuItem>)}
                        </Select>
                      ))}
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {(['amount', 'debitCreditIndicator'] as const).map((key) => (
                        <Select
                          key={key}
                          size="small"
                          fullWidth
                          displayEmpty
                          value={mapping[key] || ''}
                          onChange={(event) => setMapping((previous) => ({ ...previous, [key]: String(event.target.value) }))}
                        >
                          <MenuItem value=""><em>{key === 'amount' ? 'Amount' : 'Indicator'} 선택</em></MenuItem>
                          {inspection.headers.map((header) => <MenuItem key={header} value={header}>{header}</MenuItem>)}
                        </Select>
                      ))}
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
            <Button
              variant="contained"
              disableElevation
              sx={mvsBodyPrimaryBtnSx}
              onClick={() => void previewImport()}
              disabled={loading}
            >
              {loading ? <CircularProgress size={18} color="inherit" /> : '오류 검토 실행'}
            </Button>
          </Box>
        </Paper>
      ) : null}
      {preview ? (
        <Paper elevation={0} sx={{ ...mvsBodyCardSx, mt: 1.5, p: { xs: 1.5, sm: 2 }, borderRadius: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>4. 오류 검토</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 1, mb: 1.5 }}>
            {[
              ['전체 행', preview.totalRows],
              ['문서', preview.totalDocuments],
              ['정상 문서', preview.validDocuments],
              ['경고', preview.warningCount],
              ['오류', preview.errorCount],
            ].map(([label, value]) => (
              <Box key={String(label)} sx={{ border: '1px solid #B4B4B4', px: 1, py: 0.75, bgcolor: '#FFFFFF' }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>{value}</Typography>
              </Box>
            ))}
          </Box>
          {preview.issues.length === 0 ? (
            <Alert severity="success">현재 검증 범위에서 오류가 없습니다. 다음 단계에서 전표 미리보기를 제공합니다.</Alert>
          ) : (
            <Table size="small" sx={{ border: '1px solid #B4B4B4', '& .MuiTableCell-root': { borderColor: '#B4B4B4' } }}>
              <TableHead sx={mvsTableHeadHighlightSx}>
                <TableRow>
                  <TableCell width={95}>수준</TableCell>
                  <TableCell width={75}>행</TableCell>
                  <TableCell width={190}>코드</TableCell>
                  <TableCell>내용</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.issues.map((issue, index) => (
                  <TableRow key={`${issue.code}-${issue.rowNumber || 'document'}-${index}`}>
                    <TableCell sx={{ color: issue.severity === 'ERROR' ? 'error.main' : issue.severity === 'WARNING' ? 'warning.dark' : 'text.secondary', fontWeight: 700 }}>
                      {issue.severity}
                    </TableCell>
                    <TableCell>{issue.rowNumber || '-'}</TableCell>
                    <TableCell>{issue.code}</TableCell>
                    <TableCell>{issue.message}{issue.suggestedAction ? ` · ${issue.suggestedAction}` : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      ) : null}
      {preview ? (
        <Paper elevation={0} sx={{ ...mvsBodyCardSx, mt: 1.5, p: { xs: 1.5, sm: 2 }, borderRadius: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>SAP GL 매핑</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
            제안된 매핑은 승인 전에는 전표 변환에 사용되지 않습니다.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px minmax(280px, 1fr) auto' }, gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              label="SAP GL Code"
              value={sourceGlCode}
              onChange={(event) => setSourceGlCode(event.target.value)}
            />
            <Autocomplete
              size="small"
              options={ledgerAccounts}
              value={selectedTargetAccount}
              onChange={(_, value) => setSelectedTargetAccount(value)}
              getOptionLabel={(account) => `${account.code} · ${account.name}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="MVS 원장 계정" />}
            />
            <Button variant="outlined" onClick={() => void saveGlMapping()} disabled={loading}>
              제안 저장
            </Button>
          </Box>
          {savedMappings.length > 0 ? (
            <>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 2, mb: 1 }}>
                <TextField
                  size="small"
                  label="승인 사유"
                  value={approvalReason}
                  onChange={(event) => setApprovalReason(event.target.value)}
                  sx={{ width: { xs: '100%', sm: 360 } }}
                />
                <Typography variant="caption" color="text.secondary">제안 행의 승인 버튼을 누르면 적용됩니다.</Typography>
              </Box>
              <Table size="small" sx={{ border: '1px solid #B4B4B4', '& .MuiTableCell-root': { borderColor: '#B4B4B4' } }}>
                <TableHead sx={mvsTableHeadHighlightSx}>
                  <TableRow>
                    <TableCell>SAP GL</TableCell>
                    <TableCell>대상 원장 ID</TableCell>
                    <TableCell>상태</TableCell>
                    <TableCell width={110}>작업</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {savedMappings.map((savedMapping) => (
                    <TableRow key={savedMapping.id}>
                      <TableCell>{savedMapping.source_code || savedMapping.source_name || '-'}</TableCell>
                      <TableCell>{savedMapping.target_account_id || '-'}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: savedMapping.status === 'approved' ? 'success.dark' : 'warning.dark' }}>
                        {savedMapping.status}
                      </TableCell>
                      <TableCell>
                        {savedMapping.status === 'suggested' ? (
                          <Button size="small" variant="contained" disableElevation onClick={() => void approveMapping(savedMapping.id)} disabled={loading}>
                            승인
                          </Button>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}
        </Paper>
      ) : null}
    </Box>
  );
};

export default SapImport;
