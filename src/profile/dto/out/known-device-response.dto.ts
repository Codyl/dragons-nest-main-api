/** Single device in GET /profile/known-devices response. */
export class KnownDeviceResponseDto {
  DeviceKey?: string;
  DeviceName?: string;
  DeviceLastIPUsed?: string;
  DeviceCreateDate?: Date;
  DeviceLastAuthenticatedDate?: Date;
  DeviceLastModifiedDate?: Date;
  City?: string;
  Region?: string;
  Country?: string;
}
