import { NestFactory } from '@nestjs/core';
import { AppModule } from 'src/app.module';
import { AuthService } from 'src/auth/auth.service';

async function main() {
  const username = process.argv[2]?.trim();

  if (!username) {
    throw new Error(
      'Username/email is required. Usage: npm run account-recovery:send-code -- <username-or-email>',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const authService = app.get(AuthService);
    await authService.issueAccountRecoveryCode(username);
    console.log(
      `Account recovery code request submitted for ${username}. The code is sent via configured provider email delivery.`,
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Failed to send account recovery code: ${message}`);
  process.exit(1);
});
