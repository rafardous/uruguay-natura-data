import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { verifyGuideCatalog } from './verify-guide-catalog.mjs';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const origin = 'https://xbnbfekcxrkgteuijbzh.supabase.co';
const prefix = '/storage/v1/object/public/guia-aves';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`create table species(stable_id text, clase text, image_url text, full_url text);
    create table species_media(stable_id text, media_type text, ordinal integer, is_primary integer, url text, thumbnail_url text);`);
  db.prepare('insert into species values(?,?,?,?)').run(uuid, 'Aves', `${origin}${prefix}/001/01-480.webp`, `${origin}${prefix}/001/01.webp`);
  for (const ordinal of [1, 2]) {
    const base = `${origin}${prefix}/001/0${ordinal}`;
    db.prepare('insert into species_media values(?,?,?,?,?,?)').run(uuid, 'image', ordinal, ordinal === 1 ? 1 : 0, `${base}.webp`, `${base}-480.webp`);
  }
  return db;
}

test('verifica las dos URLs estables y el UUID de la ficha', () => {
  const db = fixture();
  try {
    assert.deepEqual(verifyGuideCatalog(db, new Map([[1, uuid]]), {
      reviewedNumbers: 1,
    }), { reviewedNumbers: 1, photos: 2, singlePhotoNumbers: 0 });
  } finally { db.close(); }
});

test('bloquea la publicación si falta una foto esperada o reaparece una URL vieja', () => {
  const db = fixture();
  try {
    db.prepare('delete from species_media').run();
    assert.throws(() => verifyGuideCatalog(db, new Map([[1, uuid]]), { reviewedNumbers: 1 }), /fotos faltantes/);
    db.prepare('insert into species_media values(?,?,?,?,?,?)').run(uuid, 'image', 1, 1, `${origin}${prefix}/001/01.webp`, `${origin}${prefix}/001/01-480.webp`);
    db.prepare("update species_media set url = 'https://legacy.example.org/1.jpg' where ordinal = 1").run();
    assert.throws(() => verifyGuideCatalog(db, new Map([[1, uuid]]), { reviewedNumbers: 1 }), /URL principal incorrecta/);
  } finally { db.close(); }
});

test('acepta una foto familiar y una externa con miniatura estable', () => {
  const db = fixture();
  try {
    const base = `${origin}${prefix}/001/external/02-abcdef123456`;
    db.prepare('update species_media set url = ?, thumbnail_url = ? where ordinal = 2').run(`${base}.webp`, `${base}-480.webp`);
    assert.deepEqual(verifyGuideCatalog(db, new Map([[1, uuid]]), { reviewedNumbers: 1 }),
      { reviewedNumbers: 1, photos: 2, singlePhotoNumbers: 0 });
  } finally { db.close(); }
});
