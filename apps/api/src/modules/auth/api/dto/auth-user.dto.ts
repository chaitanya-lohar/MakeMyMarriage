import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../../users/index.js';

/** Response of register, login and refresh. */
export class AuthUserDto {
  @ApiProperty({ type: UserDto })
  user!: UserDto;
}
