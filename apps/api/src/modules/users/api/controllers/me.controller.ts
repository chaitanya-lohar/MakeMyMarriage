import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type RequestAuth } from '../../../../common/auth/request-auth.js';
import { AppException } from '../../../../common/errors/app.exception.js';
import { ErrorCode } from '../../../../common/errors/error-codes.js';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../../common/http/api-envelope.decorator.js';
import { UsersService } from '../../application/services/users.service.js';
import { CurrentUserDto, UserDto } from '../dto/user.dto.js';

@ApiTags('Users')
@ApiCookieAuth('session')
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Current user profile' })
  @ApiEnvelopeResponse(200, CurrentUserDto)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' })
  async me(@CurrentAuth() auth: RequestAuth): Promise<CurrentUserDto> {
    const user = await this.users.findById(auth.userId);
    if (!user) {
      // The session outlived its account; treat it as signed out.
      throw new AppException({
        code: ErrorCode.Unauthenticated,
        message: 'Authentication is required.',
        status: HttpStatus.UNAUTHORIZED,
      });
    }
    return { user: UserDto.from(user) };
  }
}
