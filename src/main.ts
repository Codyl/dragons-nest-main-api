import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { COOKIE_SECRET, FRONTEND_URL, PORT } from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';
import { LoggingInterceptor } from 'src/common/interceptors/logging.interceptor';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'verbose', 'debug'],
    bodyParser: false,
  });

  // Manually register body parsers with explicit limits.
  // Disabling the built-in body parser prevents interference with
  // Multer's multipart/form-data handling on file upload routes.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.useGlobalInterceptors(new LoggingInterceptor());

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

  if (process.env.NODE_ENV !== 'production') {
    const options = new DocumentBuilder()
      .setTitle('Passkey API')
      .setDescription('API for the Passkey project')
      .setVersion('1.0')
      .addCookieAuth('ACCESS_TOKEN')
      .build();
    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup('api', app, document);
  }

  app.enableShutdownHooks();
  const port = config.getOrThrow(PORT, { infer: true });
  await app.listen(port ? Number(port) : 8080, '0.0.0.0').then(() => {
    console.log(
      `Server is running on port ${port} in ${process.env.NODE_ENV} mode`,
    );
    console.log(
      `API documentation is available at http://localhost:${port}/api`,
    );
    console.log(`API is available at http://localhost:${port}`);
    console.log(`ENV in use is ${process.env.NODE_ENV}`);
  });
}

void bootstrap();
