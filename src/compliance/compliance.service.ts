import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ComplianceCompletionRecord } from './entities/compliance-completion.schema';
import { StateComplianceLaws } from './entities/state-compliance-laws.entity';

@Injectable()
export class ComplianceService {
  constructor(
    @InjectModel(StateComplianceLaws.name)
    private readonly complianceLawsModel: Model<StateComplianceLaws>,
    @InjectModel(ComplianceCompletionRecord.name)
    private readonly completionModel: Model<ComplianceCompletionRecord>,
  ) {}

  async findByState(state: string): Promise<StateComplianceLaws> {
    const complianceLaw = await this.complianceLawsModel
      .findOne({ abbreviation: state.toUpperCase() })
      .exec();

    if (!complianceLaw) {
      throw new NotFoundException(
        `No compliance laws found for state: ${state}`,
      );
    }

    return complianceLaw;
  }

  async getCompletion(
    managerId: string,
    state: string,
    managedUserId: string,
  ): Promise<Record<string, boolean>> {
    const record = await this.completionModel
      .findOne({ managerId, managedUserId, state: state.toUpperCase() })
      .exec();
    return record ? Object.fromEntries(record.items) : {};
  }

  async toggleCompletion(
    managerId: string,
    state: string,
    managedUserId: string,
    itemKey: string,
    completed: boolean,
  ): Promise<Record<string, boolean>> {
    const record = await this.completionModel
      .findOneAndUpdate(
        { managerId, managedUserId, state: state.toUpperCase() },
        { $set: { [`items.${itemKey}`]: completed } },
        { upsert: true, new: true },
      )
      .exec();
    return Object.fromEntries(record!.items);
  }
}
