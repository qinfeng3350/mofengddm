import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';

export class SubmitFormDataDto {
  @IsString()
  @IsNotEmpty()
  formId!: string;

  @IsObject()
  @IsNotEmpty()
  data!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  recordId?: string; // 编辑模式下的记录ID，如果提供则更新，否则创建

  @IsString()
  @IsOptional()
  status?: string; // 状态：'draft' 草稿，'submitted' 已提交
}
