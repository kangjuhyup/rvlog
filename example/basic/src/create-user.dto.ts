import { MaskLog } from '@kangjuhyup/rvlog';

export class CreateUserDto {
  @MaskLog({ type: 'name' })
  name!: string;

  @MaskLog({ type: 'email' })
  email!: string;

  @MaskLog({ type: 'phone' })
  phoneNumber!: string;
}
