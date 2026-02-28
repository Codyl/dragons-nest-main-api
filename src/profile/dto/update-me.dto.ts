import { User } from 'src/users/entities/user.entity';

export class UpdateMeDto implements Partial<User> {
  email?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  phone_number?: string;
}
