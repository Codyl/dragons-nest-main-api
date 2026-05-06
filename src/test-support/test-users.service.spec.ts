import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserNotFoundException } from '@aws-sdk/client-cognito-identity-provider';

import {
  COGNITO_USER_POOL_ID,
  PREEXISTING_USER_EMAIL,
} from 'src/env.constants';
import { UsersService } from 'src/users/users.service';

import { TestUsersService } from './test-users.service';

describe('TestUsersService', () => {
  let service: TestUsersService;
  const send = jest.fn();
  const deleteAllUsers = jest.fn();
  const createSeedUser = jest.fn();

  beforeEach(async () => {
    send.mockReset();
    deleteAllUsers.mockReset();
    createSeedUser.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestUsersService,
        {
          provide: 'COGNITO_CLIENT',
          useValue: { send },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === COGNITO_USER_POOL_ID) {
                return 'pool-id';
              }
              if (key === PREEXISTING_USER_EMAIL) {
                return 'seed@example.com';
              }
              throw new Error(`unexpected key ${key}`);
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            deleteAllUsers,
            createSeedUser,
          },
        },
      ],
    }).compile();

    service = module.get<TestUsersService>(TestUsersService);
  });

  it('should list, delete, recreate Cognito user, then reset Mongo users', async () => {
    send
      .mockResolvedValueOnce({ Users: [], PaginationToken: undefined })
      .mockResolvedValueOnce({
        User: {
          Attributes: [{ Name: 'sub', Value: 'sub-123' }],
        },
      })
      .mockResolvedValueOnce({});

    await service.resetTestUsers();

    expect(send).toHaveBeenCalled();
    expect(deleteAllUsers).toHaveBeenCalled();
    expect(createSeedUser).toHaveBeenCalledWith('sub-123', 'seed@example.com');
  });

  it('should swallow UserNotFoundException (idempotent reset)', async () => {
    send.mockRejectedValueOnce(
      new UserNotFoundException({ message: 'x', $metadata: {} }),
    );

    await expect(service.resetTestUsers()).resolves.toBeUndefined();
    expect(deleteAllUsers).not.toHaveBeenCalled();
  });
});
