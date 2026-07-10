import { Box, Typography } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import { tokens } from '../../theme/tokens';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 3,
        textAlign: 'center',
        borderRadius: 0,
        border: `1px dashed ${tokens.color.border}`,
        backgroundColor: tokens.color.surfaceMuted,
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.color.surface,
          border: `1px solid ${tokens.color.borderSubtle}`,
          mb: 2,
          color: tokens.color.inkMuted,
        }}
      >
        <InboxOutlinedIcon fontSize="medium" />
      </Box>
      <Typography variant="subtitle1" sx={{ mb: 0.5, color: tokens.color.ink }}>
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" sx={{ maxWidth: 360, mb: action ? 2 : 0 }}>
          {description}
        </Typography>
      ) : null}
      {action}
    </Box>
  );
}
