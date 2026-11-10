import type { SxProps, Theme } from '@mui/material/styles';

/** 엑셀 데이터 영역 — 아주 얇은 격자선 */
const GRID_LINE = '#D4D4D4';

/** 급여 그리드 헤더 열 색상 — 저채도 슬레이트 톤 (헤더만) */
const PAYROLL_COL = {
  salary: { head: '#EEF1F5', text: '#475569', accent: '#CBD5E1' },
  salaryTotal: { bg: '#EDF3FA', head: '#D5E3F0', text: '#334155', accent: '#7DA3C4' },
  days: { head: '#EDF0F3', text: '#475569', accent: '#CBD5E1' },
  attendance: { head: '#F0EFED', text: '#475569', accent: '#CBD5E1' },
  extra: { head: '#F4F6F8', text: '#475569', accent: '#CBD5E1' },
  sum: { bg: '#F3F5F8', head: '#E4E9EF', text: '#334155', accent: '#94A3B8' },
  employer: { head: '#EEEEF2', text: '#475569', accent: '#CBD5E1' },
  employee: { head: '#F0EEEE', text: '#475569', accent: '#CBD5E1' },
  net: { bg: '#F4F6F5', head: '#E6EBE8', text: '#1E293B', accent: '#94A3B8' },
} as const;

