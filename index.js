var exec = require("child_process").exec;
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
    this.config = config || {
        "platform": "rfSwitch"
    };
    this.switches = this.config.switches || [];

    this.accessories = {};

    this.commandQueue = [];
    this.transmitting = false;

    if (api) {
        this.api = api;
        this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
    }
}

rfSwitchPlatform.prototype.configureAccessory = function(accessory) {
    this.setService(accessory);
    this.accessories[accessory.context.name] = accessory;
}

rfSwitchPlatform.prototype.didFinishLaunching = function() {
    for (var i in this.switches) this.addAccessory(this.switches[i]);

    for (var name in this.accessories) {
        var accessory = this.accessories[name];
        if (!accessory.reachable) {
            this.removeAccessory(accessory);
        }
    }
}

rfSwitchPlatform.prototype.addAccessory = function(data) {
    this.log("Initializing platform accessory '" + data.name + "'...");

    var accessory = this.accessories[data.name];

    data.serial = data.on_cmd.toString() + ":" + data.off_cmd.toString();

    if (!accessory) {
        var uuid = UUIDGen.generate(data.serial);
        accessory = new Accessory(data.name, uuid, 8);

        accessory.addService(Service.Switch, data.name);

        accessory.reachable = true;

        this.setService(accessory);

        this.api.registerPlatformAccessories("homebridge-rpi-rf-switch", "rfSwitch", [accessory]);

        this.accessories[data.name] = accessory;
    }

    this.getInitState(accessory);
}

rfSwitchPlatform.prototype.removeAccessory = function(accessory) {
    if (accessory) {
        var name = accessory.context.name;
        this.log(name + " is removed from HomeBridge.");
        this.api.unregisterPlatformAccessories("homebridge-rpi-rf-switch", "rfSwitch", [accessory]);
        delete this.accessories[name];
    }
}

rfSwitchPlatform.prototype.setService = function(accessory) {
    accessory.getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .on('set', this.setPowerState.bind(this, accessory.context));

    accessory.on('identify', this.identify.bind(this, accessory.context));
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

rfSwitchPlatform.prototype.setPowerState = function(thisSwitch, state, callback) {
    this.commandQueue.push({
        'callback': callback,
        'thisSwitch': thisSwitch,
        'state': state
    });
    if (!this.transmitting) {
        this.transmitting = true;
        this.nextCommand.bind(this)();
    }
}

rfSwitchPlatform.prototype.nextCommand = function() {
    let todoItem = this.commandQueue.shift();
    let callback = todoItem['callback'];
    let thisSwitch = todoItem['thisSwitch'];
    let state = todoItem['state'];

    var cmd = state ? thisSwitch.on_cmd : thisSwitch.off_cmd;

    exec("/usr/local/bin/rpi-rf_send " + cmd, function(error, stdout, stderr) {
        if (error && (state !== thisSwitch.state)) {
            this.log("Failed to turn " + (state ? "on " : "off ") + thisSwitch.name);
            this.log(stderr);
        } else {
            if (cmd) {
                this.log(thisSwitch.name + " is turned " + (state ? "on." : "off."))
            };
            thisSwitch.state = state;
            error = null;
        }

        if (this.commandQueue.length > 0) {
            this.nextCommand.bind(this)();
        } else {
            this.transmitting = false;
        }

        callback();
    }.bind(this));
}

rfSwitchPlatform.prototype.identify = function(thisSwitch, paired, callback) {
    this.log(thisSwitch.name + "identify requested!");
    callback();
}