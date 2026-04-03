import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-utils';
import { HealthResponseDto } from 'src/health/dto/out/health-response.dto';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        const healthResponse = res.body as HealthResponseDto;
        expect(healthResponse.status).toBe('ok');
        expect(healthResponse.info).toHaveProperty('cognito');
        expect(healthResponse.info).toHaveProperty('google');
        expect(healthResponse.info).toHaveProperty('database');
      });
  });
});
