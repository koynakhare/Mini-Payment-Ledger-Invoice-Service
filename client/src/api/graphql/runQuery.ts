import { serializeApiError } from './errors';

export async function runQuery<T>(
  executor: () => Promise<T>
): Promise<{ data: T } | { error: ReturnType<typeof serializeApiError> }> {
  try {
    const data = await executor();
    return { data };
  } catch (error) {
    return { error: serializeApiError(error) };
  }
}
