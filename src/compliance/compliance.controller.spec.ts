/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';

describe('ComplianceController', () => {
  let controller: ComplianceController;
  let complianceService: jest.Mocked<ComplianceService>;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [ComplianceController],
      providers: [
        {
          provide: ComplianceService,
          useValue: {
            findByState: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .compile();

    controller = module.get<ComplianceController>(ComplianceController);
    complianceService =
      module.get<jest.Mocked<ComplianceService>>(ComplianceService);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('returns compliance document when state matches', async () => {
    const document = { abbreviation: 'CA' };
    complianceService.findByState.mockResolvedValue(document as never);

    await expect(controller.getComplianceLaws('ca')).resolves.toEqual(document);
    expect(complianceService.findByState).toHaveBeenCalledWith('ca');
  });

  it('propagates NotFoundException when state is not found', async () => {
    complianceService.findByState.mockRejectedValue(
      new NotFoundException('missing'),
    );

    await expect(controller.getComplianceLaws('zz')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('applies AuthGuard to the controller', () => {
    const reflector = new Reflector();
    const guards = reflector.getAllAndOverride<unknown[]>(GUARDS_METADATA, [
      ComplianceController,
      ComplianceController.prototype.getComplianceLaws,
    ]);

    expect(guards).toBeDefined();
    expect(guards).toContain(AuthGuard);
  });

  it('returns 401 for unauthenticated request when guard denies access', async () => {
    const guardedModule = await Test.createTestingModule({
      controllers: [ComplianceController],
      providers: [
        {
          provide: ComplianceService,
          useValue: { findByState: jest.fn() },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: () => {
          throw new UnauthorizedException('Not authenticated');
        },
      })
      .compile();

    const app: INestApplication = guardedModule.createNestApplication();
    await app.init();

    await request(app.getHttpServer()).get('/compliance/tx').expect(401);

    await app.close();
    await guardedModule.close();
  });
});
