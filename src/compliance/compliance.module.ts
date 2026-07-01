import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import {
  ComplianceCompletionRecord,
  ComplianceCompletionRecordSchema,
} from './entities/compliance-completion.schema';
import {
  StateComplianceLaws,
  StateComplianceLawsSchema,
} from './entities/state-compliance-laws.entity';

/** State compliance metadata for homeschool UI (requirements, barriers). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StateComplianceLaws.name, schema: StateComplianceLawsSchema },
      {
        name: ComplianceCompletionRecord.name,
        schema: ComplianceCompletionRecordSchema,
      },
    ]),
  ],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [MongooseModule],
})
export class ComplianceModule {}
