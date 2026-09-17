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
 * each carrying that message's cumulative usage, so records are deduplicated by message identifier: summing
 * rows would count the same tokens several times over. A record with no identifier counts once on its own.
 * Returns null when no usage record is present, so the caller records the session as missing figures
 * rather than as zeros.
 */
export function sumTranscriptUsage(text: string): Figures | null {
  const seen = new Set<string>();
  const figures: Figures = {
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    messages: 0,
  };
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
    if (id !== null) {
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
    }
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
