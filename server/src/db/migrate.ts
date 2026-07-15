import 'dotenv/config';
import { closeDb } from './connection.js';
import { runMigrations } from './migrations.js';

runMigrations()
  .then(() => {
    console.log('Database migration completed successfully.');
    return closeDb();
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
