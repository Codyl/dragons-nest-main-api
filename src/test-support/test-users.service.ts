import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';

import { EnvironmentVariables } from 'src/env.config';
import {
  COGNITO_USER_POOL_ID,
  PREEXISTING_USER_EMAIL,
} from 'src/env.constants';
import { UsersService } from 'src/users/users.service';

/**
 * Resets Cognito users and Mongo user collection for frontend E2E (Cypress beforeEach).
 * Mirrors legacy cognito Express DELETE /test-users behavior.
 */
@Injectable()
export class TestUsersService {
  constructor(
    @Inject('COGNITO_CLIENT')
    private readonly cognitoClient: CognitoIdentityProviderClient,
    private readonly config: ConfigService<EnvironmentVariables>,
    private readonly usersService: UsersService,
  ) {}

  async resetTestUsers(): Promise<void> {
    const poolId = this.config.getOrThrow(COGNITO_USER_POOL_ID, {
      infer: true,
    });
    const preexistingEmail = this.config.getOrThrow<string>(
      PREEXISTING_USER_EMAIL,
      {
        infer: true,
      },
    );

    try {
      await this.deleteAllCognitoUsers(poolId);

      const createUserResponse = await this.cognitoClient.send(
        new AdminCreateUserCommand({
          UserPoolId: poolId,
          Username: preexistingEmail,
          MessageAction: 'SUPPRESS',
          UserAttributes: [
            { Name: 'username', Value: preexistingEmail },
            { Name: 'email_verified', Value: 'true' },
          ],
        }),
      );

      await this.cognitoClient.send(
        new AdminSetUserPasswordCommand({
          UserPoolId: poolId,
          Username: preexistingEmail,
          Password: 'Password123!',
          Permanent: true,
        }),
      );

      const cognitoSub = createUserResponse.User?.Attributes?.find(
        (a) => a.Name === 'sub',
      )?.Value;
      if (!cognitoSub) {
        throw new Error('Failed to create pre-existing user');
      }

      await this.usersService.deleteAllUsers();
      await this.usersService.createSeedUser(cognitoSub, preexistingEmail);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        return;
      }

      throw error;
    }
  }

  private async deleteAllCognitoUsers(poolId: string): Promise<void> {
    let paginationToken: string | undefined;

    do {
      const page = await this.cognitoClient.send(
        new ListUsersCommand({
          UserPoolId: poolId,
          PaginationToken: paginationToken,
        }),
      );

      for (const cognitoUser of page.Users ?? []) {
        const cognitoSub = cognitoUser.Attributes?.find(
          (a) => a.Name === 'sub',
        )?.Value;
        if (!cognitoSub) {
          continue;
        }

        await this.cognitoClient.send(
          new AdminDeleteUserCommand({
            UserPoolId: poolId,
            Username: cognitoSub,
          }),
        );
      }

      paginationToken = page.PaginationToken;
    } while (paginationToken);
  }
}
