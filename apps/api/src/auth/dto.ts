import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
export class RegisterDto { @IsEmail() email!: string; @IsString() @MinLength(8) @MaxLength(128) password!: string; @IsString() @MaxLength(80) name?: string; }
export class LoginDto { @IsEmail() email!: string; @IsString() password!: string; }
export class RefreshDto { refreshToken?: string; }
