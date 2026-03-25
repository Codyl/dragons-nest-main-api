import type { MailslurpClientInstance } from '../src/test-support/mailslurp.client';
import {
  createMailslurpClient as createMailslurpClientWithKey,
  emptyMailslurpInbox,
  getVerificationCodeFromEmail as getCodeFromClient,
} from '../src/test-support/mailslurp.client';

const DEFAULT_TIMEOUT_MS = 30_000;

export type { MailslurpClientInstance };

/**
 * Creates a MailSlurp client from env (MAILSLURP_API_KEY).
 * Returns null if MAILSLURP_API_KEY is not set.
 */
export function createMailslurpClient(): MailslurpClientInstance | null {
  return createMailslurpClientWithKey(process.env.MAILSLURP_API_KEY);
}

/**
 * Waits for the latest email in the given inbox and extracts a 6-digit verification code from the body.
 * @param inboxId - MAILSLURP_INBOX_ID
 * @param timeoutMs - Max wait time (default 30s)
 * @returns The 6-digit code or null if not found
 */
export async function getVerificationCodeFromEmail(
  inboxId: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string | null> {
  const client = createMailslurpClient();
  if (!client) return null;

  return getCodeFromClient(client, inboxId, timeoutMs);
}

/**
 * Empties the inbox after reading (optional, use to avoid re-reading old emails in next test).
 */
export async function emptyInbox(inboxId: string): Promise<void> {
  const client = createMailslurpClient();
  if (!client) return;

  await emptyMailslurpInbox(client, inboxId);
}
