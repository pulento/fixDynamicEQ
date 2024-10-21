#!/usr/bin/env node

const {Client} = require('node-ssdp');
const {Telnet} = require('telnet-client');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('events').EventEmitter.defaultMaxListeners = 20;
const client = new Client();
const networkInterfaces = os.networkInterfaces();
let foundAVR = false, deviceIP = '', localIPs = [], notDM_AVRIPs = [], jsonData, silentMode = true; // Change to 'false' to get full on screen prompting //
let model = "", upnpLocation;
Object.keys(networkInterfaces).forEach((interfaceName) => {
    networkInterfaces[interfaceName].forEach((networkInterface) => {
        if (!networkInterface.internal && networkInterface.family === 'IPv4') {
            localIPs.push(networkInterface.address);
        }
});});

const loadJSONData = async () => {
    let exeDir = process.pkg ? path.dirname(process.execPath) : path.dirname(process.argv[1]);
    try {
        if (process.env.ADY_DIRECTORY) {
            exeDir = process.env.ADY_DIRECTORY;
        }
        console.log(`Searching calibration file at: ${exeDir}`);
        const files = await fs.promises.readdir(exeDir);
        const jsonFile = files.find(file => file.startsWith('manualREW') && file.endsWith('.ady'));
        if (!jsonFile) {
            console.error('Error loading calibration file: No file starting with "manualREW" and ending with ".ady" found.');
            return null;
        }
        const jsonFilePath = path.join(exeDir, jsonFile);
        const fileData = await fs.promises.readFile(jsonFilePath, 'utf8');
        jsonData = JSON.parse(fileData);
        console.log('Loaded calibration file:', jsonData);
    } catch (err) {
        console.error('Error loading calibration file:', err.message);
        return null;
    }
};
const extractReferenceVolume = (title) => {
    const match = title.match(/MV(-?\d+)dB/);
    return match ? parseInt(match[1], 10) : null;
};
const generateSpeakerLevels = (jsonData) => {
    const excludedChannels = ['FL', 'FR', 'C'];
    const speakerLevels = jsonData.detectedChannels.reduce((acc, channel) => {
        const { commandId, customLevel } = channel;
        if (!excludedChannels.includes(commandId) && !commandId.startsWith('SW')) {
            acc[commandId] = Number(parseFloat(customLevel).toFixed(1));
        }
        return acc;
    }, {});
    return speakerLevels;
};
const connectToAVR = async (avIP) => {
    const params = {
    host: avIP,
    port: 23,
    shellPrompt: '',
    timeout: 250,
    negotiationMandatory: false,
    };
    if (!jsonData) {
        console.error("JSON data is not loaded. Cannot proceed with AVR connection.");
        return;
    }
    const referenceVolume = extractReferenceVolume(jsonData.title);
    const speakerNameMapping = {// odd naming convention specific to SLA & SRA only! //
        'SLA': 'SL',
        'SRA': 'SR'
    };
    const userSpeakerLevels = generateSpeakerLevels(jsonData);
    if (referenceVolume !== null) {
        console.log(`Measurement volume level as read from your calibration file: ${referenceVolume}dB (Absolute), ${referenceVolume - 80}dB (Relative), ${referenceVolume + 25}dB (True)`);
    } else {
        console.warn('Could not extract reference value from title');
    }
    let isAdjusting = false;
    const initialSpeakerLevels = {};
    Object.keys(userSpeakerLevels).forEach(speaker => {
        const adjustmentName = speakerNameMapping[speaker] || speaker;
        initialSpeakerLevels[adjustmentName] = userSpeakerLevels[speaker] + 50;
    });
    const halfChangeSpeakers = ['SL', 'SR', 'SBL', 'SBR', 'SB'];
    const quarterChangeSpeakers = ['FHL', 'FHR', 'FWL', 'FWR', 'TFL', 'TFR', 'TML', 'TMR', 'TRL', 'TRR', 'RHL', 'RHR', 'FDL', 'FDR', 'SDL', 'SDR', 'BDL', 'BDR', 'SHL', 'SHR', 'TS', 'CH'];
    const MIN_LEVEL = 38;
    const MAX_LEVEL = 62;
    const connection = new Telnet();
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
        await connection.connect(params);
        console.log('Successful connection!');
        console.log(`AV Receiver IP address: ${params.host}`);
        console.log(`Telnet port: ${params.port}`);
        console.log(`Timeout: ${params.timeout}ms`);
        console.log(`Reference target volume: ${referenceVolume}dB (Absolute), ${referenceVolume - 80}dB (Relative), ${referenceVolume + 25}dB (True)`);
        console.log('Default custom speaker levels as read from your calibration file:');
        Object.entries(userSpeakerLevels).forEach(([speaker, level]) => {
        console.log(`${speaker}: ${level > 0 ? '+' : ''}${level}dB`);});
        console.log('==============================');
        console.log('ONLY USE CTRL + C TO EXIT THE PROGRAM to restore original speaker volume levels in the AV Receiver!');
        let previousVolume = referenceVolume;
        const getAVRInfo = async () => {
            if (isAdjusting) {
                log('Volume adjustment in progress, skipping reading AVR volume...');
                return;
            }
            log('Reading AVR volume...');
            let mvResponse;
            try {
                mvResponse = await connection.send('MV?\x0D');
            } catch(error) {
                console.error('Retrying read');
                mvResponse = await connection.send('MV?\x0D').catch(err => console.error('Error reading volume:',err));
            }
            //let mvResponse = await connection.send('MV?\x0D').catch(err => console.error('Error reading volume:', err));
            const mvMatch = mvResponse && mvResponse.match(/MV(\d+)/);
            const mvMaxMatch = mvResponse.match(/MVMAX (\d+)/);
            if (mvMatch) {
                const absoluteVolume = mvMatch[1].length === 3 ? parseInt(mvMatch[1], 10) / 10 : parseInt(mvMatch[1], 10);
                const trueVolume = absoluteVolume + 25;
                const relativeVolume = absoluteVolume - 80;
                let adjustmentFactor = 0;
                if (absoluteVolume !== previousVolume) {
                    previousVolume = absoluteVolume;
                    const calculateAdjustment = (start, end, factor) => {
                        const steps = Math.abs(start - end) * 2;
                        return steps * factor;
                    };
                    if (absoluteVolume >= referenceVolume) {
                        adjustmentFactor = 0;
                    } else if (absoluteVolume >= 55) {
                        adjustmentFactor = calculateAdjustment(referenceVolume, absoluteVolume, 0.1);
                    } else if (absoluteVolume >= 50) {
                        adjustmentFactor = calculateAdjustment(referenceVolume, 55, 0.1);
                        adjustmentFactor += calculateAdjustment(55, absoluteVolume, 0.25);
                    } else if (absoluteVolume >= 49) {
                        adjustmentFactor = calculateAdjustment(referenceVolume, 55, 0.1);
                        adjustmentFactor += calculateAdjustment(55, 50, 0.25);
                        adjustmentFactor += calculateAdjustment(50, Math.max(absoluteVolume, 49), 0.5);
                    } else {
                        adjustmentFactor = calculateAdjustment(referenceVolume, 55, 0.1) + calculateAdjustment(55, 50, 0.25) + calculateAdjustment(50, 49, 0.5);
                    }
                    const roundedAdjustment = Math.round(adjustmentFactor * 2) / 2;
                    console.log(`Applying surround/height boost correction: ${roundedAdjustment}dB based on main volume: ${absoluteVolume}dB vs reference volume: ${referenceVolume}dB`);
                    if (absoluteVolume >= referenceVolume || Math.abs(roundedAdjustment) >= 0.5) {
                        await adjustSpeakerVolumes(roundedAdjustment, absoluteVolume >= referenceVolume);
                    } else {
                        console.log(`No adjustment applied. Calculated adjustment (${adjustmentFactor}dB) rounds to 0.`);
                    }
                }
            }
        };
        const adjustSpeakerVolumes = async (adjustmentFactor, resetToInitial = false) => {
            if (isAdjusting) return; // Prevent concurrent adjustments
            isAdjusting = true;
            const roundedAdjustmentFactor = Math.round(adjustmentFactor * 2) / 2;
            let changesApplied = false;
            await Promise.all(
                Object.keys(initialSpeakerLevels).map(async (speaker) => {
                    if (!halfChangeSpeakers.includes(speaker) && !quarterChangeSpeakers.includes(speaker)) {
                        return;
                    }
                    let initialLevel = initialSpeakerLevels[speaker];
                    let newLevel;
                    let adjustment;

                    if (resetToInitial) {
                        newLevel = initialLevel;
                        adjustment = 0;
                    } else {
                        adjustment = -roundedAdjustmentFactor;
                        if (quarterChangeSpeakers.includes(speaker)) {
                            adjustment = Math.round(adjustment * 0.5 * 2) / 2;
                        }
                        newLevel = initialLevel + adjustment;
                    }
                    const isCapped = newLevel < MIN_LEVEL || newLevel > MAX_LEVEL;
                    newLevel = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, newLevel));
                    newLevel = Math.round(newLevel * 2) / 2;
                    if (newLevel !== initialLevel || resetToInitial) {
                        changesApplied = true;
                        console.log(`${speaker}: Initial ${initialLevel - 50}dB, Adjustment ${adjustment.toFixed(1)}dB, Final ${newLevel - 50}dB`);
                        if (isCapped) {
                            console.log(`Warning: Final level for ${speaker} is capped due to 12dB limit`);
                        }
                        if (resetToInitial) {
                            console.log(`Speaker ${speaker} reset to initial level`);
                        }
                        let formattedLevel = newLevel % 1 === 0 ? newLevel.toFixed(0) : (newLevel * 10).toFixed(0);
                        await connection.send(`SSLEV${speaker} ${formattedLevel}\x0D`)
                            .catch(err => console.error(`SSLEV${speaker} command error. Please check your AVR is ON!`));
                    }
                })
            );
            if (!changesApplied) {
                log("No changes in speaker levels were necessary.", true);
            }
            isAdjusting = false;
        };
        await getAVRInfo();
        const resetSpeakerLevels = async () => {
            console.log('Resetting speaker levels to original values and disconnecting...');
            await Promise.all(
                Object.keys(initialSpeakerLevels).map(async (speaker) => {
                    let originalLevel = initialSpeakerLevels[speaker];
                    let formattedLevel = originalLevel % 1 === 0 ? originalLevel.toFixed(0) : (originalLevel * 10).toFixed(0);
                    console.log(`Resetting ${speaker} to original level: ${originalLevel - 50}dB`);
                    await connection.send(`SSLEV${speaker} ${formattedLevel}\x0D`).catch(err => console.error(`SSLEV${speaker} reset command error:`, err));
                })
            );
        };
        process.on('SIGINT', async () => {
            await resetSpeakerLevels();
            console.log('Process exiting...');
            process.exit();
        });
        process.on('exit', () => {
            console.log('Process exited.');
        });
        setInterval(async () => {await getAVRInfo();}, 2000);
    } catch (err) {
        console.error('Telnet connection attempt:', err.message);
    }
};

