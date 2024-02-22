import { Template as TemplateEntity } from '@prisma/client';

export class Template implements TemplateEntity {
  id: number;
  name: string;
  remark: string;
  createrId: number;
  createdAt: Date;
  updatedAt: Date;
}
