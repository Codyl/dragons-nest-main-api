import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  type AdminInitiateAuthCommandOutput,
  AdminLinkProviderForUserCommand,
  AdminRespondToAuthChallengeCommand,
  type AdminRespondToAuthChallengeCommandOutput,
  type ListUsersCommandOutput,
  ListUsersCommand,
  AuthFlowType,
  type AdminCreateUserCommandOutput,
  type CognitoIdentityProviderClient,
  type AuthenticationResultType,
} from '@aws-sdk/client-cognito-identity-provider';
import { OAuth2Client, type LoginTicket } from 'google-auth-library';
import * as crypto from 'crypto';
import { GoogleCredentialDto } from './dto/google-credential.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/users/entities/user.schema';
import { AccountType } from 'src/users/enums/account-type.enum';
import { COGNITO_CLIENT_ID, GOOGLE_CLIENT_ID } from 'src/env.constants';
import { COGNITO_USER_POOL_ID } from 'src/env.constants';
import { EnvironmentVariables } from 'src/env.config';

@Injectable()
export class GoogleService {
  private throwIfQuotaOrRateLimited(error: unknown): void {
    if (!(error instanceof Error)) return;

    const errorText = `${error.name} ${error.message}`.toLowerCase();
    const isRateLimited =
      errorText.includes('limitexceededexception') ||
      errorText.includes('toomanyrequestsexception') ||
      errorText.includes('too many requests') ||
      errorText.includes('rate limit') ||
      errorText.includes('quota') ||
      errorText.includes('429');

    if (isRateLimited) {
      throw new HttpException(
        'Google or Cognito request limit reached. This is likely a provider quota/rate-limit issue, not broken application code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  constructor(
    @Inject('GOOGLE_OAUTH2_CLIENT')
    private readonly googleOAuthClient: OAuth2Client,
    @Inject('COGNITO_CLIENT')
    private readonly cognitoClient: CognitoIdentityProviderClient,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  /** Verify Google ID token and return email + sub. Used by link-google and auth flows. */
  async verifyCredential(
    credential: string,
  ): Promise<{ email: string; sub: string }> {
    if (!credential || typeof credential !== 'string') {
      throw new BadRequestException('Google credential (ID token) is required');
    }

    let ticket: LoginTicket;
    try {
      ticket = await this.googleOAuthClient.verifyIdToken({
        idToken: credential,
        audience: this.configService.getOrThrow(GOOGLE_CLIENT_ID, {
          infer: true,
        }),
      });
    } catch (error) {
      this.throwIfQuotaOrRateLimited(error);
      throw new UnauthorizedException('Invalid Google ID token');
    }
    const payload = ticket.getPayload();
    if (!payload?.email || payload.sub == null) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    return { email: payload.email, sub: payload.sub };
  }

  async googleSSOSignup(
    dto: GoogleCredentialDto,
  ): Promise<{ AuthenticationResult?: AuthenticationResultType }> {
    const { credential } = dto;

    if (!credential || typeof credential !== 'string') {
      throw new BadRequestException('Google credential (ID token) is required');
    }

    let ticket: LoginTicket;
    try {
      ticket = await this.googleOAuthClient.verifyIdToken({
        idToken: credential,
        audience: this.configService.getOrThrow(GOOGLE_CLIENT_ID, {
          infer: true,
        }),
      });
    } catch (error) {
      this.throwIfQuotaOrRateLimited(error);
      throw new UnauthorizedException('Invalid Google ID token');
    }
    const payload = ticket.getPayload();

    if (!payload) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    const email = payload.email;
    const googleSub = payload.sub;
    const name = payload.name ?? payload.given_name ?? email;

    if (!email) {
      throw new BadRequestException(
        'Email is required for signup. Ensure the Google Sign-In request includes the email scope.',
      );
    }

    const temporaryPassword =
      'Aa1!' +
      crypto
        .randomBytes(20)
        .toString('base64')
        .replace(/\+/g, 'x')
        .replace(/\//g, 'y')
        .replace(/=/g, '');

    const createUserCommand = new AdminCreateUserCommand({
      UserPoolId: this.configService.getOrThrow(COGNITO_USER_POOL_ID, {
        infer: true,
      }),
      Username: email,
      TemporaryPassword: temporaryPassword,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: name },
        { Name: 'preferred_username', Value: name },
        { Name: 'updated_at', Value: Date.now().toString() },
      ],
    });

    try {
      const createUserResponse: AdminCreateUserCommandOutput =
        await this.cognitoClient.send(createUserCommand);

      const cognitoSub = createUserResponse.User?.Attributes?.find(
        (a) => a.Name === 'sub',
      )?.Value;

      if (!cognitoSub) {
        throw new InternalServerErrorException('Failed to create user');
      }

      const linkCommand = new AdminLinkProviderForUserCommand({
        UserPoolId: this.configService.getOrThrow(COGNITO_USER_POOL_ID, {
          infer: true,
        }),
        DestinationUser: {
          ProviderName: 'Cognito',
          ProviderAttributeName: 'Cognito_Subject',
          ProviderAttributeValue: cognitoSub,
        },
        SourceUser: {
          ProviderName: 'Google',
          ProviderAttributeName: 'Cognito_Subject',
          ProviderAttributeValue: googleSub ?? '',
        },
      });
      await this.cognitoClient.send(linkCommand);

      // Optionally persist a local user record; keep logic minimal and non-invasive.
      await this.userModel.updateOne(
        { cognitoSub },
        {
          $setOnInsert: {
            hasPassword: false,
            email,
            accountType: AccountType.Student,
            state: null,
            zipCode: null,
          },
          $addToSet: { linkedProviders: 'GOOGLE' },
          $set: { 'linkedProviderSubjects.GOOGLE': googleSub },
        },
        { upsert: true },
      );
    } catch (error) {
      this.throwIfQuotaOrRateLimited(error);

      if (error instanceof Error && error.name === 'UsernameExistsException') {
        throw new ConflictException(
          'An account with this email already exists. Please sign in.',
        );
      }

      throw new InternalServerErrorException('Failed to create user');
    }

    const authCommand = new AdminInitiateAuthCommand({
      UserPoolId: this.configService.getOrThrow(COGNITO_USER_POOL_ID, {
        infer: true,
      }),
      ClientId: this.configService.getOrThrow(COGNITO_CLIENT_ID, {
        infer: true,
      }),
      AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: temporaryPassword,
      },
    });

    let authResponse: AdminInitiateAuthCommandOutput;
    try {
      authResponse = await this.cognitoClient.send(authCommand);
    } catch (error) {
      this.throwIfQuotaOrRateLimited(error);
      throw new InternalServerErrorException(
        (error as Error)?.message || 'Failed to authenticate user',
      );
    }

    return {
      AuthenticationResult: authResponse.AuthenticationResult,
    };
  }

  async googleTokenExchange(
    dto: GoogleCredentialDto,
  ): Promise<{ AuthenticationResult?: AuthenticationResultType }> {
    const { credential } = dto;

    if (!credential || typeof credential !== 'string') {
      throw new BadRequestException('Google credential (ID token) is required');
    }

    let ticket: LoginTicket;
    try {
      ticket = await this.googleOAuthClient.verifyIdToken({
        idToken: credential,
        audience: this.configService.getOrThrow(GOOGLE_CLIENT_ID, {
          infer: true,
        }),
      });
    } catch (error) {
      this.throwIfQuotaOrRateLimited(error);
      throw new UnauthorizedException(
        (error as Error)?.message || 'Invalid Google ID token',
      );
    }
    const payload = ticket.getPayload();

    if (!payload?.email) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    const email = payload.email;
    const googleSub = payload.sub;
    if (!email || !googleSub) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    const userPoolId = this.configService.getOrThrow(COGNITO_USER_POOL_ID, {
      infer: true,
    });
    const clientId = this.configService.getOrThrow(COGNITO_CLIENT_ID, {
      infer: true,
    });

    let cognitoUsername = email;
    let listResult: ListUsersCommandOutput;
    try {
      listResult = await this.cognitoClient.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          Filter: `email = "${email.replace(/"/g, '\\"')}"`,
          Limit: 1,
        }),
      );
    } catch (error) {
      this.throwIfQuotaOrRateLimited(error);
      throw new InternalServerErrorException(
        (error as Error)?.message || 'Failed to query user',
      );
    }

    const existingUser = listResult.Users?.[0];

    if (existingUser) {
      const user = await this.userModel.findOne({
        email,
        linkedProviders: { $elemMatch: { $eq: 'GOOGLE' } },
      });
      if (!user) {
        throw new ConflictException(
          'An account with this email already exists. Please sign in.',
        );
      }

      cognitoUsername = existingUser.Username ?? email;
    } else {
      const temporaryPassword =
        'Aa1!' +
        crypto
          .randomBytes(20)
          .toString('base64')
          .replace(/\+/g, 'x')
          .replace(/\//g, 'y')
          .replace(/=/g, '');
      const name = payload.name ?? payload.given_name ?? email;

      let createResponse: AdminCreateUserCommandOutput;
      try {
        createResponse = await this.cognitoClient.send(
          new AdminCreateUserCommand({
            UserPoolId: userPoolId,
            Username: email,
            TemporaryPassword: temporaryPassword,
            MessageAction: 'SUPPRESS',
            UserAttributes: [
              { Name: 'email', Value: email },
              { Name: 'email_verified', Value: 'true' },
              { Name: 'name', Value: name },
              { Name: 'preferred_username', Value: name },
              { Name: 'updated_at', Value: Date.now().toString() },
            ],
          }),
        );
      } catch (error) {
        this.throwIfQuotaOrRateLimited(error);
        throw new InternalServerErrorException('Failed to create user');
      }

      const cognitoSub = createResponse.User?.Attributes?.find(
        (a) => a.Name === 'sub',
      )?.Value;

      if (!cognitoSub) {
        throw new InternalServerErrorException('Failed to create user');
      }

      try {
        await this.cognitoClient.send(
          new AdminLinkProviderForUserCommand({
            UserPoolId: userPoolId,
            DestinationUser: {
              ProviderName: 'Cognito',
              ProviderAttributeName: 'Cognito_Subject',
              ProviderAttributeValue: cognitoSub,
            },
            SourceUser: {
              ProviderName: 'Google',
              ProviderAttributeName: 'Cognito_Subject',
              ProviderAttributeValue: googleSub ?? '',
            },
          }),
        );
      } catch (error) {
        this.throwIfQuotaOrRateLimited(error);
        throw new InternalServerErrorException('Failed to link Google account');
      }

      await this.userModel.create({
        cognitoSub,
        linkedProviders: ['GOOGLE'],
        linkedProviderSubjects: { GOOGLE: googleSub },
        hasPassword: false,
        email,
        accountType: AccountType.Student,
        state: null,
        zipCode: null,
      });
    }

    let initiateResponse: AdminInitiateAuthCommandOutput;
    try {
      initiateResponse = await this.cognitoClient.send(
        new AdminInitiateAuthCommand({
          UserPoolId: userPoolId,
          ClientId: clientId,
          AuthFlow: AuthFlowType.CUSTOM_AUTH,
          AuthParameters: {
            USERNAME: cognitoUsername,
            CHALLENGE_NAME: 'CUSTOM_CHALLENGE',
          },
        }),
      );
    } catch (error) {
      this.throwIfQuotaOrRateLimited(error);
      throw new InternalServerErrorException('Failed to initiate auth');
    }

    let authenticationResult: AuthenticationResultType | undefined;

    if (initiateResponse.AuthenticationResult) {
      authenticationResult = initiateResponse.AuthenticationResult;
    } else {
      const session = initiateResponse.Session;
      const challengeName = initiateResponse.ChallengeName;

      if (!session || !challengeName) {
        throw new InternalServerErrorException(
          'Unexpected response from auth (no challenge)',
        );
      }

      let respondResponse: AdminRespondToAuthChallengeCommandOutput;
      try {
        respondResponse = await this.cognitoClient.send(
          new AdminRespondToAuthChallengeCommand({
            UserPoolId: userPoolId,
            ClientId: clientId,
            ChallengeName: challengeName,
            Session: session,
            ChallengeResponses: {
              USERNAME: cognitoUsername,
              ANSWER: credential,
            },
            ClientMetadata: { GOOGLE_ID_TOKEN: credential },
          }),
        );
      } catch (error) {
        this.throwIfQuotaOrRateLimited(error);
        throw new InternalServerErrorException(
          'Failed to respond to auth challenge',
        );
      }

      if (!respondResponse.AuthenticationResult) {
        throw new InternalServerErrorException(
          'Token exchange did not return tokens',
        );
      }

      authenticationResult = respondResponse.AuthenticationResult;
    }

    return {
      AuthenticationResult: authenticationResult,
    };
  }
}
