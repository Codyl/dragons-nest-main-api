import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser(process.env.COOKIE_SECRET ?? 'cookie-secret'));
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  const options = new DocumentBuilder().addCookieAuth('ACCESS_TOKEN').build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 8080);
}

void bootstrap();
