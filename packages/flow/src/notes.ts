import {
  NOTES_PATH,
  validateNoteFile,
  type NoteFile,
} from '@dev-ledger/capture';
import { readBlob, treeFiles } from './git.ts';

// Operator notes on figures, read from the default branch's tree and rendered beside the reads they name.

export type NoteRecord = {
  path: string;
  producer: 'operator';
  trust: 'reported';
  valid: boolean;
  errors: string[];
  file: NoteFile | null;
};

export function collectNotes(dir: string, branch: string): NoteRecord[] {
  return treeFiles(dir, branch, NOTES_PATH)
    .filter((path) => path.endsWith('.json'))
    .sort()
    .map((path) => {
      const text = readBlob(dir, branch, path);
      let file: NoteFile | null = null;
      let errors: string[] = ['note could not be read'];
      if (text !== null) {
        try {
          const parsed = JSON.parse(text) as NoteFile;
          errors = validateNoteFile(parsed);
          file = errors.length === 0 ? parsed : null;
        } catch (error) {
          errors = [`note is not valid JSON: ${(error as Error).message}`];
        }
      }
      return {
        path,
        producer: 'operator',
        trust: 'reported',
        valid: errors.length === 0,
        errors,
        file,
      };
    });
}
