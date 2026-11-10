import { createTheme, Theme, alpha } from '@mui/material/styles';

// hex 색상을 RGB로 변환
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

// RGB를 hex 색상으로 변환
const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

// 색상에서 밝기 계산
const getLuminance = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// primaryColor에서 light/dark 색상 생성
const generateColorVariants = (primaryColor: string) => {
  const rgb = hexToRgb(primaryColor);
  if (!rgb) {
    return {
      main: primaryColor,
      light: '#3da6ff',
      dark: '#0052a3',
      contrastText: '#ffffff',
    };
  }

  // Light 색상 생성 (밝게)
  const lightRgb = {
    r: Math.min(255, rgb.r + 40),
    g: Math.min(255, rgb.g + 40),
    b: Math.min(255, rgb.b + 40),
  };

  // Dark 색상 생성 (어둡게)
  const darkRgb = {
    r: Math.max(0, rgb.r - 40),
    g: Math.max(0, rgb.g - 40),
    b: Math.max(0, rgb.b - 40),
  };

  return {
    main: primaryColor,
    light: rgbToHex(lightRgb.r, lightRgb.g, lightRgb.b),
    dark: rgbToHex(darkRgb.r, darkRgb.g, darkRgb.b),
    contrastText: getLuminance(primaryColor) > 0.5 ? '#000000' : '#ffffff',
  };
};

// 폰트 크기 설정
const getFontSizeMultiplier = (fontSize: string): number => {
  switch (fontSize) {
    case 'small':
      return 0.9;
    case 'medium':
      return 1.0;
    case 'large':
      return 1.1;
    default:
      return 1.0;
  }
};

// 동적 테마 생성 함수
type ThemePreset = 'light' | 'dark' | 'forest' | 'sunset' | 'lavender' | 'graphite';
type ThemePresetInput = ThemePreset | 'ocean';

const THEME_PRESETS: Record<
  ThemePreset,
  {
    mode: 'light' | 'dark';
    primaryColor: string;
    secondaryColor: string;
    backgroundDefault: string;
    backgroundPaper: string;
    workArea: { main: string; light: string; dark: string };
    bodyArea: { main: string; light: string; dark: string };
    textPrimary: string;
    textSecondary: string;
  }
> = {
  /** 모던 SaaS/ERP: 밝은 캔버스·낮은 채도 파스텔 포인트 */
  light: {
    mode: 'light',
    primaryColor: '#1D4E7C',
    secondaryColor: '#0D9488',
    backgroundDefault: '#F1F5F9',
    backgroundPaper: '#FFFFFF',
    workArea: { main: '#FFFFFF', light: '#F8FAFC', dark: '#E2E8F0' },
    bodyArea: { main: '#F1F5F9', light: '#F8FAFC', dark: '#E2E8F0' },
    textPrimary: '#0F172A',
    textSecondary: '#475569'
  },
  dark: {
    mode: 'dark',
    primaryColor: '#8AABAF',
    secondaryColor: '#A8B8A5',
    backgroundDefault: '#0f172a',
    backgroundPaper: '#1e293b',
    workArea: { main: '#1e293b', light: '#334155', dark: '#0f172a' },
    bodyArea: { main: '#0f172a', light: '#1e293b', dark: '#020617' },
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8'
  },
  forest: {
    mode: 'dark',
    primaryColor: '#7FA88A',
    secondaryColor: '#8AABAF',
    backgroundDefault: '#0a1f14',
    backgroundPaper: '#123122',
    workArea: { main: '#123122', light: '#18432f', dark: '#0a1f14' },
    bodyArea: { main: '#0a1f14', light: '#123122', dark: '#06160d' },
    textPrimary: '#eafcf1',
    textSecondary: '#a5d8bd'
  },
  sunset: {
    mode: 'light',
    primaryColor: '#C4A574',
    secondaryColor: '#9AAD9E',
    backgroundDefault: '#F7F3EE',
    backgroundPaper: '#ffffff',
    workArea: { main: '#ffffff', light: '#F7F3EE', dark: '#EFE8E0' },
    bodyArea: { main: '#F7F3EE', light: '#F3EEE8', dark: '#E8E0D6' },
    textPrimary: '#2f1b14',
    textSecondary: '#7d5d50'
  },
  lavender: {
    mode: 'light',
    primaryColor: '#A89BB8',
    secondaryColor: '#8A9BB5',
    backgroundDefault: '#F4F2F7',
    backgroundPaper: '#ffffff',
    workArea: { main: '#ffffff', light: '#F4F2F7', dark: '#EBE7F0' },
    bodyArea: { main: '#F4F2F7', light: '#F0EEF4', dark: '#E6E2ED' },
    textPrimary: '#2e1f4f',
    textSecondary: '#6d5e95'
  },
  graphite: {
    mode: 'dark',
    primaryColor: '#8A9BB5',
    secondaryColor: '#A3A8B0',
    backgroundDefault: '#111214',
    backgroundPaper: '#1a1c1f',
    workArea: { main: '#1a1c1f', light: '#23262a', dark: '#111214' },
    bodyArea: { main: '#111214', light: '#1a1c1f', dark: '#0b0c0d' },
    textPrimary: '#f5f5f5',
    textSecondary: '#b0b3b8'
  }
};

