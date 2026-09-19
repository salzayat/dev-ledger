// Tasks and their relative complexity, read from OpenSpec task lists. A task line is `- [x] 1.2 ~3 ...`:
// the checkbox, the task id, and an optional `~N` weight. A task completed by a change is one that is
// ticked at the change's last commit and was not ticked at its base. Unweighted tasks count one and are
// reported as unweighted, never guessed heavier.

export type TaskItem = { id: string; done: boolean; weight: number | null };

const TASK_LINE = /^\s*[-*] \[( |x|X)\] ((?:\d+\.)*\d+)(?:\s+~(\d+))?(?=\s|$)/;

export function parseTasks(text: string): Map<string, TaskItem> {
  const tasks = new Map<string, TaskItem>();
  for (const line of text.split('\n')) {
    const match = TASK_LINE.exec(line);
    if (!match) {
      continue;
    }
    tasks.set(match[2], {
      id: match[2],
      done: match[1] !== ' ',
      weight: match[3] === undefined ? null : Number(match[3]),
    });
  }
  return tasks;
}

/** The change name a tasks.md path belongs to, with an archive date prefix removed. */
export function changeNameOf(path: string): string | null {
  const match =
    /^openspec\/changes\/(?:archive\/\d{4}-\d{2}-\d{2}-)?([a-z0-9-]+)\/tasks\.md$/.exec(
      path,
    );
  return match ? match[1] : null;
}

export type CompletedTask = {
  change: string;
  id: string;
  weight: number | null;
};

/** Tasks ticked in `after` that were not ticked in `before` (absent counts as unticked). */
export function completedTasks(
  change: string,
  before: string | null,
  after: string | null,
): CompletedTask[] {
  if (after === null) {
    return [];
  }
  const was =
    before === null ? new Map<string, TaskItem>() : parseTasks(before);
  const completed: CompletedTask[] = [];
  for (const task of parseTasks(after).values()) {
    if (task.done && !(was.get(task.id)?.done ?? false)) {
      completed.push({ change, id: task.id, weight: task.weight });
    }
  }
  return completed;
}
