import { tokens } from './tokens';

export const gradientButtonSx = {
  color: '#fff',
  background: tokens.color.accentGradient,
  whiteSpace: 'nowrap',
  '& .MuiButton-startIcon': { color: '#fff' },
  '&:hover': {
    background: tokens.color.accentGradient,
    filter: 'brightness(1.06)',
    color: '#fff',
  },
  '&.Mui-disabled': {
    color: 'rgba(255,255,255,0.72)',
    background: tokens.color.accentGradient,
    opacity: 0.6,
  },
} as const;
