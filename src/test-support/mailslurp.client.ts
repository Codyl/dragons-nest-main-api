import MailSlurp, { Email } from 'mailslurp-client';

const DEFAULT_TIMEOUT_MS = 30_000;

export type MailslurpClientInstance = InstanceType<typeof MailSlurp>;

function isMailslurpQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const haystack = `${error.name} ${error.message}`.toLowerCase();
  return (
    haystack.includes('quota') ||
    haystack.includes('limit') ||
    haystack.includes('429') ||
    haystack.includes('too many requests') ||
    haystack.includes('payment required')
  );
}

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
  let email: Email | null = null;
  try {
    email = await client.waitForLatestEmail(inboxId, timeoutMs, true);

    if (!email) {
      throw new Error('No email found');
    }

    const body = email?.body ?? '';
    const codeMatch = body.match(/\b\d{6}\b/);
    return codeMatch ? codeMatch[0] : null;
  } catch (error) {
    if (isMailslurpQuotaError(error)) {
      throw new Error(
        'MailSlurp inbox read limit reached (free-tier/quota). Code is likely fine; upgrade MailSlurp or wait for quota reset.',
      );
    }

    throw error;
  }
}

export async function emptyMailslurpInbox(
  client: MailslurpClientInstance,
  inboxId: string,
): Promise<void> {
  await client.emptyInbox(inboxId);
}
