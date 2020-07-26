import {
  API,
  APIEvent,
  CharacteristicSetCallback,
  CharacteristicValue,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformAccessoryEvent,
  PlatformConfig
} from 'homebridge';
const python = require('node-calls-python').interpreter; // eslint-disable-line @typescript-eslint/no-var-requires
import process from 'child_process';

let hap: HAP;
let Accessory: typeof PlatformAccessory;

const PLUGIN_NAME = 'homebridge-rpi-rf-switch';
const PLATFORM_NAME = 'rfSwitch';

class RfSwitchPlatform implements DynamicPlatformPlugin {
  private readonly log: Logging;
  private readonly api: API;
  private readonly config: PlatformConfig;
  private readonly gpio: number;
  private readonly repeat: number;
  private readonly libpython: string;
  private readonly accessories: Array<PlatformAccessory>;
  private readonly commandQueue: Array<any>;
  private readonly rfDevice: any;
  private transmitting: boolean;

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.config = config;
    this.api = api;

    this.gpio = config.gpio || 17;
    this.repeat = config.repeat || 10;

    this.libpython = config.libpython;

    if (this.libpython == null) {
      let pyconfig = process.execSync('python3-config --libs').toString();
      let index = pyconfig.indexOf('-lpython');
      pyconfig = pyconfig.substr(index + 2);
      index = pyconfig.indexOf(' ');
      this.libpython = pyconfig.substr(0, index);
    }

    python.fixlink('lib' + this.libpython + '.so');

    this.accessories = [];
    this.commandQueue = [];
    this.transmitting = false;

    const rpiRf = python.importSync('rpi_rf');
    this.rfDevice = python.createSync(rpiRf, 'RFDevice', this.gpio, 1, null, this.repeat, 24);
    python.callSync(this.rfDevice, 'enable_tx');

    api.on(APIEvent.DID_FINISH_LAUNCHING, this.didFinishLaunching.bind(this));
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.setService(accessory);
    this.accessories.push(accessory);
  }

  didFinishLaunching(): void {
    const serials: Array<string> = [];
    this.config.devices.forEach((device: any) => {
      this.addAccessory(device);
      serials.push(device.on_code + ':' + device.off_code);
    });

    const badAccessories: Array<PlatformAccessory> = [];
    this.accessories.forEach(cachedAccessory => {
      if (!serials.includes(cachedAccessory.context.serial)) {
        badAccessories.push(cachedAccessory);
      }
    });
    this.removeAccessories(badAccessories);
  }

  addAccessory(data: any): void {
    this.log('Initializing platform accessory \'' + data.name + '\'...');
    data.serial = data.on_code + ':' + data.off_code;

    let accessory = this.accessories.find(cachedAccessory => {
      return cachedAccessory.context.serial == data.serial;
    });

    if (!accessory) {
      const uuid = hap.uuid.generate(data.serial);
      accessory = new Accessory(data.name, uuid);

      accessory.context = data;

      accessory.addService(hap.Service.Switch, data.name);

      accessory.reachable = true;

      this.setService(accessory);

      this.api.registerPlatformAccessories('homebridge-rpi-rf-switch', 'rfSwitch', [accessory]);

      this.accessories.push(accessory);
    } else {
      accessory.context = data;
    }

    this.getInitState(accessory);
  }

  removeAccessories(accessories: Array<PlatformAccessory>): void {
    accessories.forEach((accessory: PlatformAccessory) => {
      this.log(accessory.context.name + ' is removed from HomeBridge.');
      this.api.unregisterPlatformAccessories('homebridge-rpi-rf-switch', 'rfSwitch', [accessory]);
      this.accessories.splice(this.accessories.indexOf(accessory), 1);
    });
  }

  setService(accessory: PlatformAccessory): void {
    const service = accessory.getService(hap.Service.Switch);
    if (service) {
      service
        .getCharacteristic(hap.Characteristic.On)
        .on('set', this.setPowerState.bind(this, accessory));
    }

    accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
      this.log(accessory.displayName, 'identify requested!');
    });
  }

  getInitState(accessory: PlatformAccessory): void {
    const accInfo = accessory.getService(hap.Service.AccessoryInformation);
    if (accInfo) {
      accInfo
        .setCharacteristic(hap.Characteristic.Manufacturer, 'Sunoo')
        .setCharacteristic(hap.Characteristic.Model, 'rpi-rf')
        .setCharacteristic(hap.Characteristic.SerialNumber, accessory.context.serial);
    }
  }

  setPowerState(accessory: PlatformAccessory, state: CharacteristicValue, callback: CharacteristicSetCallback): void {
    this.commandQueue.push({
      'accessory': accessory,
      'state': state,
      'callback': callback
    });
    if (!this.transmitting) {
      this.transmitting = true;
      this.nextCommand.bind(this)();
    }
  }

  nextCommand(): void {
    const todoItem = this.commandQueue.shift();
    const accessory = todoItem['accessory'];
    const state = todoItem['state'];
    const callback = todoItem['callback'];

    const code = state ? accessory.context.on_code : accessory.context.off_code;

    python.call(this.rfDevice, 'tx_code', code, accessory.context.protocol,
      accessory.context.pulselength, accessory.context.codelength)
      .then((): void => {
        this.log.debug(accessory.context.name + ' is turned ' + (state ? 'on.' : 'off.'));
        accessory.context.state = state;

        if (this.commandQueue.length > 0) {
          this.nextCommand.bind(this)();
        } else {
          this.transmitting = false;
        }

        callback();
      })
      .catch((error: Error) => {
        this.log('Failed to turn ' + (state ? 'on ' : 'off ') + accessory.context.name);
        this.log(error.message);
      });
  }
}

export = (api: API): void => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, RfSwitchPlatform);
};