(async () => {
    await loadJSONData();
    if (!jsonData) {
        console.error("JSON data could not be loaded. Exiting process.");
        return;
    }
    //console.log(process.argv);
    if (process.argv[3] && process.argv[2] === '-f') {
        deviceIP = process.argv[3];
        console.log(`Forcing AVR IP to: ${deviceIP}`);
        foundAVR = true;
        connectToAVR(deviceIP);
    } else {
        while(true) {
            await searchForAVR();
            if (foundAVR) {
                model = await getModel(upnpLocation);
                console.log(`AVR Model found: ${model}`);
                if (model === jsonData.targetModelName) {
                    console.log("Matching AVR model found!");
                    break;
                } else {
                    notDM_AVRIPs.push(denonIP);
                }
            }
        }
        console.log(`Connecting to: ${denonIP}`);
        connectToAVR(denonIP);
    }
})();

client.on('response', (headers, statusCode, rinfo) => {
    deviceIP = rinfo.address;
    if (localIPs.includes(deviceIP) || notDM_AVRIPs.includes(deviceIP)) {
        return;
    }
    const isDenonOrMarantz = (
        (headers.SERVER && (headers.SERVER.includes('Denon') || headers.SERVER.includes('Marantz'))) ||
        (headers.LOCATION && headers.LOCATION.includes('/upnp/desc/aios_device')) ||
        (headers.USN && headers.USN.toLowerCase().includes('denon')) ||
        (headers.USN && headers.USN.toLowerCase().includes('marantz')) ||
        (headers.ST && headers.ST.toLowerCase().includes('denon')) ||
        (headers.ST && headers.ST.toLowerCase().includes('marantz'))
    );
    if (isDenonOrMarantz) { 
        //console.log(`Potential AV Receiver found at: ${deviceIP}`);
        denonIP = rinfo.address;
        upnpLocation = headers.LOCATION;
        foundAVR = true;
    } else {
        notDM_AVRIPs.push(deviceIP);
        //console.log(notDM_AVRIPs);
    }
});

const searchForAVR = () => {
    const ssdpTimeOut = 5000;
    console.log(`Searching for: ${jsonData.targetModelName}...`);
    return new Promise((resolve) => {
        client.search('ssdp:all');
        //client.search('urn:schemas-denon-com:device:AiosDevice:1');
        //client.search('urn:schemas-denon-com:service:ACT:1');
        setTimeout(() => {
            client.stop();
            resolve();
        }, ssdpTimeOut);
    })
};

async function getModel(url) {
    return await fetch(url)
    .then(response => {
        return response.text();
    })
    .then(responseText => {
        lines = responseText.split(/\r?\n/);
        let i = 0;
        modelName = '';
        while (line = lines[i++]) {
            if (line.includes("modelName")) {
                modelName = line.split("<modelName>")[1].split("</modelName>")[0];
                break;
            }
        }
        return modelName;
    })
    .catch(error => {
        console.error(`Error getting ${url}: ` + error)
    });
}

function log(message) {
    if (!silentMode) {
        console.log(message);
}};

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

setTimeout(() => {client.stop();}, 500);
