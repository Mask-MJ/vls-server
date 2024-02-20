import { Role as RoleEntity } from '@prisma/client';

export class Role implements RoleEntity {
  id: number;
  name: string;
  roleKey: string;
  status: number;
  sort: number;
  remark: string;
  createdAt: Date;
  updatedAt: Date;
}
