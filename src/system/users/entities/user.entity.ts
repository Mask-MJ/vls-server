import { User as UserEntity } from '@prisma/client';
import { Exclude } from 'class-transformer';
export class User implements UserEntity {
  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }

  id: number;
  account: string;

  @Exclude()
  password: string;

  nickname: string;
  status: number;
  createdAt: Date;
  updatedAt: Date;
}
