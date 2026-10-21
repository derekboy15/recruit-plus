const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True for RFC 4122 version 1-5 UUIDs, the only ids the server accepts for documents. */
export function isUuid(id: string): boolean {
  return UUID.test(id);
}

/** A fresh document id (UUID v4). */
export function newDocId(): string {
  return crypto.randomUUID();
}
