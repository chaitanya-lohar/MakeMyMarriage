import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { PasswordPolicy } from '../../domain/rules/auth-policy.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const PASSWORD_RULE = `Must be ${PasswordPolicy.minLength}–${PasswordPolicy.maxLength} characters.`;

export class RegisterDto {
  @ApiProperty({ example: 'Priya Sharma', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName!: string;

  @ApiProperty({ example: 'priya@example.com', maxLength: 254 })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    minLength: PasswordPolicy.minLength,
    maxLength: PasswordPolicy.maxLength,
    description: PASSWORD_RULE,
  })
  @IsString()
  @Length(PasswordPolicy.minLength, PasswordPolicy.maxLength, { message: PASSWORD_RULE })
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'priya@example.com' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(PasswordPolicy.maxLength)
  password!: string;

  @ApiPropertyOptional({ default: false, description: 'Stay signed in for 30 days.' })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'priya@example.com' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from the reset link.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;

  @ApiProperty({
    minLength: PasswordPolicy.minLength,
    maxLength: PasswordPolicy.maxLength,
    description: PASSWORD_RULE,
  })
  @IsString()
  @Length(PasswordPolicy.minLength, PasswordPolicy.maxLength, { message: PASSWORD_RULE })
  password!: string;
}
