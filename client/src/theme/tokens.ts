export const tokens = {
  color: {
    base: '#EEF2F8',
    baseGradient: 'linear-gradient(160deg, #EEF2F8 0%, #E4EBF5 45%, #E8F0FA 100%)',
    surface: '#FFFFFF',
    surfaceMuted: '#F6F9FC',
    surfaceElevated: '#FFFFFF',
    ink: '#0A1628',
    inkSecondary: '#4A5D73',
    inkMuted: '#8B9CB0',
    border: '#D8E2ED',
    borderSubtle: '#E8EEF5',
    primary: '#0F2B4A',
    primaryHover: '#0A2240',
    primaryMuted: '#E3ECF6',
    accent: '#0D9488',
    accentHover: '#0B7C72',
    accentMuted: '#E6F7F5',
    accentGradient: 'linear-gradient(135deg, #0F2B4A 0%, #0D5C7A 50%, #0D9488 100%)',
    success: '#047857',
    successMuted: '#ECFDF5',
    warning: '#B45309',
    warningMuted: '#FFFBEB',
    error: '#B91C1C',
    errorMuted: '#FEF2F2',
    info: '#1D4ED8',
    infoMuted: '#EFF6FF',
    draft: '#64748B',
    draftMuted: '#F1F5F9',
    sidebar: '#0A1628',
    sidebarHover: 'rgba(255, 255, 255, 0.06)',
    sidebarActive: 'rgba(13, 148, 136, 0.18)',
    sidebarText: 'rgba(255, 255, 255, 0.72)',
    sidebarTextActive: '#FFFFFF',
  },
  radius: {
    sm: 0,
    md: 0,
    lg: 0,
    xl: 0,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  shadow: {
    card: '0 1px 2px rgba(10, 22, 40, 0.04), 0 8px 24px rgba(10, 22, 40, 0.06)',
    cardHover: '0 4px 12px rgba(10, 22, 40, 0.08), 0 16px 40px rgba(10, 22, 40, 0.08)',
    sidebar: '4px 0 24px rgba(10, 22, 40, 0.12)',
    glow: '0 0 0 1px rgba(13, 148, 136, 0.15), 0 8px 32px rgba(13, 148, 136, 0.12)',
  },
  font: {
    body: '"IBM Plex Sans", system-ui, sans-serif',
    mono: '"IBM Plex Mono", "SF Mono", monospace',
  },
  transition: {
    fast: '140ms ease',
    normal: '220ms ease',
    slow: '360ms ease',
  },
} as const;

export type InvoiceStatusToken =
  | 'draft'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue';

export const statusTokens: Record<
  InvoiceStatusToken,
  { color: string; background: string; border: string }
> = {
  draft: {
    color: tokens.color.draft,
    background: tokens.color.draftMuted,
    border: tokens.color.border,
  },
  sent: {
    color: tokens.color.info,
    background: tokens.color.infoMuted,
    border: '#BFDBFE',
  },
  partially_paid: {
    color: tokens.color.warning,
    background: tokens.color.warningMuted,
    border: '#FDE68A',
  },
  paid: {
    color: tokens.color.success,
    background: tokens.color.successMuted,
    border: '#A7F3D0',
  },
  overdue: {
    color: tokens.color.error,
    background: tokens.color.errorMuted,
    border: '#FECACA',
  },
};

export const accountTypeTokens: Record<string, { color: string; background: string }> = {
  COMPANY_BANK: { color: tokens.color.primary, background: tokens.color.primaryMuted },
  VENDOR_PAYABLE: { color: tokens.color.accent, background: tokens.color.accentMuted },
  EXPENSE: { color: tokens.color.warning, background: tokens.color.warningMuted },
};
