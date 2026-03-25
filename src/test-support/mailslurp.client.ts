import MailSlurp from 'mailslurp-client';

const DEFAULT_TIMEOUT_MS = 30_000;

export type MailslurpClientInstance = InstanceType<typeof MailSlurp>;

/**
 * Creates a MailSlurp client when apiKey is non-empty.
 */
export function createMailslurpClient(
  apiKey: string | undefined,
): MailslurpClientInstance | null {
  if (!apiKey) return null;

  return new MailSlurp({ apiKey });
}

/**
 * Waits for the latest email and extracts a 6-digit verification code from the body.
 */
export async function getVerificationCodeFromEmail(
  client: MailslurpClientInstance,
  inboxId: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string | null> {
  const email = await client.waitForLatestEmail(inboxId, timeoutMs, true);

  const body = email?.body ?? '';
  const codeMatch = body.match(/\b\d{6}\b/);
  return codeMatch ? codeMatch[0] : null;
}

export async function emptyMailslurpInbox(
  client: MailslurpClientInstance,
  inboxId: string,
): Promise<void> {
  await client.emptyInbox(inboxId);
}
