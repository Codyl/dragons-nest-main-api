import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MaxmindService } from './maxmind.service';
import { WebServiceClient } from '@maxmind/geoip2-node';
import { MAXMIND_ACCOUNT_ID, MAXMIND_KEY } from 'env.constants';
import { EnvironmentVariables } from 'env.config';

@Module({
  providers: [
    {
      provide: 'MAXMIND_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables>) => {
        return new WebServiceClient(
          config.getOrThrow(MAXMIND_ACCOUNT_ID),
          config.getOrThrow(MAXMIND_KEY),
          { host: 'geolite.info' },
        );
      },
    },
    MaxmindService,
  ],
  exports: [MaxmindService],
})
export class MaxmindModule {}
