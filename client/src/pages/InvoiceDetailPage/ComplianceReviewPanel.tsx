import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import type { ComplianceFlag, ComplianceReview, ComplianceSeverity } from '../../types';
import { tokens } from '../../theme/tokens';

const SEVERITY_STYLES: Record<
  ComplianceSeverity,
  { bg: string; color: string; label: string }
> = {
  info: { bg: tokens.color.infoMuted, color: tokens.color.info, label: 'Info' },
  low: { bg: tokens.color.draftMuted, color: tokens.color.draft, label: 'Low' },
  medium: { bg: tokens.color.warningMuted, color: tokens.color.warning, label: 'Medium' },
  high: { bg: tokens.color.errorMuted, color: tokens.color.error, label: 'High' },
};

function formatFlagType(type: string): string {
  return type.replace(/_/g, ' ');
}

interface ComplianceReviewPanelProps {
  loading: boolean;
  errorMessage?: string;
  review?: ComplianceReview | null;
}

export function ComplianceReviewPanel({
  loading,
  errorMessage,
  review,
}: ComplianceReviewPanelProps) {
  return (
    <Box
      sx={{
        mt: 2.5,
        p: 2,
        border: `1px solid ${tokens.color.border}`,
        bgcolor: tokens.color.surfaceMuted,
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        AI compliance review
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', mb: 1.5, color: tokens.color.inkMuted }}>
        Informational only — AI advises, you decide. This never blocks payment.
      </Typography>

      {loading ? (
        <Stack direction="row" spacing={1.25} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Running compliance review…
          </Typography>
        </Stack>
      ) : null}

      {!loading && errorMessage ? (
        <Alert severity="warning" sx={{ borderRadius: 0 }}>
          {errorMessage}. You can still apply the payment.
        </Alert>
      ) : null}

      {!loading && !errorMessage && review && !review.available ? (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          {review.summary || 'AI review unavailable'}. You can still apply the payment.
        </Alert>
      ) : null}

      {!loading && !errorMessage && review?.available ? (
        <Box>
          <Typography variant="body2" sx={{ mb: review.flags.length ? 1.5 : 0 }}>
            {review.summary}
          </Typography>
          <Stack spacing={1}>
            {review.flags.map((flag: ComplianceFlag, index: number) => {
              const style = SEVERITY_STYLES[flag.severity] ?? SEVERITY_STYLES.info;
              return (
                <Box
                  key={`${flag.type}-${index}`}
                  sx={{
                    p: 1.25,
                    bgcolor: tokens.color.surface,
                    border: `1px solid ${tokens.color.borderSubtle}`,
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                    <Chip
                      size="small"
                      label={style.label}
                      sx={{
                        fontWeight: 600,
                        bgcolor: style.bg,
                        color: style.color,
                        borderRadius: 0,
                      }}
                    />
                    <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: '0.02em' }}>
                      {formatFlagType(flag.type)}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {flag.rationale}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>
      ) : null}
    </Box>
  );
}
