/**
    Copyright MillieSoft 2016. You may use this skill for personal use, but may not submit it or any derivatives to Amazon for certification.

    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
        http://aws.amazon.com/apache2.0/
    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

var username = "{enter your username}";
var password = "{enter your encoded password}";
var PK_Device = "";  // if you want to use a specific device, enter it's device ID here

var https = require('https');
var http = require('http');
var log = log;
var generateControlError = generateControlError;

var Server_Device = "";
/**
 * Main entry point.
 * Incoming events from Alexa Lighting APIs are processed via this method.
 */
exports.handler = function (event, context) {
    switch (event.header.namespace) {

        case 'Alexa.ConnectedHome.Discovery':
            handleDiscovery(event, context);
        break;

        case 'Alexa.ConnectedHome.Control':
            handleControl(event, context);
        break;

        case 'Alexa.ConnectedHome.System':
            if (event.header.name=="HealthCheckRequest"){
                var headers = {
                    namespace: 'Alexa.ConnectedHome.System',
                    name: 'HealthCheckResponse',
                    payloadVersion: '2',
                    messageId: generateUUID()
                };
                var payloads = {
                    "isHealthy": true,
                    "description": "The system is currently healthy"
                };
                var result = {
                    header: headers,
                    payload: payloads
                };

                context.succeed(result);
            }
        break;

		/**
		 * We received an unexpected message
		 */
        default:
            // Warning! Logging this in production might be a security problem.
            log('Err', 'No supported namespace: ' + event.header.namespace);
            context.fail('Something went wrong');
        break;
    }
};

