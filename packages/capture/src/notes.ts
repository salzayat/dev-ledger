// An operator's note on a figure: why a number on the page reads the way it does. A note is a record like
// any other, committed and cited, dated, never edited in place. It explains; it never changes a figure.

export const NOTE_SCHEMA_VERSION = 1;
export const NOTES_PATH = '.telemetry/notes';

export type NoteFile = {
  schemaVersion: number;
  /** A short identifier, also the file name. */
  noteId: string;
  /** The panel or read the note is about: coverage, rework, spend, flowEfficiency, queue, and so on. */
  figure: string;
  /** Optional `YYYY-MM` the note applies to; absent means the figure as a whole. */
  period?: string;
  text: string;
  /** When the note was written, ISO 8601. */
  at: string;
};

const FORBIDDEN_KEYS =
  /^(name|operatorName|email|operatorEmail|hourlyRate|rate|salary|compensation|userName|user)$/i;
const ID = /^[a-z0-9][a-z0-9-]*$/;

export function noteFilePath(noteId: string): string {
  if (!ID.test(noteId)) {
    throw new Error(`noteId must be a short identifier, got "${noteId}"`);
  }
  return `${NOTES_PATH}/${noteId}.json`;
}

export function validateNoteFile(value: unknown): string[] {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return ['note must be a JSON object'];
  }
  const file = value as Record<string, unknown>;
  for (const key of Object.keys(file)) {
    if (FORBIDDEN_KEYS.test(key)) {
      errors.push(
        `${key} is not allowed: a note carries no name, email address, or rate`,
      );
    }
  }
  if (file.schemaVersion !== NOTE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${NOTE_SCHEMA_VERSION}`);
  }
  if (typeof file.noteId !== 'string' || !ID.test(file.noteId)) {
    errors.push('noteId must be a short identifier');
  }
  if (
    typeof file.figure !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9]*$/.test(file.figure)
  ) {
    errors.push('figure must name a read, as one word');
  }
  if (
    file.period !== undefined &&
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(file.period))
  ) {
    errors.push('period must be YYYY-MM when present');
  }
  if (
    typeof file.text !== 'string' ||
    file.text.trim().length === 0 ||
    file.text.length > 600
  ) {
    errors.push('text must be a non-empty string of at most 600 characters');
  }
  if (typeof file.at !== 'string' || Number.isNaN(Date.parse(file.at))) {
    errors.push('at must be an ISO 8601 timestamp');
  }
  return errors;
}
