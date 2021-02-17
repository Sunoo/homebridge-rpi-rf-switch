import { PlatformIdentifier, PlatformName } from 'homebridge';

export type RfSwitchPlatformConfig = {
  platform: PlatformName | PlatformIdentifier;
  name?: string;
  gpio?: number;
  repeat?: number;
  devices?: Array<DeviceConfig>;
};

export type DeviceConfig = {
  name?: string;
  on_code?: number;
  off_code?: number;
  pulseLength?: number;
  protocol?: number;
  codelength?: number;
};