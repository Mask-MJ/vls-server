import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import * as dayjs from 'dayjs';

export class QueryUserDto {
  @IsOptional()
  @IsString()
  account?: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsNumber({}, { each: true })
  roles?: number[];

  @IsOptional()
  @IsNumber()
  status?: number;

  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => dayjs(value).format(), { toClassOnly: true })
  beginTime?: Date;

  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => dayjs(value).format(), { toClassOnly: true })
  endTime?: Date;
}
