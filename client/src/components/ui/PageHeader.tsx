import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { tokens } from '../../theme/tokens';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
}: PageHeaderProps) {
  return (
    <Box
      sx={{
        mb: { xs: 3, md: 4 },
        p: { xs: 2, sm: 2.5, md: 3 },
        borderRadius: 0,
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.borderSubtle}`,
        boxShadow: tokens.shadow.card,
        position: 'sticky',
        top: 0,
        zIndex: 20,
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: tokens.color.accentGradient,
        },
      }}
    >
      {breadcrumbs}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mt: breadcrumbs ? 1 : 0 }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="h5"
            sx={{
              mb: subtitle ? 0.75 : 0,
              fontWeight: 700,
              letterSpacing: '-0.025em',
              wordBreak: 'break-word',
            }}
          >
            {title}
          </Typography>
          {subtitle ? (
            <Box sx={{ mt: 0.75, maxWidth: { xs: '100%', md: '72ch' }, wordBreak: 'break-word' }}>
              {subtitle}
            </Box>
          ) : null}
        </Box>
        {actions ? (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}
          >
            {actions}
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
