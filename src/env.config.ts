export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'production' | 'test';
  APP_ENV: 'development' | 'production' | 'staging' | 'test';

  PORT: number;

  COOKIE_SECRET: string;
  JWT_SECRET: string;

  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  COGNITO_CALLBACK_URL: string;
  AWS_REGION: string;

  IPSTACK_KEY: string;
  MAXMIND_ACCOUNT_ID: string;
  MAXMIND_KEY: string;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  MONGODB_URI: string;

  FRONTEND_URL: string;

  WEBAUTHN_RP_ID: string;
  WEBAUTHN_RP_NAME: string;
  WEBAUTHN_ORIGIN: string;
  WEBAUTHN_AUTHENTICATOR_ATTACHMENT: string;

  /** Required when NODE_ENV is test (see Joi in app.module). */
  PREEXISTING_USER_EMAIL?: string;

  /** Optional: used when MailSlurp verification resolver is active (e2e / test). */
  MAILSLURP_API_KEY?: string;
  MAILSLURP_INBOX_ID?: string;
  MAILSLURP_EMAIL?: string;
}
