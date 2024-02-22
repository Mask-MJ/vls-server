import { Type } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class QueryDictDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  templateId: number;
}
