import React, { useCallback, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Snackbar,
  TextField,
  Typography,
  Alert,
  Stack,
  InputAdornment,
  CircularProgress,
  Tooltip
} from '@mui/material';
import DaeheungPageHeader from '../../components/Common/DaeheungPageHeader';
import {
  mvsPageRootSx,
  mvsBodyCardSx,
  mvsBodyPrimaryBtnSx,
  mvsSearchFieldSx,
  mvsInnerCardSx } from '../../theme/daeheungLayout';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { inventoryService } from '../../services/api';
import { useMenuStore } from '../../store';
import { useMenuRoutePermissionFlags } from '../../hooks/useMenuRoutePermissionFlags';
import { resolveMediaUrl } from '../../utils/uploadUrl';

const STOCK_IN_MENU_ROUTES = ['/inventory/stock-in', '/inventory'] as const;

type ProductLookup = {
  id: number;
  product_code?: string;
  name?: string;
  category?: string;
  unit?: string;
  stock_quantity?: number;
  image_url?: string;
};

const resolveProductImageUrl = resolveMediaUrl;

/** 품목코드와 정확히 일치하는 제품만 조회 (바코드 스캔용) */
async function findProductByExactCode(code: string): Promise<ProductLookup | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const res = await inventoryService.getProducts({ search: trimmed, limit: 100 });
  const rows = (res as any)?.data ?? [];
  const upper = trimmed.toUpperCase();
  return (
    rows.find((p: { product_code?: string }) => (p.product_code || '').trim().toUpperCase() === upper) ?? null
  );
}

/** 통합 입력: 전체 문자열 또는 `이름 · 품목코드`에서 품목코드 접미로 정확 일치 조회 */
async function findProductFromComboInput(text: string): Promise<ProductLookup | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const direct = await findProductByExactCode(trimmed);
  if (direct) return direct;
  if (!trimmed.includes('·')) return null;
  const suffix = trimmed.split('·').pop()?.trim() ?? '';
  if (!suffix || suffix === trimmed) return null;
  return findProductByExactCode(suffix);
}

