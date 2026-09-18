// Token figures summed from a session transcript: a JSONL file whose records carry a `usage` object in
// the wire format of the model API. Nothing but token counts is read, and nothing is derived: cost stays
// whatever the harness reported, because a price table here would be stale the day a price changed.

export type Figures = {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
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
export function sumTranscriptUsage(text: string): Figures | null {
  const byId = new Map<string, Usage>();
  const anonymous: Usage[] = [];
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) {
      continue;
    }
    let record: { message?: { id?: unknown; usage?: Usage } };
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
    messages: 0,
  };
  for (const usage of [...byId.values(), ...anonymous]) {
    figures.inputTokens += whole(usage.input_tokens);
    figures.outputTokens += whole(usage.output_tokens);
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
  const times: string[] = [];
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
    if (record.type !== 'user' || typeof record.timestamp !== 'string') {
      continue;
    }
    const content = record.message?.content;
    const prompt =
      typeof content === 'string' ||
      (Array.isArray(content) &&
        content.length > 0 &&
        content.every(
          (block) =>
            typeof block === 'object' &&
            block !== null &&
            (block as { type?: unknown }).type === 'text',
        ));
    if (!prompt) {
      continue;
    }
    if (Number.isNaN(Date.parse(record.timestamp))) {
      continue;
    }
    times.push(record.timestamp);
  }
  return times;
}
