from rpi_rf import RFDevice

rfdevice = None

def send(code, gpio, pulselength, protocol, codelength, repeat):
    if pulselength < 0:
        pulselength = None
    if protocol < 0:
        protocol = None
    if codelength < 0:
        codelength = None

    global rfdevice
    if rfdevice == None:
        rfdevice = RFDevice(gpio)
        rfdevice.enable_tx()

    rfdevice.tx_repeat = repeat
    rfdevice.tx_code(code, protocol, pulselength, codelength)