function generateUUID(){
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d/16);
        return (c =='x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}


/**
 * This method is invoked when we receive a "Discovery" message from Alexa Connected Home Skill.
 * We are expected to respond back with a list of appliances that we have discovered for a given
 * customer.
 */
function handleDiscovery(event, context) {
var headers = {
        namespace: 'Alexa.ConnectedHome.Discovery',
        name: 'DiscoverAppliancesResponse',
        payloadVersion: '2',
        messageId: generateUUID()
    };

    var accessToken = event.payload.accessToken.trim();

    var appliances = [];
    getVeraSession(username,password,PK_Device,function (ServerRelay,RelaySessionToken,PK_Device){
        getStatuses(ServerRelay,PK_Device,RelaySessionToken,function (statusText){
            var Status = parseJson(statusText,"status");
            var allDevices = Status.devices;
            var allRooms = Status.rooms;
            var allScenes = Status.scenes;
            var actions = [];
            var roomName = "Unknown Room";
            var applicanceId = "";
        deviceLoop:
          for(var i = 0; i < allDevices.length; i++) {
            var device = allDevices[i];

            if(device.name.indexOf("_") !== 0){
                roomName = "Unknown Room";
                for (var j = 0;j<allRooms.length;j++){
                    if(allRooms[j].id == device.room){
                        roomName = allRooms[j].name;
                        break;
                    }
                }

            var deviceCategory = "Unknown type of device";
            applicanceId = device.id.toString();
            switch (device.category){
                case 2:
                    deviceCategory = "Dimmable Switch";
                    actions = ["turnOff", "turnOn","setPercentage","incrementPercentage","decrementPercentage"];
                    break;
                case 3:
                    deviceCategory = "Switch";
                    actions = ["turnOff", "turnOn"];
                    break;
                case 4:
                    deviceCategory = "Sensor";
                    continue deviceLoop;
                case 5:
                    deviceCategory = "Thermostat";
                    applicanceId = "T"+device.id.toString();
                    actions = ["setTargetTemperature", "decrementTargetTemperature","incrementTargetTemperature"];
                    break;
                case 6:
                    deviceCategory = "Camera";
                    continue deviceLoop;
                case 11:
                    deviceCategory = "Generic IO";
                    continue deviceLoop;
                case 16:
                    deviceCategory = "Humidity Sensor";
                    continue deviceLoop;
                case 17:
                    deviceCategory = "Temperature Sensor";
                    continue deviceLoop;
                case 18:
                    deviceCategory = "Light Sensor";
                    continue deviceLoop;
                default:
                    continue deviceLoop;
            }

            var applianceDiscovered = {
            applianceId: applicanceId,
            manufacturerName:"vera",
            modelName:"vera "+deviceCategory,
            version: "1",
            friendlyName: device.name,
            friendlyDescription: deviceCategory+" "+device.name+" in "+roomName,
            isReachable: true,
            "actions":actions,
            additionalApplianceDetails: {}
            };
            appliances.push(applianceDiscovered);
            }

          }

        actions = ["turnOff", "turnOn"];
        for(var k = 0; k < allScenes.length; k++) {
            var scene = allScenes[k];
            if(scene.name.indexOf("_") !== 0){
                roomName = "Unknown Room";
                for (var j2 = 0;j2<allRooms.length;j2++){
                    if(allRooms[j2].id == scene.room){
                        roomName = allRooms[j2].name;
                        break;
                    }
                }
                applicanceId = "S"+scene.id.toString();

            var applianceDiscovered2 = {
            applianceId: applicanceId,
            manufacturerName:"vera",
            modelName:"vera scene",
            version: "1",
            friendlyName: scene.name,
            friendlyDescription: scene.name+" Scene in "+roomName,
            isReachable: true,
            "actions":actions,
            additionalApplianceDetails: {}
            };
            appliances.push(applianceDiscovered2);
            }

        }

    appliances.sort(function(a, b) {
      return a.friendlyName.localeCompare(b.friendlyName);
    });
    var payloads = {
        discoveredAppliances: appliances
    };
    var result = {
        header: headers,
        payload: payloads
    };

    context.succeed(result);


        });
    });

}

/**
 * Control events are processed here.
 * This is called when Alexa requests an action (IE turn off appliance).
 */
function handleControl(event, context) {
    var requestType=event.header.name;
    var responseType=event.header.name.replace("Request","Confirmation");
                var headers = {
                    namespace: "Alexa.ConnectedHome.Control",
                    name: responseType,
                    payloadVersion: "2",
                    messageId: generateUUID()
                };
                var result = {
                    header: headers,
                    payload: {}
                };


    getVeraSession(username,password,PK_Device,function(ServerRelay,RelaySessionToken,PK_Device){

        var applianceId = event.payload.appliance.applianceId;

        if (typeof applianceId !== "string" ) {
            log("event payload is invalid",event);
            context.fail(generateControlError(responseType, 'UNEXPECTED_INFORMATION_RECEIVED', 'Input is invalid'));
        }

        if (event.header.name == 'TurnOnRequest') {
            if(applianceId.indexOf("S")===0){
              runScene(ServerRelay,PK_Device,RelaySessionToken,applianceId,function(response){
                if(response.indexOf("ERROR")===0){
                    context.fail(generateControlError(responseType, 'TargetHardwareMalfunctionError', response));
                } else {
                    context.succeed(result);
                }
            });
            }  else {
                switchDevice(ServerRelay,PK_Device,RelaySessionToken,applianceId,1,function(response){
                if(response.indexOf("ERROR")===0){
                    context.fail(generateControlError(responseType, 'TargetHardwareMalfunctionError', response));
                } else {
                    context.succeed(result);
                }
                });
            }
        } else if (event.header.name == 'TurnOffRequest') {
            if (applianceId.indexOf("S")===0){
              stopScene(ServerRelay,PK_Device,RelaySessionToken,applianceId,function(response){
                if(response.indexOf("ERROR")===0){
                    context.fail(generateControlError(responseType, 'TargetHardwareMalfunctionError', response));
                } else {
                    context.succeed(result);
               }
            });
            } else {
                switchDevice(ServerRelay,PK_Device,RelaySessionToken,applianceId,0,function(response){
                if(response.indexOf("ERROR")===0){
                    context.fail(generateControlError(responseType, 'TargetHardwareMalfunctionError', response));
                } else {
                    context.succeed(result);
                }
            });
        }
        } else if (event.header.name === 'SetPercentageRequest') {
            var targetDimLevel=event.payload.percentageState.value;

            dimDevice(ServerRelay,PK_Device,RelaySessionToken,applianceId,targetDimLevel.toFixed(),function(response){
                if(response.indexOf("ERROR")===0){
                  context.fail(generateControlError(responseType, 'TargetHardwareMalfunctionError', response));
                } else {
                context.succeed(result);
                }
            });
        } else if (event.header.name === 'IncrementPercentageRequest') {
            getCurrentDimLevel(ServerRelay,PK_Device,RelaySessionToken,applianceId,function(currentDimLevelString){
                var currentDimLevel=Number(currentDimLevelString);
                if(isNaN(currentDimLevel)){
                            context.fail(generateControlError(responseType, 'TargetConnectivityUnstableError', 'Could not get current dim level'));
                } else {
                  var targetDimLevel=currentDimLevel+event.payload.deltaPercentage.value;
                  if(targetDimLevel>100||targetDimLevel<0){
                            context.fail(generateControlError(responseType, 'UnwillingToSetValueError', 'Out of range'));
                  }
                dimDevice(ServerRelay,PK_Device,RelaySessionToken,applianceId,targetDimLevel.toFixed(),function(response){
                if(response.indexOf("ERROR")===0){
                  context.fail(generateControlError(responseType, 'TargetHardwareMalfunctionError', response));
                } else {
                context.succeed(result);
                }
            });
                }
            });
        } else if (event.header.name === 'DecrementPercentageRequest') {
            getCurrentDimLevel(ServerRelay,PK_Device,RelaySessionToken,applianceId,function(currentDimLevelString){
                var currentDimLevel=Number(currentDimLevelString);
                if(isNaN(currentDimLevel)){
                            context.fail(generateControlError(responseType, 'TargetConnectivityUnstableError', 'Could not get current dim level'));
                } else {
                  var targetDimLevel=currentDimLevel-event.payload.deltaPercentage.value;
                  if(targetDimLevel>100||targetDimLevel<0){
                            context.fail(generateControlError(responseType, 'UnwillingToSetValueError', 'Out of range'));
                  }
                dimDevice(ServerRelay,PK_Device,RelaySessionToken,applianceId,targetDimLevel.toFixed(),function(response){
                if(response.indexOf("ERROR")===0){
                  context.fail(generateControlError(responseType, 'TargetHardwareMalfunctionError', response));
                } else {
                context.succeed(result);
                }
            });
                }
            });
        } else if (event.header.name === 'SetTargetTemperatureRequest') {
                var targetTemperature=event.payload.targetTemperature.value;
                setTemperature(ServerRelay,PK_Device,RelaySessionToken,applianceId,targetTemperature.toFixed(),function(response){
                    if(response.indexOf("ERROR")===0){
                        context.fail(generateControlError(responseType, 'TargetHardwareMalfunctionError', response));
                    } else {
                    var payloads = {achievedState: {targetTemperature:{value: targetTemperature},mode:{value:"AUTO"}},previousState: {targetTemperature:{value: targetTemperature},mode:{value:"AUTO"}},targetTemperature:{value: targetTemperature},temperatureMode:{value:"AUTO"}};
                    var result = {header: headers,payload: payloads};
                    context.succeed(result);
                    }
                });
        } else if (event.header.name === 'IncrementTargetTemperatureRequest') {
            getCurrentTemperature(ServerRelay,PK_Device,RelaySessionToken,applianceId,function(currentTemperatureString){
                var currentTemperature=Number(currentTemperatureString);
                if(isNaN(currentTemperature)){
                    context.fail(generateControlError(responseType, 'TargetConnectivityUnstableError', 'Could not get current temperature'));
                } else {
                  var targetTemperature=currentTemperature+event.payload.deltaTemperature.value;
                  setTemperature(ServerRelay,PK_Device,RelaySessionToken,applianceId,targetTemperature.toFixed(),function(response){
                if(response.indexOf("ERROR")===0){
                    context.fail(generateControlError(responseType, 'TargetHardwareMalfunctionError', response));
                } else {
                    var payloads = {achievedState: {targetTemperature:{value: targetTemperature},mode:{value:"AUTO"}},previousState: {targetTemperature:{value: currentTemperature},mode:{value:"AUTO"}},targetTemperature:{value: targetTemperature},temperatureMode:{value:"AUTO"}};
                  var result = {header: headers,payload: payloads};
                  context.succeed(result);
                }
            });}});
        } else if (event.header.name === 'DecrementTargetTemperatureRequest') {
            getCurrentTemperature(ServerRelay,PK_Device,RelaySessionToken,applianceId,function(currentTemperatureString){
                var currentTemperature=Number(currentTemperatureString);
                if(isNaN(currentTemperature)){
                    context.fail(generateControlError(responseType, 'TargetConnectivityUnstableError', 'Could not get current temperature'));
                } else {
                  var targetTemperature=currentTemperature-event.payload.deltaTemperature.value;
                  setTemperature(ServerRelay,PK_Device,RelaySessionToken,applianceId,targetTemperature.toFixed(),function(response){
                if(response.indexOf("ERROR")===0){
                    context.fail(generateControlError(responseType, 'TargetHardwareMalfunctionError', response));
                } else {
                    var payloads = {achievedState: {targetTemperature:{value: targetTemperature},mode:{value:"AUTO"}},previousState: {targetTemperature:{value: currentTemperature},mode:{value:"AUTO"}},targetTemperature:{value: targetTemperature},temperatureMode:{value:"AUTO"}};
                  var result = {header: headers,payload: payloads};
                  context.succeed(result);
                }
            });}});

        } else {
            // error
        }

    });

}

function getVeraSession(username,password,device,cbfunc){
        getAuthToken( username,password, function ( AuthToken, AuthSigToken, Server_Account ) {
            var AuthTokenDecoded = new Buffer(AuthToken, 'base64');
            var AuthTokenJson=parseJson(AuthTokenDecoded,"auth");
            var PK_Account = AuthTokenJson.PK_Account;
		    getSessionToken( Server_Account, AuthToken, AuthSigToken, function(AuthSessionToken) {
			    getDeviceList(Server_Account,PK_Account,AuthSessionToken,function(deviceTable) {
					var Devices = parseJson(deviceTable,"device");
					if(device==""){
					  device=Devices.Devices[0].PK_Device;
					  Server_Device=Devices.Devices[0].Server_Device;
					} else {
					  var deviceArrayLength = Devices.Devices.length;
                      for (var i = 0; i < deviceArrayLength; i++) {
                        if(Devices.Devices[i].PK_Device==device){
                          Server_Device=Devices.Devices[i].Server_Device;
                          break;
                        }
                      }
					}

					getSessionToken(Server_Device, AuthToken, AuthSigToken, function(ServerDeviceSessionToken) {
				        getServerRelay(Server_Device,device,ServerDeviceSessionToken,function(sessionRelayText){
					        var Relays = parseJson(sessionRelayText,"relays");
					        var ServerRelay=Relays.Server_Relay;
					        getSessionToken(ServerRelay, AuthToken, AuthSigToken, function(RelaySessionToken) {
    					        cbfunc(ServerRelay,RelaySessionToken,device);
					        });
					    });
					});
				});
			});
		});
}

function getAuthToken( user, pwd, cbfunc )
{

    var keepAliveAgent = new https.Agent({ keepAlive: true });
    var options = {hostname: 'vera-us-oem-autha.mios.com',path: '/autha/auth/username/'+user+'?SHA1Password='+pwd+'&PK_Oem=1',port:443,agent:keepAliveAgent};


    https.get(options, function(response) {
        var body = '';
        response.on('data', function(d) { body += d;});
        response.on('end', function() {
        var result = parseJson(body,"auth");
		var AuthToken  		= result.Identity;
		var AuthSigToken    = result.IdentitySignature;
		var Server_Account	= result.Server_Account;
		cbfunc(AuthToken,AuthSigToken,Server_Account);
        });

        response.on("error",function(e){log("getAuthToken","Got error: " + e.message);});
    });
}

function getSessionToken(server, AuthToken, AuthSigToken, cbfunc )
{
    var keepAliveAgent = new https.Agent({ keepAlive: true });
    var options = {hostname: server,port: 443,path: '/info/session/token',headers: {"MMSAuth":AuthToken,"MMSAuthSig":AuthSigToken},agent:keepAliveAgent};

    https.get(options, function(response) {
        var SessionToken = '';
        response.on('data', function(d) {SessionToken += d;});
        response.on('end', function() {cbfunc(SessionToken);});
        response.on("error",function(e){log("Got error: " + e.message);});
    });
}



function getDeviceList( Server_Account,PK_Account,SessionToken, cbfunc )
{
    var keepAliveAgent = new https.Agent({ keepAlive: true });
	var options = {	hostname: Server_Account,port: 443,path: '/account/account/account/'+PK_Account+'/devices',headers: {"MMSSession":SessionToken},agent:keepAliveAgent};

	https.get(options, function(response) {
        var body = '';
        response.on('data', function(d) {body += d;});
        response.on('end', function() {cbfunc(body);});
	    response.on("error",function(e){log("Got error: " + e.message); });
	});

}

function getServerRelay( ServerDevice,PK_Device,SessionToken, cbfunc )
{
    var keepAliveAgent = new https.Agent({ keepAlive: true });
	var options = {hostname: ServerDevice,port: 443,path: '/device/device/device/'+PK_Device,headers: {"MMSSession":SessionToken},agent:keepAliveAgent};

	https.get(options, function(response) {
        var body = '';
        response.on('data', function(d) {body += d;});
        response.on('end', function() {cbfunc(body);});
	    response.on("error",function(e){log("Got error: " + e.message); });
	});
}


function getStatuses( ServerRelay,PK_Device,RelaySessionToken, cbfunc )
{
    runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=sdata',ServerRelay,RelaySessionToken,function(response){
        cbfunc(response);
    });
}

