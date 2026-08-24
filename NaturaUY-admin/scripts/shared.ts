import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

export function required(name: string): string {
  const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required`); return value;
}

export function adminClient() {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
}

export const chunks = <T>(items: T[], size: number): T[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

export function stableUuid(input: string): string {
  const bytes = new Uint8Array(createHash('sha1').update(`natura-uy:${input}`).digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join(''); return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
