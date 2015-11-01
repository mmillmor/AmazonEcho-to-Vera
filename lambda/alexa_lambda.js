/**
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
        http://aws.amazon.com/apache2.0/
    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

var https = require('https');
var http = require('http');
var log = log;
var generateControlError = generateControlError;

/**
 * Main entry point.
 * Incoming events from Alexa Lighting APIs are processed via this method.
 */
exports.handler = function(event, context) {

    // Warning! Logging this in production might be a security problem.
 //   log('Input', event);

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

    var accessToken = event.payload.accessToken.trim();

    getLoginDetails(accessToken,function(userDetailsText){
        var userDetails=JSON.parse(userDetailsText);
        if(typeof(userDetails.username)!=="undefined"){

    var appliances = [];
    getVeraSession(userDetails.username,userDetails.password,function(ServerRelay,RelaySessionToken,PK_Device){
        getStatuses(ServerRelay,PK_Device,RelaySessionToken,function(statusText){
          var Status = JSON.parse(statusText);
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
                    continue deviceLoop;
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
            applianceId: device.id.toString(),
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
        } else {

          var payload = {
            exception: {
              code: 'INVALID_ACCESS_TOKEN',
              description: 'Could not find user'
            }
          };

          var result = {
            header: headers,
            payload: payload
          };
          context.fail(result);
        }
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
    var accessToken = event.payload.accessToken.trim();

    getLoginDetails(accessToken,function(userDetailsText){
        var userDetails=JSON.parse(userDetailsText);
        if(typeof(userDetails.username)!=="undefined"){

    getVeraSession(userDetails.username,userDetails.password,function(ServerRelay,RelaySessionToken,PK_Device){


    if (event.header.namespace !== 'Control' || !(event.header.name == 'SwitchOnOffRequest' ||event.header.name == 'AdjustNumericalSettingRequest') ) {
        context.fail(generateControlError(event.header.name.replace("Request","Response"), 'UNSUPPORTED_OPERATION', 'Unrecognized operation'));
    }

        var applianceId = event.payload.appliance.applianceId;

        if (typeof applianceId !== "string" || typeof accessToken !== "string") {
            log("event payload is invalid");
            context.fail(generateControlError(event.header.name.replace("Request","Response"), 'UNEXPECTED_INFORMATION_RECEIVED', 'Input is invalid'));
        }

    if (event.header.name === 'SwitchOnOffRequest') {

        /**
         * Make a remote call to execute the action based on accessToken and the applianceId and the switchControlAction
         * Some other examples of checks:
         *	validate the appliance is actually reachable else return TARGET_OFFLINE error
         *	validate the authentication has not expired else return EXPIRED_ACCESS_TOKEN error
         * Please see the technical documentation for detailed list of errors
         */
        if (event.payload.switchControlAction === 'TURN_ON') {
            if(applianceId.indexOf("S")===0){
              runScene(ServerRelay,PK_Device,RelaySessionToken,applianceId,1,function(response){
                if(response.indexOf("ERROR")===0){
                  context.fail(generateControlError("SwitchOnOffResponse", 'TARGET_HARDWARE_MALFUNCTION', response));
                } else {
                context.succeed(result);
               }
            });
            }
            switchDevice(ServerRelay,PK_Device,RelaySessionToken,applianceId,1,function(response){
                if(response.indexOf("ERROR")===0){
                  context.fail(generateControlError("SwitchOnOffResponse", 'TARGET_HARDWARE_MALFUNCTION', response));
                } else {
                context.succeed(result);
               }
            });
        } else if (event.payload.switchControlAction === "TURN_OFF") {
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

                // Warning! Logging this with production data might be a security problem.
              //  log('Done with result', JSON.stringify(result));
                context.succeed(result);
                }

            });
        }



    } else if (event.header.name === 'AdjustNumericalSettingRequest') {
        var targetDimLevel=0;
        if (event.payload.adjustmentType === 'RELATIVE') {
            getCurrentDimLevel(ServerRelay,PK_Device,RelaySessionToken,applianceId,function(currentDimLevel){
                if(isNaN(currentDimLevel)){
                            context.fail(generateControlError("AdjustNumericalSettingResponse", 'UNEXPECTED_INFORMATION_RECEIVED', 'Could not get current dim level'));
                } else {
                  targetDimLevel=currentDimLevel+event.payload.adjustmentValue;
                  if(targetDimLevel>100||targetDimLevel<0){
                            context.fail(generateControlError("AdjustNumericalSettingResponse", 'TARGET_SETTING_OUT_OF_RANGE', 'Out of range'));
                  }
                }
            });
        } else {
            targetDimLevel=event.payload.adjustmentValue;
        }
            dimDevice(ServerRelay,PK_Device,RelaySessionToken,applianceId,targetDimLevel.toFixed(),function(response){
                         if(response.indexOf("ERROR")===0){
                  context.fail(generateControlError("AdjustNumericalSettingResponse", 'TARGET_HARDWARE_MALFUNCTION', response));
                } else {

                var payloads = {
                    success: true
                };
                var result = {
                    header: headers,
                    payload: payloads
                };

                // Warning! Logging this with production data might be a security problem.
               // log('Done with result', JSON.stringify(result));
                context.succeed(result);
                }

            });
        }

    });
} else {
            context.fail(generateControlError(event.header.name.replace("Request","Response"), 'INVALID_ACCESS_TOKEN', 'Could not find user'));
}
});

}



function getVeraSession(username,password,cbfunc){
		var authd11Server = "vera-us-oem-authd11.mios.com";
        getAuthToken( username,password, function ( AuthToken, AuthSigToken, Server_Account ) {
            var AuthTokenDecoded = new Buffer(AuthToken, 'base64');
            var AuthTokenJson=JSON.parse(AuthTokenDecoded);
            var PK_Account = AuthTokenJson.PK_Account;
		    getSessionToken( authd11Server, AuthToken, AuthSigToken, function(AuthSessionToken) {
			    getDeviceList(Server_Account,PK_Account,AuthSessionToken,function(deviceTable) {
					var Devices = JSON.parse(deviceTable);
					var PK_Device=Devices.Devices[0].PK_Device;
					var Server_Device=Devices.Devices[0].Server_Device;
					getSessionToken(Server_Device, AuthToken, AuthSigToken, function(ServerDeviceSessionToken) {
				        getServerRelay(Server_Device,PK_Device,ServerDeviceSessionToken,function(sessionRelayText){
					        var Relays = JSON.parse(sessionRelayText);
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
  hostname: 'vera-us-oem-authd11.mios.com',
  path: '/autha/auth/username/'+user+'?SHA1Password='+pwd+'&PK_Oem=1',
  port:443
};

//console.log("https://"+options["hostname"]+options["path"]);
https.get(options, function(response) {
        var body = '';
        response.on('data', function(d) { body += d;});
        response.on('end', function() {
        var result = JSON.parse(body);
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
        response.on('end', function() { cbfunc(SessionToken);});
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
	var options = {
	hostname: ServerRelay,
	port: 443,
	path: '/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=sdata',
	headers: {"MMSSession":RelaySessionToken}
	};

	https.get(options, function(response) {
        var body = '';
        response.on('data', function(d) {body += d;});
        response.on('end', function() {cbfunc(body);});
	    response.on("error",function(e){log("Got error: " + e.message); });
	});

}

function switchDevice( ServerRelay,PK_Device,RelaySessionToken, deviceId,deviceState,cbfunc )
{
	var options = {
	hostname: ServerRelay,
	port: 443,
	path: '/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&DeviceNum='+deviceId+'&serviceId=urn:upnp-org:serviceId:SwitchPower1&action=SetTarget&newTargetValue='+deviceState+'&output_format=json',
	headers: {"MMSSession":RelaySessionToken}
	};

	https.get(options, function(response) {
        var body = '';
        response.on('data', function(d) {body += d;});
        response.on('end', function() {cbfunc(body);});
	    response.on("error",function(e){log("Got error: " + e.message); });
	});
}

function dimDevice( ServerRelay,PK_Device,RelaySessionToken, deviceId,dimLevel,cbfunc )
{
	var options = {
	hostname: ServerRelay,
	port: 443,
	path: '/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&DeviceNum='+deviceId+'&serviceId=urn:upnp-org:serviceId:Dimming1&action=SetLoadLevelTarget&newLoadlevelTarget='+dimLevel+'&output_format=json',
	headers: {"MMSSession":RelaySessionToken}
	};

	https.get(options, function(response) {
        var body = '';
        response.on('data', function(d) {body += d;});
        response.on('end', function() {cbfunc(body);});
	    response.on("error",function(e){log("Got error: " + e.message); });
	});
}

function runScene( ServerRelay,PK_Device,RelaySessionToken, sceneId,cbfunc )
{
	var options = {
	hostname: ServerRelay,
	port: 443,
	path: '/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&serviceId=urn:micasaverde-com:serviceId:HomeAutomationGateway1&action=RunScene&SceneNum='+sceneId.substring(1)+'&output_format=json',
	headers: {"MMSSession":RelaySessionToken}
	};

	https.get(options, function(response) {
        var body = '';
        response.on('data', function(d) {body += d;});
        response.on('end', function() {cbfunc(body);});
	    response.on("error",function(e){log("Got error: " + e.message); });
	});
}


function getCurrentDimLevel( ServerRelay,PK_Device,RelaySessionToken, deviceId,cbfunc )
{

	var options = {
	hostname: ServerRelay,
	port: 443,
	path: '/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=variableget&DeviceNum='+deviceId+'&serviceId=urn:upnp-org:serviceId:Dimming1&Variable=LoadLevelTarget',
	headers: {"MMSSession":RelaySessionToken}
	};

	https.get(options, function(response) {
        var body = '';
        response.on('data', function(d) {body += d;});

        response.on('end', function() {
	      cbfunc(body);
	    });

	    response.on("error",function(e){log("Got error: " + e.message); });
	});
}


function getLoginDetails( accessToken, cbfunc )
{
	// edit the following line to put your server name
	var options = {
	hostname: "enter your host name",
	port: 443,
	path: '/auth/get_user_details.php?access_token='+accessToken,
	};

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