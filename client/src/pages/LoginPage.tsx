import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Loader } from '../components/common/Loader';
import { ROUTE_PATHS } from '../routes/routePaths';
import { tokens } from '../theme/tokens';

type AuthMode = 'signIn' | 'signUp';

export function LoginPage() {
  const { isConfigured, isLoading, session, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isConfigured) {
    return <Navigate to={ROUTE_PATHS.DASHBOARD} replace />;
  }

  if (isLoading) {
    return <Loader variant="page" />;
  }

  if (session) {
    return <Navigate to={ROUTE_PATHS.DASHBOARD} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);

    try {
      if (mode === 'signIn') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
        setInfo('Account created. Check your email if confirmation is required, then sign in.');
        setMode('signIn');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: tokens.color.baseGradient,
        px: 2,
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 420,
          border: `1px solid ${tokens.color.borderSubtle}`,
          boxShadow: tokens.shadow.card,
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3}>
            <Stack spacing={1} alignItems="center" textAlign="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: tokens.radius.md,
                  background: tokens.color.accentGradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: tokens.shadow.glow,
                }}
              >
                <LocalShippingOutlinedIcon />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, color: tokens.color.ink }}>
                TMS Payables
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mode === 'signIn' ? 'Sign in to manage invoices and payments' : 'Create your account'}
              </Typography>
            </Stack>

            {error ? <Alert severity="error">{error}</Alert> : null}
            {info ? <Alert severity="info">{info}</Alert> : null}

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  fullWidth
                  autoComplete="email"
                />
                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  fullWidth
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  inputProps={{ minLength: 6 }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting}
                  sx={{
                    py: 1.2,
                    fontWeight: 600,
                    background: tokens.color.accentGradient,
                    '&:hover': {
                      background: tokens.color.accentGradient,
                      filter: 'brightness(1.05)',
                    },
                  }}
                >
                  {submitting
                    ? mode === 'signIn'
                      ? 'Signing in...'
                      : 'Creating account...'
                    : mode === 'signIn'
                      ? 'Sign In'
                      : 'Create Account'}
                </Button>
              </Stack>
            </Box>

            <Typography variant="body2" color="text.secondary" textAlign="center">
              {mode === 'signIn' ? "Don't have an account? " : 'Already have an account? '}
              <Link
                component="button"
                type="button"
                underline="hover"
                onClick={() => {
                  setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                  setError('');
                  setInfo('');
                }}
              >
                {mode === 'signIn' ? 'Create one' : 'Sign in'}
              </Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
