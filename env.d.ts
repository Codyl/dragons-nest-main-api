declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: '8080';
    COOKIE_SECRET: string;
    JWT_SECRET: string;
    AWS_REGION: string;

    COGNITO_USER_POOL_ID: string;
    COGNITO_CLIENT_ID: string;
    COGNITO_CALLBACK_URL: string;

    IPSTACK_KEY: string;

    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_CLIENT_ID: string;

    MONGODB_URI: string;

    FRONTEND_URL: string;
  }
}
