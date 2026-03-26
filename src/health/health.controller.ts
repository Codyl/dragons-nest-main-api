import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HttpHealthIndicator,
  HealthCheck,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from 'src/env.config';
import { AWS_REGION, COGNITO_USER_POOL_ID, NODE_ENV } from 'src/env.constants';
import {
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private mongo: MongooseHealthIndicator,
    private config: ConfigService<EnvironmentVariables>,
  ) {}

  @ApiOperation({
    summary: 'Reports the health of the application and its dependencies',
  })
  @ApiServiceUnavailableResponse({
    description:
      'One or more dependencies are unhealthy or unreachable (Cognito, Google, or database).',
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected server failure while executing health checks.',
  })
  @Get()
  @HealthCheck()
  async check() {
    const result = await this.health.check([
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

    const nodeEnv = this.config.get(NODE_ENV, { infer: true });
    if (nodeEnv === 'test') {
      return {
        ...result,
        debug: { nodeEnv },
      };
    }

    return result;
  }
}