/** 입고 관리 — 이미 등록된 품목에 대한 추가 입고만 처리 */
const StockInSimple: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { language } = useMenuStore();
  const perm = useMenuRoutePermissionFlags(STOCK_IN_MENU_ROUTES);
  const txt = useCallback((ko: string, en: string) => (language === 'en' ? en : ko), [language]);
  const codeRef = useRef<HTMLInputElement | null>(null);
  /** 제품명 검색 + 품목코드/바코드 입력 통합 필드 */
  const [comboInput, setComboInput] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [stockQuantity, setStockQuantity] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [matchedProductId, setMatchedProductId] = useState<number | null>(null);
  const [matchedCurrentStock, setMatchedCurrentStock] = useState<number | null>(null);
  /** 조회 완료 후 해당 코드의 등록 품목 없음 */
  const [lookupNotFound, setLookupNotFound] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string>('');
  const [snack, setSnack] = useState<{ open: boolean; msg: string; ok: boolean }>({
    open: false,
    msg: '',
    ok: true
  });

  const [nameSearchOptions, setNameSearchOptions] = useState<ProductLookup[]>([]);
  const [nameSearchLoading, setNameSearchLoading] = useState(false);
  /** 제품명 검색에서 선택된 값(코드 조회 성공 시에도 동기화) */
  const [namePick, setNamePick] = useState<ProductLookup | null>(null);
  const nameSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatProductComboLabel = useCallback((p: ProductLookup) => {
    const code = (p.product_code || '').trim();
    const nm = (p.name || '').trim() || '—';
    return code ? `${nm} · ${code}` : nm;
  }, []);

  const clearProductFields = useCallback(() => {
    setMatchedProductId(null);
    setMatchedCurrentStock(null);
    setName('');
    setCategory('');
    setUnit('');
    setPreviewImageUrl('');
    setNamePick(null);
    setStockQuantity(0);
  }, []);

  const applyProductFromLookup = useCallback((product: ProductLookup) => {
    if (!product?.id) return;
    setMatchedProductId(product.id);
    setComboInput(formatProductComboLabel(product));
    setName(String(product.name ?? ''));
    setCategory(String(product.category ?? '').trim() || '—');
    setUnit(String(product.unit ?? '').trim() || '—');
    setMatchedCurrentStock(
      typeof product.stock_quantity === 'number' ? product.stock_quantity : Number(product.stock_quantity) || 0
    );
    setStockQuantity(0);
    setPreviewImageUrl(resolveProductImageUrl(product.image_url));
    setLookupNotFound(false);
    setNamePick(product);
  }, [formatProductComboLabel]);

  const runLookup = useCallback(async () => {
    const code = comboInput.trim();
    if (!code) {
      setLookupNotFound(false);
      clearProductFields();
      return;
    }
    if (namePick && formatProductComboLabel(namePick) === code) {
      return;
    }
    setLookupLoading(true);
    setLookupNotFound(false);
    try {
      const product = await findProductFromComboInput(code);
      if (product?.id) {
        applyProductFromLookup(product);
      } else {
        setMatchedProductId(null);
        setMatchedCurrentStock(null);
        setName('');
        setCategory('');
        setUnit('');
        setPreviewImageUrl('');
        setNamePick(null);
        setLookupNotFound(true);
      }
    } catch {
      setMatchedProductId(null);
      setMatchedCurrentStock(null);
      setLookupNotFound(false);
      setName('');
      setCategory('');
      setUnit('');
      setPreviewImageUrl('');
      setNamePick(null);
      setSnack({ open: true, msg: txt('품목 조회에 실패했습니다.', 'Product lookup failed.'), ok: false });
    } finally {
      setLookupLoading(false);
    }
  }, [comboInput, namePick, formatProductComboLabel, applyProductFromLookup, clearProductFields, txt]);

  const resetForm = useCallback(() => {
    setComboInput('');
    setName('');
    setCategory('');
    setUnit('');
    setStockQuantity(0);
    setMatchedProductId(null);
    setMatchedCurrentStock(null);
    setLookupNotFound(false);
    setPreviewImageUrl('');
    setNamePick(null);
    setNameSearchOptions([]);
    codeRef.current?.focus();
  }, []);

  const onNameSearchInput = useCallback((_e: unknown, value: string, reason: string) => {
    if (reason === 'reset') return;
    if (nameSearchDebounceRef.current) clearTimeout(nameSearchDebounceRef.current);
    nameSearchDebounceRef.current = setTimeout(async () => {
      const q = value.trim();
      if (!q) {
        setNameSearchOptions([]);
        return;
      }
      setNameSearchLoading(true);
      try {
        const res = await inventoryService.getProducts({ search: q, limit: 40 });
        setNameSearchOptions(((res as any)?.data ?? []) as ProductLookup[]);
      } catch {
        setNameSearchOptions([]);
      } finally {
        setNameSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleComboInputChange = useCallback(
    (_e: unknown, newInput: string, reason: string) => {
      setComboInput(newInput);
      if (reason === 'reset') return;
      if (namePick && formatProductComboLabel(namePick) !== newInput) {
        setMatchedProductId(null);
        setMatchedCurrentStock(null);
        setName('');
        setCategory('');
        setUnit('');
        setPreviewImageUrl('');
        setNamePick(null);
        setLookupNotFound(false);
        setStockQuantity(0);
      }
      onNameSearchInput(_e, newInput, reason);
    },
    [namePick, formatProductComboLabel, onNameSearchInput]
  );

  const submit = useCallback(async () => {
    if (!perm.canMutate) {
      setSnack({ open: true, msg: t('common.menuNoMutate'), ok: false });
      return;
    }
    const nm = name.trim();
    if (matchedProductId == null) {
      setSnack({
        open: true,
        msg: txt(
          '등록된 품목코드로 조회된 품목이 있어야 입고할 수 있습니다.',
          'Select a registered product (lookup by code) before receiving stock.'
        ),
        ok: false
      });
      return;
    }
    if (!nm) {
      setSnack({
        open: true,
        msg: txt('품목 정보를 불러올 수 없습니다. 다시 조회하세요.', 'Could not load product. Look up again.'),
        ok: false
      });
      return;
    }
    if (stockQuantity < 1) {
      setSnack({
        open: true,
        msg: txt('입고 수량은 1 이상 입력하세요.', 'Enter a quantity of at least 1.'),
        ok: false
      });
      return;
    }

    setLoading(true);
    try {
      const res = await inventoryService.stockIn({
        product_id: matchedProductId,
        quantity: stockQuantity,
        notes: txt('입고(입고 관리)', 'Stock in (Receiving)')
      });
      if (!(res as any)?.success) {
        setSnack({
          open: true,
          msg: (res as any)?.message || txt('입고 처리에 실패했습니다.', 'Stock-in failed.'),
          ok: false
        });
        return;
      }
      setSnack({
        open: true,
        msg:
          language === 'en'
            ? `Received · ${nm} (+${stockQuantity})`
            : `입고 완료 · ${nm} (+${stockQuantity})`,
        ok: true
      });
      resetForm();
    } catch (e: any) {
      setSnack({
        open: true,
        msg: e?.response?.data?.message || e?.message || txt('처리에 실패했습니다.', 'Request failed.'),
        ok: false
      });
    } finally {
      setLoading(false);
    }
  }, [name, stockQuantity, matchedProductId, resetForm, txt, language, perm.canMutate, t]);

  const fieldLabelSx = {
    mb: 1,
    fontSize: '0.875rem',
    fontWeight: 600,
    letterSpacing: '-0.015em',
    color: 'text.primary',
    lineHeight: 1.35 } as const;

  /** 편집 가능 입력 — MVS Body 검색 필드 + 폼 높이 */
  const appleInputSx = {
    ...(mvsSearchFieldSx as Record<string, unknown>),
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.1 : 0.05),
      minHeight: 48,
      transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color'], { duration: 180 }),
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: '#CBD5E1' },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: '#94A3B8' },
      '& fieldset': {
        borderColor: '#CBD5E1' },
      '&:hover fieldset': {
        borderColor: '#94A3B8' },
      '&:hover': {
        bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.14 : 0.08) },
      '&.Mui-focused': {
        bgcolor: 'background.paper',
        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.18)}`,
        '& fieldset': {
          borderColor: alpha(theme.palette.divider, 0.95),
          borderWidth: 1 } },
      '&.Mui-disabled': {
        bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.06 : 0.04) } },
    '& .MuiOutlinedInput-input': {
      py: 1.35,
      fontSize: '0.9375rem',
      letterSpacing: '-0.02em' },
    '& .MuiOutlinedInput-input::placeholder': {
      color: alpha(theme.palette.text.secondary, 0.85),
      opacity: 1 },
    '& .MuiFormHelperText-root': {
      mt: 1.25,
      mx: 0,
      px: 0.25,
      letterSpacing: '-0.01em',
      fontSize: '0.75rem',
      lineHeight: 1.5,
      color: alpha(theme.palette.text.secondary, 0.95) } };

  /** 조회된 품목 읽기 전용 — MVS Body 검색 필드 톤 + 읽기 전용 배경 */
  const appleReadOnlySx = {
    ...(mvsSearchFieldSx as Record<string, unknown>),
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      minHeight: 48,
      bgcolor: alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.06 : 0.04),
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: '#CBD5E1' },
      '& fieldset': {
        borderColor: '#CBD5E1' },
      '&:hover fieldset': {
        borderColor: '#94A3B8' } },
    '& .MuiOutlinedInput-input': {
      py: 1.35,
      fontSize: '0.9375rem',
      letterSpacing: '-0.02em' },
    '& .MuiFormHelperText-root': {
      mt: 1.25,
      mx: 0,
      px: 0.25,
      letterSpacing: '-0.01em',
      fontSize: '0.75rem',
      lineHeight: 1.5,
      color: alpha(theme.palette.text.secondary, 0.95) } };

  return (
    <Box sx={mvsPageRootSx}>
      <DaeheungPageHeader
        title={txt('입고 관리', 'Receiving')}
        description={
          <>
            {txt(
              '이미 시스템에 등록된 품목만 입고할 수 있습니다. 아래 한 칸에서 제품명·코드로 검색해 선택하거나, 품목코드를 입력·스캔한 뒤 Enter 또는 포커스를 옮기면 품목 정보와 이미지를 불러옵니다.',
              'Only registered products can be received here. In the field below, search by name or code and pick a product, or type/scan an item code and press Enter (or move focus) to load details and the image.'
            )}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 1, lineHeight: 1.55, maxWidth: 720 }}>
              {txt(
                '신규 제품은 재고(제품) 관리에서 먼저 등록하세요. 출고는 "출고 관리"에서 바코드로 처리합니다.',
                'Register new products in Inventory (Products) first. Outbound stock uses barcodes in Outbound management.'
              )}
            </Typography>
          </>
        }
      />

      <Card elevation={0} sx={mvsBodyCardSx}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: { xs: 2, sm: 2.5 }, py: 2.5 }}>
            <Stack spacing={3}>
              <Typography
                component="label"
                sx={{
                  ...fieldLabelSx,
                  mb: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  columnGap: 0.75,
                  rowGap: 0.5 }}
              >
                {txt('제품 검색 · 품목코드 / 바코드', 'Product search · item code / barcode')}
                <Box component="span" sx={{ color: 'error.main', px: 0.375, display: 'inline-flex' }}>
                  *
                </Box>
              </Typography>
              <Autocomplete<ProductLookup, false, false, false>
                slotProps={{
                  paper: {
                    elevation: 0,
                    sx: {
                      mt: 1,
                      borderRadius: '8px',
                      border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                      boxShadow:
                        theme.palette.mode === 'light'
                          ? '0 12px 40px rgba(15, 23, 42, 0.1)'
                          : '0 12px 40px rgba(0,0,0,0.45)' } } }}
                value={namePick}
                inputValue={comboInput}
                disabled={perm.menusLoading || !perm.canMutate}
                onChange={(_e, v) => {
                  if (v && typeof v === 'object' && v.id) {
                    applyProductFromLookup(v);
                  } else {
                    setComboInput('');
                    setLookupNotFound(false);
                    clearProductFields();
                  }
                }}
                onInputChange={handleComboInputChange}
                options={nameSearchOptions}
                loading={nameSearchLoading}
                filterOptions={(x) => x}
                getOptionLabel={(p) => formatProductComboLabel(p)}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                fullWidth
                size="medium"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    inputRef={codeRef}
                    hiddenLabel
                    autoFocus
                    placeholder={txt(
                      '제품명·코드 검색 또는 코드 입력·스캔',
                      'Search by name or code, or type/scan code'
                    )}
                    helperText={
                      nameSearchLoading || lookupLoading
                        ? txt('조회 중…', 'Looking up…')
                        : matchedProductId
                          ? txt(
                              `조회됨 · 현재 재고 ${matchedCurrentStock ?? 0}`,
                              `Found · current stock ${matchedCurrentStock ?? 0}`
                            )
                          : lookupNotFound
                            ? txt(
                                '등록된 품목이 없습니다. 제품 등록 후 다시 시도하세요.',
                                'No matching product. Register the product first, then try again.'
                              )
                            : txt(
                                '목록에서 선택하거나, 품목코드 입력 후 Enter·포커스 이동 시 정확 일치 조회',
                                'Pick from the list, or enter an item code and press Enter or move focus for exact match.'
                              )
                    }
                    FormHelperTextProps={{ sx: { mx: 0 } }}
                    sx={appleInputSx}
                    inputProps={{
                      ...params.inputProps,
                      'aria-label': txt('제품 검색 · 품목코드 / 바코드', 'Product search · item code / barcode'),
                      onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                        params.inputProps.onBlur?.(e);
                        void runLookup();
                      },
                      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                        params.inputProps.onKeyDown?.(e);
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void runLookup();
                        }
                      } }}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {nameSearchLoading || lookupLoading ? (
                            <InputAdornment position="end">
                              <CircularProgress color="inherit" size={20} />
                            </InputAdornment>
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ) }}
                  />
                )}
              />
            </Stack>

            {lookupNotFound && (
              <Alert severity="warning" variant="outlined" sx={{ borderRadius: '8px' }}>
                {txt(
                  '이 품목코드로 등록된 제품이 없습니다. 재고(제품) 관리에서 제품을 먼저 등록한 뒤 입고하세요.',
                  'No product is registered for this code. Add the product in Inventory (Products), then receive stock here.'
                )}
              </Alert>
            )}

            {matchedProductId != null && (
              <>
                <Box
                  sx={{
                    ...mvsInnerCardSx,
                    p: 2,
                    minHeight: 160,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center' }}
                >
                  {previewImageUrl ? (
                    <Box
                      component="img"
                      src={previewImageUrl}
                      alt=""
                      sx={{
                        maxHeight: 220,
                        maxWidth: '100%',
                        width: 'auto',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        bgcolor: 'background.paper' }}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ letterSpacing: '-0.01em' }}>
                      {txt('등록된 제품 이미지가 없습니다.', 'No product image on file.')}
                    </Typography>
                  )}
                </Box>

                <Box>
                  <Typography component="label" sx={fieldLabelSx}>
                    {txt('품명', 'Product name')}
                    <Box component="span" sx={{ color: 'error.main', ml: 0.25 }}>
                      *
                    </Box>
                  </Typography>
                  <TextField
                    hiddenLabel
                    value={name}
                    fullWidth
                    size="medium"
                    required
                    variant="outlined"
                    InputProps={{ readOnly: true }}
                    placeholder="—"
                    helperText={txt('조회된 품목 정보입니다. 수정할 수 없습니다.', 'Looked-up product (read-only).')}
                    FormHelperTextProps={{ sx: { mx: 0 } }}
                    sx={appleReadOnlySx}
                  />
                </Box>
                <Box>
                  <Typography component="label" sx={fieldLabelSx}>
                    {txt('카테고리', 'Category')}
                  </Typography>
                  <TextField
                    hiddenLabel
                    value={category}
                    fullWidth
                    size="medium"
                    variant="outlined"
                    InputProps={{ readOnly: true }}
                    placeholder="—"
                    sx={appleReadOnlySx}
                  />
                </Box>
                <Box>
                  <Typography component="label" sx={fieldLabelSx}>
                    {txt('단위', 'Unit')}
                  </Typography>
                  <TextField
                    hiddenLabel
                    value={unit}
                    fullWidth
                    size="medium"
                    variant="outlined"
                    InputProps={{ readOnly: true }}
                    placeholder="—"
                    sx={appleReadOnlySx}
                  />
                </Box>
                <Box>
                  <Typography component="label" sx={fieldLabelSx}>
                    {txt('입고 수량', 'Quantity to receive')}
                    <Box component="span" sx={{ color: 'error.main', ml: 0.25 }}>
                      *
                    </Box>
                  </Typography>
                  <TextField
                    hiddenLabel
                    type="number"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(Math.max(0, Number(e.target.value) || 0))}
                    inputProps={{ min: 0 }}
                    fullWidth
                    size="medium"
                    variant="outlined"
                    disabled={perm.menusLoading || !perm.canMutate}
                    placeholder="0"
                    helperText={txt(
                      `현재 재고 ${matchedCurrentStock ?? 0}에 더해질 수량입니다.`,
                      `Amount to add to current stock (${matchedCurrentStock ?? 0}).`
                    )}
                    FormHelperTextProps={{ sx: { mx: 0 } }}
                    sx={{
                      ...appleInputSx,
                      '& .MuiOutlinedInput-input': { fontVariantNumeric: 'tabular-nums' } }}
                  />
                </Box>
                <Tooltip title={t('common.menuNoMutate')} disableHoverListener={perm.menusLoading || perm.canMutate}>
                  <span style={{ display: 'block' }}>
                    <Button
                      variant="contained"
                      disableElevation
                      size="large"
                      disabled={loading || lookupLoading || perm.menusLoading || !perm.canMutate}
                      onClick={submit}
                      fullWidth
                      sx={{
                        ...mvsBodyPrimaryBtnSx,
                        mt: 0.5,
                        py: 1.35,
                        minHeight: 48,
                        fontSize: '0.95rem' }}
                    >
                      {txt('입고 처리', 'Receive stock')}
                    </Button>
                  </span>
                </Tooltip>
              </>
            )}
          </CardContent>
        </Card>
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.ok ? 'success' : 'error'} variant="filled" sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default StockInSimple;
