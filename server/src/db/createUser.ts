import 'dotenv/config';
import { closeDb, getDb, isPostgres } from './connection.js';
import { runMigrations } from './migrations.js';
import { authService } from '../services/index.js';
import type { UserRole } from '../auth/types.js';
import { isAppError } from '../errors/AppError.js';

async function main(): Promise<void> {
  const [, , email, password, roleArg] = process.argv;
  if (!email || !password) {
    console.error('Usage: npm run db:create-user -- <email> <password> [VIEWER|APPROVER]');
    process.exit(1);
  }

  const role = ((roleArg ?? 'APPROVER').toUpperCase() as UserRole);
  if (role !== 'VIEWER' && role !== 'APPROVER') {
    console.error('Role must be VIEWER or APPROVER');
    process.exit(1);
  }

  if (!isPostgres()) {
    getDb();
  }
  await runMigrations();

  const user = await authService.createUser(email, password, role);
  console.log(`Created ${user.role} user: ${user.email} (${user.id})`);
  await closeDb();
}

main().catch((error) => {
  if (isAppError(error)) {
    console.error(`${error.code}: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
