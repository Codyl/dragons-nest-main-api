import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { CurriculumService } from './curriculum.service';
import { CurriculumItem } from './entities/curriculum.entity';
import { Subject } from 'src/subjects/subject.entity';
import { UsersService } from 'src/users/users.service';

describe('CurriculumService', () => {
  let service: CurriculumService;

  const mockCurriculumModel = {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
    create: jest.fn(),
  };

  const mockSubjectModel = {
    findById: jest.fn(),
  };

  const mockUsersService = {
    findOneByCognitoSub: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'CURRICULUM_S3_BUCKET') return 'test-bucket';

      if (key === 'AWS_REGION') return 'us-east-1';

      return 'mock-value';
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurriculumService,
        {
          provide: getModelToken(CurriculumItem.name),
          useValue: mockCurriculumModel,
        },
        {
          provide: getModelToken(Subject.name),
          useValue: mockSubjectModel,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<CurriculumService>(CurriculumService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
