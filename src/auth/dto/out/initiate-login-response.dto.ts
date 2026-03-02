export class InitiateLoginResponseDto {
  session?: string;
  challengeName?: string;
  device?: {
    DeviceKey?: string;
    DeviceGroupKey?: string;
    DeviceName?: string;
  };
}
