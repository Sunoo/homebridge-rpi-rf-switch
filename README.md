# homebridge-rpi-rf-switch
[rpi-rf](https://pypi.org/project/rpi-rf/) Plugin for [Homebridge](https://github.com/nfarina/homebridge)

This plugin allows you to send 433MHz RF commands via HomeKit. I had no luck getting anything other than rpi-rf to communicate with my hardware. There are other plugins though, try those if this doesn't work for you.

### Installation
1. Install pip using `sudo apt install python3-pip`.
2. Install rpi-rf using `sudo pip3 install rpi-rf`.
3. Install homebridge using `npm install -g homebridge`.
4. Install this plugin using `npm install -g homebridge-rpi-rf-switch --unsafe-perm`.
5. Update your configuration file. See configuration sample below.

### Configuration
Edit your `config.json` accordingly. Configuration sample:
 ```
"platforms": [{
    "platform": "rfSwitch",
    "name": "RF Switch",
    "devices": [{
        "name" : "Outlet 1",
        "on_code": 999988851,
        "off_code": 999989622
    }, {
        "name" : "Outlet 2",
        "on_code":  379952729,
        "off_code": 379953500
    }]
}]
```

| Fields             | Description                                                                  | Required |
|--------------------|------------------------------------------------------------------------------|----------|
| platform           | Must always be `rfSwitch`.                                                   | Yes      |
| name               | For logging purposes.                                                        | No       |
| gpio               | The BCM number of the pin your RF transmitter is connected to. (Default: 17) | No       |
| repeat             | RF code repeat cycles. (Default: 10)                                         | No       |
| devices            | Array of switch config (multiple switches supported).                        | Yes      |
| \|- name           | Name of your device.                                                         | Yes      |
| \|- on_code        | RF code to turn on your device.                                              | Yes      |
| \|- off_code       | RF code to turn off your device.                                             | Yes      |
| \|- pulselength    | RF code pulse length. (Default: 350)                                         | No       |
| \|- protocol       | RF code protocol. (Default: 1)                                               | No       |
| \|- codelength     | RF code length. (Default: 24)                                                | No       |

### Note on Getting RF Codes
I've had the best luck with `RFSniffer` from the [433Utils](https://github.com/ninjablocks/433Utils) project. Your mileage may vary.
