import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  StateComplianceLaws,
  StateComplianceLawsSchema,
} from './entities/state-compliance-laws.entity';

/** State compliance metadata for homeschool UI (requirements, barriers). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StateComplianceLaws.name, schema: StateComplianceLawsSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class ComplianceModule {}
