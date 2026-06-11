import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StateComplianceLaws } from './entities/state-compliance-laws.entity';

@Injectable()
export class ComplianceService {
  constructor(
    @InjectModel(StateComplianceLaws.name)
    private readonly complianceLawsModel: Model<StateComplianceLaws>,
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
}
