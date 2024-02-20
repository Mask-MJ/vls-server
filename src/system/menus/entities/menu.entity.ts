import { Menu as MenuEntity } from '@prisma/client';

export class Menu implements MenuEntity {
  id: number;
  parentId: number;
  name: string;
  icon: string;
  path: string;
  hidden: boolean;
  status: number;
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}
