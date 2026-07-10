import { Box, Button, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { tokens } from '../../theme/tokens';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  backTo?: string;
  backLabel?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  backTo,
  backLabel = 'Back',
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        mb: { xs: 3, md: 4 },
        p: { xs: 2, sm: 2.5, md: 3 },
        borderRadius: 0,
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.borderSubtle}`,
        boxShadow: tokens.shadow.card,
        position: 'relative',
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
      {backTo ? (
        <Button
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={() => navigate(backTo)}
          sx={{
            mb: breadcrumbs ? 0.5 : 1,
            ml: -0.5,
            color: tokens.color.inkSecondary,
            alignSelf: 'flex-start',
            '&:hover': { color: tokens.color.primary, bgcolor: 'transparent' },
          }}
        >
          {backLabel}
        </Button>
      ) : null}
      {breadcrumbs}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mt: breadcrumbs || backTo ? 1 : 0 }}
      >
        <Box sx={{ minWidth: 0 }}>
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
            <Typography variant="body2" sx={{ maxWidth: 560, lineHeight: 1.6, wordBreak: 'break-word' }}>
              {subtitle}
            </Typography>
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
