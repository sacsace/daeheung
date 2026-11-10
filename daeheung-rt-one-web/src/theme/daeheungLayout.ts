import type { SxProps, Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';

/** sx prop에 spread 가능한 plain object 토큰 */
export type MvsStyleObject = SystemStyleObject<Theme>;

/** MVS 공통 레이아웃 토큰 — 페이지에서 sx로 재사용 가능 (로직 변경 없음) */

/** Body 영역 기본 최대 너비 (초광폭 모니터에서 가독성 유지) */
export const mvsPageContentMaxWidth = 1764;

export const mvsPageShellSx: SxProps<Theme> = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  margin: 0,
  boxSizing: 'border-box',
  py: { xs: '12px', sm: '24px', md: '32px' },
  px: { xs: '8px', sm: '24px', md: '40px' },
};

export const mvsMainSurfaceSx: SxProps<Theme> = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  padding: { xs: '16px', sm: '24px', md: '32px' },
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
  border: '1px solid #E2E8F0',
  boxSizing: 'border-box',
};

export const mvsSectionGroupSx: SxProps<Theme> = {
  backgroundColor: '#F8FAFC',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '24px',
  border: '1px solid #E2E8F0',
  boxShadow: 'none',
};

export const mvsInnerCardSx: SxProps<Theme> = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  padding: '18px',
  border: '1px solid #E2E8F0',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
};

export const mvsFilterToolbarSx: MvsStyleObject = {
  backgroundColor: '#F8FAFC',
  borderRadius: '8px',
  padding: { xs: '12px', sm: '16px' },
  marginBottom: { xs: '16px', sm: '24px' },
  border: '1px solid #E2E8F0',
  boxShadow: 'none',
};

/** 검색·필터 입력(TextField·Select·Autocomplete) 테두리 — 페이지 sx에 spread */
export const mvsSearchFieldSx: MvsStyleObject = {
  bgcolor: 'transparent',
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    bgcolor: 'background.paper',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: '#CBD5E1',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#94A3B8',
    },
    '& fieldset': {
      borderColor: '#CBD5E1',
    },
    '&:hover fieldset': {
      borderColor: '#94A3B8',
    },
  },
};

/** 검색·필터 outlined 라벨 — 테두리 위 고정 (급여관리·근태관리 필터와 동일) */
export const mvsOutlinedLabelProps = {
  InputLabelProps: { shrink: true },
} as const;

/** 검색·필터 영역 래퍼(mvsFilterToolbarSx와 동일 계열) */
export const mvsSearchZoneSx: MvsStyleObject = mvsFilterToolbarSx;

export const mvsTableZoneSx: SxProps<Theme> = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  padding: { xs: '12px', sm: '18px' },
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
  border: '1px solid #E2E8F0',
};

/** KPI·요약 카드 — 재고·회계 등 목록 상단 통계 */
export const mvsKpiCardSx: SxProps<Theme> = (theme) => ({
  borderRadius: '8px',
  border: '1px solid',
  borderColor: theme.palette.mode === 'light' ? '#E2E8F0' : 'divider',
  boxShadow:
    theme.palette.mode === 'light' ? '0 1px 2px rgba(15, 23, 42, 0.06)' : '0 1px 2px rgba(0,0,0,0.25)',
  bgcolor: 'background.paper',
});

/** 필터 입력 높이(40px) — mvsSearchFieldSx와 함께 spread */
export const mvsFilterFieldHeightSx: MvsStyleObject = {
  '& .MuiOutlinedInput-root': {
    height: 40,
    '& .MuiOutlinedInput-input': { py: 0 },
  },
};

/** 모바일에서 넓은 테이블 가로 스크롤 */
export const mvsTableScrollSx: SxProps<Theme> = {
  width: '100%',
  maxWidth: '100%',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
};

