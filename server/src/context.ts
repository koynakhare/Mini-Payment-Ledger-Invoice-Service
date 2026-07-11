import type { Request } from 'express';
import { supabaseAdmin } from './lib/supabaseAdmin.js';

export interface Context {
  userId: string | null;
}

export async function createContext({ req }: { req: Request }): Promise<Context> {
  if (!supabaseAdmin) {
    return { userId: null };
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return { userId: null };
  }

  const {
    data: { user },
  } = await supabaseAdmin.auth.getUser(token);

  return { userId: user?.id ?? null };
}
