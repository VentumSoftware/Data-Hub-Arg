import { createTheme } from '@mui/material/styles';
import '@mui/material/styles';
import { lighten, darken } from '@mui/material/styles';
declare module '@mui/material/styles' {
  interface TypeBackground {
    paperSecondary: string;
  }
}

export const getTheme = (mode: 'light' | 'dark', primaryColor?: any): Theme =>
  createTheme({
    typography: {
      pxToRem: (size: number) => `${size / 16}rem`,
      "fontFamily": "'Montserrat', sans-serif",
      "fontSize": 14,
      "fontWeightLight": 300,
      "fontWeightRegular": 400,
      "fontWeightMedium": 500
    },
    palette: {
      mode,
      primary: {
        main: primaryColor?.main || '#FF7D00',
        light: lighten(primaryColor?.main||'#FF7D00', 0.3) ,
        dark: darken(primaryColor?.main||'#FF7D00', 0.3),
        contrastText: primaryColor?.contrastText || '#FFECD1',
      },
      secondary: {
        main: '#15616D',
        light: '#CA75C0',
        dark: '#672C5F',
        contrastText: '#FFECD1',
      },
      info: {
        main: '#287580',
        light: '#074F59',
        dark: '#0073AC',
        contrastText: '#FFECD1',
      },
      success: {
        main: '#4CAF50',
        light: '#80E27E',
        dark: '#087F23',
        contrastText: '#FFFFFF',
      },
      error: {
        main: '#F44336',
        light: '#FF7961',
        dark: '#BA000D',
        contrastText: '#FFFFFF',
      },
      warning: {
        main: '#FF9800',
        light: '#FFC947',
        dark: '#C66900',
        contrastText: '#000000',
      },
      background: {
        default: mode === 'light' ? '#f4f6f8' : '#121212',
        paper: mode === 'light' ? '#ffffff' : '#1E1E1E',
        paperSecondary: mode === 'light' ? '#f4f6f8' : '#161616',
      },
    },
    components: {
      MuiDataGrid: {
        defaultProps: {
          density: "compact",
        },
        styleOverrides: {
          columnHeader: {
            fontWeight: 'bold'
          }
        }
      }
    }
  });
