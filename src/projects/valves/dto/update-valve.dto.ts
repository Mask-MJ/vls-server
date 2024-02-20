import { PartialType } from '@nestjs/swagger';
import { CreateValveDto } from './create-valve.dto';

export class UpdateValveDto extends PartialType(CreateValveDto) {}
