/** GET /health response data. */
export class HealthResponseDto {
  uptime!: number;
  timestamp!: string;
  database!: string;
  debug?: {
    dbName: string;
    host: string;
    nodeEnv: string;
    appEnv: string;
  };
}
