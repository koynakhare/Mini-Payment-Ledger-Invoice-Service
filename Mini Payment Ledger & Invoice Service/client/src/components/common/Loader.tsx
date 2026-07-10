import { Box, Skeleton } from '@mui/material';
import { TABLE_DEFAULTS } from '../../constants';

export type LoaderVariant = 'table' | 'card' | 'page';

export interface LoaderProps {
  variant?: LoaderVariant;
  rows?: number;
  columns?: number;
}

function TableLoader({ rows, columns }: { rows: number; columns: number }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 1, px: 2, py: 1.5 }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" width={i === columns - 1 ? 64 : 96} height={20} />
        ))}
      </Box>
      {Array.from({ length: rows }).map((_, row) => (
        <Box key={row} sx={{ display: 'flex', gap: 2, px: 2, py: 1.5 }}>
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton key={col} variant="text" width={col >= columns - 2 ? 72 : '80%'} height={20} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

function CardLoader() {
  return (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" height={120} />
    </Box>
  );
}

export function Loader({
  variant = 'table',
  rows = TABLE_DEFAULTS.SKELETON_ROWS,
  columns = TABLE_DEFAULTS.SKELETON_COLUMNS,
}: LoaderProps) {
  if (variant === 'card') {
    return <CardLoader />;
  }
  if (variant === 'page') {
    return (
      <Box>
        <Skeleton variant="text" width={180} height={36} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={320} height={20} sx={{ mb: 3 }} />
        <TableLoader rows={rows} columns={columns} />
      </Box>
    );
  }
  return <TableLoader rows={rows} columns={columns} />;
}
