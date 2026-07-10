import { closeDb } from './connection.js';
import { runMigrations } from './migrations.js';

runMigrations();
console.log('Database migration completed successfully.');
closeDb();
