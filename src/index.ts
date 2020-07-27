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
import { DeviceConfig, RfSwitchPlatformConfig } from './configTypes';

let hap: HAP;
let Accessory: typeof PlatformAccessory;

const PLUGIN_NAME = 'homebridge-rpi-rf-switch';
const PLATFORM_NAME = 'rfSwitch';

type Command = {
  accessory: PlatformAccessory,
  state: CharacteristicValue,
  callback: CharacteristicSetCallback
};

class RfSwitchPlatform implements DynamicPlatformPlugin {
  private readonly log: Logging;
  private readonly api: API;
  private readonly config: RfSwitchPlatformConfig;
  private readonly accessories: Array<PlatformAccessory>;
  private readonly commandQueue: Array<Command>;
  private readonly rfDevice: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  private transmitting: boolean;

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.config = config as unknown as RfSwitchPlatformConfig;
    this.api = api;

    this.accessories = [];
    this.commandQueue = [];
    this.transmitting = false;

    let libpython = config.libpython;

    if (!libpython) {
      let pyconfig = process.execSync('python3-config --libs').toString();
      let index = pyconfig.indexOf('-lpython');
      pyconfig = pyconfig.substr(index + 2);
      index = pyconfig.indexOf(' ');
      libpython = pyconfig.substr(0, index);
    }

    python.fixlink('lib' + libpython + '.so');

    const gpio = config.gpio || 17;
    const repeat = config.repeat || 10;

    const rpiRf = python.importSync('rpi_rf');
    try {
      this.rfDevice = python.createSync(rpiRf, 'RFDevice', gpio, 1, null, repeat, 24);
    } catch (ex) {
      this.log.error('Error starting rpi-rf. Please make sure it you\'ve followed the ' +
        'installation instructions on the project\'s page. ' + ex);
      return;
    }
    python.callSync(this.rfDevice, 'enable_tx');

    api.on(APIEvent.DID_FINISH_LAUNCHING, this.didFinishLaunching.bind(this));
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.setService(accessory);
    this.accessories.push(accessory);
  }

  didFinishLaunching(): void {
    const serials: Array<string> = [];
    this.config.devices.forEach((device: DeviceConfig) => {
      this.addAccessory(device);
      serials.push(device.on_code + ':' + device.off_code);
    });

    const badAccessories = this.accessories.filter((cachedAccessory: PlatformAccessory) => {
      return !serials.includes(cachedAccessory.context.serial);
    });
    this.removeAccessories(badAccessories);
  }

  addAccessory(data: DeviceConfig): void {
    this.log('Initializing platform accessory \'' + data.name + '\'...');
    const serial = data.on_code + ':' + data.off_code;

    let accessory = this.accessories.find(cachedAccessory => {
      return cachedAccessory.context.serial == serial;
    });

    if (!accessory) {
      const uuid = hap.uuid.generate(serial);
      accessory = new Accessory(data.name, uuid);

      accessory.addService(hap.Service.Switch, data.name);

      this.setService(accessory);

      this.api.registerPlatformAccessories('homebridge-rpi-rf-switch', 'rfSwitch', [accessory]);

      this.accessories.push(accessory);
    }

    accessory.context = data;
    accessory.context.serial = serial;

    const accInfo = accessory.getService(hap.Service.AccessoryInformation);
    if (accInfo) {
      accInfo
        .setCharacteristic(hap.Characteristic.Manufacturer, 'Sunoo')
        .setCharacteristic(hap.Characteristic.Model, 'rpi-rf')
        .setCharacteristic(hap.Characteristic.SerialNumber, accessory.context.serial);
    }
  }

  removeAccessories(accessories: Array<PlatformAccessory>): void {
    accessories.forEach((accessory: PlatformAccessory) => {
      this.log(accessory.context.name + ' is removed from Homebridge.');
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
    if (!todoItem) {
      return;
    }

    const code = todoItem.state ? todoItem.accessory.context.on_code : todoItem.accessory.context.off_code;

    python.call(this.rfDevice, 'tx_code', code, todoItem.accessory.context.protocol,
      todoItem.accessory.context.pulselength, todoItem.accessory.context.codelength)
      .then((): void => {
        this.log.debug(todoItem.accessory.context.name + ' is turned ' + (todoItem.state ? 'on.' : 'off.'));
        todoItem.accessory.context.state = todoItem.state;

        if (this.commandQueue.length > 0) {
          this.nextCommand.bind(this)();
        } else {
          this.transmitting = false;
        }

        todoItem.callback();
      })
      .catch((error: Error) => {
        this.log('Failed to turn ' + (todoItem.state ? 'on ' : 'off ') + todoItem.accessory.context.name);
        this.log(error.message);
      });
  }
}

export = (api: API): void => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, RfSwitchPlatform);
};