/** 필터 아래 테이블을 살짝 띄워 구분 (전자결재·고객정보 등과 동일 계열) */
export const mvsTableWellSx: SxProps<Theme> = (theme) => ({
  mt: 2.5,
  pt: 2.5,
  borderTop: '1px solid',
  borderColor:
    theme.palette.mode === 'dark' ? theme.palette.divider : '#E2E8F0',
  borderRadius: 0,
});

export const mvsTableInsetWrapSx: SxProps<Theme> = (theme) => ({
  borderRadius: '8px',
  p: { xs: 1, sm: 1.25 },
  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
});

/** MuiTableCell head 기본이 transparent인 경우를 대비해 헤더 행을 확실히 구분 */
export const mvsTableHeadHighlightSx: SxProps<Theme> = (theme) => {
  const light = theme.palette.mode === 'light';
  const headBg = light ? '#F8FAFC' : theme.palette.grey[800];
  const headFg = light ? '#334155' : theme.palette.grey[200];
  const headBorder = light ? '#CBD5E1' : theme.palette.divider;
  return {
    bgcolor: headBg,
    '& .MuiTableCell-head': {
      bgcolor: headBg,
      color: headFg,
      fontWeight: 600,
      fontSize: '0.8125rem',
      textTransform: 'none',
      letterSpacing: '0.01em',
      overflow: 'hidden',
      borderBottom: `1px solid ${headBorder}`,
      borderTop: '2px solid',
      borderTopColor: 'primary.main',
      py: 1.5,
    },
    '& .MuiTableCell-head.MuiTableCell-paddingCheckbox': {
      overflow: 'visible',
      width: 56,
      minWidth: 56,
      maxWidth: 56,
      pl: { xs: 1.5, sm: 2 },
      pr: 1,
      boxSizing: 'border-box',
    },
  };
};

/** Body 페이지네이션 — 배경·외곽 박스 없음 */
export const mvsBodyPaginationSx: MvsStyleObject = {
  display: 'flex',
  justifyContent: 'center',
  py: 2,
  bgcolor: 'transparent',
};

/** Body 리스트 영역 — 외곽 박스·배경 없음 (컨트롤 카드 아래) */
export const mvsBodyListZoneSx: MvsStyleObject = {
  width: '100%',
  bgcolor: 'transparent',
  mt: { xs: 2, sm: 2.5 },
};

/**
 * 목록형 화면 공통 탭 바 (지출결의서·견적·세금계산서 등).
 * 카드(mvsBodyCardSx) 안에 넣고 Header → Tabs → KPI → Filter → List 순서를 맞춘다.
 */
export const mvsMainTabsSx: MvsStyleObject = {
  minHeight: 48,
  px: { xs: 1, sm: 1.5 },
  bgcolor: '#FFFFFF',
  '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
  '& .MuiTab-root': {
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '0.8125rem',
    minHeight: 48,
    py: 1.5,
    px: { xs: 1.25, sm: 2 },
    letterSpacing: '-0.01em',
    color: 'text.secondary',
  },
  '& .MuiTab-root.Mui-selected': { color: 'primary.main', fontWeight: 700 },
};

/** KPI 카드 4열 그리드 */
export const mvsKpiGridSx: MvsStyleObject = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
  gap: 2.5,
  mb: 3,
};

/** 필터 바 내부 (흰 배경 + 검색/셀렉트/초기화 그리드) */
export const mvsFilterBarInnerSx: MvsStyleObject = {
  px: { xs: 2, sm: 2.5 },
  py: 2,
  bgcolor: '#FFFFFF',
  display: 'grid',
  gap: 2,
  alignItems: 'flex-end',
};

/** Body 카드·리스트 공통 외곽 톤 */
export const mvsBodyFrameBorder = '1px solid #E2E8F0';
export const mvsBodyFrameShadow = '0 1px 2px rgba(15, 23, 42, 0.06)';
export const mvsBodyFrameRadius = '8px';

