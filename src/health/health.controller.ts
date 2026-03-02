import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HttpHealthIndicator,
  HealthCheck,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from 'src/env.config';
import { AWS_REGION, COGNITO_USER_POOL_ID } from 'src/env.constants';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private mongo: MongooseHealthIndicator,
    private config: ConfigService<EnvironmentVariables>,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () =>
        this.http.pingCheck(
          'cognito',
          `https://cognito-idp.${this.config.getOrThrow(AWS_REGION, {
            infer: true,
          })}.amazonaws.com/${this.config.getOrThrow(COGNITO_USER_POOL_ID, {
            infer: true,
          })}/.well-known/jwks.json`,
        ),
      () =>
        this.http.pingCheck(
          'google',
          'https://accounts.google.com/.well-known/openid-configuration',
        ),
      () => this.mongo.pingCheck('database'),
    ]);
  }
}
