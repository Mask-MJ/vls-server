import { IsOptional, IsString } from 'class-validator';

export class QueryTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;
}
