import { getInvoicePdfUrl } from '../constants/apiEndpoints';

export async function downloadInvoicePdf(invoiceId: string, invoiceNumber: string): Promise<void> {
  const response = await fetch(getInvoicePdfUrl(invoiceId));

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
