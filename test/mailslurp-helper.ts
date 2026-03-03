import MailSlurp from 'mailslurp-client';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Creates a MailSlurp client from env (MAILSLURP_API_KEY).
 * Returns null if MAILSLURP_API_KEY is not set.
 */
export function createMailslurpClient(): InstanceType<typeof MailSlurp> | null {
  const apiKey = process.env.MAILSLURP_API_KEY;
  if (!apiKey) return null;

  return new MailSlurp({ apiKey });
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

  const email = await client.waitForLatestEmail(
    inboxId,
    timeoutMs,
    true, // unreadOnly
  );

  const body = email?.body ?? '';
  const codeMatch = body.match(/\b\d{6}\b/);
  return codeMatch ? codeMatch[0] : null;
}

/**
 * Empties the inbox after reading (optional, use to avoid re-reading old emails in next test).
 */
export async function emptyInbox(inboxId: string): Promise<void> {
  const client = createMailslurpClient();
  if (!client) return;

  await client.emptyInbox(inboxId);
}
