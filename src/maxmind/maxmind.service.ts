import { City, WebServiceClient } from '@maxmind/geoip2-node';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class MaxmindService {
  constructor(
    @Inject('MAXMIND_CLIENT') private readonly maxmindClient: WebServiceClient,
  ) {}

  async getLocation(ip: string): Promise<City> {
    const response = await this.maxmindClient.city(ip);
    return response;
  }
}
