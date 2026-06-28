import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { BaseDto } from 'src/common/dto/base.dto';

export class CreateDictDataDto {
  /**
   * 字典数据名称
   * @example '性别'
   */
  @IsString()
  name: string;

  /**
   * 字典数据值
   * @example '1'
   */
  @IsString()
  value: string;

  /**
   * 排序
   * @example 1
   */
  @IsOptional()
  @IsNumber()
  sort?: number;

  /**
   * 类型 0: 配置 1: 参数 2: 诊断
   * @example '0'
   */
  @IsString()
  @IsOptional()
  type?: string;

  /**
   * 状态 false: 禁用 true: 启用
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  status?: boolean = true;

  /**
   * 中文标题
   * @example '男'
   */
  @IsString()
  @IsOptional()
  cnTitle?: string;

  /**
   * 英文标题
   * @example 'boy'
   */
  @IsString()
  @IsOptional()
  enTitle?: string;

  /**
   * 是否图表
   * @example false
   */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isChart?: boolean;

  /**
   * 图表数据类型 0: 数值 1: 百分比
   * @example '0'
   */
  @IsString()
  @IsOptional()
  chartType?: string;

  /**
   * 上限值
   * @example '0'
   */
  @IsString()
  @IsOptional()
  upperLimit?: string;

  /**
   * 下限值
   * @example '0'
   */
  @IsString()
  @IsOptional()
  lowerLimit?: string;

  /**
   * 单位（图表 Y 轴显示）
   * @example '%'
   */
  @IsString()
  @IsOptional()
  unit?: string;

  /**
   * 字典类型ID
   * @example 1
   */
  @IsNumber()
  @Type(() => Number)
  dictTypeId: number;

  /**
   * 备注
   * @example '备注'
   */
  @IsString()
  @IsOptional()
  remark?: string;

  /**
   * 父级菜单id
   * @example 0
   */
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  parentId?: number;

  /**
   * treeId
   * @example 1
   */
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  treeId?: number;
}

export class QueryDictDataDto extends PartialType(
  IntersectionType(
    PickType(CreateDictDataDto, ['name', 'value', 'dictTypeId', 'isChart']),
    BaseDto,
  ),
) {
  /**
   * 字典类型值
   * @example 'chart'
   */
  @IsString()
  @IsOptional()
  dictTypeValue?: string;
}

export class UpdateDictDataDto extends PartialType(CreateDictDataDto) {
  @IsNumber()
  id: number;
}