/** MVS Body 리스트 헤더 톤 + 급여 그리드 (헤더=영역 구분, 본문=엑셀) */
export const payrollDataGridSx: SxProps<Theme> = (theme) => {
  const light = theme.palette.mode === 'light';
  const headBg = light ? '#F1F5F9' : theme.palette.grey[800];
  const headFg = light ? '#475569' : theme.palette.grey[200];
  const headBorder = light ? '#A8B4C0' : theme.palette.divider;
  const line = light ? GRID_LINE : theme.palette.divider;
  const thinBorder = `1px solid ${line}`;

  return {
    border: 'none',
    borderRadius: 0,
    fontSize: '0.8125rem',
    outline: 'none',
    '& .MuiDataGrid-main': { borderRadius: 0 },
    '& .MuiDataGrid-virtualScroller': {
      minHeight: 'unset !important',
      overflowX: 'hidden !important',
      overflowY: 'hidden !important',
    },
    '& .MuiDataGrid-virtualScrollerContent': { minHeight: 'unset !important' },
    '& .MuiDataGrid-scrollbar--horizontal': { display: 'none !important' },
    '& .MuiDataGrid-scrollbarFiller': { display: 'none !important' },
    '& .MuiDataGrid-columnSeparator': { display: 'none' },
    '& .MuiDataGrid-withBorderColor': { borderColor: line },

    /* ── 헤더 (이전 영역 구분 유지) ── */
    '& .MuiDataGrid-columnHeaders': {
      backgroundColor: headBg,
      color: headFg,
      borderBottom: `1px solid ${headBorder}`,
      borderTop: 'none',
      fontSize: '0.75rem',
      minHeight: 48,
      borderRadius: 0,
    },
    '& .MuiDataGrid-columnHeader': {
      backgroundColor: headBg,
      color: headFg,
      minHeight: '48px !important',
      maxHeight: '48px !important',
      py: 0.5,
      alignItems: 'center',
      borderRadius: 0,
      borderRight: thinBorder,
      '&:focus, &:focus-within': { backgroundColor: headBg, outline: 'none' },
    },
    '& .MuiDataGrid-columnHeaderTitleContainer': {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
      width: '100%',
      gap: '2px',
      minWidth: 0,
    },
    '& .MuiDataGrid-columnHeader .MuiDataGrid-columnHeaderTitleContainerContent': {
      overflow: 'visible',
      textOverflow: 'clip',
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontWeight: 600,
      whiteSpace: 'pre-line',
      lineHeight: 1.2,
      textAlign: 'center',
      fontSize: '0.7rem',
      overflow: 'visible',
      textOverflow: 'clip !important',
      wordBreak: 'normal',
      overflowWrap: 'normal',
    },
    '& .MuiDataGrid-columnHeader.payroll-col-row-no .MuiDataGrid-columnHeaderTitle': {
      whiteSpace: 'nowrap',
    },

    /* ── 헤더 정렬 ── */
    '& .MuiDataGrid-columnHeader--sortable': {
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: light ? '#E8EDF2' : theme.palette.grey[700],
      },
    },
    '& .MuiDataGrid-columnHeader:not(.MuiDataGrid-columnHeader--sortable)': {
      cursor: 'default',
    },
    '& .MuiDataGrid-columnHeader--sorted': {
      backgroundColor: light ? '#E2E8F0' : theme.palette.grey[700],
      color: light ? '#334155' : theme.palette.grey[100],
      '&:focus, &:focus-within': {
        backgroundColor: light ? '#E2E8F0' : theme.palette.grey[700],
      },
    },
    '& .MuiDataGrid-iconButtonContainer': {
      display: 'none !important',
      width: 0,
      minWidth: 0,
      margin: 0,
      padding: 0,
    },

    /* ── 데이터 행 — 엑셀형 흰 배경 + 얇은 격자 ── */
    '& .MuiDataGrid-cell': {
      py: 0,
      px: 0.5,
      fontSize: '0.8125rem',
      display: 'flex',
      alignItems: 'center',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      backgroundColor: '#FFFFFF',
      color: light ? '#111827' : theme.palette.text.primary,
      borderRight: thinBorder,
      borderBottom: thinBorder,
    },
    '& .MuiDataGrid-row': { maxHeight: 'none' },
    '& .MuiDataGrid-row:hover .MuiDataGrid-cell': {
      backgroundColor: `${light ? '#EAF4FC' : theme.palette.action.hover} !important`,
    },
    '& .MuiDataGrid-row.Mui-hovered .MuiDataGrid-cell': {
      backgroundColor: `${light ? '#EAF4FC' : theme.palette.action.hover} !important`,
    },
    '& .MuiDataGrid-row.Mui-selected .MuiDataGrid-cell, & .MuiDataGrid-row.Mui-selected:hover .MuiDataGrid-cell':
      {
        backgroundColor: `${light ? '#DCEEFF' : theme.palette.action.selected} !important`,
      },
    '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
      outline: light ? '1px solid #217346' : `1px solid ${theme.palette.primary.main}`,
      outlineOffset: -1,
    },

    /* 헤더 — 기본급 · HRA · 기타 */
    '& .MuiDataGrid-columnHeader.payroll-col-salary': {
      backgroundColor: light ? PAYROLL_COL.salary.head : 'rgba(2, 132, 199, 0.22)',
      color: light ? PAYROLL_COL.salary.text : theme.palette.info.light,
      fontWeight: 600,
    },
    '& .MuiDataGrid-columnHeader.payroll-col-salary-start': {
      borderLeft: 'none',
    },
    '& .MuiDataGrid-cell.payroll-col-salary-start': {
      borderLeft: 'none',
    },
    '& .MuiDataGrid-columnHeader.payroll-col-salary-end': {
      borderRight: 'none',
      boxShadow: light
        ? `inset -2px 0 0 ${PAYROLL_COL.sum.accent}`
        : `inset -2px 0 0 ${theme.palette.divider}`,
    },
    '& .MuiDataGrid-columnHeader.payroll-col-salary-total': {
      backgroundColor: light ? PAYROLL_COL.salaryTotal.head : 'rgba(3, 105, 161, 0.24)',
      color: light ? PAYROLL_COL.salaryTotal.text : theme.palette.info.light,
      fontWeight: 600,
      borderRight: 'none',
      boxShadow: light
        ? `inset -2px 0 0 ${PAYROLL_COL.salaryTotal.accent}`
        : `inset -2px 0 0 ${theme.palette.divider}`,
    },

    '& .MuiDataGrid-columnHeader.payroll-col-days': {
      backgroundColor: light ? PAYROLL_COL.days.head : 'rgba(13, 148, 136, 0.24)',
      color: light ? PAYROLL_COL.days.text : theme.palette.info.light,
      fontWeight: 600,
    },
    '& .MuiDataGrid-columnHeader.payroll-col-days-start': {
      borderLeft: 'none',
    },
    '& .MuiDataGrid-cell.payroll-col-days-start': {
      borderLeft: 'none',
    },
    '& .MuiDataGrid-columnHeader.payroll-col-days-end': {
      borderRight: 'none',
      boxShadow: light
        ? `inset -2px 0 0 ${PAYROLL_COL.days.accent}`
        : `inset -2px 0 0 ${theme.palette.divider}`,
    },
    '& .MuiDataGrid-columnHeader.payroll-col-attendance': {
      backgroundColor: light ? PAYROLL_COL.attendance.head : 'rgba(217, 119, 6, 0.22)',
      color: light ? PAYROLL_COL.attendance.text : theme.palette.warning.light,
      fontWeight: 600,
    },
    '& .MuiDataGrid-columnHeader.payroll-col-attendance-start': {
      borderLeft: 'none',
    },
    '& .MuiDataGrid-cell.payroll-col-attendance-start': {
      borderLeft: 'none',
    },

    '& .MuiDataGrid-columnHeader.payroll-col-extra': {
      backgroundColor: light ? PAYROLL_COL.extra.head : 'rgba(148, 163, 184, 0.2)',
      color: light ? PAYROLL_COL.extra.text : theme.palette.text.secondary,
      fontWeight: 600,
    },

    '& .MuiDataGrid-columnHeader.payroll-col-sum': {
      backgroundColor: light ? PAYROLL_COL.sum.head : 'rgba(29, 78, 124, 0.24)',
      color: light ? PAYROLL_COL.sum.text : theme.palette.text.primary,
      fontWeight: 600,
      borderLeft: 'none',
      borderRight: 'none',
      boxShadow: light
        ? `inset 2px 0 0 ${PAYROLL_COL.sum.accent}, inset -2px 0 0 ${PAYROLL_COL.sum.accent}`
        : `inset 2px 0 0 ${theme.palette.divider}, inset -2px 0 0 ${theme.palette.divider}`,
    },

    '& .MuiDataGrid-columnHeader.payroll-col-employer': {
      backgroundColor: light ? PAYROLL_COL.employer.head : 'rgba(124, 58, 237, 0.24)',
      fontWeight: 600,
    },
    '& .MuiDataGrid-columnHeader.payroll-col-employer-start': {
      borderLeft: 'none',
    },
    '& .MuiDataGrid-cell.payroll-col-employer-start': {
      borderLeft: 'none',
    },
    '& .MuiDataGrid-columnHeader.payroll-col-employer-end': {
      borderRight: 'none',
      boxShadow: light
        ? `inset -2px 0 0 ${PAYROLL_COL.employer.accent}`
        : `inset -2px 0 0 ${theme.palette.divider}`,
    },

    '& .MuiDataGrid-columnHeader.payroll-col-employee': {
      backgroundColor: light ? PAYROLL_COL.employee.head : 'rgba(225, 29, 72, 0.22)',
      fontWeight: 600,
    },
    '& .MuiDataGrid-columnHeader.payroll-col-employee-start': {
      borderLeft: 'none',
    },
    '& .MuiDataGrid-cell.payroll-col-employee-start': {
      borderLeft: 'none',
    },

    '& .MuiDataGrid-columnHeader.payroll-col-net': {
      backgroundColor: light ? PAYROLL_COL.net.head : 'rgba(234, 88, 12, 0.24)',
      fontWeight: 600,
    },
    '& .MuiDataGrid-columnHeader.payroll-col-net-start': {
      borderLeft: 'none',
      boxShadow: light
        ? `inset 2px 0 0 ${PAYROLL_COL.net.accent}`
        : `inset 2px 0 0 ${theme.palette.divider}`,
    },

    /* 데이터 셀 — 지급 합계 · 실수령 강조 */
    '& .MuiDataGrid-cell.payroll-col-net': {
      backgroundColor: `${light ? PAYROLL_COL.net.bg : 'rgba(234, 88, 12, 0.12)'} !important`,
      color: light ? PAYROLL_COL.net.text : theme.palette.text.primary,
      fontWeight: 600,
    },
    '& .MuiDataGrid-row:hover .MuiDataGrid-cell.payroll-col-sum': {
      backgroundColor: `${light ? '#E8EEF5' : 'rgba(29, 78, 124, 0.18)'} !important`,
    },
    '& .MuiDataGrid-row:hover .MuiDataGrid-cell.payroll-col-salary-total': {
      backgroundColor: `${light ? '#E3EEF8' : 'rgba(3, 105, 161, 0.18)'} !important`,
    },
    '& .MuiDataGrid-row:hover .MuiDataGrid-cell.payroll-col-net': {
      backgroundColor: `${light ? '#EAF0EC' : 'rgba(234, 88, 12, 0.18)'} !important`,
    },
    '& .MuiDataGrid-row.Mui-hovered .MuiDataGrid-cell.payroll-col-sum': {
      backgroundColor: `${light ? '#E8EEF5' : 'rgba(29, 78, 124, 0.18)'} !important`,
    },
    '& .MuiDataGrid-row.Mui-hovered .MuiDataGrid-cell.payroll-col-salary-total': {
      backgroundColor: `${light ? '#E3EEF8' : 'rgba(3, 105, 161, 0.18)'} !important`,
    },
    '& .MuiDataGrid-row.Mui-hovered .MuiDataGrid-cell.payroll-col-net': {
      backgroundColor: `${light ? '#EAF0EC' : 'rgba(234, 88, 12, 0.18)'} !important`,
    },
    '& .MuiDataGrid-cell.payroll-col-days': { justifyContent: 'center' },
    '& .MuiDataGrid-cell.payroll-col-days .MuiInputBase-input': { textAlign: 'center' },
    '& .MuiDataGrid-cell.payroll-col-center': { justifyContent: 'center', textAlign: 'center' },
    '& .MuiDataGrid-cell.payroll-col-center .MuiInputBase-input': { textAlign: 'center' },
    '& .MuiDataGrid-cell.payroll-col-text-left': {
      justifyContent: 'flex-start',
      textAlign: 'left',
      paddingLeft: '6px',
    },
    '& .MuiDataGrid-cell.payroll-col-text-left .MuiInputBase-input': { textAlign: 'left' },
    '& .MuiDataGrid-cell.payroll-col-emp-id': {
      overflow: 'visible',
      textOverflow: 'clip',
      paddingRight: '8px',
    },
    '& .MuiDataGrid-cell.payroll-col-name:focus, & .MuiDataGrid-cell.payroll-col-name:focus-within': {
      outline: 'none',
    },
    '& .MuiDataGrid-cell.payroll-col-name .MuiLink-root': {
      textDecoration: 'none !important',
      color: 'inherit !important',
    },

    /* 편집 — 텍스트 박스 형태 없음, 입력 중에만 셀 테두리 */
    '& .MuiDataGrid-cell--editable:not(.MuiDataGrid-cell--editing):not(.payroll-col-salary-end):not(.payroll-col-salary-total):not(.payroll-col-days-end):not(.payroll-col-sum)':
      {
        boxShadow: 'none',
      },
    '& .MuiDataGrid-cell--editing:not(.payroll-col-salary-end):not(.payroll-col-salary-total):not(.payroll-col-days-end):not(.payroll-col-sum)':
      {
        padding: '0 2px',
        boxShadow: 'none',
      },
    '& .MuiDataGrid-cell--editing .MuiInputBase-root': {
      fontSize: '0.8125rem',
      height: '100%',
    },
    '& .MuiDataGrid-cell--editing .MuiOutlinedInput-root': {
      padding: 0,
    },
    '& .MuiDataGrid-cell--editing .MuiOutlinedInput-notchedOutline': {
      border: 'none !important',
    },
    '& .MuiDataGrid-cell--editing .MuiInputBase-input': {
      padding: '0 4px',
    },

    /* 영역 구분선 — 편집 셀 boxShadow:none 뒤에 두어 헤더와 동일 두께 */
    '& .MuiDataGrid-cell.payroll-col-salary-end': {
      borderRight: 'none !important',
      boxShadow: light
        ? `inset -2px 0 0 ${PAYROLL_COL.sum.accent}`
        : `inset -2px 0 0 ${theme.palette.divider}`,
    },
    '& .MuiDataGrid-cell.payroll-col-salary-total': {
      backgroundColor: `${light ? PAYROLL_COL.salaryTotal.bg : 'rgba(3, 105, 161, 0.12)'} !important`,
      color: light ? PAYROLL_COL.salaryTotal.text : theme.palette.text.primary,
      fontWeight: 600,
      borderRight: 'none',
      boxShadow: light
        ? `inset -2px 0 0 ${PAYROLL_COL.salaryTotal.accent}`
        : `inset -2px 0 0 ${theme.palette.divider}`,
    },
    '& .MuiDataGrid-cell.payroll-col-days-end': {
      borderRight: 'none',
      boxShadow: light
        ? `inset -2px 0 0 ${PAYROLL_COL.days.accent}`
        : `inset -2px 0 0 ${theme.palette.divider}`,
    },
    '& .MuiDataGrid-cell.payroll-col-employer-end': {
      borderRight: 'none',
      boxShadow: light
        ? `inset -2px 0 0 ${PAYROLL_COL.employer.accent}`
        : `inset -2px 0 0 ${theme.palette.divider}`,
    },
    '& .MuiDataGrid-cell.payroll-col-net-start': {
      borderLeft: 'none',
      boxShadow: light
        ? `inset 2px 0 0 ${PAYROLL_COL.net.accent}`
        : `inset 2px 0 0 ${theme.palette.divider}`,
    },
    '& .MuiDataGrid-cell.payroll-col-sum': {
      backgroundColor: `${light ? PAYROLL_COL.sum.bg : 'rgba(29, 78, 124, 0.12)'} !important`,
      color: light ? PAYROLL_COL.sum.text : theme.palette.text.primary,
      fontWeight: 600,
      borderLeft: 'none',
      borderRight: 'none',
      boxShadow: light
        ? `inset 2px 0 0 ${PAYROLL_COL.sum.accent}, inset -2px 0 0 ${PAYROLL_COL.sum.accent}`
        : `inset 2px 0 0 ${theme.palette.divider}, inset -2px 0 0 ${theme.palette.divider}`,
    },

    /* 사용자 입력 — OT·수당 (빨간 숫자만, 박스 없음) */
    '& .MuiDataGrid-cell.payroll-col-user-input': {
      color: `${light ? '#B91C1C' : theme.palette.error.light} !important`,
      fontWeight: 600,
    },
    '& .MuiDataGrid-cell.payroll-col-user-input .MuiInputBase-input': {
      color: `${light ? '#B91C1C' : theme.palette.error.light} !important`,
      fontWeight: 600,
    },

    '& .MuiDataGrid-footerContainer': { display: 'none' },
    '& .MuiDataGrid-filler': { display: 'none !important' },
    '& .MuiDataGrid-bottomContainer': { display: 'none' },
  };
};
