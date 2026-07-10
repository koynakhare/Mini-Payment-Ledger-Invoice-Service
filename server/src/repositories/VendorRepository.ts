import { randomUUID } from 'crypto';
import { getDb } from '../db/connection.js';
import { allRows, oneRow } from '../db/sqliteRows.js';
import type { Vendor } from '../types/index.js';

interface VendorRow {
  id: string;
  name: string;
  contact_info: string | null;
  created_at: string;
}

function mapVendor(row: VendorRow): Vendor {
  return {
    id: row.id,
    name: row.name,
    contactInfo: row.contact_info,
    createdAt: row.created_at,
  };
}

export class VendorRepository {
  findAll(): Vendor[] {
    const db = getDb();
    const rows = allRows<VendorRow>(db.prepare('SELECT * FROM vendors ORDER BY name').all());
    return rows.map(mapVendor);
  }

  findById(id: string): Vendor | null {
    const db = getDb();
    const row = oneRow<VendorRow>(db.prepare('SELECT * FROM vendors WHERE id = ?').get(id));
    return row ? mapVendor(row) : null;
  }

  create(name: string, contactInfo?: string | null): Vendor {
    const db = getDb();
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    db.prepare(
      'INSERT INTO vendors (id, name, contact_info, created_at) VALUES (?, ?, ?, ?)'
    ).run(id, name, contactInfo ?? null, createdAt);
    return { id, name, contactInfo: contactInfo ?? null, createdAt };
  }
}
