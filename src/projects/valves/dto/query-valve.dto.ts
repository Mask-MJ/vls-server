import { IsNumber, IsOptional, IsString } from 'class-validator';

export class QueryValveDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsNumber()
  factoryId: number;

  @IsOptional()
  @IsNumber()
  status?: number;
}
