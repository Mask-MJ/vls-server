import { MinLength } from 'class-validator';

export class SignInDto {
  @MinLength(4)
  account: string;
  @MinLength(4)
  password: string;
}
