/**
 * Shared TypeScript interfaces for the streaming completions implementation.
 */

/** OAuth2 token response from the Gloo AI token endpoint. */
export interface TokenInfo {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Result returned by streamCompletion after the stream completes.
 */
export interface StreamResult {
  /** Full accumulated response text. */
  text: string;
  /** Number of content-bearing chunks received. */
  token_count: number;
  /** Total request duration in milliseconds. */
  duration_ms: number;
  /** Finish reason from the last chunk (e.g., 'stop'). */
  finish_reason: string;
}

/**
 * Shape of one parsed SSE JSON chunk from the completions API.
 */
export interface SSEChunk {
  id?: string;
  choices: Array<{
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string | null;
    index?: number;
  }>;
}
