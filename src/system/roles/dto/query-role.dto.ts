import { IsNumber, IsOptional, IsString } from 'class-validator';

export class QueryRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  roleKey?: string;

  @IsOptional()
  @IsNumber({}, { each: true })
  sort?: number[];

  @IsOptional()
  @IsNumber()
  status?: number;
}
