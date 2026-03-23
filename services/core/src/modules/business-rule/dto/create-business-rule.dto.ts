import { IsString, IsOptional, IsBoolean, IsNumber, IsObject, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BusinessRuleTriggerDto {
  @IsString()
  event!: 'create' | 'update' | 'delete' | 'statusChange';

  @IsString()
  formId!: string;

  @IsOptional()
  @IsArray()
  conditions?: Array<{
    fieldId: string;
    operator: string;
    value: any;
  }>;
}

export class BusinessRuleActionDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  targetFormId?: string;

  @IsOptional()
  @IsObject()
  fieldMapping?: Record<string, string>;

  @IsOptional()
  @IsString()
  targetRecordId?: string;

  @IsOptional()
  @IsObject()
  notification?: any;

  @IsOptional()
  @IsString()
  script?: string;

  @IsOptional()
  @IsObject()
  api?: any;
}

export class CreateBusinessRuleDto {
  @IsString()
  ruleId!: string;

  @IsString()
  ruleName!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsString()
  applicationId!: string;

  @ValidateNested()
  @Type(() => BusinessRuleTriggerDto)
  trigger!: BusinessRuleTriggerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessRuleActionDto)
  actions!: BusinessRuleActionDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateBusinessRuleDto {
  @IsOptional()
  @IsString()
  ruleName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => BusinessRuleTriggerDto)
  trigger?: BusinessRuleTriggerDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessRuleActionDto)
  actions?: BusinessRuleActionDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