function switchDevice( ServerRelay,PK_Device,RelaySessionToken, deviceId,deviceState,cbfunc )
{
    runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&DeviceNum='+deviceId+'&serviceId=urn:upnp-org:serviceId:SwitchPower1&action=SetTarget&newTargetValue='+deviceState+'&output_format=json',ServerRelay,RelaySessionToken,function(response){
        cbfunc(response);
    });
}

function runScene( ServerRelay,PK_Device,RelaySessionToken, sceneId,cbfunc )
{
    runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&serviceId=urn:micasaverde-com:serviceId:HomeAutomationGateway1&action=RunScene&SceneNum='+sceneId.substring(1)+'&output_format=json',ServerRelay,RelaySessionToken,function(response){
        cbfunc(response);
    });
}

function stopScene( ServerRelay,PK_Device,RelaySessionToken, sceneId,cbfunc )
{
    runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&serviceId=urn:micasaverde-com:serviceId:HomeAutomationGateway1&action=SceneOff&SceneNum='+sceneId.substring(1)+'&output_format=json',ServerRelay,RelaySessionToken,function(response){
        cbfunc(response);
    });
}

function dimDevice( ServerRelay,PK_Device,RelaySessionToken, deviceId,dimLevel,cbfunc )
{
    runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&DeviceNum='+deviceId+'&serviceId=urn:upnp-org:serviceId:Dimming1&action=SetLoadLevelTarget&newLoadlevelTarget='+dimLevel+'&output_format=json',ServerRelay,RelaySessionToken,function(response){
        cbfunc(response);
    });
}

