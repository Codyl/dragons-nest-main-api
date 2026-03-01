import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MaxmindService } from './maxmind.service';
import { WebServiceClient } from '@maxmind/geoip2-node';

@Module({
  providers: [
    {
      provide: 'MAXMIND_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return new WebServiceClient(
          config.get<string>('MAXMIND_ACCOUNT_ID')!,
          config.get<string>('MAXMIND_KEY')!,
          { host: 'geolite.info' },
        );
      },
    },
    MaxmindService,
  ],
  exports: [MaxmindService],
})
export class MaxmindModule {}
