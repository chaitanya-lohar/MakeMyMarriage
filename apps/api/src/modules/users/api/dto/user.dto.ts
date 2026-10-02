import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../domain/types/user.js';

/** Public view of a user account. */
export class UserDto {
  @ApiProperty({ example: '6650f0c2a1b2c3d4e5f60718' })
  id!: string;

  @ApiProperty({ example: 'priya@example.com' })
  email!: string;

  @ApiProperty({ example: 'Priya Sharma' })
  displayName!: string;

  static from(user: User): UserDto {
    return { id: user.id, email: user.email, displayName: user.displayName };
  }
}

export class CurrentUserDto {
  @ApiProperty({ type: UserDto })
  user!: UserDto;
}
