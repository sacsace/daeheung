import '@mui/material/styles';
import type { CSSProperties } from 'react';

declare module '@mui/material/styles' {
  interface Palette {
    workArea: {
      main: string;
      light: string;
      dark: string;
    };
    bodyArea: {
      main: string;
      light: string;
      dark: string;
    };
  }

  interface PaletteOptions {
    workArea?: {
      main?: string;
      light?: string;
      dark?: string;
    };
    bodyArea?: {
      main?: string;
      light?: string;
      dark?: string;
    };
  }

  interface TypographyVariants {
    pageTitle: CSSProperties;
    sectionTitle: CSSProperties;
    cardTitle: CSSProperties;
    pageDescription: CSSProperties;
    kpiNumber: CSSProperties;
  }

  interface TypographyVariantsOptions {
    pageTitle?: CSSProperties;
    sectionTitle?: CSSProperties;
    cardTitle?: CSSProperties;
    pageDescription?: CSSProperties;
    kpiNumber?: CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    pageTitle: true;
    sectionTitle: true;
    cardTitle: true;
    pageDescription: true;
    kpiNumber: true;
  }
}
