import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './test-utils';

describe('PasskeyController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('unauthenticated access', () => {
    it('POST /passkey/passkey/register/options without auth returns error', async () => {
      const res = await request(app.getHttpServer())
        .post('/passkey/passkey/register/options')
        .send({})
        .expect(500);

      expect(res.body).toBeDefined();
    });

    it('POST /passkey/passkey/register/verify without auth returns error', async () => {
      const res = await request(app.getHttpServer())
        .post('/passkey/passkey/register/verify')
        .send({
          id: 'credential-id',
          rawId: 'raw-id',
          type: 'public-key',
          response: {
            clientDataJSON: 'eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0=',
            attestationObject:
              'o2NmbXRkbm9uZWdhdHRTdG10oGhhdXRoRGF0YVikSZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2NFAAAAAK3OAAI1vMYKZIsLJfHwVQMAIHIgJ0hU',
          },
        })
        .expect(500);

      expect(res.body).toBeDefined();
    });
  });

  describe('validation', () => {
    it('POST /passkey/passkey/register/verify rejects invalid body (missing required fields)', () => {
      return request(app.getHttpServer())
        .post('/passkey/passkey/register/verify')
        .send({})
        .expect(400);
    });

    it('POST /passkey/passkey/register/verify rejects invalid type', () => {
      return request(app.getHttpServer())
        .post('/passkey/passkey/register/verify')
        .send({
          id: 'id',
          rawId: 'rawId',
          type: 'wrong-type',
          response: {
            clientDataJSON: 'a',
            attestationObject: 'b',
          },
        })
        .expect(400);
    });
  });
});
