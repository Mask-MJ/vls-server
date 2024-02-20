import { Valve as ValveEntity } from '@prisma/client';

export class Valve implements ValveEntity {
  id: number;
  name: string;
  status: number;
  remark: string;
  factoryId: number;
  createrId: number;
  createdAt: Date;
  updatedAt: Date;
}
