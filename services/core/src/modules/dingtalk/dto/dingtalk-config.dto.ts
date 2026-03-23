import { IsString, IsOptional } from 'class-validator';

export class DingtalkConfigDto {
  @IsString()
  appKey!: string;

  @IsString()
  appSecret!: string;

  @IsOptional()
  @IsString()
  agentId?: string;
}

