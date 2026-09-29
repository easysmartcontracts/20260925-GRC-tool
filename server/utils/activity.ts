import { pool } from '../db.js';

export interface ActivityLogInput {
  type: 'document_update' | 'access_request' | 'user_login' | 'settings_update';
  action: string;
  title: string;
  actor?: string | null;
  target_type?: string | null;
  target_name?: string | null;
  details?: any;
  ip_address?: string | null;
  status?: 'success' | 'failed' | 'pending' | 'warning';
}

export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    const detailsStr = typeof input.details === 'object' && input.details !== null
      ? JSON.stringify(input.details)
      : (input.details ? String(input.details) : null);

    await pool.query(`
      INSERT INTO activity_logs (type, action, title, actor, target_type, target_name, details, ip_address, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      input.type,
      input.action,
      input.title,
      input.actor || 'System',
      input.target_type || null,
      input.target_name || null,
      detailsStr,
      input.ip_address || null,
      input.status || 'success'
    ]);
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}
