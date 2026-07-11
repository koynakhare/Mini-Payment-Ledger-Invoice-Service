import {
  Box,
  Button,
  Container,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LAYOUT, NAV_ITEMS } from '../constants';
import { ROUTE_PATHS } from '../routes/routePaths';
import { tokens } from '../theme/tokens';

const NAV_ROUTE_MAP = {
  dashboard: ROUTE_PATHS.DASHBOARD,
  accounts: ROUTE_PATHS.ACCOUNTS,
  invoices: ROUTE_PATHS.INVOICES,
} as const;

const NAV_ICONS = {
  dashboard: <DashboardOutlinedIcon fontSize="small" />,
  accounts: <AccountBalanceOutlinedIcon fontSize="small" />,
  invoices: <ReceiptLongOutlinedIcon fontSize="small" />,
} as const;

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) =>
    path === ROUTE_PATHS.DASHBOARD
      ? location.pathname === ROUTE_PATHS.DASHBOARD
      : location.pathname.startsWith(path);

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const drawerContent = (
    <>
      <Box
        sx={{
          px: 2.5,
          pt: 3,
          pb: 2.5,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: tokens.radius.md,
              background: tokens.color.accentGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: tokens.shadow.glow,
            }}
          >
            <LocalShippingOutlinedIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#fff',
                fontSize: '0.9375rem',
                lineHeight: 1.2,
              }}
            >
              TMS Payables
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              Payment Ledger
            </Typography>
          </Box>
        </Box>
      </Box>

      <List sx={{ px: 1.5, py: 2, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const path = NAV_ROUTE_MAP[item.key];
          const active = isActive(path);
          return (
            <ListItemButton
              key={item.key}
              selected={active}
              onClick={() => handleNavigate(path)}
              sx={{
                borderRadius: tokens.radius.md,
                mb: 0.5,
                color: active ? tokens.color.sidebarTextActive : tokens.color.sidebarText,
                '&.Mui-selected': {
                  bgcolor: tokens.color.sidebarActive,
                  color: tokens.color.sidebarTextActive,
                  '& .MuiListItemIcon-root': { color: tokens.color.accent },
                  '&:hover': { bgcolor: tokens.color.sidebarActive },
                },
                '&:hover': { bgcolor: tokens.color.sidebarHover },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 36,
                  color: active ? tokens.color.accent : 'rgba(255,255,255,0.55)',
                }}
              >
                {NAV_ICONS[item.key]}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: active ? 600 : 500,
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => handleNavigate(ROUTE_PATHS.INVOICES)}
          sx={{
            background: tokens.color.accentGradient,
            color: '#fff',
            py: 1.1,
            fontWeight: 600,
            '&:hover': {
              background: tokens.color.accentGradient,
              filter: 'brightness(1.08)',
            },
          }}
        >
          New Invoice
        </Button>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', height: '100dvh', overflow: 'hidden', bgcolor: tokens.color.base }}>
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: LAYOUT.DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: LAYOUT.DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: tokens.color.sidebar,
            color: tokens.color.sidebarText,
            borderRight: 'none',
            boxShadow: tokens.shadow.sidebar,
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: tokens.color.baseGradient,
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -120,
            right: 0,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(13,148,136,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          },
        }}
      >
        {isMobile ? (
          <Toolbar
            sx={{
              px: 1.5,
              minHeight: { xs: 56 },
              borderBottom: `1px solid ${tokens.color.borderSubtle}`,
              bgcolor: tokens.color.surface,
              flexShrink: 0,
            }}
          >
            <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </IconButton>
            <Typography variant="subtitle1" sx={{ ml: 1, fontWeight: 600 }}>
              TMS Payables
            </Typography>
          </Toolbar>
        ) : null}

        <Container
          maxWidth="lg"
          disableGutters={isMobile}
          sx={{
            flex: 1,
            overflow: 'auto',
            py: { xs: 2, md: 3 },
            px: { xs: 2, sm: 2.5, md: 3 },
            position: 'relative',
          }}
        >
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
