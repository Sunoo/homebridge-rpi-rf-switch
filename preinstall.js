const process = require('child_process');
const os = require('os');

if (os.userInfo().username == 'nobody') {
	console.error('The --unsafe-perm option must be used for preinstall script to work.');
	console.error('Please reinstall with that option, or do remaining steps manually:');
	console.error('https://github.com/Sunoo/homebridge-rpi-rf-switch#manual-pre-install-steps');
} else {
	if (os.platform() == 'linux') {
		try {
			console.log('$ apt-get install -y python3-dev python3-pip');
			process.execSync('apt-get install -y python3-dev python3-pip', {stdio: 'inherit'});
		} catch (err) {
			console.info(err);
			console.error('Error running apt-get, skipping install. Please ensure python3-dev and pip3 are installed.');
		}
	} else {
		console.log('Not running under Linux, not attempting to run apt-get command. Please ensure python3-dev and pip3 are installed.');
	}

	console.log();

	try {
		console.log('$ pip3 install rpi-rf');
		process.execSync('pip3 install rpi-rf', {stdio: 'inherit'});
	} catch (err) {
		console.info(err);
		console.error('Error running pip3. Please manually install rpi-rf.');
	}

	console.log();
}