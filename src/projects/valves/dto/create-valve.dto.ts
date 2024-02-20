export class CreateValveDto {
  /**
   * 阀门名称
   * @example '阀门1'
   */
  name: string;

  /**
   * 阀门状态 0: 关闭 1: 开启
   * @example 1
   */
  status?: number = 1;

  /**
   * 阀门描述
   * @example '这是一个阀门'
   */
  remark?: string = '';

  /**
   * 工厂id
   * @example 1
   */
  factoryId: number;

  /**
   * 创建者id
   * @example 1
   */
  createrId: number;
}
