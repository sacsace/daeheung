import { createTheme } from '@mui/material/styles';
import './types';
import { injectStitchesGlobalStyles } from '../styles/stitches';

injectStitchesGlobalStyles();

/** 로그인 등 기본 테마 — 모던 SaaS/ERP(밝은 캔버스·얇은 보더·넉넉한 여백), 로그인 후 createDynamicTheme */
const theme = createTheme({
  palette: {
    primary: {
      50: '#EFF3F8',
      100: '#DCE7F1',
      200: '#B7CBDF',
      300: '#8CACC9',
      400: '#5C89AE',
      500: '#2F6795',
      600: '#1D4E7C',
      700: '#163E63',
      800: '#112F4B',
      900: '#0C2135',
      main: '#1D4E7C',
      light: '#2F6795',
      dark: '#163E63',
      contrastText: '#ffffff',
    },
    secondary: {
      50: '#F0FDFA',
      100: '#CCFBF1',
      200: '#99F6E4',
      300: '#5EEAD4',
      400: '#2DD4BF',
      500: '#14B8A6',
      600: '#0D9488',
      700: '#0F766E',
      800: '#115E59',
      900: '#134E4A',
      main: '#0D9488',
      light: '#14B8A6',
      dark: '#0F766E',
      contrastText: '#ffffff',
    },
    error: {
      main: '#DC2626',
      light: '#EF4444',
      dark: '#B91C1C',
    },
    warning: {
      main: '#D97706',
      light: '#F59E0B',
      dark: '#B45309',
    },
    info: {
      main: '#0284C7',
      light: '#0EA5E9',
      dark: '#0369A1',
    },
    success: {
      main: '#059669',
      light: '#10B981',
      dark: '#047857',
    },
    divider: '#E2E8F0',
    background: {
      default: '#F1F5F9',
      paper: '#FFFFFF',
    },
    workArea: {
      main: '#FFFFFF',
      light: '#F8FAFC',
      dark: '#F1F5F9',
    },
    bodyArea: {
      main: '#F1F5F9',
      light: '#F8FAFC',
      dark: '#E2E8F0',
    },
    text: {
      primary: '#0F172A',
      secondary: '#475569',
    },
    grey: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      300: '#CBD5E1',
      400: '#94A3B8',
      500: '#64748B',
      600: '#475569',
      700: '#334155',
      800: '#1E293B',
      900: '#0F172A',
    },
  },
  typography: {
    fontFamily:
      'Inter, "Segoe UI", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
    /** 페이지 메인 타이틀 — 전 화면 동일 */
    h1: {
      fontSize: '22px',
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
      color: '#0F172A',
    },
    pageTitle: {
      fontSize: '22px',
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
      color: '#0F172A',
      marginBottom: '6px',
    },
    /** 섹션 제목 */
    sectionTitle: {
      fontSize: '16px',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
      color: '#0F172A',
    },
    /** 카드·위젯 헤더 타이틀 */
    cardTitle: {
      fontSize: '14px',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
      color: '#0F172A',
    },
    /** 페이지 설명 문단 */
    pageDescription: {
      fontSize: '13px',
      lineHeight: 1.6,
      color: '#475569',
    },
    /** KPI 숫자 */
    kpiNumber: {
      fontSize: '22px',
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
      color: '#0F172A',
    },
    h2: {
      fontSize: '16px',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
      marginBottom: '12px',
      color: '#0F172A',
    },
    h3: {
      fontSize: '1.0625rem',
      fontWeight: 500,
      lineHeight: 1.45,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.45,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontSize: '1.0625rem',
      fontWeight: 600,
      lineHeight: 1.35,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.5,
      letterSpacing: '0',
    },
    body1: {
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: 1.6,
      letterSpacing: '0',
      color: '#0F172A',
    },
    body2: {
      fontSize: '0.8125rem',
      lineHeight: 1.45,
      letterSpacing: '0',
    },
    caption: {
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: '0',
      color: '#475569',
    },
    subtitle1: {
      fontSize: '14px',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
      color: '#0F172A',
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.45,
      letterSpacing: '0',
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8, // 8px 그리드 시스템
  shadows: [
    'none',
    '0 1px 2px rgba(15, 23, 42, 0.05)',
    '0 1px 2px rgba(15, 23, 42, 0.06)',
    '0 1px 3px rgba(15, 23, 42, 0.07)',
    '0 2px 4px rgba(15, 23, 42, 0.07)',
    '0 2px 4px rgba(15, 23, 42, 0.08)',
    '0 2px 6px rgba(15, 23, 42, 0.08)',
    '0 2px 6px rgba(15, 23, 42, 0.08)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 4px 10px rgba(15, 23, 42, 0.1)',
    '0 8px 20px rgba(15, 23, 42, 0.12)',
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          backgroundColor: '#F1F5F9',
          color: '#0F172A',
          fontSize: '14px',
        },
      },
    },
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          pageTitle: 'h1',
          sectionTitle: 'h2',
          cardTitle: 'h3',
          pageDescription: 'p',
          kpiNumber: 'div',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '14px',
          minHeight: 40,
          padding: '8px 16px',
          boxShadow: 'none',
          transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
          '&.Mui-disabled': {
            opacity: 0.5,
          },
        },
        outlined: {
          borderColor: '#CBD5E1',
          color: '#334155',
          '&:hover': {
            borderColor: '#94A3B8',
            backgroundColor: '#F8FAFC',
          },
        },
        contained: {
          backgroundColor: '#1D4E7C',
          color: '#FFFFFF',
          boxShadow: 'none',
          '&:hover': {
            backgroundColor: '#163E63',
            color: '#FFFFFF',
            boxShadow: 'none',
          },
          '&.Mui-disabled': {
            color: '#FFFFFF',
          },
        },
        sizeSmall: {
          fontSize: '0.8125rem',
          minHeight: 34,
          padding: '6px 14px',
        },
        sizeLarge: {
          fontSize: '0.9375rem',
          minHeight: 44,
          padding: '10px 22px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
          transition: 'border-color 0.15s ease',
          '&:hover': {
            borderColor: '#CBD5E1',
          },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '20px',
          '&:last-child': {
            paddingBottom: '20px',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: ({ ownerState }) => {
          const elev =
            ownerState.variant === 'elevation' && typeof ownerState.elevation === 'number'
              ? ownerState.elevation
              : 0;
          /** 메뉴·다이얼로그 등 고 elevation — MUI 기본 그림자 유지 */
          if (ownerState.variant === 'elevation' && elev >= 8) {
            return { backgroundImage: 'none' };
          }
          return {
            backgroundImage: 'none',
            borderRadius: '8px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
            border: '1px solid #E2E8F0',
          };
        },
      },
    },
    /** 다이얼로그 내부에서 폼 라벨이 잘리지 않도록 기본 글자 크기·overflow 보정 (body 전역 font-size 등과 분리) */
    MuiDialog: {
      styleOverrides: {
        paper: {
          fontSize: '1rem',
          lineHeight: 1.5
        }
      }
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          overflow: 'visible'
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            minHeight: 44,
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            '& .MuiOutlinedInput-input': {
              paddingTop: '12px',
              paddingBottom: '12px',
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#CBD5E1',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#94A3B8',
            },
            '&.Mui-focused': {
              boxShadow: '0 0 0 3px rgba(29, 78, 124, 0.16)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#1D4E7C',
              borderWidth: 1,
            },
          },
          '& .MuiInputBase-input::placeholder': {
            color: '#94A3B8',
            opacity: 1,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          backgroundColor: '#FFFFFF',
          minHeight: 44,
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#CBD5E1',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#94A3B8',
          },
          '&.Mui-focused': {
            boxShadow: '0 0 0 3px rgba(29, 78, 124, 0.16)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#1D4E7C',
            borderWidth: 1,
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
          transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
          '&:hover': {
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
            transform: 'none',
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #E2E8F0',
          boxShadow: 'none',
          backgroundColor: '#FFFFFF',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          color: '#0F172A',
          boxShadow: 'none',
          borderBottom: '1px solid #E2E8F0',
          backdropFilter: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          margin: '4px 8px',
          padding: '10px 12px',
          borderLeft: 'none',
          fontSize: '14px',
          color: '#4B5563',
          transition: 'background-color 0.15s ease, color 0.15s ease',
          '&:hover': {
            backgroundColor: 'rgba(15, 23, 42, 0.04)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(29, 78, 124, 0.10)',
            color: '#163E63',
            fontWeight: 600,
            borderLeft: 'none',
            '&:hover': {
              backgroundColor: 'rgba(29, 78, 124, 0.16)',
            },
          },
        },
      },
    },
    MuiTable: {
      styleOverrides: {
        root: {
          '& .MuiTableHead-root': {
            backgroundColor: '#F8FAFC',
          },
          '& .MuiTableCell-head': {
            fontSize: '12px',
            fontWeight: 600,
            color: '#475569',
            lineHeight: 1.4,
          },
          '& .MuiTableRow-root': {
            height: 56,
          },
          '& .MuiTableRow-root:hover': {
            backgroundColor: '#F8FAFC',
          },
          '& .MuiTableCell-root': {
            borderBottom: '1px solid #E2E8F0',
            fontSize: '14px',
            lineHeight: 1.5,
            color: '#0F172A',
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#F8FAFC',
          '& .MuiTableCell-head': {
            fontSize: '12px',
            fontWeight: 600,
            color: '#475569',
            textTransform: 'none',
            letterSpacing: '0.02em',
            borderBottom: '1px solid #E2E8F0',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '14px',
          borderBottom: '1px solid #E2E8F0',
          padding: '14px 16px',
          color: '#0F172A',
          lineHeight: 1.5,
        },
        head: {
          color: '#475569',
          fontWeight: 600,
          fontSize: '12px',
          lineHeight: 1.4,
          borderBottom: '1px solid #E2E8F0',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          height: 56,
          transition: 'background-color 0.15s ease',
          '&:hover': {
            backgroundColor: '#F8FAFC',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: '0.75rem',
          height: 26,
          borderRadius: 6,
          fontWeight: 600,
        },
        colorSuccess: {
          backgroundColor: 'rgba(5, 150, 105, 0.12)',
          color: '#047857',
        },
        colorWarning: {
          backgroundColor: 'rgba(217, 119, 6, 0.14)',
          color: '#B45309',
        },
        colorError: {
          backgroundColor: 'rgba(220, 38, 38, 0.12)',
          color: '#B91C1C',
        },
        colorInfo: {
          backgroundColor: 'rgba(2, 132, 199, 0.12)',
          color: '#0369A1',
        },
        colorDefault: {
          backgroundColor: '#F1F5F9',
          color: '#475569',
        },
        colorPrimary: {
          backgroundColor: 'rgba(29, 78, 124, 0.12)',
          color: '#163E63',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '6px',
          transition: 'background-color 0.15s ease, color 0.15s ease',
          color: '#64748B',
          '&:hover': {
            backgroundColor: 'rgba(15, 23, 42, 0.05)',
            color: '#1D4E7C',
          },
        },
        colorPrimary: {
          color: '#64748B',
          '&:hover': {
            color: '#1D4E7C',
            backgroundColor: 'rgba(29, 78, 124, 0.10)',
          },
        },
        colorSuccess: {
          color: '#64748B',
          '&:hover': {
            color: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.12)',
          },
        },
        colorError: {
          color: '#64748B',
          '&:hover': {
            color: '#DC2626',
            backgroundColor: 'rgba(220, 38, 38, 0.12)',
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.75rem',
          backgroundColor: '#1e293b',
          color: '#F8FAFC',
          borderRadius: 6,
        },
        arrow: {
          color: '#1e293b',
        },
      },
    },
  },
});

export { theme };