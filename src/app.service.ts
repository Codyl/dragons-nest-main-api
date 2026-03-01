import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class AppService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly configService: ConfigService,
  ) {}

  getHealth() {
    const dbStatus =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      this.connection.readyState === 1 ? 'connected' : 'disconnected';

    if (dbStatus === 'disconnected') {
      throw new ServiceUnavailableException('Database is disconnected');
    }

    // Basic status for everyone (load balancers need this)
    const status = {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: dbStatus,
    };

    // Sensitive detail only for development/local
    if (this.configService.get<string>('APP_ENV') !== 'production') {
      return {
        ...status,
        debug: {
          dbName: this.connection.name, // "test" vs "myRealDb"
          host: this.connection.host,
          nodeEnv: this.configService.get<string>('NODE_ENV'),
          appEnv: this.configService.get<string>('APP_ENV'),
        },
      };
    }

    return status;
  }
}
