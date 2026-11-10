/** 표시용 회사명 — Private Limited / Pvt Ltd 등 법적 접미사 제거 */
export function shortCompanyName(name?: string | null): string {
  return String(name || '')
    .replace(/\bprivate\s+limited\b\.?/gi, '')
    .replace(/\bprivate\s+ltd\.?\b/gi, '')
    .replace(/\bpvt\.?\s*ltd\.?\b/gi, '')
    .replace(/\bpvt\.?\s*limited\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,\s]+$/g, '')
    .trim();
}

/** 회사 Autocomplete/Select — 한 줄 + 말줄임 */
export const companySelectNowrapSx = {
  '& .MuiAutocomplete-input, & .MuiSelect-select, & .MuiInputBase-input': {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
} as const;

export const companySelectListboxSlotProps = {
  paper: {
    sx: {
      width: 'max-content',
      minWidth: '100%',
      maxWidth: 'min(560px, 92vw)',
    },
  },
  listbox: {
    sx: {
      '& .MuiAutocomplete-option': {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'block',
      },
    },
  },
} as const;
