import { AppModule } from '../src/app.module';
import { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from 'src/env.config';
import { COOKIE_SECRET, FRONTEND_URL } from 'src/env.constants';

export async function createTestApp() {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  const config = app.get(ConfigService<EnvironmentVariables>);
  app.use(cookieParser(config.getOrThrow(COOKIE_SECRET, { infer: true })));
  app.enableCors({
    origin: config.getOrThrow(FRONTEND_URL, { infer: true }),
    credentials: true,
  });
  await app.init();

  return app;
}
