import {
  Box,
  Paper,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  type SxProps,
  type Theme,
} from '@mui/material';
import isEmpty from 'lodash/isEmpty.js';
import { tokens } from '../../theme/tokens';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Loader } from './Loader';

export interface TableColumn<T> {
  id: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  renderCell?: (row: T, rowIndex: number) => React.ReactNode;
  accessor?: keyof T;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  errorMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  maxHeight?: number | string;
  getRowSx?: (row: T, rowIndex: number) => SxProps<Theme>;
  skeletonRows?: number;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  isLoading = false,
  error,
  errorMessage,
  emptyTitle = 'No data',
  emptyDescription,
  emptyAction,
  maxHeight,
  getRowSx,
  skeletonRows = 5,
}: TableProps<T>) {
  if (isLoading) {
    return <Loader variant="table" rows={skeletonRows} columns={columns.length} />;
  }

  if (error) {
    return <ErrorState message={errorMessage} error={error} />;
  }

  if (isEmpty(rows)) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
    );
  }

  return (
    <Box
      sx={{
        border: `1px solid ${tokens.color.borderSubtle}`,
        boxShadow: tokens.shadow.card,
        overflow: 'hidden',
        maxWidth: '100%',
      }}
    >
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          maxHeight,
          overflowX: 'auto',
          overflowY: maxHeight ? 'auto' : 'visible',
          borderRadius: 0,
          border: 'none',
          backgroundImage: 'none',
          maxWidth: '100%',
          '& .MuiTableHead-root .MuiTableCell-root': {
            position: 'sticky',
            top: 0,
            zIndex: 1,
          },
        }}
      >
        <MuiTable size="medium" sx={{ minWidth: 560 }}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.id} align={column.align ?? 'left'}>
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={rowKey(row)} hover sx={getRowSx?.(row, rowIndex)}>
                {columns.map((column) => (
                  <TableCell key={column.id} align={column.align ?? 'left'}>
                    {column.renderCell
                      ? column.renderCell(row, rowIndex)
                      : column.accessor
                        ? String(row[column.accessor] ?? '')
                        : null}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </MuiTable>
      </TableContainer>
    </Box>
  );
}
