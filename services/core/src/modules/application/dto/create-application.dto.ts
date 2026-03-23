import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsEnum(['draft', 'published', 'archived'])
  status?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

