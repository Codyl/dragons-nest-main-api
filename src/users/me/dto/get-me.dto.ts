import { User } from 'src/users/entities/user.entity';

export class GetMeDto implements Partial<User> {
  cognitoSub: string;
  linkedProviders?: string[];
  linkedProviderSubjects?: { GOOGLE?: string };
  hasPassword?: boolean;
  email?: string;
}
