import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  type SxProps,
  type Theme,
} from '@mui/material';
import isEmpty from 'lodash/isEmpty.js';
import { tokens } from '../../theme/tokens';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Loader } from './Loader';

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

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
  paginate?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
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
  paginate = true,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: TableProps<T>) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultPageSize);

  const visibleRows = useMemo(() => {
    if (!paginate) return rows;
    const start = page * rowsPerPage;
    return rows.slice(start, start + rowsPerPage);
  }, [paginate, page, rows, rowsPerPage]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, rows.length, rowsPerPage]);

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
            {visibleRows.map((row, rowIndex) => {
              const absoluteRowIndex = paginate ? page * rowsPerPage + rowIndex : rowIndex;

              return (
                <TableRow key={rowKey(row)} hover sx={getRowSx?.(row, absoluteRowIndex)}>
                  {columns.map((column) => (
                    <TableCell key={column.id} align={column.align ?? 'left'}>
                      {column.renderCell
                        ? column.renderCell(row, absoluteRowIndex)
                        : column.accessor
                          ? String(row[column.accessor] ?? '')
                          : null}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </MuiTable>
      </TableContainer>
      {paginate ? (
        <TablePagination
          component="div"
          count={rows.length}
          page={page}
          onPageChange={(_event, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={pageSizeOptions}
          sx={{
            borderTop: `1px solid ${tokens.color.borderSubtle}`,
            bgcolor: tokens.color.surfaceMuted,
            color: tokens.color.inkSecondary,
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
              fontSize: '0.8125rem',
            },
            '& .MuiTablePagination-select': {
              fontSize: '0.8125rem',
            },
          }}
        />
      ) : null}
    </Box>
  );
}
