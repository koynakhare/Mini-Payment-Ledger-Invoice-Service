import { alpha, createTheme } from '@mui/material/styles';
import { tokens } from './tokens';

declare module '@mui/material/styles' {
  interface Palette {
    ink: Palette['primary'];
    border: Palette['primary'];
  }
  interface PaletteOptions {
    ink?: PaletteOptions['primary'];
    border?: PaletteOptions['primary'];
  }
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: tokens.color.primary,
      dark: tokens.color.primaryHover,
      contrastText: tokens.color.surface,
    },
    secondary: {
      main: tokens.color.inkSecondary,
    },
    success: {
      main: tokens.color.success,
      light: tokens.color.successMuted,
    },
    warning: {
      main: tokens.color.warning,
      light: tokens.color.warningMuted,
    },
    error: {
      main: tokens.color.error,
      light: tokens.color.errorMuted,
    },
    info: {
      main: tokens.color.info,
      light: tokens.color.infoMuted,
    },
    text: {
      primary: tokens.color.ink,
      secondary: tokens.color.inkSecondary,
      disabled: tokens.color.inkMuted,
    },
    background: {
      default: tokens.color.base,
      paper: tokens.color.surface,
    },
    divider: tokens.color.border,
    ink: {
      main: tokens.color.ink,
    },
    border: {
      main: tokens.color.border,
    },
  },
  typography: {
    fontFamily: tokens.font.body,
    h4: {
      fontWeight: 600,
      letterSpacing: '-0.02em',
      color: tokens.color.ink,
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.015em',
      color: tokens.color.ink,
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
      color: tokens.color.ink,
    },
    subtitle1: {
      fontWeight: 500,
    },
    subtitle2: {
      fontWeight: 500,
      color: tokens.color.inkSecondary,
    },
    body2: {
      color: tokens.color.inkSecondary,
    },
    overline: {
      fontWeight: 600,
      letterSpacing: '0.06em',
      color: tokens.color.inkMuted,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 0,
  },
  spacing: 4,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          height: '100%',
          overflow: 'hidden',
        },
        body: {
          height: '100%',
          overflow: 'hidden',
          backgroundColor: tokens.color.base,
          color: tokens.color.ink,
        },
        '#root': {
          height: '100%',
          overflow: 'hidden',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 0,
          padding: '8px 16px',
          transition: `background-color ${tokens.transition.fast}, box-shadow ${tokens.transition.fast}, transform ${tokens.transition.fast}`,
          '@media (prefers-reduced-motion: no-preference)': {
            '&:hover': {
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'translateY(0)',
            },
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: tokens.shadow.cardHover,
          },
        },
        outlined: {
          borderColor: tokens.color.border,
          '&:hover': {
            borderColor: tokens.color.primary,
            backgroundColor: alpha(tokens.color.primary, 0.04),
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          border: `1px solid ${tokens.color.borderSubtle}`,
          boxShadow: tokens.shadow.card,
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 0,
        },
        outlined: {
          border: `1px solid ${tokens.color.borderSubtle}`,
          boxShadow: tokens.shadow.card,
          borderRadius: 0,
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          fontSize: '0.75rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: tokens.color.inkSecondary,
          backgroundColor: tokens.color.surfaceMuted,
          borderBottom: `1px solid ${tokens.color.border}`,
        },
        body: {
          borderBottom: `1px solid ${tokens.color.borderSubtle}`,
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: `background-color ${tokens.transition.fast}`,
          '&:hover': {
            backgroundColor: alpha(tokens.color.primary, 0.03),
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.75rem',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 0,
            transition: `border-color ${tokens.transition.fast}, box-shadow ${tokens.transition.fast}`,
            '&.Mui-focused': {
              boxShadow: `0 0 0 3px ${alpha(tokens.color.primary, 0.12)}`,
            },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          border: `1px solid ${tokens.color.borderSubtle}`,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
        standardSuccess: {
          backgroundColor: tokens.color.successMuted,
          color: tokens.color.success,
        },
        standardError: {
          backgroundColor: tokens.color.errorMuted,
          color: tokens.color.error,
        },
        standardWarning: {
          backgroundColor: tokens.color.warningMuted,
          color: tokens.color.warning,
        },
        standardInfo: {
          backgroundColor: tokens.color.infoMuted,
          color: tokens.color.info,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          margin: '2px 8px',
          transition: `background-color ${tokens.transition.fast}, color ${tokens.transition.fast}`,
          '&.Mui-selected': {
            backgroundColor: tokens.color.primaryMuted,
            color: tokens.color.primary,
            '& .MuiListItemIcon-root': {
              color: tokens.color.primary,
            },
            '&:hover': {
              backgroundColor: alpha(tokens.color.primary, 0.12),
            },
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: 'none',
        },
      },
    },
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiAlert-root': {
            boxShadow: tokens.shadow.cardHover,
          },
        },
      },
    },
  },
});
