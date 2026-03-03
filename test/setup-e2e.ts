import * as path from 'path';
import { config } from 'dotenv';

process.env.NODE_ENV = 'test';
config({ path: path.join(process.cwd(), '.env.test.local') });
