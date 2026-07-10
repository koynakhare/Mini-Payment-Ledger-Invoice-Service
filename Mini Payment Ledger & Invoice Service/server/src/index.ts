import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import express from 'express';
import { getDb } from './db/connection.js';
import { runMigrations } from './db/migrations.js';
import { resolvers } from './graphql/resolvers.js';
import { typeDefs } from './graphql/schema.js';
import { systemAccountService } from './services/index.js';
import { InvoicePdfService } from './services/InvoicePdfService.js';
import { isAppError } from './errors/AppError.js';

const PORT = Number(process.env.PORT) || 8266;
const invoicePdfService = new InvoicePdfService();

async function startServer(): Promise<void> {
  getDb();
  runMigrations();
  systemAccountService.ensureCompanyBankAccount();
  systemAccountService.ensureExpenseAccount();

  const app = express();
  const server = new ApolloServer({ typeDefs, resolvers });

  await server.start();

  app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(server)
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/invoices/:id/pdf', async (req, res) => {
    try {
      const invoiceId = req.params.id;
      const buffer = await invoicePdfService.generatePdfBuffer(invoiceId);
      const filename = invoicePdfService.getDownloadFilename(invoiceId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      if (isAppError(error) && error.code === 'NOT_FOUND') {
        res.status(404).json({ error: error.message });
        return;
      }
      console.error('PDF generation failed:', error);
      res.status(500).json({ error: 'Failed to generate invoice PDF' });
    }
  });

  app.listen(PORT, () => {
    console.log(`GraphQL server ready at http://localhost:${PORT}/graphql`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