/** Body 리스트 테이블 래퍼 — 컨트롤 카드와 동일 외곽 톤 (코너에서 헤더/셀 배경이 잘리도록 clip) */
export const mvsBodyListTableSx: MvsStyleObject = {
  width: '100%',
  maxWidth: '100%',
  overflow: 'hidden',
  overflowX: 'auto',
  WebkitOverflowScrolling: 'touch',
  bgcolor: '#FFFFFF',
  borderRadius: mvsBodyFrameRadius,
  border: mvsBodyFrameBorder,
  boxShadow: mvsBodyFrameShadow,
};

/** ── Body 영역 표준 (KPI 아래 리스트·테이블 본문) ── */

/** Body 카드 — 흰색 외곽 컨테이너 */
export const mvsBodyCardSx: MvsStyleObject = {
  backgroundColor: '#FFFFFF',
  borderRadius: mvsBodyFrameRadius,
  boxShadow: mvsBodyFrameShadow,
  border: mvsBodyFrameBorder,
  overflow: 'hidden',
};

/**
 * Body 섹션 패널 — 회색 타이틀 바 + 본문 (견적/폼 섹션 등).
 * 부모 overflow:hidden 으로 헤더 배경이 둥근 테두리에 맞게 잘림.
 */
export const mvsBodySectionPanelSx: MvsStyleObject = {
  border: '1px solid #CFCFCF',
  borderRadius: mvsBodyFrameRadius,
  overflow: 'hidden',
  bgcolor: '#FFFFFF',
  mb: 2,
};

/** Body 섹션 패널 타이틀 바 */
export const mvsBodySectionPanelTitleSx: MvsStyleObject = {
  bgcolor: '#F0F0F0',
  px: 2,
  py: 0.75,
};

/** Body 섹션 헤더 — 제목 + 주요 액션 */
export const mvsBodySectionHeaderSx: MvsStyleObject = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 1.5,
  px: { xs: 2, sm: 2.5 },
  py: 2,
  borderBottom: '1px solid #E2E8F0',
  bgcolor: '#FFFFFF',
};

/** Body 보조 도구 버튼 줄 — 카드 상단일 때 둥근 모서리와 맞춤 */
export const mvsBodyToolbarSx: MvsStyleObject = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 1,
  px: { xs: 2, sm: 2.5 },
  py: 1.5,
  bgcolor: '#F8FAFC',
  borderBottom: '1px solid #E2E8F0',
  borderTopLeftRadius: mvsBodyFrameRadius,
  borderTopRightRadius: mvsBodyFrameRadius,
};

/** Body 보조 outlined 버튼 — primary(추가)와 구분되는 연한 슬레이트 톤 */
export const mvsBodyOutlinedBtnSx: MvsStyleObject = {
  textTransform: 'none',
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: '0.8125rem',
  minHeight: 36,
  px: 1.5,
  borderColor: '#CBD5E1',
  color: '#334155',
  bgcolor: '#FFFFFF',
  boxShadow: 'none',
  '& .MuiButton-startIcon': { mr: '6px', color: '#64748B' },
  '&:hover': {
    borderColor: '#94A3B8',
    bgcolor: '#F1F5F9',
    color: '#0F172A',
    '& .MuiButton-startIcon': { color: '#475569' },
  },
};

/** Body 통일 primary 버튼 */
export const mvsBodyPrimaryBtnSx: MvsStyleObject = {
  textTransform: 'none',
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: '0.8125rem',
  minHeight: 36,
  px: 2,
  boxShadow: 'none',
};

/** Body 필터 래퍼 — 툴바와 동일 톤(배경 단계 최소화). 카드 첫 자식일 때 상단 코너 맞춤 */
export const mvsBodyFilterWrapSx: MvsStyleObject = {
  px: { xs: 2, sm: 2.5 },
  py: 2,
  bgcolor: '#F8FAFC',
  borderTopLeftRadius: mvsBodyFrameRadius,
  borderTopRightRadius: mvsBodyFrameRadius,
};

