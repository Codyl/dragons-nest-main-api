import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { COOKIE_SECRET, FRONTEND_URL, PORT } from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  const options = new DocumentBuilder()
    .setTitle('Passkey API')
    .setDescription('API for the Passkey project')
    .setVersion('1.0')
    .addCookieAuth('ACCESS_TOKEN')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api', app, document);

  const port = config.getOrThrow(PORT, { infer: true });
  await app.listen(port ? Number(port) : 8080);
}

void bootstrap();
