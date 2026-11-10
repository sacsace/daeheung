import React, { useMemo } from 'react';
import { Autocomplete, Card, CardContent, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { mvsBodyCardSx, mvsOutlinedLabelProps, mvsSearchFieldSx } from '../../theme/daeheungLayout';
import type { AccountingCompany } from '../../hooks/useAccountingCompany';
import {
  companySelectListboxSlotProps,
  companySelectNowrapSx,
  shortCompanyName,
} from '../../utils/companyDisplayName';

type Props = {
  canSelectCompany: boolean;
  companies: AccountingCompany[];
  selectedCompanyId: number | '';
  selectedCompanyName: string;
  onChangeCompany: (companyId: number) => void;
};

const AccountingCompanyBar: React.FC<Props> = ({
  canSelectCompany,
  companies,
  selectedCompanyId,
  onChangeCompany,
}) => {
  const { t } = useTranslation();

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  /** root·audit만 회사 선택 UI 필요 — 일반 사용자·관리자는 본인 회사로 고정 */
  if (!canSelectCompany) {
    return null;
  }

  return (
    <Card elevation={0} sx={{ ...mvsBodyCardSx, mb: 2 }}>
      <CardContent sx={{ py: '12px !important', display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Autocomplete
          options={companies}
          value={selectedCompany}
          onChange={(_, newValue) => {
            if (newValue?.id) onChangeCompany(newValue.id);
          }}
          getOptionLabel={(option) => shortCompanyName(option.name) || option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          disableClearable={Boolean(selectedCompany)}
          slotProps={companySelectListboxSlotProps}
          sx={{
            minWidth: 280,
            width: { xs: '100%', sm: 360 },
            ...mvsSearchFieldSx,
            ...companySelectNowrapSx,
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label={t('accountingScope.company')}
              {...mvsOutlinedLabelProps}
              placeholder={t('accountingScope.searchCompany', { defaultValue: 'Search company' })}
              sx={companySelectNowrapSx}
            />
          )}
        />
        <Typography variant="body2" color="text.secondary">
          {t('accountingScope.hint')}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default AccountingCompanyBar;
