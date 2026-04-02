import { IsString, IsNotEmpty, IsEmail, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: '账号不能为空' })
  @MinLength(3, { message: '账号至少3个字符' })
  @MaxLength(64, { message: '账号最多64个字符' })
  account!: string;

  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码至少6个字符' })
  @MaxLength(128, { message: '密码最多128个字符' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: '姓名不能为空' })
  @MaxLength(128, { message: '姓名最多128个字符' })
  name!: string;

  @IsEmail({}, { message: '邮箱格式不正确' })
  @IsNotEmpty({ message: '邮箱不能为空' })
  email!: string;

  @IsString()
  phone?: string;

  @IsString()
  @IsNotEmpty({ message: '邀请码不能为空' })
  inviteCode!: string;
}