function getCurrentDimLevel( ServerRelay,PK_Device,RelaySessionToken, deviceId,cbfunc )
{
    runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=variableget&DeviceNum='+deviceId+'&serviceId=urn:upnp-org:serviceId:Dimming1&Variable=LoadLevelTarget',ServerRelay,RelaySessionToken,function(response){
        cbfunc(response);
    });
}

function getCurrentTemperature( ServerRelay,PK_Device,RelaySessionToken, deviceId,cbfunc )
{
    runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=variableget&DeviceNum='+deviceId.substring(1)+'&serviceId=urn:upnp-org:serviceId:TemperatureSetpoint1&Variable=CurrentSetpoint',ServerRelay,RelaySessionToken,function(response){
        cbfunc(response);
    });
}

function setTemperature( ServerRelay,PK_Device,RelaySessionToken, deviceId,temperature,cbfunc )
{
    runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&DeviceNum='+deviceId.substring(1)+'&serviceId=urn:upnp-org:serviceId:TemperatureSetpoint1&action=SetCurrentSetpoint&NewCurrentSetpoint='+temperature+'&output_format=json',ServerRelay,RelaySessionToken,function(response){
        cbfunc(response);
    });
}

function runVeraCommand(path, ServerRelay,RelaySessionToken,cbfunc ){
    var keepAliveAgent = new https.Agent({ keepAlive: true });
	var options = {hostname: ServerRelay,port: 443,headers: {"MMSSession":RelaySessionToken},path: path,agent:keepAliveAgent};

	https.get(options, function(response) {
        var body = '';
        response.on('data', function(d) {body += d;});
        response.on('end', function() {cbfunc(body);});
        response.on("error",function(e){log("Got error: " + e.message); });
	});
}


/**
 * Utility functions.
 */
function parseJson(jsonMessage,requestType){
    try {
        return JSON.parse(jsonMessage);
    } catch (ex)
    {log("Parsing Error","error parsing JSON message of type "+requestType+": "+jsonMessage);
    console.error(ex);}
}

function log(title, msg) {
    console.log('*************** ' + title + ' *************');
    console.log(msg);
    console.log('*************** ' + title + ' End*************');
}

function generateControlError(name, code, description) {
    var headers = {
        namespace: 'Control',
        name: name,
        payloadVersion: '1'
    };

    var payload = {
        exception: {
            code: code,
            description: description
        }
    };

    var result = {
        header: headers,
        payload: payload
    };

    return result;
}
