import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { StateComplianceLaws } from './entities/state-compliance-laws.entity';

describe('ComplianceService', () => {
  let service: ComplianceService;
  let findOne: jest.Mock;
  let exec: jest.Mock;

  beforeEach(async () => {
    exec = jest.fn();
    findOne = jest.fn().mockReturnValue({ exec });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        {
          provide: getModelToken(StateComplianceLaws.name),
          useValue: { findOne },
        },
      ],
    }).compile();

    service = module.get<ComplianceService>(ComplianceService);
  });

  it('returns document when abbreviation matches', async () => {
    const doc = { abbreviation: 'TX' } as StateComplianceLaws;
    exec.mockResolvedValue(doc);

    const result = await service.findByState('TX');

    expect(findOne).toHaveBeenCalledWith({ abbreviation: 'TX' });
    expect(result).toBe(doc);
  });

  it('throws NotFoundException when no document found', async () => {
    exec.mockResolvedValue(null);

    await expect(service.findByState('ZZ')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findOne).toHaveBeenCalledWith({ abbreviation: 'ZZ' });
  });

  it('normalizes lowercase input and still matches', async () => {
    const doc = { abbreviation: 'CA' } as StateComplianceLaws;
    exec.mockResolvedValue(doc);

    const result = await service.findByState('ca');

    expect(findOne).toHaveBeenCalledWith({ abbreviation: 'CA' });
    expect(result).toBe(doc);
  });
});
