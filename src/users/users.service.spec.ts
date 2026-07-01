import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { User } from './entities/user.schema';
import { AccountType } from './enums/account-type.enum';
import { AgeBandAtRegistration } from './enums/age-band-at-registration.enum';
import {
  accountStatusFromBirthDate,
  eighteenthBirthdayStart,
  resolveAccountStatusForUser,
  UsersService,
} from './users.service';
import { StateComplianceLaws } from 'src/compliance/entities/state-compliance-laws.entity';

describe('UsersService', () => {
  let service: UsersService;
  let userModel: {
    findById: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };

  beforeEach(async () => {
    userModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: userModel,
        },
        {
          provide: getModelToken(StateComplianceLaws.name),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('accountStatusFromBirthDate', () => {
    const ref = new Date(2026, 3, 8);

    it('returns null when birthDate is missing', () => {
      expect(accountStatusFromBirthDate(null, ref)).toBeNull();
      expect(accountStatusFromBirthDate(undefined, ref)).toBeNull();
    });

    it('returns MANAGED when age is under 13', () => {
      expect(accountStatusFromBirthDate(new Date(2014, 3, 9), ref)).toBe(
        'MANAGED',
      );
    });

    it('returns INDEPENDENT for ages 13 through 17', () => {
      expect(accountStatusFromBirthDate(new Date(2013, 3, 8), ref)).toBe(
        'INDEPENDENT',
      );
      expect(accountStatusFromBirthDate(new Date(2009, 3, 8), ref)).toBe(
        'INDEPENDENT',
      );
    });

    it('returns ADULT when age is 18 or older', () => {
      expect(accountStatusFromBirthDate(new Date(2008, 3, 8), ref)).toBe(
        'ADULT',
      );
    });
  });

  describe('resolveAccountStatusForUser', () => {
    it('uses attested adult band', () => {
      expect(
        resolveAccountStatusForUser({
          ageBandAtRegistration: AgeBandAtRegistration.Adult18Plus,
          accountType: AccountType.Adult,
        }),
      ).toBe('ADULT');
    });

    it('falls back to legacy birthDate when band is absent', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 3, 9));
      try {
        expect(
          resolveAccountStatusForUser({
            ageBandAtRegistration: null,
            accountType: AccountType.ManagedUser,
            birthDate: new Date(2010, 3, 8),
          }),
        ).toBe('INDEPENDENT');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('eighteenthBirthdayStart', () => {
    it('returns local calendar start of 18th birthday', () => {
      const bd = new Date(2014, 3, 8);
      expect(eighteenthBirthdayStart(bd)).toEqual(new Date(2032, 3, 8));
    });
  });

  describe('findOneByIdForViewer', () => {
    const targetId = new Types.ObjectId();
    const parentId = new Types.ObjectId();
    const viewerSub = 'viewer-sub';
    const childBirth = new Date(2014, 3, 8);

    function mockChildChain(doc: Record<string, unknown>) {
      const chain = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(doc),
      };
      userModel.findById.mockReturnValue(chain as never);
      return chain;
    }

    it('returns null when user is missing', async () => {
      mockChildChain(null as never);
      await expect(
        service.findOneByIdForViewer(undefined, targetId),
      ).resolves.toBeNull();
    });

    it('omits addedClasses when there is no authenticated viewer', async () => {
      mockChildChain({
        _id: targetId,
        addedClasses: [{ hoursCompleted: 1, createdAt: new Date(2020, 0, 1) }],
      });
      const res = await service.findOneByIdForViewer(undefined, targetId);
      expect(res?.addedClasses).toBeUndefined();
    });

    it('returns full addedClasses when viewer is the same user', async () => {
      const classes = [{ hoursCompleted: 1, createdAt: new Date(2020, 0, 1) }];
      mockChildChain({
        _id: targetId,
        cognitoSub: viewerSub,
        addedClasses: classes,
      });
      userModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: targetId,
          cognitoSub: viewerSub,
          deleted: false,
        }),
      });
      const res = await service.findOneByIdForViewer(viewerSub, targetId);
      expect(res?.addedClasses).toEqual(classes);
    });

    it('for parent viewer, keeps only enrollments created before 18th birthday', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 3, 8));
      try {
        const before = new Date(2030, 0, 1);
        const after = new Date(2033, 0, 1);
        mockChildChain({
          _id: targetId,
          parentId,
          birthDate: childBirth,
          addedClasses: [
            { hoursCompleted: 1, createdAt: before },
            { hoursCompleted: 2, createdAt: after },
            { hoursCompleted: 3 },
          ],
        });
        userModel.findOne.mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: parentId,
            cognitoSub: viewerSub,
            deleted: false,
          }),
        });
        const res = await service.findOneByIdForViewer(viewerSub, targetId);
        expect(res?.addedClasses).toEqual([
          { hoursCompleted: 1, createdAt: before },
        ]);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('upgradeToIndependent', () => {
    const userId = new Types.ObjectId();
    const email = 'teen@example.com';
    const cognitoId = 'cognito-sub-xyz';

    it('throws NotFoundException when user does not exist', async () => {
      userModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.upgradeToIndependent(userId, email, cognitoId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when user is deleted', async () => {
      userModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ deleted: true }),
      });
      await expect(
        service.upgradeToIndependent(userId, email, cognitoId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when user already has cognitoSub', async () => {
      userModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          deleted: false,
          cognitoSub: 'existing',
        }),
      });
      await expect(
        service.upgradeToIndependent(userId, email, cognitoId),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates email, cognitoSub, and hasPassword on success', async () => {
      userModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: userId,
          deleted: false,
          cognitoSub: null,
        }),
      });
      const updated = { _id: userId, email, cognitoSub: cognitoId };
      userModel.findOneAndUpdate.mockResolvedValue(updated);
      const result = await service.upgradeToIndependent(
        userId,
        email,
        cognitoId,
      );
      expect(result).toBe(updated);
      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: userId,
          deleted: { $ne: true },
        }),
        {
          $set: {
            email,
            cognitoSub: cognitoId,
            hasPassword: true,
          },
        },
        { new: true },
      );
    });

    it('throws BadRequestException when findOneAndUpdate returns null', async () => {
      userModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          deleted: false,
          cognitoSub: null,
        }),
      });
      userModel.findOneAndUpdate.mockResolvedValue(null);
      await expect(
        service.upgradeToIndependent(userId, email, cognitoId),
      ).rejects.toThrow(BadRequestException);
    });

    it('maps duplicate key error to BadRequestException', async () => {
      userModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          deleted: false,
          cognitoSub: null,
        }),
      });
      userModel.findOneAndUpdate.mockRejectedValue({ code: 11000 });
      await expect(
        service.upgradeToIndependent(userId, email, cognitoId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('isManagerOf', () => {
    const parentId = new Types.ObjectId();
    const childId = new Types.ObjectId();
    const refBirthFor11 = new Date(2014, 3, 8);

    it('returns false when child is missing', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      });
      await expect(service.isAccountManagerOf(parentId, childId)).resolves.toBe(false);
    });

    it('returns false when child is deleted', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          deleted: true,
          parentId,
          birthDate: refBirthFor11,
        }),
      });
      await expect(service.isAccountManagerOf(parentId, childId)).resolves.toBe(false);
    });

    it('returns false when child has no parentId', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          deleted: false,
          parentId: null,
          birthDate: refBirthFor11,
        }),
      });
      await expect(service.isAccountManagerOf(parentId, childId)).resolves.toBe(false);
    });

    it('returns true for minor age band without birthDate', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          deleted: false,
          parentId,
          ageBandAtRegistration: AgeBandAtRegistration.Teen13To17,
        }),
      });
      await expect(service.isAccountManagerOf(parentId, childId)).resolves.toBe(true);
    });

    it('returns false when birthDate and age band are both absent', async () => {
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          deleted: false,
          parentId,
        }),
      });
      await expect(service.isAccountManagerOf(parentId, childId)).resolves.toBe(false);
    });

    it('returns false when parentId does not match', async () => {
      const otherParent = new Types.ObjectId();
      userModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          deleted: false,
          parentId: otherParent,
          birthDate: refBirthFor11,
        }),
      });
      await expect(service.isAccountManagerOf(parentId, childId)).resolves.toBe(false);
    });

    it('returns false when child is 18 or older', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 3, 8));
      try {
        userModel.findById.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue({
            deleted: false,
            parentId,
            birthDate: new Date(2008, 3, 8),
          }),
        });
        await expect(service.isAccountManagerOf(parentId, childId)).resolves.toBe(
          false,
        );
      } finally {
        jest.useRealTimers();
      }
    });

    it('returns true when parent matches and child is under 18', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 3, 8));
      try {
        userModel.findById.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue({
            deleted: false,
            parentId,
            birthDate: new Date(2014, 3, 8),
          }),
        });
        await expect(service.isAccountManagerOf(parentId, childId)).resolves.toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });

    it('accepts string ids', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 3, 8));
      try {
        userModel.findById.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue({
            deleted: false,
            parentId,
            birthDate: new Date(2014, 3, 8),
          }),
        });
        await expect(
          service.isAccountManagerOf(parentId.toString(), childId.toString()),
        ).resolves.toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
