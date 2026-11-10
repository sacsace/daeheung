export type SapAmountMode = 'separate_columns' | 'amount_indicator';

export type SapCanonicalField =
  | 'companyCode'
  | 'fiscalYear'
  | 'documentNumber'
  | 'postingDate'
  | 'documentDate'
  | 'documentType'
  | 'currencyCode'
  | 'exchangeRate'
  | 'glAccountCode'
  | 'glAccountName'
  | 'vendorCode'
  | 'vendorName'
  | 'customerCode'
  | 'customerName'
  | 'costCenter'
  | 'profitCenter'
  | 'taxCode'
  | 'assignment'
  | 'reference'
  | 'lineText'
  | 'debit'
  | 'credit'
  | 'amount'
  | 'debitCreditIndicator';

export type SapColumnMapping = Partial<Record<SapCanonicalField, string>>;

export type SapImportTemplateConfig = {
  columnMapping: SapColumnMapping;
  documentGroupKeys: SapCanonicalField[];
  amountMode: SapAmountMode;
  debitCreditConfig?: {
    debitIndicators?: string[];
    creditIndicators?: string[];
  };
};

export type SapRawRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type SapNormalizedRow = {
  rowNumber: number;
  rawValues: Record<string, string>;
  values: Partial<Record<SapCanonicalField, string>>;
  normalizedValues: Partial<Record<SapCanonicalField, string>>;
  debit: string;
  credit: string;
};

export type SapImportValidationIssue = {
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  field?: SapCanonicalField;
  rowNumber?: number;
  sourceValue?: string;
  message: string;
  suggestedAction?: string;
};

export type SapDocument = {
  documentKey: string;
  rows: SapNormalizedRow[];
};
