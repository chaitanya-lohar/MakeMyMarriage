import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../../../common/auth/request-auth.js';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
} from '../../../../common/http/api-envelope.decorator.js';
import { AppConfig } from '../../../../config/app-config.js';
import { UserDto } from '../../../users/index.js';
import { LoginUseCase } from '../../application/use-cases/login.use-case.js';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case.js';
import { RefreshSessionUseCase } from '../../application/use-cases/refresh-session.use-case.js';
import { RegisterUseCase } from '../../application/use-cases/register.use-case.js';
import { RequestPasswordResetUseCase } from '../../application/use-cases/request-password-reset.use-case.js';
import { ResetPasswordUseCase } from '../../application/use-cases/reset-password.use-case.js';
import type { ClientInfo } from '../../domain/types/auth-session.js';
import { AuthUserDto } from '../dto/auth-user.dto.js';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from '../dto/auth.dto.js';
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from '../session-cookies.js';

function clientInfo(request: Request): ClientInfo {
  return { userAgent: request.get('user-agent'), ipAddress: request.ip };
}

function refreshTokenOf(request: Request): string | undefined {
  return (request.cookies as Record<string, string | undefined> | undefined)?.[REFRESH_COOKIE];
}

/** Email/password authentication (API Design §5, decision 0015). */
@ApiTags('Auth')
@Public()
@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    config: AppConfig,
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly requestResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {
    this.secureCookies = config.auth.secureCookies;
  }

  @Post('register')
  @ApiOperation({ summary: 'Create an account and sign in' })
  @ApiEnvelopeResponse(201, AuthUserDto)
  @ApiErrorResponses(
    { status: 400, description: 'Invalid input' },
    { status: 409, description: 'Email already registered' },
  )
  async register(
    @Body() body: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUserDto> {
    const { user, session } = await this.registerUseCase.execute(body, clientInfo(request));
    setSessionCookies(response, session, this.secureCookies);
    return { user: UserDto.from(user) };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiEnvelopeResponse(200, AuthUserDto)
  @ApiErrorResponses(
    { status: 401, description: 'Invalid credentials' },
    { status: 429, description: 'Too many attempts' },
  )
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUserDto> {
    const { user, session } = await this.loginUseCase.execute(
      { email: body.email, password: body.password, rememberMe: body.rememberMe ?? false },
      clientInfo(request),
    );
    setSessionCookies(response, session, this.secureCookies);
    return { user: UserDto.from(user) };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the session and issue a new access token' })
  @ApiEnvelopeResponse(200, AuthUserDto)
  @ApiErrorResponses({ status: 401, description: 'Session ended' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUserDto> {
    try {
      const { user, session } = await this.refreshUseCase.execute(refreshTokenOf(request));
      setSessionCookies(response, session, this.secureCookies);
      return { user: UserDto.from(user) };
    } catch (error) {
      clearSessionCookies(response, this.secureCookies);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out of the current session' })
  @ApiEnvelopeResponse(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.logoutUseCase.execute(refreshTokenOf(request));
    clearSessionCookies(response, this.secureCookies);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Request a password reset email',
    description: 'Always returns 202, whether or not the email has an account.',
  })
  @ApiEnvelopeResponse(202)
  @ApiErrorResponses({ status: 429, description: 'Too many attempts' })
  async forgotPassword(@Body() body: ForgotPasswordDto): Promise<null> {
    await this.requestResetUseCase.execute(body.email);
    return null;
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set a new password with a reset token' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses({ status: 400, description: 'Invalid input, or the link expired or was used' })
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    await this.resetPasswordUseCase.execute(body.token, body.password);
  }
}
