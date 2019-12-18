# homebridge-rpi-rf-switch
Rpi-RF Plugin for [Homebridge](https://github.com/nfarina/homebridge)

### What this plugin does
This plugin allows you to send RF commands via HomeKit.

### How this plugin works
1. `on_cmd`: This is the command issued when the switch is turned ON.
2. `off_cmd`: This is the command issued when the switch is turned OFF.

# Installation
1. Install homebridge using `npm install -g homebridge`.
2. Install this plugin using `npm install -g homebridge-rpi-rf-switch`.
3. Update your configuration file. See configuration sample below.

# Configuration
Edit your `config.json` accordingly. Configuration sample:
 ```
"platforms": [{
    "platform": "rfSwitch",
    "name": "RF Switch",
    "switches": [{
        "name" : "Outlet 1",
        "on_cmd": "999988851",
        "off_cmd": "999989622"
    }, {
        "name" : "Outlet 2",
        "on_cmd":  "379952729",
        "off_cmd": "379953500"
    }]
}]
```


| Fields             | Description                                           | Required |
|--------------------|-------------------------------------------------------|----------|
| platform           | Must always be `rfSwitch`.                            | Yes      |
| name               | For logging purposes.                                 | No       |
| switches           | Array of switch config (multiple switches supported). | Yes      |
| \|- name\*         | Name of your device.                                  | Yes      |
| \|- on_cmd         | Command to turn on your device.                       | Yes      |
| \|- off_cmd        | Command to turn off your device.                      | Yes      |

\*Changing the switch `name` in `config.json` will create a new switch instead of renaming the existing one in HomeKit. It's strongly recommended that you rename the switch using a HomeKit app only.

\*\*Command execution is assumed 'Successful' if timeout occures.
