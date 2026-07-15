import { getInvoicePdfUrl } from '../constants/apiEndpoints';
import { getStoredToken } from '../auth/authStorage';

export async function downloadInvoicePdf(invoiceId: string, invoiceNumber: string): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getStoredToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(getInvoicePdfUrl(invoiceId), { headers });

  if (!response.ok) {
    let message = 'Failed to download invoice PDF';
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/pdf')) {
    throw new Error('Server did not return a PDF.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `invoice-${invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
