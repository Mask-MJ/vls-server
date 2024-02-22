import { IsString, MinLength } from 'class-validator';

export class CreateTemplateDto {
  /**
   * 模板名称
   * @example '模板1'
   */
  @IsString()
  @MinLength(1)
  name: string;

  /**
   * 模板描述
   * @example '这是一个模板'
   */
  @IsString()
  remark?: string = '';
}
