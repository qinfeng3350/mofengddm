import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FormFieldLayoutDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  w: number;

  @IsNumber()
  h: number;
}

export class FormFieldValidationDto {
  @IsOptional()
  @IsNumber()
  minLength?: number;

  @IsOptional()
  @IsNumber()
  maxLength?: number;

  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;

  @IsOptional()
  @IsString()
  regex?: string;
}

export class FormFieldOptionDto {
  @IsString()
  label: string;

  @IsString()
  value: string;
}

export class FormFieldDto {
  @IsString()
  @IsNotEmpty()
  fieldId: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  required?: boolean;

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  visible?: boolean;

  @IsOptional()
  editable?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => FormFieldValidationDto)
  validation?: FormFieldValidationDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldOptionDto)
  options?: FormFieldOptionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FormFieldLayoutDto)
  layout?: FormFieldLayoutDto;
}

export class FormLayoutDto {
  @IsEnum(['grid', 'flex', 'custom'])
  type: string;

  @IsNumber()
  columns: number;
}

export class CreateFormDefinitionDto {
  @IsString()
  @IsNotEmpty()
  formName: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(['draft', 'published'])
  status?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields: FormFieldDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FormLayoutDto)
  layout?: FormLayoutDto;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  elements?: any[];
}
