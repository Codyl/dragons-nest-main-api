import { Module } from '@nestjs/common';
import { MaxmindService } from './maxmind.service';
import { WebServiceClient } from '@maxmind/geoip2-node';

@Module({
  providers: [
    {
      provide: 'MAXMIND_CLIENT',
      useFactory: () => {
        return new WebServiceClient(
          process.env.MAXMIND_ACCOUNT_ID,
          process.env.MAXMIND_KEY,
          { host: 'geolite.info' },
        );
      },
    },
    MaxmindService,
  ],
  exports: [MaxmindService],
})
export class MaxmindModule {}
