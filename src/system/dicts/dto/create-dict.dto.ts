import { IsNumber, IsString, MinLength } from 'class-validator';

export class CreateDictDto {
  /**
   * 字典名称
   * @example '字典1'
   */
  @IsString()
  @MinLength(1)
  name: string;

  /**
   * 字典值
   * @example '1'
   */
  @IsString()
  @MinLength(1)
  value: string;

  /**
   * 字典描述
   * @example '这是一个字典'
   */
  @IsString()
  remark?: string = '';

  /**
   * 模板id
   * @example 1
   */
  @IsNumber()
  templateId: number;
}
