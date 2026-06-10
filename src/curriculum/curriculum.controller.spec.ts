import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';
import { AuthGuard } from 'src/common/guards/auth.guard';

describe('CurriculumController', () => {
  let controller: CurriculumController;

  const mockCurriculumService = {
    getCurriculumItems: jest.fn(),
    uploadCurriculumItem: jest.fn(),
    deleteCurriculumItem: jest.fn(),
    getFileStream: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CurriculumController],
      providers: [
        {
          provide: CurriculumService,
          useValue: mockCurriculumService,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(() => 'mock-value'),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CurriculumController>(CurriculumController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
