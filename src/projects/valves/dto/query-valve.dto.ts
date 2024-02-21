import { IsNumber, IsOptional, IsString } from 'class-validator';

export class QueryValveDto {
  @IsOptional()
  @IsString()
  name?: string;

  factoryId: number;

  @IsOptional()
  @IsNumber()
  status?: number;
}
