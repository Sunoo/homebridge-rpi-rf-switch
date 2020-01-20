const python = require("@sunookitsune/node-calls-python").interpreter;
var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform("homebridge-rpi-rf-switch", "rfSwitch", rfSwitchPlatform, true);
}

function rfSwitchPlatform(log, config, api) {
    this.log = log;
    this.config = config;

    this.gpio = config.gpio || 17;
    this.repeat = config.repeat || 10;
    this.libpython = config.libpython || 'python3.7m';

    this.accessories = [];

    this.commandQueue = [];
    this.transmitting = false;

    python.fixlink('lib' + this.libpython + '.so');

    var rpiRf = python.importSync('rpi_rf');
    this.rfDevice = python.createSync(rpiRf, 'RFDevice', this.gpio, 1, null, this.repeat, 24);
    python.callSync(this.rfDevice, 'enable_tx');

    if (api) {
        this.api = api;
        this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
    }
}

rfSwitchPlatform.prototype.configureAccessory = function(accessory) {
    this.setService(accessory);
    this.accessories.push(accessory);
}

rfSwitchPlatform.prototype.didFinishLaunching = function() {
    var serials = [];
    this.config.devices.forEach(device => {
        this.addAccessory(device);
        serials.push(device.on_code + ':' + device.off_code);
    });

    var badAccessories = [];
    this.accessories.forEach(cachedAccessory => {
        if (!serials.includes(cachedAccessory.context.serial)) {
            badAccessories.push(cachedAccessory);
        }
    });
    this.removeAccessories(badAccessories);
}

rfSwitchPlatform.prototype.addAccessory = function(data) {
    this.log("Initializing platform accessory '" + data.name + "'...");
    data.serial = data.on_code + ":" + data.off_code;

    var accessory;
    this.accessories.forEach(cachedAccessory => {
        if (cachedAccessory.context.serial == data.serial) {
            accessory = cachedAccessory;
        }
    });

    if (!accessory) {
        var uuid = UUIDGen.generate(data.serial);
        accessory = new Accessory(data.name, uuid);

        accessory.context = data;

        accessory.addService(Service.Switch, data.name);

        accessory.reachable = true;

        this.setService(accessory);

        this.api.registerPlatformAccessories("homebridge-rpi-rf-switch", "rfSwitch", [accessory]);

        this.accessories.push(accessory);
    } else {
        accessory.context = data;
    }

    this.getInitState(accessory);
}

rfSwitchPlatform.prototype.removeAccessories = function(accessories) {
    accessories.forEach(accessory => {
        this.log(accessory.context.name + " is removed from HomeBridge.");
        this.api.unregisterPlatformAccessories("homebridge-honeywell-leak", "honeywellLeak", [accessory]);
        this.accessories.splice(this.accessories.indexOf(accessory), 1);
    });
}

rfSwitchPlatform.prototype.setService = function(accessory) {
    accessory.getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .on('set', this.setPowerState.bind(this, accessory));

    accessory.on('identify', this.identify.bind(this, accessory));
}

rfSwitchPlatform.prototype.getInitState = function(accessory) {
    accessory.getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "Sunoo")
        .setCharacteristic(Characteristic.Model, "rpi-rf")
        .setCharacteristic(Characteristic.SerialNumber, accessory.context.serial);

    accessory.getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .getValue();

    accessory.updateReachability(true);
}

rfSwitchPlatform.prototype.setPowerState = function(accessory, state, callback) {
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

rfSwitchPlatform.prototype.nextCommand = function() {
    let todoItem = this.commandQueue.shift();
    let accessory = todoItem['accessory'];
    let state = todoItem['state'];
    let callback = todoItem['callback'];

    let code = state ? accessory.context.on_code : accessory.context.off_code;

    let handleError = function(error) {}

    python.call(this.rfDevice, "tx_code", code, accessory.context.protocol,
            accessory.context.pulselength, accessory.context.codelength)
        .then(result => {
            this.log(accessory.context.name + " is turned " + (state ? "on." : "off."))
            accessory.context.state = state;

            if (this.commandQueue.length > 0) {
                this.nextCommand.bind(this)();
            } else {
                this.transmitting = false;
            }

            callback();
        })
        .catch(error => {
            this.log("Failed to turn " + (state ? "on " : "off ") + accessory.context.name);
            this.log(error);
        });
}

rfSwitchPlatform.prototype.identify = function(thisSwitch, paired, callback) {
    this.log(thisSwitch.context.name + "identify requested!");
    callback();
}