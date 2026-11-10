import { createStitches } from '@stitches/react';

const { globalCss } = createStitches({
  theme: {
    colors: {
      bgCanvas: '#F1F5F9',
      bgSurface: '#ffffff',
      bgMuted: '#F3F7FB',
      textStrong: '#0F172A',
      textMuted: '#475569',
      borderSubtle: '#E2E8F0',
      borderStrong: '#CBD5E1',
      primary: '#1D4E7C',
      primaryHover: '#163E63',
      focusRing: 'rgba(29, 78, 124, 0.24)',
    },
    radii: {
      sm: '6px',
      md: '8px',
      lg: '8px',
      xl: '10px',
      full: '9999px',
    },
    shadows: {
      card: '0 1px 2px rgba(36, 52, 71, 0.05)',
      cardHover: '0 1px 2px rgba(36, 52, 71, 0.05)',
    },
    fonts: {
      body:
        'Inter, "Segoe UI", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
      mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    },
  },
});

const applyGlobalStyles = globalCss({
  'html, body, #root': {
    minHeight: '100%',
  },
  body: {
    margin: 0,
    backgroundColor: '$bgCanvas',
    color: '$textStrong',
    fontFamily: '$body',
    lineHeight: 1.6,
    fontSize: '13.5px',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  },
  '.MuiPaper-root': {
    border: '1px solid #E2E8F0',
    backgroundImage: 'none',
    boxShadow: '$card',
  },
  '.MuiCard-root': {
    borderRadius: '8px',
    boxShadow: '$card',
    border: '1px solid #E2E8F0',
    transition: 'border-color 0.15s ease',
    '&:hover': {
      borderColor: '#CBD5E1',
    },
  },
  '.MuiCard-root:has([data-testid="SearchIcon"])': {
    border: '1px solid #E2E8F0 !important',
    backgroundColor: '#F0F4F8',
    boxShadow: 'none !important',
    '&:hover': {
      transform: 'none',
    },
  },
  '.MuiOutlinedInput-root:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': {
    borderColor: '#E2E8F0',
  },
  '.MuiOutlinedInput-root:not(.Mui-disabled):hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#94A3B8',
  },
  '.MuiCard-root.MuiPaper-outlined': {
    borderRadius: '8px',
    boxShadow: '$card',
  },
  '.MuiButton-root': {
    textTransform: 'none',
    fontWeight: 500,
    borderRadius: '$md',
  },
  '.MuiButton-contained': {
    boxShadow: 'none',
    '&:hover': {
      boxShadow: 'none',
    },
  },
  '.MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderWidth: '1px',
  },
});

let injected = false;

export const injectStitchesGlobalStyles = (): void => {
  if (injected) return;
  applyGlobalStyles();
  injected = true;
};
