import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useLoginMutation } from '../store/slices/authApi';
import { ROUTE_PATHS } from '../routes/routePaths';
import { getErrorMessage } from '../utils/errors';
import { gradientButtonSx } from '../theme/buttonStyles';
import { tokens } from '../theme/tokens';

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        background: tokens.color.baseGradient,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: { xs: 3, sm: 4 },
          border: `1px solid ${tokens.color.border}`,
          bgcolor: tokens.color.surface,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              background: tokens.color.accentGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <LocalShippingOutlinedIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              TMS Payables
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to continue
            </Typography>
          </Box>
        </Box>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2 }}>
          {formError ? <Alert severity="error">{formError}</Alert> : null}
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
            sx={{ ...gradientButtonSx, py: 1.25, mt: 0.5 }}
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
