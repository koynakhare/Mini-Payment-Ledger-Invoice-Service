import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Breadcrumbs as MuiBreadcrumbs,
  IconButton,
  Link,
  Typography,
  Box,
} from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { tokens } from '../../theme/tokens';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  backTo?: string;
}

export function Breadcrumbs({ items, backTo }: BreadcrumbsProps) {
  const navigate = useNavigate();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      {backTo ? (
        <IconButton
          size="small"
          aria-label="Go back"
          onClick={() => navigate(backTo)}
          sx={{
            ml: -0.75,
            color: tokens.color.inkSecondary,
            '&:hover': { color: tokens.color.primary, bgcolor: tokens.color.surfaceMuted },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
      ) : null}
      <MuiBreadcrumbs sx={{ mb: 0 }}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          if (isLast || !item.path) {
            return (
              <Typography key={`${item.label}-${index}`} color="text.primary" variant="body2">
                {item.label}
              </Typography>
            );
          }
          return (
            <Link
              key={`${item.label}-${index}`}
              component={RouterLink}
              to={item.path}
              underline="hover"
              color="inherit"
              variant="body2"
            >
              {item.label}
            </Link>
          );
        })}
      </MuiBreadcrumbs>
    </Box>
  );
}