export const createDynamicTheme = (appearanceSettings: {
  theme?: ThemePresetInput;
  primaryColor?: string;
  fontSize?: 'small' | 'medium' | 'large';
}): Theme => {
  const {
    theme: selectedTheme = 'light',
    primaryColor,
    fontSize = 'medium',
  } = appearanceSettings;

  const normalizedTheme: ThemePreset = selectedTheme === 'ocean' ? 'forest' : selectedTheme;
  const preset = THEME_PRESETS[normalizedTheme] || THEME_PRESETS.light;
  const mode = preset.mode;
  const isForestTheme = normalizedTheme === 'forest';
  const resolvedPrimaryColor = primaryColor || preset.primaryColor;
  const fontSizeMultiplier = getFontSizeMultiplier(fontSize);
  const primaryColors = generateColorVariants(resolvedPrimaryColor);
  const secondaryColors = generateColorVariants(preset.secondaryColor);
  const isLightMode = mode === 'light';
  const containedButtonShadow = 'none';
  const containedButtonShadowHover = 'none';
  const dividerColor = isForestTheme ? '#2d6a4f' : mode === 'dark' ? '#475569' : '#E2E8F0';
  const actionActiveColor = isForestTheme
    ? 'rgba(218, 248, 230, 0.78)'
    : mode === 'dark'
      ? 'rgba(248, 250, 252, 0.72)'
      : 'rgba(15, 23, 42, 0.62)';
  const actionHoverColor = isForestTheme
    ? 'rgba(34, 197, 94, 0.16)'
    : mode === 'dark'
      ? 'rgba(148, 163, 184, 0.16)'
      : 'rgba(17, 24, 39, 0.04)';
  const actionSelectedColor = isForestTheme
    ? 'rgba(127, 168, 138, 0.26)'
    : mode === 'dark'
      ? 'rgba(148, 163, 184, 0.24)'
      : alpha(resolvedPrimaryColor, 0.16);
  const actionDisabledColor = isForestTheme
    ? 'rgba(147, 197, 163, 0.52)'
    : mode === 'dark'
      ? 'rgba(148, 163, 184, 0.46)'
      : 'rgba(100, 116, 139, 0.38)';
  const actionDisabledBgColor = isForestTheme
    ? 'rgba(147, 197, 163, 0.14)'
    : mode === 'dark'
      ? 'rgba(148, 163, 184, 0.12)'
      : 'rgba(100, 116, 139, 0.12)';
  const actionFocusColor = isForestTheme
    ? 'rgba(127, 168, 138, 0.32)'
    : mode === 'dark'
      ? 'rgba(148, 163, 184, 0.28)'
      : alpha(resolvedPrimaryColor, 0.22);
  const cardBorderColor = isForestTheme ? '#2d6a4f' : mode === 'dark' ? '#52647a' : '#E2E8F0';
  const cardHoverBorderColor = isForestTheme ? '#3b8f66' : mode === 'dark' ? '#64748b' : '#CBD5E1';
  const cardShadow =
    mode === 'dark' ? '0 1px 0 rgba(0, 0, 0, 0.2)' : '0 1px 2px rgba(15, 23, 42, 0.06)';
  const appBarBackground = mode === 'dark' ? '#253345' : '#FFFFFF';
  const appBarTextColor = isForestTheme ? '#eafcf1' : mode === 'dark' ? '#f8fafc' : '#0F172A';
  const appBarBorderColor = isForestTheme ? '#2d6a4f' : mode === 'dark' ? '#52647a' : '#E2E8F0';
  const listHoverBg = isForestTheme ? 'rgba(127, 168, 138, 0.2)' : mode === 'dark' ? '#334155' : 'rgba(15, 23, 42, 0.04)';
  const listSelectedBg = isForestTheme
    ? 'rgba(127, 168, 138, 0.34)'
    : mode === 'dark'
      ? '#475569'
      : alpha(resolvedPrimaryColor, 0.14);
  const listSelectedHoverBg = isForestTheme
    ? 'rgba(127, 168, 138, 0.42)'
    : mode === 'dark'
      ? '#64748b'
      : alpha(resolvedPrimaryColor, 0.2);

  return createTheme({
    palette: {
      mode,
      common: {
        black: '#000000',
        white: '#ffffff',
      },
      primary: primaryColors,
      secondary: {
        main: secondaryColors.main,
        light: secondaryColors.light,
        dark: secondaryColors.dark,
        contrastText: '#ffffff',
      },
      error: {
        main: '#ef4444',
        light: '#f87171',
        dark: '#dc2626',
      },
      warning: {
        main: '#f59e0b',
        light: '#fbbf24',
        dark: '#d97706',
      },
      info: {
        main: '#3b82f6',
        light: '#60a5fa',
        dark: '#1d4e7c',
      },
      success: {
        main: '#22c55e',
        light: '#4ade80',
        dark: '#16a34a',
      },
      background: {
        default: preset.backgroundDefault,
        paper: preset.backgroundPaper,
      },
      workArea: preset.workArea,
      bodyArea: preset.bodyArea,
      text: {
        primary: preset.textPrimary,
        secondary: preset.textSecondary,
      },
      divider: dividerColor,
      action: {
        active: actionActiveColor,
        hover: actionHoverColor,
        selected: actionSelectedColor,
        disabled: actionDisabledColor,
        disabledBackground: actionDisabledBgColor,
        focus: actionFocusColor,
        hoverOpacity: 0.08,
        disabledOpacity: 0.38,
        activatedOpacity: 0.12,
        focusOpacity: 0.12,
        selectedOpacity: 0.12
      },
      grey: {
        50: isForestTheme ? '#113726' : mode === 'dark' ? '#1e293b' : '#f8fafc',
        100: isForestTheme ? '#194b34' : mode === 'dark' ? '#334155' : '#f1f5f9',
        200: isForestTheme ? '#236145' : mode === 'dark' ? '#475569' : '#e2e8f0',
        300: isForestTheme ? '#2f7d5a' : mode === 'dark' ? '#64748b' : '#cbd5e1',
        400: isForestTheme ? '#44a072' : mode === 'dark' ? '#94a3b8' : '#94a3b8',
        500: isForestTheme ? '#6bb894' : mode === 'dark' ? '#cbd5e1' : '#64748b',
        600: isForestTheme ? '#96d0b5' : mode === 'dark' ? '#e2e8f0' : '#475569',
        700: isForestTheme ? '#b9e3d2' : mode === 'dark' ? '#f1f5f9' : '#334155',
        800: isForestTheme ? '#d7f1e4' : mode === 'dark' ? '#f8fafc' : '#1e293b',
        900: isForestTheme ? '#edfbf3' : mode === 'dark' ? '#ffffff' : '#0f172a',
      },
    },
    typography: {
      fontFamily:
        'Inter, "Segoe UI", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
      h1: {
        fontSize: `${22 * fontSizeMultiplier}px`,
        fontWeight: 700,
        lineHeight: 1.3,
        letterSpacing: '-0.02em',
        ...(isLightMode ? { color: '#0F172A' } : {}),
      },
      pageTitle: {
        fontSize: `${22 * fontSizeMultiplier}px`,
        fontWeight: 700,
        lineHeight: 1.3,
        letterSpacing: '-0.02em',
        ...(isLightMode ? { color: '#0F172A', marginBottom: '6px' } : {}),
      },
      sectionTitle: {
        fontSize: `${16 * fontSizeMultiplier}px`,
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: '-0.015em',
        ...(isLightMode ? { color: '#0F172A' } : {}),
      },
      cardTitle: {
        fontSize: `${14 * fontSizeMultiplier}px`,
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: '-0.01em',
        ...(isLightMode ? { color: '#0F172A' } : {}),
      },
      pageDescription: {
        fontSize: `${13 * fontSizeMultiplier}px`,
        lineHeight: 1.6,
        ...(isLightMode ? { color: '#475569' } : {}),
      },
      kpiNumber: {
        fontSize: `${22 * fontSizeMultiplier}px`,
        fontWeight: 700,
        lineHeight: 1.3,
        letterSpacing: '-0.02em',
        ...(isLightMode ? { color: '#0F172A' } : {}),
      },
      h2: {
        fontSize: `${16 * fontSizeMultiplier}px`,
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: '-0.015em',
        ...(isLightMode ? { marginBottom: '12px', color: '#0F172A' } : {}),
      },
      h3: {
        fontSize: `${1.0625 * fontSizeMultiplier}rem`,
        fontWeight: 500,
        lineHeight: 1.45,
        letterSpacing: '-0.01em',
      },
      h4: {
        fontSize: `${1 * fontSizeMultiplier}rem`,
        fontWeight: 500,
        lineHeight: 1.45,
        letterSpacing: '-0.01em',
      },
      h5: {
        fontSize: `${1.0625 * fontSizeMultiplier}rem`,
        fontWeight: 600,
        lineHeight: 1.35,
        letterSpacing: '-0.01em',
      },
      h6: {
        fontSize: `${0.875 * fontSizeMultiplier}rem`,
        fontWeight: 500,
        lineHeight: 1.5,
        letterSpacing: '0',
      },
        body1: {
        fontSize: `${14 * fontSizeMultiplier}px`,
        fontWeight: 400,
        lineHeight: 1.6,
        letterSpacing: '0',
        ...(isLightMode ? { color: '#0F172A' } : {}),
      },
      body2: {
        fontSize: `${0.8125 * fontSizeMultiplier}rem`,
        lineHeight: 1.45,
        letterSpacing: '0',
      },
      caption: {
        fontSize: `${12 * fontSizeMultiplier}px`,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: '0',
        ...(isLightMode ? { color: '#475569' } : {}),
      },
      subtitle1: {
        fontSize: `${14 * fontSizeMultiplier}px`,
        fontWeight: 600,
        lineHeight: 1.4,
        letterSpacing: '-0.01em',
        ...(isLightMode ? { color: '#0F172A' } : {}),
      },
      subtitle2: {
        fontSize: `${0.875 * fontSizeMultiplier}rem`,
        fontWeight: 500,
        lineHeight: 1.45,
        letterSpacing: '0',
      },
    },
    shape: {
      borderRadius: 8,
    },
    spacing: 8,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            ...(isLightMode
              ? {
                  backgroundColor: '#F1F5F9',
                  color: '#0F172A',
                  fontSize: `${14 * fontSizeMultiplier}px`,
                }
              : {}),
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
            fontSize: `${14 * fontSizeMultiplier}px`,
            minHeight: isLightMode ? 40 : 36,
            padding: isLightMode ? '8px 16px' : '8px 16px',
            boxShadow: 'none',
            transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
            ...(isLightMode && {
              '&.Mui-disabled': { opacity: 0.5 },
            })
          },
          outlined: isLightMode
            ? {
                borderColor: '#CBD5E1',
                color: '#334155',
                '&:hover': {
                  borderColor: '#94A3B8',
                  backgroundColor: '#F8FAFC',
                },
              }
            : {},
          contained: {
            background: primaryColors.main,
            color: '#FFFFFF',
            boxShadow: isLightMode ? containedButtonShadow : 'none',
            '&:hover': {
              background: primaryColors.dark,
              color: '#FFFFFF',
              boxShadow: isLightMode ? containedButtonShadowHover : 'none',
            },
            '&.Mui-disabled': {
              color: '#FFFFFF',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: () => {
            if (!isLightMode) {
              return {
                borderRadius: 8,
                boxShadow: cardShadow,
                border: `1px solid ${cardBorderColor}`,
                backgroundColor: preset.backgroundPaper,
                transition: 'border-color 0.15s ease',
                '&:hover': { borderColor: cardHoverBorderColor },
              };
            }
            return {
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: `1px solid ${cardBorderColor}`,
              boxShadow: cardShadow,
              transition: 'border-color 0.15s ease',
              '&:hover': {
                borderColor: cardHoverBorderColor,
              },
            };
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: isLightMode ? '20px' : 24,
            '&:last-child': {
              paddingBottom: isLightMode ? '20px' : 24,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: ({
            ownerState,
          }: {
            ownerState: { variant?: string; elevation?: number };
          }) => {
            if (!isLightMode) {
              return {
                boxShadow: 'none',
                border: `1px solid ${dividerColor}`,
                backgroundColor: preset.backgroundPaper,
                backgroundImage: 'none',
              };
            }
            const elev =
              ownerState.variant === 'elevation' && typeof ownerState.elevation === 'number'
                ? ownerState.elevation
                : 0;
            if (ownerState.variant === 'elevation' && elev >= 8) {
              return { backgroundImage: 'none' };
            }
            return {
              backgroundImage: 'none',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              boxShadow: cardShadow,
              border: `1px solid ${cardBorderColor}`,
            };
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: dividerColor,
            opacity: isLightMode ? 1 : 0.9,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: isLightMode ? '#ffffff' : preset.backgroundPaper,
            ...(isLightMode
              ? {
                  borderRadius: 8,
                  minHeight: 44,
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }
              : {}),
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: isLightMode ? '#CBD5E1' : dividerColor,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isLightMode ? '#94A3B8' : '#64748b',
            },
            '&.Mui-focused': isLightMode
              ? { boxShadow: `0 0 0 3px ${alpha(primaryColors.main, 0.16)}` }
              : {},
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: primaryColors.main,
              borderWidth: 1,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: isLightMode ? '1px solid #E2E8F0' : `1px solid ${dividerColor}`,
            ...(isLightMode && { fontSize: '14px', padding: '14px 16px', color: '#0F172A', lineHeight: 1.5 }),
          },
          head: {
            backgroundColor: isLightMode ? 'transparent' : '#2b3a4f',
            color: isLightMode ? '#334155' : preset.textSecondary,
            fontWeight: 600,
            fontSize: isLightMode ? '12.5px' : undefined,
            lineHeight: isLightMode ? 1.4 : undefined,
            letterSpacing: isLightMode ? '0.01em' : undefined,
            textTransform: 'none',
            borderBottom: isLightMode ? '1px solid #E2E8F0' : `1px solid ${dividerColor}`,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: isLightMode
            ? {
                backgroundColor: '#F8FAFC',
              }
            : {},
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: isLightMode
            ? {
                height: 56,
                transition: 'background-color 0.15s ease',
                '&:hover': { backgroundColor: '#F8FAFC' },
              }
            : {},
        },
      },
      MuiTable: {
        styleOverrides: {
          root: isLightMode
            ? {
                '& .MuiTableHead-root': { backgroundColor: '#F8FAFC' },
                '& .MuiTableCell-head': {
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#334155',
                  lineHeight: 1.4,
                },
                '& .MuiTableRow-root': { height: 56 },
                '& .MuiTableRow-root:hover': { backgroundColor: '#F8FAFC' },
                '& .MuiTableCell-root': {
                  borderBottom: '1px solid #E2E8F0',
                  fontSize: '14px',
                  lineHeight: 1.5,
                  color: '#0F172A',
                },
              }
            : {},
        },
      },
      MuiChip: {
        styleOverrides: {
          root: isLightMode
            ? {
                borderRadius: 6,
                height: 26,
                fontWeight: 600,
                fontSize: '0.75rem',
              }
            : {},
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: isLightMode ? '1px solid #E2E8F0' : `1px solid ${dividerColor}`,
            boxShadow: 'none',
            backgroundColor: mode === 'dark' ? '#1b2738' : '#FFFFFF',
            backgroundImage: 'none',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: appBarBackground,
            color: appBarTextColor,
            boxShadow: 'none',
            borderBottom: `1px solid ${appBarBorderColor}`,
            backdropFilter: 'none',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: isLightMode ? '4px 8px' : '2px 8px',
            padding: isLightMode ? '10px 12px' : undefined,
            borderLeft: 'none',
            ...(isLightMode
              ? {
                  fontSize: '13.5px',
                  color: '#475569',
                }
              : {}),
            transition: 'background-color 0.15s ease, color 0.15s ease',
            '&:hover': {
              backgroundColor: listHoverBg,
            },
            '&.Mui-selected': {
              backgroundColor: listSelectedBg,
              ...(isLightMode
                ? {
                    color: primaryColors.dark,
                    fontWeight: 600,
                  }
                : {}),
              '&:hover': {
                backgroundColor: listSelectedHoverBg,
              },
            },
          },
        },
      },
    },
  });
};

