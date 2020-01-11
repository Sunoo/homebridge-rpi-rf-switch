var exec = require("child_process").exec;
var Accessory, Service, Characteristic, UUIDGen;

// command queue
let todoList = [];
let running = false;

module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerPlatform("homebridge-rpi-rf-switch", "rfSwitch", rfSwitchPlatform, true);
}

function toggleNext() {
    // get next todo item
    let todoItem = todoList.shift();
    let callback = todoItem['callback'];
    let thisSwitch = todoItem['thisSwitch'];
    let state = todoItem['state'];
    let self = todoItem['self'];

    var cmd = state ? thisSwitch.on_cmd : thisSwitch.off_cmd;

    // Execute command to set state
    exec("/usr/local/bin/rpi-rf_send " + cmd, function(error, stdout, stderr) {
        // Error detection
        if (error && (state !== thisSwitch.state)) {
            self.log("Failed to turn " + (state ? "on " : "off ") + thisSwitch.name);
            self.log(stderr);
        } else {
            if (cmd) self.log(thisSwitch.name + " is turned " + (state ? "on." : "off."));
            thisSwitch.state = state;
            error = null;
        }

        // set timer for next todo
        if (todoList.length > 0) {
            toggleNext();
        } else {
            running = false;
        }

        callback();
    });
}

function rfSwitchPlatform(log, config, api) {
    this.log = log;
    this.config = config || {
        "platform": "rfSwitch"
    };
    this.switches = this.config.switches || [];

    this.accessories = {};

    if (api) {
        this.api = api;
        this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
    }
}

// Method to restore accessories from cache
rfSwitchPlatform.prototype.configureAccessory = function(accessory) {
    this.setService(accessory);
    this.accessories[accessory.context.name] = accessory;
}

// Method to setup accessories from config.json
rfSwitchPlatform.prototype.didFinishLaunching = function() {
    // Add or update accessories defined in config.json
    for (var i in this.switches) this.addAccessory(this.switches[i]);

    // Remove extra accessories in cache
    for (var name in this.accessories) {
        var accessory = this.accessories[name];
        if (!accessory.reachable) this.removeAccessory(accessory);
    }
}

// Method to add and update HomeKit accessories
rfSwitchPlatform.prototype.addAccessory = function(data) {
    this.log("Initializing platform accessory '" + data.name + "'...");

    // Retrieve accessory from cache
    var accessory = this.accessories[data.name];

    data.manufacturer = "Sunoo";
    data.model = "rpi-rf";
    data.serial = data.on_cmd.toString() + ":" + data.off_cmd.toString();

    if (!accessory) {
        // Setup accessory as SWITCH (8) category.
        var uuid = UUIDGen.generate(data.serial);
        accessory = new Accessory(data.name, uuid, 8);

        // Setup HomeKit switch service
        accessory.addService(Service.Switch, data.name);

        // New accessory is always reachable
        accessory.reachable = true;

        // Setup listeners for different switch events
        this.setService(accessory);

        // Register new accessory in HomeKit
        this.api.registerPlatformAccessories("homebridge-rpi-rf-switch", "rfSwitch", [accessory]);

        // Store accessory in cache
        this.accessories[data.name] = accessory;
    }

    // Retrieve initial state
    this.getInitState(accessory);
}

// Method to remove accessories from HomeKit
rfSwitchPlatform.prototype.removeAccessory = function(accessory) {
    if (accessory) {
        var name = accessory.context.name;
        this.log(name + " is removed from HomeBridge.");
        this.api.unregisterPlatformAccessories("homebridge-rpi-rf-switch", "rfSwitch", [accessory]);
        delete this.accessories[name];
    }
}

// Method to setup listeners for different events
rfSwitchPlatform.prototype.setService = function(accessory) {
    accessory.getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this, accessory.context))
        .on('set', this.setPowerState.bind(this, accessory.context));

    accessory.on('identify', this.identify.bind(this, accessory.context));
}

// Method to retrieve initial state
rfSwitchPlatform.prototype.getInitState = function(accessory) {
    var manufacturer = accessory.context.manufacturer;
    var model = accessory.context.model;
    var serial = accessory.context.serial;

    // Update HomeKit accessory information
    accessory.getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, manufacturer)
        .setCharacteristic(Characteristic.Model, model)
        .setCharacteristic(Characteristic.SerialNumber, serial);

    accessory.getService(Service.Switch)
        .getCharacteristic(Characteristic.On)
        .getValue();

    // Configured accessory is reachable
    accessory.updateReachability(true);
}

// Method to determine current state
rfSwitchPlatform.prototype.getState = function(thisSwitch, callback) {
    var self = this;

    // Return cached state if no state_cmd provided
    callback(null, thisSwitch.state);
    return;
}

// Method to determine current state
rfSwitchPlatform.prototype.getPowerState = function(thisSwitch, callback) {
    var self = this;

    // Check state if polling is disabled
    this.getState(thisSwitch, function(error, state) {
        // Update state if command exists
        callback(error, thisSwitch.state);
    });
}

// Method to set state
rfSwitchPlatform.prototype.setPowerState = function(thisSwitch, state, callback) {
    var self = this;

    todoList.push({
        'callback': callback,
        'thisSwitch': thisSwitch,
        'state': state,
        'self': self
    });
    if (!running) {
        running = true;
        toggleNext();
    }
}

// Method to handle identify request
rfSwitchPlatform.prototype.identify = function(thisSwitch, paired, callback) {
    this.log(thisSwitch.name + " identify requested!");
    callback();
}
