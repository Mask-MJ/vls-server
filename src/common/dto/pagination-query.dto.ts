import { Type, Expose, Transform } from 'class-transformer';
import { IsOptional, IsPositive } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  @Expose()
  @Transform(({ value }) => parseInt(value) || 1)
  page: number;

  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  @Expose()
  @Transform(({ value }) => parseInt(value) || 10)
  pageSize: number;
}
