import { PartialType } from '@nestjs/swagger';
import { CreateFactoryDto } from './create-factory.dto';

export class UpdateFactoryDto extends PartialType(CreateFactoryDto) {}
