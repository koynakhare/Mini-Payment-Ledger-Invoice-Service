import { newId, nowIso, queryAll, queryOne, execute } from '../db/connection.js';
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
  async findAll(): Promise<Vendor[]> {
    const rows = await queryAll<VendorRow>('SELECT * FROM vendors ORDER BY name');
    return rows.map(mapVendor);
  }

  async findById(id: string): Promise<Vendor | null> {
    const row = await queryOne<VendorRow>('SELECT * FROM vendors WHERE id = $1', [id]);
    return row ? mapVendor(row) : null;
  }

  async create(name: string, contactInfo?: string | null): Promise<Vendor> {
    const id = newId();
    const createdAt = nowIso();
    await execute(
      'INSERT INTO vendors (id, name, contact_info, created_at) VALUES ($1, $2, $3, $4)',
      [id, name, contactInfo ?? null, createdAt]
    );
    return { id, name, contactInfo: contactInfo ?? null, createdAt };
  }

  async updateContactInfo(id: string, contactInfo: string): Promise<Vendor | null> {
    await execute('UPDATE vendors SET contact_info = $1 WHERE id = $2', [contactInfo, id]);
    return this.findById(id);
  }
}