/** Body 테이블 인셋 — 배경 없이 여백만 (카드 안 카드 중첩 방지) */
export const mvsBodyTableInsetSx: MvsStyleObject = {
  px: { xs: 2, sm: 2.5 },
  py: { xs: 2, sm: 2.5 },
  bgcolor: 'transparent',
};

/** Body 테이블 프레임 — 인셋 안 흰 테이블 카드 */
export const mvsBodyTableFrameSx: MvsStyleObject = {
  width: '100%',
  maxWidth: '100%',
  mx: 'auto',
  borderRadius: '8px',
  border: '1px solid #E2E8F0',
  overflow: 'hidden',
  bgcolor: '#FFFFFF',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
};

/** Body 테이블 바디 — 줄무늬 없음(전 행 흰색), hover만 구분 */
export const mvsTableBodyRowSx: SxProps<Theme> = (theme) => {
  const rowBg = theme.palette.mode === 'light' ? '#FFFFFF' : theme.palette.background.paper;
  const hover = theme.palette.mode === 'light' ? '#F1F5F9' : 'action.hover';
  const border = theme.palette.mode === 'light' ? '#E2E8F0' : theme.palette.divider;
  return {
    '& .MuiTableCell-body': {
      py: 1.5,
      px: 2,
      fontSize: '0.875rem',
      borderBottom: `1px solid ${border}`,
    },
    '& .MuiTableRow-root': {
      bgcolor: rowBg,
    },
    '& .MuiTableRow-root:hover': {
      bgcolor: hover,
    },
    '& .MuiTableRow-root:last-of-type .MuiTableCell-body': {
      borderBottom: 'none',
    },
  };
};

export const mvsPageTitleSx: SxProps<Theme> = {
  fontSize: { xs: '18px', sm: '20px', md: '22px' },
  fontWeight: 700,
  lineHeight: 1.3,
  letterSpacing: '-0.01em',
  color: '#0F172A',
  marginBottom: 0,
};

/** 모든 페이지 공통 루트 래퍼 — AppLayout 패딩 안에서 시작 위치·기본 너비 통일 */
export const mvsPageRootSx: SxProps<Theme> = {
  p: 0,
  width: '100%',
  maxWidth: mvsPageContentMaxWidth,
  minWidth: 0,
  mx: 'auto',
  minHeight: '100%',
  boxSizing: 'border-box',
  bgcolor: 'transparent',
  overflowX: 'hidden',
};

/** 보드·엑셀 시트 등 브라우저 너비를 쓰는 전체 폭 페이지 */
export const mvsPageRootFullBleedSx: SxProps<Theme> = {
  p: 0,
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  mx: 0,
  minHeight: '100%',
  boxSizing: 'border-box',
  bgcolor: 'transparent',
  overflowX: 'hidden',
};

export const mvsPageDescriptionSx: SxProps<Theme> = {
  fontSize: '13px',
  lineHeight: 1.6,
  color: '#475569',
};

export const mvsTitleBlockSx: SxProps<Theme> = {
  marginBottom: '24px',
};

/** 업무 관리(보드 목록·상세) 페이지 배경 */
export const mvsWorkBoardPageBg = '#F1F5F9';


/** 대시보드 하단 위젯 그룹 배경 */
export const mvsDashboardWidgetGroupSx: SxProps<Theme> = {
  backgroundColor: '#F8FAFC',
  borderRadius: '8px',
  padding: '20px',
  gap: '20px',
  border: '1px solid #E2E8F0',
  boxShadow: 'none',
};

/** 대시보드 개별 위젯 카드(내부 패딩은 CardContent 유지) */
export const mvsDashboardWidgetCardSx: SxProps<Theme> = {
  backgroundColor: '#FFFFFF',
  borderRadius: '8px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
  border: '1px solid #E2E8F0',
};
