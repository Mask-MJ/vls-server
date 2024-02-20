import { IsNumber, IsString, MinLength } from 'class-validator';

export class CreateFactoryDto {
  /**
   * 工厂名称
   * @example '工厂1'
   */
  @IsString()
  @MinLength(1)
  name: string;

  /**
   * 状态 0: 禁用 1: 启用
   * @example 1
   */
  @IsNumber()
  status?: number = 1;

  /**
   * 工厂地址
   * @example '地址1'
   */
  @IsString()
  address?: string = '';

  /**
   * 工厂坐标
   * @example [1, 1]
   */
  @IsNumber({}, { each: true })
  location?: number[] = [];

  /**
   * 工厂描述
   * @example '描述1'
   */
  @IsString()
  remark?: string = '';

  /**
   * 阀门
   * @example [1, 2, 3]
   */
  @IsNumber({}, { each: true })
  valves?: number[] = [];

  /**
   * 可查看人员id
   * @example [1, 2, 3]
   */
  @IsNumber({}, { each: true })
  users?: number[] = [];
}
