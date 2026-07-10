export function allRows<T>(rows: unknown): T[] {
  return rows as T[];
}

export function oneRow<T>(row: unknown): T | undefined {
  if (row === undefined) {
    return undefined;
  }
  return row as T;
}
