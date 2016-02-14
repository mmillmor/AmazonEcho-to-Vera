/**
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
        http://aws.amazon.com/apache2.0/
    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

var username="{enter your username}";
var password="{enter your encoded password}";

var https = require('https');
var http = require('http');
var log = log;
var generateControlError = generateControlError;
/**
 * Main entry point.
 * Incoming events from Alexa Lighting APIs are processed via this method.
 */
exports.handler = function(event, context) {

    switch (event.header.namespace) {

        case 'Discovery':
            handleDiscovery(event, context);
        break;

        case 'Control':
            handleControl(event, context);
        break;

        case 'System':
            if(event.header.name=="HealthCheckRequest"){
                var headers = {
                    namespace: 'System',
                    name: 'HealthCheckResponse',
                    payloadVersion: '1'
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

/**
 * This method is invoked when we receive a "Discovery" message from Alexa Connected Home Skill.
 * We are expected to respond back with a list of appliances that we have discovered for a given
 * customer.
 */
function handleDiscovery(event, context) {

    var headers = {
        namespace: 'Discovery',
        name: 'DiscoverAppliancesResponse',
        payloadVersion: '1'
    };


    var appliances = [];
    getVeraSession(username,password,function(ServerRelay,RelaySessionToken,PK_Device){
        getStatuses(ServerRelay,PK_Device,RelaySessionToken,function(statusText){
          var Status = parseJson(statusText,"status");
          var allDevices=Status.devices;
          var allRooms=Status.rooms;
          var allScenes=Status.scenes;
          deviceLoop:
          for(var i = 0; i < allDevices.length; i++) {
            var device = allDevices[i];

            if(device.name.indexOf("_")!==0){
                var roomName="Unknown Room";
                for (var j=0;j<allRooms.length;j++){
                    if(allRooms[j].id==device.room){
                        roomName=allRooms[j].name;
                        break;
                    }
                }

            var deviceCategory="Unknown type of device";
            var applicanceId=device.id.toString();
            switch (device.category){
                case 2:
                    deviceCategory="Dimmable Switch";
                    break;
                case 3:
                    deviceCategory="Switch";
                    break;
                case 4:
                    deviceCategory="Sensor";
                    continue deviceLoop;
                case 5:
                    deviceCategory="Thermostat";
                    applicanceId="T"+device.id.toString();
                    break;
                case 6:
                    deviceCategory="Camera";
                    continue deviceLoop;
                case 11:
                    deviceCategory="Generic IO";
                    continue deviceLoop;
                case 16:
                    deviceCategory="Humidity Sensor";
                    continue deviceLoop;
                case 17:
                    deviceCategory="Temperature Sensor";
                    continue deviceLoop;
                case 17:
                    deviceCategory="Light Sensor";
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
            additionalApplianceDetails: {}
            };
            appliances.push(applianceDiscovered);
            }

          }

        for(var k = 0; k < allScenes.length; k++) {
            var scene = allScenes[k];
            if(scene.name.indexOf("_")!==0){

            var applianceDiscovered2 = {
            manufacturerName:"vera",
            modelName:"vera scene",
            version: "1",
            applianceId: "S"+scene.id.toString(),
            friendlyName: scene.name + " Scene",
            isReachable: true,
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

    // Warning! Logging this in production might be a security problem.
 //   log('Discovery', JSON.stringify(result));

    context.succeed(result);


        });
    });

}

/**
 * Control events are processed here.
 * This is called when Alexa requests an action (IE turn off appliance).
 */
function handleControl(event, context) {

                var headers = {
                    namespace: event.header.namespace,
                    name: event.header.name.replace("Request","Response"),
                    payloadVersion: '1'
                };
                var payloads = {
                    success: true
                };
                var result = {
                    header: headers,
                    payload: payloads
                };

    getVeraSession(username,password,function(ServerRelay,RelaySessionToken,PK_Device){

    if (event.header.namespace !== 'Control' || !(event.header.name == 'SwitchOnOffRequest' ||event.header.name == 'AdjustNumericalSettingRequest') ) {
        context.fail(generateControlError(event.header.name.replace("Request","Response"), 'UNSUPPORTED_OPERATION', 'Unrecognized operation'));
    }

        var applianceId = event.payload.appliance.applianceId;

        if (typeof applianceId !== "string" ) {
            log("event payload is invalid",event);
            context.fail(generateControlError(event.header.name.replace("Request","Response"), 'UNEXPECTED_INFORMATION_RECEIVED', 'Input is invalid'));
        }

    if (event.header.name === 'SwitchOnOffRequest') {

        if (event.payload.switchControlAction === 'TURN_ON') {
            if(applianceId.indexOf("S")===0){
              runScene(ServerRelay,PK_Device,RelaySessionToken,applianceId,function(response){
                if(response.indexOf("ERROR")===0){
                    log("scene failed",result);
                  context.fail(generateControlError("SwitchOnOffResponse", 'TARGET_HARDWARE_MALFUNCTION', response));
                } else {
                    log("scene succeeded",result);
                context.succeed(result);
               }
            });
            } else if (applianceId.indexOf("T")===0){
                  context.fail(generateControlError("SwitchOnOffResponse", 'UNSUPPORTED_OPERATION', response));
            } else {

            switchDevice(ServerRelay,PK_Device,RelaySessionToken,applianceId,1,function(response){
                if(response.indexOf("ERROR")===0){
                  context.fail(generateControlError("SwitchOnOffResponse", 'TARGET_HARDWARE_MALFUNCTION', response));
                } else {
                context.succeed(result);
               }
            });
            }
        } else if (event.payload.switchControlAction === "TURN_OFF") {
            if (applianceId.indexOf("T")===0||applianceId.indexOf("S")===0){
                  context.fail(generateControlError("SwitchOnOffResponse", 'UNSUPPORTED_OPERATION', response));
            } else {
            switchDevice(ServerRelay,PK_Device,RelaySessionToken,applianceId,0,function(response){
                if(response.indexOf("ERROR")===0){
                  context.fail(generateControlError("SwitchOnOffResponse", 'TARGET_HARDWARE_MALFUNCTION', response));
                } else {
                var payloads = {
                    success: true
                };
                var result = {
                    header: headers,
                    payload: payloads
                };

                context.succeed(result);
                }

            });
        }
      }
    } else if (event.header.name === 'AdjustNumericalSettingRequest') {
        if (applianceId.indexOf("T")===0){
          if (event.payload.adjustmentType === 'RELATIVE') {
            getCurrentTemperature(ServerRelay,PK_Device,RelaySessionToken,applianceId,function(currentTemperature){
                if(isNaN(currentTemperature)){
                    context.fail(generateControlError("AdjustNumericalSettingResponse", 'UNEXPECTED_INFORMATION_RECEIVED', 'Could not get current dim level'));
                } else {
                  var targetTemperature=currentTemperature+event.payload.adjustmentValue;
                  setTemperature(ServerRelay,PK_Device,RelaySessionToken,applianceId,targetTemperature.toFixed(),function(response){
                if(response.indexOf("ERROR")===0){
                    context.fail(generateControlError("AdjustNumericalSettingResponse", 'TARGET_HARDWARE_MALFUNCTION', response));
                } else {
                  var payloads = {success: true};
                  var result = {header: headers,payload: payloads};
                  context.succeed(result);
                }
            });

                }
            });
        } else {
            var targetTemperature=event.payload.adjustmentValue;
            setTemperature(ServerRelay,PK_Device,RelaySessionToken,applianceId,targetTemperature.toFixed(),function(response){
                if(response.indexOf("ERROR")===0){
                    context.fail(generateControlError("AdjustNumericalSettingResponse", 'TARGET_HARDWARE_MALFUNCTION', response));
                } else {
                var payloads = {success: true};
                var result = {header: headers,payload: payloads};
                context.succeed(result);
                }
            });
        }
        } else {

        if (event.payload.adjustmentType === 'RELATIVE') {
            getCurrentDimLevel(ServerRelay,PK_Device,RelaySessionToken,applianceId,function(currentDimLevel){
                if(isNaN(currentDimLevel)){
                            context.fail(generateControlError("AdjustNumericalSettingResponse", 'UNEXPECTED_INFORMATION_RECEIVED', 'Could not get current dim level'));
                } else {
                  var targetDimLevel=currentDimLevel+event.payload.adjustmentValue;
                  if(targetDimLevel>100||targetDimLevel<0){
                            context.fail(generateControlError("AdjustNumericalSettingResponse", 'TARGET_SETTING_OUT_OF_RANGE', 'Out of range'));
                  }
                dimDevice(ServerRelay,PK_Device,RelaySessionToken,applianceId,targetDimLevel.toFixed(),function(response){
                if(response.indexOf("ERROR")===0){
                  context.fail(generateControlError("AdjustNumericalSettingResponse", 'TARGET_HARDWARE_MALFUNCTION', response));
                } else {
                var payloads = {success: true};
                var result = {header: headers,payload: payloads};
                context.succeed(result);
                }
            });
                }
            });
        } else {
            var targetDimLevel=event.payload.adjustmentValue;

            dimDevice(ServerRelay,PK_Device,RelaySessionToken,applianceId,targetDimLevel.toFixed(),function(response){
                if(response.indexOf("ERROR")===0){
                  context.fail(generateControlError("AdjustNumericalSettingResponse", 'TARGET_HARDWARE_MALFUNCTION', response));
                } else {
                var payloads = {success: true};
                var result = {header: headers,payload: payloads};
                context.succeed(result);
                }
            });
        }

        }

    }
    });

}

function getVeraSession(username,password,cbfunc){
        getAuthToken( username,password, function ( AuthToken, AuthSigToken, Server_Account ) {
            var AuthTokenDecoded = new Buffer(AuthToken, 'base64');
            var AuthTokenJson=parseJson(AuthTokenDecoded,"auth");
            var PK_Account = AuthTokenJson.PK_Account;
		    getSessionToken( Server_Account, AuthToken, AuthSigToken, function(AuthSessionToken) {
			    getDeviceList(Server_Account,PK_Account,AuthSessionToken,function(deviceTable) {
					var Devices = parseJson(deviceTable,"device");
					var PK_Device=Devices.Devices[0].PK_Device;
					var Server_Device=Devices.Devices[0].Server_Device;
					getSessionToken(Server_Device, AuthToken, AuthSigToken, function(ServerDeviceSessionToken) {
				        getServerRelay(Server_Device,PK_Device,ServerDeviceSessionToken,function(sessionRelayText){
					        var Relays = parseJson(sessionRelayText,"relays");
					        var ServerRelay=Relays.Server_Relay;
					        getSessionToken(ServerRelay, AuthToken, AuthSigToken, function(RelaySessionToken) {
    					        cbfunc(ServerRelay,RelaySessionToken,PK_Device);
					        });
					    });
					});
				});
			});
		});
}

function getAuthToken( user, pwd, cbfunc )
{

var options = {
  hostname: 'vera-us-oem-autha.mios.com',
  path: '/autha/auth/username/'+user+'?SHA1Password='+pwd+'&PK_Oem=1',
  port:443
};

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
    var options = {
      hostname: server,
      port: 443,
      path: '/info/session/token',
      headers: {"MMSAuth":AuthToken,"MMSAuthSig":AuthSigToken}
    };
    https.get(options, function(response) {
        var SessionToken = '';
        response.on('data', function(d) {SessionToken += d;});
        response.on('end', function() {cbfunc(SessionToken);});
        response.on("error",function(e){log("Got error: " + e.message);});
    });
}



function getDeviceList( Server_Account,PK_Account,SessionToken, cbfunc )
{
	var options = {
	hostname: Server_Account,
	port: 443,
	path: '/account/account/account/'+PK_Account+'/devices',
	headers: {"MMSSession":SessionToken}
	};

	https.get(options, function(response) {
        var body = '';
        response.on('data', function(d) {body += d;});
        response.on('end', function() {cbfunc(body);});
	    response.on("error",function(e){log("Got error: " + e.message); });
	});

}

function getServerRelay( ServerDevice,PK_Device,SessionToken, cbfunc )
{
	var options = {
	hostname: ServerDevice,
	port: 443,
	path: '/device/device/device/'+PK_Device,
	headers: {"MMSSession":SessionToken}
	};

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
	var options = {hostname: ServerRelay,port: 443,headers: {"MMSSession":RelaySessionToken},
	path: path};
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
    {log("Parsing Error","error parsing JSON message of type "+requestType+": "+jsonMessage);}
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
