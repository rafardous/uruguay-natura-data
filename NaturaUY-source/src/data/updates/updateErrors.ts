export type UpdateErrorKind = 'offline' | 'server' | 'interrupted' | 'space' | 'invalid' | 'storage';

export class UpdateError extends Error {
  constructor(public readonly kind: UpdateErrorKind, message: string) { super(message); }
}

export function classifyUpdateError(error: unknown, offline: boolean): UpdateErrorKind {
  if (error instanceof UpdateError) return error.kind;
  const message = error instanceof Error ? error.message : String(error);
  if (/ENOSPC|no space|disk.*full|insufficient.*space/i.test(message)) return 'space';
  if (offline) return 'offline';
  if (/AbortError|aborted|cancelled|timeout/i.test(message)) return 'interrupted';
  if (/manifest_|catalog_.*(mismatch|invalid|failed|missing)|integrity/i.test(message)) return 'invalid';
  if (/fetch|network|http|download|connection|host/i.test(message)) return 'server';
  return 'storage';
}

export function updateErrorMessage(kind: UpdateErrorKind): string {
  switch (kind) {
    case 'offline': return 'Sin conexión. Podés seguir usando el catálogo guardado y volver a intentar.';
    case 'server': return 'No pudimos comunicarnos con el servidor. Volvé a intentar más tarde.';
    case 'interrupted': return 'La descarga o consulta se interrumpió. Volvé a intentar.';
    case 'space': return 'No hay espacio suficiente. Liberá espacio en el dispositivo y volvé a intentar.';
    case 'invalid': return 'La actualización no pasó las verificaciones. Conservamos tu catálogo actual.';
    case 'storage': return 'No pudimos guardar o leer la actualización. Conservamos tu catálogo actual; volvé a intentar.';
  }
}

