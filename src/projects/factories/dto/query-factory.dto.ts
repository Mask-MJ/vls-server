import { IsNumber, IsOptional, IsString } from 'class-validator';

export class QueryFactoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  status?: number;
}
