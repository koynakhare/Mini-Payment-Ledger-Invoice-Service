import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useLoginMutation } from '../store/slices/authApi';
import { ROUTE_PATHS } from '../routes/routePaths';
import { getErrorMessage } from '../utils/errors';
import { gradientButtonSx } from '../theme/buttonStyles';
import { tokens } from '../theme/tokens';

const FIELD_RADIUS = '10px';
const CARD_RADIUS = '16px';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: FIELD_RADIUS,
    bgcolor: tokens.color.surfaceMuted,
    '& fieldset': {
      borderColor: tokens.color.border,
      borderWidth: 1,
    },
    '&:hover fieldset': {
      borderColor: tokens.color.inkMuted,
    },
    '&.Mui-focused': {
      bgcolor: tokens.color.surface,
      boxShadow: 'none',
    },
    '&.Mui-focused fieldset': {
      borderColor: tokens.color.accent,
      borderWidth: 1,
    },
  },
} as const;

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [loginMutation, { isLoading }] = useLoginMutation();

  const from =
    (location.state as { from?: string } | null)?.from ?? ROUTE_PATHS.DASHBOARD;

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    try {
      const result = await loginMutation({ email: email.trim(), password }).unwrap();
      login(result.token, {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      });
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err));
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
        background: tokens.color.baseGradient,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          px: { xs: 3.5, sm: 5 },
          py: { xs: 4, sm: 5 },
          borderRadius: CARD_RADIUS,
          border: `1px solid ${tokens.color.borderSubtle}`,
          bgcolor: tokens.color.surface,
          boxShadow: tokens.shadow.cardHover,
        }}
      >
        <Stack alignItems="center" spacing={1.25} sx={{ mb: 4 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '12px',
              background: tokens.color.accentGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: tokens.shadow.glow,
              mb: 0.5,
            }}
          >
            <LocalShippingOutlinedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 700, letterSpacing: '-0.02em', color: tokens.color.ink }}
          >
            TMS Payables
          </Typography>
          <Typography variant="body2" sx={{ color: tokens.color.inkMuted, textAlign: 'center' }}>
            Sign in to continue to your payment ledger
          </Typography>
        </Stack>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2.75}>
            {formError ? (
              <Alert severity="error" sx={{ borderRadius: FIELD_RADIUS }}>
                {formError}
              </Alert>
            ) : null}

            <Box>
              <Typography
                component="label"
                htmlFor="login-email"
                variant="body2"
                sx={{ display: 'block', mb: 1, fontWeight: 600, color: tokens.color.ink }}
              >
                Email Address
              </Typography>
              <TextField
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                sx={fieldSx}
              />
            </Box>

            <Box>
              <Typography
                component="label"
                htmlFor="login-password"
                variant="body2"
                sx={{ display: 'block', mb: 1, fontWeight: 600, color: tokens.color.ink }}
              >
                Password
              </Typography>
              <TextField
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                sx={fieldSx}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? (
                          <VisibilityOffOutlinedIcon fontSize="small" />
                        ) : (
                          <VisibilityOutlinedIcon fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Button
              type="submit"
              variant="contained"
              disabled={isLoading}
              fullWidth
              sx={{
                ...gradientButtonSx,
                mt: 0.5,
                py: 1.4,
                borderRadius: FIELD_RADIUS,
                fontWeight: 600,
                fontSize: '0.9375rem',
              }}
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
