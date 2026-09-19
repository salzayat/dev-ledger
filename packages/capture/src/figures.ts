// Token figures summed from a session transcript: a JSONL file whose records carry a `usage` object in
// the wire format of the model API. Nothing but token counts is read, and nothing is derived: cost stays
// whatever the harness reported, because a price table here would be stale the day a price changed.

export type Figures = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  /** Cache reads and writes apart, for a provider whose usage object reports them apart. */
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Distinct messages counted, so a caller can say how the figures were arrived at. */
  messages: number;
};

type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}

/**
 * Sums a transcript's usage records. A streaming transcript writes a record every time a message grows,
 * each carrying that message's cumulative usage, so records are deduplicated by message identifier and the
 * last record for an identifier wins: it is the one that saw the whole message, and summing the rows would
 * count the same tokens several times over. A record with no identifier counts once on its own. Returns
 * null when no usage record is present, so the caller records the session as missing figures rather than
 * as zeros.
 */
export function sumTranscriptUsage(
  text: string,
  window: { from?: string; to?: string } = {},
): Figures | null {
  // A harness may keep one transcript across many sessions, so with a window only the records timestamped
  // inside it count; a record with no timestamp cannot be placed and is left out.
  const windowed = window.from !== undefined || window.to !== undefined;
  const fromMs = window.from
    ? Date.parse(window.from)
    : Number.NEGATIVE_INFINITY;
  const toMs = window.to ? Date.parse(window.to) : Number.POSITIVE_INFINITY;
  const byId = new Map<string, Usage>();
  const anonymous: Usage[] = [];
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) {
      continue;
    }
    let record: {
      timestamp?: unknown;
      message?: { id?: unknown; usage?: Usage };
    };
    try {
      record = JSON.parse(line) as typeof record;
    } catch {
      continue;
    }
    const message = record.message;
    const usage = message?.usage;
    if (!usage || typeof usage !== 'object') {
      continue;
    }
    if (windowed) {
      const at =
        typeof record.timestamp === 'string'
          ? Date.parse(record.timestamp)
          : NaN;
      if (Number.isNaN(at) || at < fromMs || at > toMs) {
        continue;
      }
    }
    const id = typeof message?.id === 'string' ? message.id : null;
    if (id === null) {
      anonymous.push(usage);
    } else {
      byId.set(id, usage);
    }
  }
  const figures: Figures = {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    messages: 0,
  };
  for (const usage of [...byId.values(), ...anonymous]) {
    figures.inputTokens += whole(usage.input_tokens);
    figures.outputTokens += whole(usage.output_tokens);
    figures.cacheReadTokens += whole(usage.cache_read_input_tokens);
    figures.cacheWriteTokens += whole(usage.cache_creation_input_tokens);
    // The combined figure stays, because every committed record carries it and the reads that sum it must
    // keep working; the components sit beside it for a provider that reports them apart.
    figures.cachedTokens +=
      whole(usage.cache_read_input_tokens) +
      whole(usage.cache_creation_input_tokens);
    figures.messages += 1;
  }
  return figures.messages === 0 ? null : figures;
}

/** The `figuresSource` a transcript-summed record carries: how the figures were arrived at, in one line. */
export function transcriptFiguresSource(figures: Figures): string {
  return `summed from ${figures.messages} messages in the session transcript`;
}

/**
 * The operator's own prompts in a transcript, as timestamps. A transcript's user-addressed records are not
 * all the human: most of them are `tool_result` blocks, the harness returning its own tool output to the
 * model through the middle of an agent turn. Counting those would report an engineer as present for every
 * file the agent read, so a record counts only when its content is a plain string or its blocks are all
 * text.
 */
export function operatorPromptTimes(text: string): string[] {
  return transcriptEvents(text)
    .filter((event) => event.kind === 'prompt')
    .map((event) => event.timestamp);
}

export type TranscriptEvent = {
  timestamp: string;
  kind: 'prompt' | 'agent';
};

/**
 * Every timestamped transcript record, split into the two things that can produce one: the operator, who
 * writes prompts, and the harness, which writes assistant messages and feeds tool results back to the
 * model. A user-addressed record carrying a tool result is harness traffic, not a person.
 */
export function transcriptEvents(text: string): TranscriptEvent[] {
  const events: TranscriptEvent[] = [];
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) {
      continue;
    }
    let record: {
      type?: unknown;
      timestamp?: unknown;
      message?: { content?: unknown };
    };
    try {
      record = JSON.parse(line) as typeof record;
    } catch {
      continue;
    }
    if (
      (record.type !== 'user' && record.type !== 'assistant') ||
      typeof record.timestamp !== 'string' ||
      Number.isNaN(Date.parse(record.timestamp))
    ) {
      continue;
    }
    const content = record.message?.content;
    const prompt =
      record.type === 'user' &&
      (typeof content === 'string' ||
        (Array.isArray(content) &&
          content.length > 0 &&
          content.every(
            (block) =>
              typeof block === 'object' &&
              block !== null &&
              (block as { type?: unknown }).type === 'text',
          )));
    events.push({
      timestamp: record.timestamp,
      kind: prompt ? 'prompt' : 'agent',
    });
  }
  return events.sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
}

/** The model named by the transcript's newest assistant record, or null when none names one. */
export function transcriptModel(text: string): string | null {
  let model: string | null = null;
  for (const line of text.split('\n')) {
    if (!line.includes('"model"')) {
      continue;
    }
    try {
      const record = JSON.parse(line) as {
        type?: unknown;
        message?: { model?: unknown };
      };
      if (
        record.type === 'assistant' &&
        typeof record.message?.model === 'string'
      ) {
        model = record.message.model;
      }
    } catch {
      // not a JSON line
    }
  }
  return model;
}
