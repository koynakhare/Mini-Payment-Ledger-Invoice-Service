import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
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
  );
}
