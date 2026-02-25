import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class AppService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  getHealth() {
    const dbStatus =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      this.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Basic status for everyone (load balancers need this)
    const status = {
      uptime: process.uptime(),
      message: 'OK',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    };

    // Sensitive detail only for development/local
    if (process.env.APP_ENV !== 'production') {
      return {
        ...status,
        debug: {
          dbName: this.connection.name, // "test" vs "myRealDb"
          host: this.connection.host,
          nodeEnv: process.env.NODE_ENV,
        },
      };
    }
  }
}
