export class CreateDictDto {
  /**
   * 字典名称
   * @example '字典1'
   */
  name: string;

  /**
   * 字典值
   * @example '1'
   */
  value: string;

  /**
   * 字典描述
   * @example '这是一个字典'
   */
  remark?: string = '';

  /**
   * 模板id
   * @example 1
   */
  templateId: number;
}
