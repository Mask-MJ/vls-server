import { IsNumber, IsOptional, IsString } from 'class-validator';

export class QueryDictDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsNumber()
  templateId: number;
}
