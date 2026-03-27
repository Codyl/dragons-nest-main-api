import { WebServiceClient } from '@maxmind/geoip2-node';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

@Injectable()
export class MaxmindService {
  constructor(
    @Inject('MAXMIND_CLIENT') private readonly maxmindClient: WebServiceClient,
  ) {}

  async getLocation(ip: string) {
    try {
      const response = await this.maxmindClient.city(ip);
      return response;
    } catch (error) {
      if (error instanceof Error) {
        const errorText = `${error.name} ${error.message}`.toLowerCase();
        const isRateLimited =
          errorText.includes('out_of_queries') ||
          errorText.includes('quota') ||
          errorText.includes('too many requests') ||
          errorText.includes('429');

        if (isRateLimited) {
          throw new HttpException(
            'MaxMind query limit reached. This is likely a service quota/free-tier issue, not broken application code.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      throw new InternalServerErrorException('Failed to query MaxMind');
    }
  }
}
