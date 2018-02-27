/**
    Copyright MillieSoft 2017. You may use this skill for personal use, but may not submit it or any derivatives to Amazon for certification.

    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

var username = "{enter your username}";
var password = "{enter your encoded password}";
var PK_Device = "";  // if you want to use a specific device, enter it's device ID here
var scale = "C"; // change to F for fahrenheit support
var AppendToSceneName = "";   // change to " Scene" to append ' Scene' to each scene name
var devicesToIgnore = []; // create a list of IDs to ignore, e.g. ["252","S7"] to exclude devices from discovery
var smartplugDevices=[]; // create a list of IDs to treat as a smart plug, e.g. ["15","99"]
var switchDevices=[]; // create a list of IDs to treat as a wall switch, e.g. ["12","62"]
var cameras=[]; // create a list of cameras, with the following format {"id":"enter the vera device id","protocols":["RTSP"],"width":1280,"height":738,"authorizationTypes": ["BASIC"],"videoCodecs": ["H264"],"audioCodecs": ["NONE"],"streamingUrl":"enter the rtsp url","imageURL":"enter the static image url"};
/* DO NOT MODIFY BELOW THIS LINE */

var https = require('https');
var http = require('http');
var log = log;
var generateControlError = generateControlError;
var Server_Device = "";

/**
 * Main entry point.
 * Incoming events from Alexa Lighting APIs are processed via this method.
 */

exports.handler = function (request, context) {
    if (request.directive.header.namespace === 'Alexa.Discovery' && request.directive.header.name === 'Discover') {
        log("DEGUG:", "Discover request",  JSON.stringify(request));
        handleDiscovery(request, context, "");
    }
    else if (request.directive.header.namespace === 'Alexa.PowerController') {
        if (request.directive.header.name === 'TurnOn' || request.directive.header.name === 'TurnOff') {
            log("DEBUG:", "TurnOn or TurnOff Request", JSON.stringify(request));
            handlePowerControl(request, context);
        }
    } else if (request.directive.header.namespace === 'Alexa.BrightnessController') {
        if (request.directive.header.name === 'AdjustBrightness' || request.directive.header.name === 'SetBrightness') {
            log("DEBUG:", "AdjustBrightness or SetBrightness Request", JSON.stringify(request));
            handleBrightnessControl(request, context);
        }
    } else if (request.directive.header.namespace === 'Alexa.ColorTemperatureController') {
        if (request.directive.header.name === 'SetColorTemperature') {
            log("DEBUG:", "SetColorTemperature Request", JSON.stringify(request));
            handleColorTemperatureControl(request, context);
        }
    } else if (request.directive.header.namespace === 'Alexa.ThermostatController') {
        if (request.directive.header.name === 'AdjustTargetTemperature' || request.directive.header.name === 'SetTargetTemperature') {
            log("DEBUG:", "AdjustTargetTemperature or SetTargetTemperature Request", JSON.stringify(request));
            handleTemperatureControl(request, context);
        }
    } else if (request.directive.header.namespace === 'Alexa.SceneController') {
        if (request.directive.header.name === 'Activate' || request.directive.header.name === 'Deactivate') {
            log("DEBUG:", "Activate or Deactivate Request", JSON.stringify(request));
            handleSceneControl(request, context);
        }
    } else if (request.directive.header.namespace === 'Alexa.LockController') {
        if (request.directive.header.name === 'Lock' || request.directive.header.name === 'Unlock') {
            log("DEBUG:", "Lock or Unlock Request", JSON.stringify(request));
            handleLockControl(request, context);
        }
    } else if (request.directive.header.namespace === 'Alexa.CameraStreamController') {
        if (request.directive.header.name === 'InitializeCameraStreams') {
            log("DEBUG:", "Camera Stream Request", JSON.stringify(request));
            handleCameraControl(request, context);
        }
    } else if (request.directive.header.namespace === 'Alexa') {
        if (request.directive.header.name === 'ReportState') {
            log("DEBUG:", "ReportState Request", JSON.stringify(request));
            reportState(request, context);
        }
    }
};

function generateUUID(){
  var d = new Date().getTime();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d/16);
    return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return uuid;
}

function handleDiscovery(request, context) {

  var accessToken = request.directive.payload.scope.token.trim();
  var endpoints = [];
  getVeraSession(username,password,PK_Device,function (ServerRelay,RelaySessionToken,PK_Device){
    getUserData(ServerRelay,PK_Device,RelaySessionToken,function (statusText){
      var Status = parseJson(statusText,"status");
      var allDevices = Status.devices;
      var allRooms = Status.rooms;
      var allScenes = Status.scenes;
      var displayCategories=[];
      var roomName = "Unknown Room";
      var endpointId = "";
      deviceLoop:
      for(var i = 0; i < allDevices.length; i++) {
        var device = allDevices[i];
        if(device.name.indexOf("_") !== 0){
          roomName = "Unknown Room";
          for (var j = 0;j < allRooms.length;j++){
            if(allRooms[j].id == device.room){
              roomName = allRooms[j].name;
              break;
            }
          }
          var deviceCategory = "Unknown type of device";
          endpointId = device.id.toString();
          if(devicesToIgnore.indexOf(endpointId) >= 0){
            continue deviceLoop;
          }
          switch (device.device_type){
            case "urn:schemas-upnp-org:device:DimmableLight:1":
              deviceCategory = "Dimmable Switch";
              capabilities=[{"type":"AlexaInterface","interface":"Alexa.BrightnessController","version":"3","properties":{"supported":[{"name":"brightness"}]  ,"proactivelyReported": false,"retrievable": true}}
                           ,{"type": "AlexaInterface","interface": "Alexa.EndpointHealth"    ,"version":"3","properties":{"supported":[{"name": "connectivity"}],"proactivelyReported": false,"retrievable": true}}
                           ,{"type": "AlexaInterface","interface": "Alexa.PowerController"   ,"version":"3","properties":{"supported":[{"name": "powerState"}]  ,"proactivelyReported": false,"retrievable": true}}
                           ];
              displayCategories=["LIGHT"];
              break;
            case "urn:schemas-upnp-org:device:BinaryLight:1":
              deviceCategory = "Switch";
              capabilities=[{"type": "AlexaInterface","interface": "Alexa.PowerController"   ,"version":"3","properties":{"supported":[{"name": "powerState"}]  ,"proactivelyReported": false,"retrievable": true}}
                         ,{"type": "AlexaInterface","interface": "Alexa.EndpointHealth"    ,"version":"3","properties":{"supported":[{"name": "connectivity"}],"proactivelyReported": false,"retrievable": true}}
                           ];
              displayCategories=["LIGHT"];
              if(smartplugDevices.indexOf(endpointId) >= 0){
                displayCategories=["SMARTPLUG"];
			  } else if (switchDevices.indexOf(endpointId) >= 0){
                displayCategories=["SWITCH"];
			  }
             break;
            case "urn:schemas-micasaverde-com:device:MotionSensor:1":
            case "urn:schemas-micasaverde-com:device:DoorSensor:1":
            case "urn:schemas-micasaverde-com:device:LightSensor:1":
            case "urn:schemas-micasaverde-com:device:HumiditySensor:1":
              deviceCategory = "Sensor";
              continue deviceLoop;
            case "urn:schemas-upnp-org:device:HVAC_ZoneThermostat:1":
              deviceCategory = "Thermostat";
              capabilities=[{"type": "AlexaInterface","interface": "Alexa.EndpointHealth"    ,"version":"3","properties":{"supported":[{"name": "connectivity"}],"proactivelyReported": false,"retrievable": true}}
                           ,{"type": "AlexaInterface","interface": "Alexa.ThermostatController","version": "3","properties": {"supported": [{"name": "targetSetpoint"},{"name": "thermostatMode"}],"proactivelyReported": false,"retrievable": true}}
                           ,{"type": "AlexaInterface","interface": "Alexa.TemperatureSensor"   ,"version": "3","properties": {"supported": [{"name": "temperature"}],"proactivelyReported": false,"retrievable": true}}
                           ];
              displayCategories=["THERMOSTAT"];
              break;
            case "urn:schemas-upnp-org:device:DigitalSecurityCamera:1":
            case "urn:schemas-upnp-org:device:DigitalSecurityCamera:2":
            var camera=cameras.find(o => o.id === endpointId);
            if(camera){
              deviceCategory = "Camera";
              displayCategories=["CAMERA"];
              capabilities= [{"type": "AlexaInterface","interface": "Alexa.CameraStreamController","version": "3","cameraStreamConfigurations":
              [
                {"protocols": camera.protocols,"resolutions": [{"width": camera.width,"height": camera.height}],"authorizationTypes": camera.authorizationTypes,"videoCodecs": camera.videoCodecs,"audioCodecs": camera.audioCodecs}
              ]
              }];
              break;
		  } else {
            continue deviceLoop;
		  }
            case "urn:schemas-micasaverde-com:device:DoorLock:1":
              deviceCategory = "Lock";
              displayCategories=["SMARTLOCK"];
              capabilities= [{"type": "AlexaInterface","interface": "Alexa.EndpointHealth"    ,"version":"3","properties":{"supported":[{"name": "connectivity"}],"proactivelyReported": false,"retrievable": true}}
                            ,{"type": "AlexaInterface","interface": "Alexa.LockController","version": "3","properties": {"supported": [{"name": "lockState"}],"proactivelyReported": false,"retrievable": true}}
                            ];
              break;
            case 11:
              deviceCategory = "Generic IO";
              continue deviceLoop;
            case "urn:schemas-micasaverde-com:device:TemperatureSensor:1":
              deviceCategory = "Thermostat";
              capabilities=[{"type": "AlexaInterface","interface": "Alexa.EndpointHealth"    ,"version":"3","properties":{"supported":[{"name": "connectivity"}],"proactivelyReported": false,"retrievable": true}}
                           ,{"type": "AlexaInterface","interface": "Alexa.TemperatureSensor"   ,"version": "3","properties": {"supported": [{"name": "temperature"}],"proactivelyReported": false,"retrievable": true}}
                           ];
              displayCategories=["TEMPERATURE_SENSOR"];
              continue deviceLoop;
            case "urn:schemas-upnp-org:device:DimmableRGBLight:1":
            case "urn:schemas-upnp-org:device:DimmableRGBLight:2":
			deviceCategory = "RGB Switch";
			capabilities=[{"type":"AlexaInterface","interface":"Alexa.BrightnessController","version":"3","properties":{"supported":[{"name":"brightness"}]  ,"proactivelyReported": false,"retrievable": true}}
			             ,{"type": "AlexaInterface","interface": "Alexa.EndpointHealth"    ,"version":"3","properties":{"supported":[{"name": "connectivity"}],"proactivelyReported": false,"retrievable": true}}
			             ,{"type": "AlexaInterface","interface": "Alexa.PowerController"   ,"version":"3","properties":{"supported":[{"name": "powerState"}]  ,"proactivelyReported": false,"retrievable": true}}
			             ,{"type": "AlexaInterface","interface": "Alexa.ColorTemperatureController"   ,"version":"3","properties":{"supported":[{"name": "colorTemperatureInKelvin"}]  ,"proactivelyReported": false,"retrievable": true}}
			             ];
			displayCategories=["LIGHT"];
			break;

            default:
              continue deviceLoop;
          }
          /*capabilities.push({
              "type": "AlexaInterface",
              "interface": "Alexa",
              "version": "3"
            });*/
          var applianceDiscovered = {
            endpointId: endpointId,
            friendlyName: device.name,
            description: deviceCategory + " " + device.name + " in " + roomName,
            manufacturerName:"MillieSoft",
            displayCategories:displayCategories,
            capabilities:capabilities
          ,  cookie: {deviceId:device.id.toString(),deviceCategory:device.device_type}
          };
          endpoints.push(applianceDiscovered);
        }
      }
      sceneLoop:
      for(var k = 0; k < allScenes.length; k++) {
        var scene = allScenes[k];
        if(scene.name.indexOf("_") !== 0){
          endpointId = "S" + scene.id.toString();
          if(devicesToIgnore.indexOf(endpointId) >= 0){
            continue sceneLoop;
          }
          roomName = "Unknown Room";
          for (var j2 = 0;j2 < allRooms.length;j2++){
            if(allRooms[j2].id == scene.room){
              roomName = allRooms[j2].name;
              break;
            }
          }
          var applianceDiscovered2 = {
            endpointId: endpointId,
            friendlyName: scene.name + AppendToSceneName,
            description: scene.name + " Scene in " + roomName,
            manufacturerName: "MillieSoft",
            capabilities: [{"type": "AlexaInterface","interface": "Alexa.SceneController","version": "3","supportsDeactivation": true,"proactivelyReported": false}],
            cookie: {deviceId:scene.id.toString(),deviceCategory:"SCENE"},
            displayCategories:["SCENE_TRIGGER"]
          };
          endpoints.push(applianceDiscovered2);
        }
      }
      endpoints.sort(function(a, b) {
        return a.friendlyName.localeCompare(b.friendlyName);
      });

              var header = request.directive.header;
	          header.name = "Discover.Response";
	          log("DEBUG", "Discovery Response: ", JSON.stringify({ header: header, payload: {endpoints:endpoints}}));
	          context.succeed({ event: { header: header, payload: {endpoints:endpoints} } });


    });
  });
}


function handlePowerControl(request, context) {
  // get device ID passed in during discovery
  var requestMethod = request.directive.header.name;
  var powerResult;

  getVeraSession(username,password,PK_Device,function(ServerRelay,RelaySessionToken,PK_Device){
    var endpointId = request.directive.endpoint.endpointId;
    var contextResult = {
        "properties": [{
            "namespace": "Alexa.PowerController",
            "name": "powerState",
            "uncertaintyInMilliseconds": 50
        }]
    };
    var responseHeader = request.directive.header;
    responseHeader.namespace="Alexa";
    responseHeader.name = "Response";
    responseHeader.messageId = responseHeader.messageId + "-R";

    if (typeof endpointId !== "string" ) {
      log("event payload is invalid",event);
      context.fail(generateControlError(responseType, 'UNEXPECTED_INFORMATION_RECEIVED', 'Input is invalid'));
    }

      if (requestMethod === "TurnOn") {
          switchDevice(ServerRelay,PK_Device,RelaySessionToken,endpointId,1,function(veraResponse){
			  if(veraResponse.indexOf("ERROR") === 0){
			    context.fail(generateControlError3(request.directive, 'BRIDGE_UNREACHABLE', veraResponse));
			  } else {
				  contextResult.properties[0].value="ON";
				  contextResult.properties[0].timeOfSample=new Date().toISOString();
                var response = {context: contextResult,event: {header: responseHeader},endpoint: request.directive.endpoint,payload: {}};
                log("DEBUG", "Alexa.PowerController ", JSON.stringify(response));
                context.succeed(response);
		      }
			});
      } else if (requestMethod === "TurnOff") {
          switchDevice(ServerRelay,PK_Device,RelaySessionToken,endpointId,0,function(veraResponse){
			  if(veraResponse.indexOf("ERROR") === 0){
			    context.fail(generateControlError3(request.directive, 'BRIDGE_UNREACHABLE', veraResponse));
			  } else {
				  contextResult.properties[0].value="OFF";
				  contextResult.properties[0].timeOfSample=new Date().toISOString();
                var response = {context: contextResult,event: {header: responseHeader},endpoint: request.directive.endpoint,payload: {}};
                log("DEBUG", "Alexa.PowerController ", JSON.stringify(response));
                context.succeed(response);
		      }
		  });
        }
	  });
}

function handleBrightnessControl(request, context) {
  // get device ID passed in during discovery
  var requestMethod = request.directive.header.name;
  var powerResult;

  getVeraSession(username,password,PK_Device,function(ServerRelay,RelaySessionToken,PK_Device){
    var endpointId = request.directive.endpoint.endpointId;
    var contextResult = {
        "properties": [{
            "namespace": "Alexa.BrightnessController",
            "name": "brightness",
            "uncertaintyInMilliseconds": 50
        }]
    };
    var responseHeader = request.directive.header;
    responseHeader.namespace="Alexa";
    responseHeader.name = "Response";
    responseHeader.messageId = responseHeader.messageId + "-R";

    if (typeof endpointId !== "string" ) {
      log("event payload is invalid",event);
      context.fail(generateControlError(responseType, 'UNEXPECTED_INFORMATION_RECEIVED', 'Input is invalid'));
    }

    if (requestMethod === "AdjustBrightness") {

	   getCurrentDimLevel(ServerRelay,PK_Device,RelaySessionToken,endpointId,function(currentDimLevelString){
	     var currentDimLevel = Number(currentDimLevelString);
	     if(isNaN(currentDimLevel)){
		    context.fail(generateControlError3(request.directive, 'BRIDGE_UNREACHABLE', 'Could not get current dim level'));
	     } else {
	       var targetDimLevel = Math.min(100,Math.max(0,currentDimLevel + request.directive.payload.brightnessDelta));
	       dimDevice(ServerRelay,PK_Device,RelaySessionToken,endpointId,targetDimLevel.toFixed(),function(veraResponse){
	         if(veraResponse.indexOf("ERROR") === 0){
		    context.fail(generateControlError3(request.directive, 'BRIDGE_UNREACHABLE', 'Could not set dim level'));
	         } else {
			  contextResult.properties[0].value=targetDimLevel;
			  contextResult.properties[0].timeOfSample=new Date().toISOString();
              var response = {context: contextResult,event: {header: responseHeader},endpoint: request.directive.endpoint,payload: {}};
              log("DEBUG", "Alexa.BrightnessController ", JSON.stringify(response));
              context.succeed(response);
	         }
	       });
	     }
	   });
	} else if (requestMethod === "SetBrightness") {
	  var targetDimLevel = request.directive.payload.brightness;
	  dimDevice(ServerRelay,PK_Device,RelaySessionToken,endpointId,targetDimLevel.toFixed(),function(veraResponse){
	    if(veraResponse.indexOf("ERROR") === 0){
		 context.fail(generateControlError3(request.directive, 'BRIDGE_UNREACHABLE', 'Could not set dim level'));
	    } else {
		  contextResult.properties[0].value=targetDimLevel;
		  contextResult.properties[0].timeOfSample=new Date().toISOString();
          var response = {context: contextResult,event: {header: responseHeader},endpoint: request.directive.endpoint,payload: {}};
         log("DEBUG", "Alexa.BrightnessController ", JSON.stringify(response));
         context.succeed(response);
	    }
	  });
	}
  });
}

function handleColorTemperatureControl(request, context) {
  // get device ID passed in during discovery
  var requestMethod = request.directive.header.name;
  var powerResult;

  getVeraSession(username,password,PK_Device,function(ServerRelay,RelaySessionToken,PK_Device){
    var endpointId = request.directive.endpoint.endpointId;
    var contextResult = {
        "properties": [{
            "namespace": "Alexa.ColorTemperatureController",
            "name": "colorTemperatureInKelvin",
            "uncertaintyInMilliseconds": 50
        }]
    };
    var responseHeader = request.directive.header;
    responseHeader.namespace="Alexa";
    responseHeader.name = "Response";
    responseHeader.messageId = responseHeader.messageId + "-R";

    if (typeof endpointId !== "string" ) {
      log("event payload is invalid",event);
      context.fail(generateControlError(responseType, 'UNEXPECTED_INFORMATION_RECEIVED', 'Input is invalid'));
    }

    if (requestMethod === "SetColorTemperature") {
	  var targetTemperatureLevel = request.directive.payload.colorTemperatureInKelvin;
	  colorTemperatureDevice(ServerRelay,PK_Device,RelaySessionToken,endpointId,targetTemperatureLevel.toFixed(),function(veraResponse){
	    if(veraResponse.indexOf("ERROR") === 0){
		 context.fail(generateControlError3(request.directive, 'BRIDGE_UNREACHABLE', 'Could not set color temperature level'));
	    } else {
		  contextResult.properties[0].value=targetTemperatureLevel;
		  contextResult.properties[0].timeOfSample=new Date().toISOString();
          var response = {context: contextResult,event: {header: responseHeader},endpoint: request.directive.endpoint,payload: {}};
         log("DEBUG", "Alexa.ColorTemperatureController ", JSON.stringify(response));
         context.succeed(response);
	    }
	  });
	}
  });
}

function handleTemperatureControl(request, context) {
  // get device ID passed in during discovery
  var requestMethod = request.directive.header.name;
  var powerResult;

  getVeraSession(username,password,PK_Device,function(ServerRelay,RelaySessionToken,PK_Device){
    var endpointId = request.directive.endpoint.endpointId;
    var responseHeader = request.directive.header;
    responseHeader.namespace="Alexa";
    responseHeader.name = "Response";
    responseHeader.messageId = responseHeader.messageId + "-R";

    if (typeof endpointId !== "string" ) {
      log("event payload is invalid",event);
      context.fail(generateControlError(responseType, 'UNEXPECTED_INFORMATION_RECEIVED', 'Input is invalid'));
    }

    var targetTemperature=0;
    var targetScale="CELSIUS";
    if (requestMethod === "AdjustTargetTemperature") {
        getCurrentTemperature(ServerRelay,PK_Device,RelaySessionToken,endpointId,function(currentTemperatureString){
		  var currentTemperature = Number(currentTemperatureString);
		  if(isNaN(currentTemperature)){
		    context.fail(generateControlError3(request.directive, 'BRIDGE_UNREACHABLE', 'Could not get current temperature'));
		  } else {
		    targetTemperature = currentTemperature + request.directive.payload.targetSetpointDelta.value;
		    targetScale = request.directive.payload.targetSetpointDelta.scale;
	        setTemperature2(ServerRelay,RelaySessionToken,PK_Device,targetTemperature,targetScale,endpointId,responseHeader,request, context);
	      }
	  });

	} else if (requestMethod === "SetTargetTemperature") {
	  targetTemperature = request.directive.payload.targetSetpoint.value;
	  targetScale=request.directive.payload.targetSetpoint.scale;
	  setTemperature2(ServerRelay,RelaySessionToken,PK_Device,targetTemperature,targetScale,endpointId,responseHeader,request, context);
	}
  });
}



function setTemperature2(ServerRelay,RelaySessionToken,PK_Device,targetTemperature,targetScale,endpointId,responseHeader,request, context){
	  setTemperature(ServerRelay,PK_Device,RelaySessionToken,endpointId,targetTemperature.toFixed(),function(veraResponse){
	    if(veraResponse.indexOf("ERROR") === 0){
		 context.fail(generateControlError3(request.directive, 'BRIDGE_UNREACHABLE', 'Could not set temperature'));
	    } else {
          getTemperatureMode(ServerRelay, PK_Device, RelaySessionToken, endpointId, function(temperatureMode){
		    var timeOfSample=new Date().toISOString();

            var contextResult = {
              "properties": [{
              "namespace": "Alexa.TemperatureSensor",
              "name": "temperature",
              "value": {value:targetTemperature,scale:targetScale},
			  "timeOfSample":timeOfSample,
              "uncertaintyInMilliseconds": 50
             },{
		      "namespace": "Alexa.ThermostatController",
		      "name": "thermostatMode",
		      "value": temperatureMode,
			  "timeOfSample":timeOfSample,
		      "uncertaintyInMilliseconds": 50
		    }]};

            var response = {context: contextResult,event: {header: responseHeader},endpoint: request.directive.endpoint,payload: {}};
            log("DEBUG", "Alexa.ThermostatController ", JSON.stringify(response));
            context.succeed(response);

	    });
	}
});
}

function handleSceneControl(request, context) {
  // get device ID passed in during discovery
  var requestMethod = request.directive.header.name;

  getVeraSession(username,password,PK_Device,function(ServerRelay,RelaySessionToken,PK_Device){
    var endpointId=request.directive.endpoint.cookie.deviceId;
    var response={context:{}};
    response.event=request.directive;
    response.event.payload.cause={"type" : "VOICE_INTERACTION"};
    response.event.payload.timestamp=new Date().toISOString();
    response.event.header.messageId = response.event.header.messageId + "-R";

    if (requestMethod === "Activate") {
      runScene(ServerRelay,PK_Device,RelaySessionToken,endpointId,function(veraResponse){
	       if(veraResponse.indexOf("ERROR") === 0){
	    context.fail(generateControlError3(request.directive, 'BRIDGE_UNREACHABLE', 'Could not run scene'));
	       } else {
			 response.event.header.name="ActivationStarted";
            log("DEBUG", "Alexa.SceneController ", JSON.stringify(response));
            context.succeed(response);
	       }
	  });
	} else if (requestMethod === "Deactivate") {
	  stopScene(ServerRelay,PK_Device,RelaySessionToken,endpointId,function(veraResponse){
	       if(veraResponse.indexOf("ERROR") === 0){
	    context.fail(generateControlError3(request.directive, 'BRIDGE_UNREACHABLE', 'Could not stop scene'));
	       } else {
			 response.event.header.name="DeactivationStarted";
	        log("DEBUG", "Alexa.SceneController ", JSON.stringify(response));
	        context.succeed(response);
	       }
	  });
	}
  });
}

function handleLockControl(request, context) {
  // get device ID passed in during discovery
  var requestMethod = request.directive.header.name;
  var powerResult;

  getVeraSession(username,password,PK_Device,function(ServerRelay,RelaySessionToken,PK_Device){
    var endpointId = request.directive.endpoint.endpointId;
    var contextResult = {
        "properties": [{
            "namespace": "Alexa.LockController",
            "name": "lockState",
            "uncertaintyInMilliseconds": 50
        }]
    };
    var responseHeader = request.directive.header;
    responseHeader.namespace="Alexa";
    responseHeader.name = "Response";
    responseHeader.messageId = responseHeader.messageId + "-R";

    if (typeof endpointId !== "string" ) {
      log("event payload is invalid",event);
      context.fail(generateControlError(responseType, 'UNEXPECTED_INFORMATION_RECEIVED', 'Input is invalid'));
    }

      var lockState=-1;
      var lockStateString="";
      if (requestMethod === "Lock") {
		  lockState=1;
		  lockStateString="LOCKED";
      } else if (requestMethod === "Unlock"){
		  lockState=0;
		  lockStateString="UNLOCKED";
      }

      if(lockState>=0){
        setLockState(ServerRelay,PK_Device,RelaySessionToken,endpointId,lockState,function(veraResponse){
			  if(veraResponse.indexOf("ERROR") === 0){
			    context.fail(generateControlError3(request.directive, 'BRIDGE_UNREACHABLE', veraResponse));
			  } else {
				  contextResult.properties[0].value=lockStateString;
				  contextResult.properties[0].timeOfSample=new Date().toISOString();
                var response = {context: contextResult,event: {header: responseHeader},payload: {}};
                log("DEBUG", "Alexa.LockController ", JSON.stringify(response));
                context.succeed(response);
		      }

			});
        }

	  });
}

function handleCameraControl(request, context) {
  // get device ID passed in during discovery
      var endpointId = request.directive.endpoint.endpointId;

      var camera=cameras.find(o => o.id === endpointId);

      if(camera){
		  var response={event:{}};
		  response.event.header=request.directive.header;
		  response.event.header.name="Response";
		  response.event.endpoint=request.directive.endpoint;
          response.event.header.messageId = response.event.header.messageId + "-R";
          response.event.payload={
            "cameraStreams": [ {
              "uri": camera.streamingUrl,
              "protocol": camera.protocols[0],
              "resolution": {
                "width": camera.width,
                "height": camera.height
              },
              "authorizationType": camera.authorizationTypes[0],
              "videoCodec": camera.videoCodecs[0],
              "audioCodec": camera.audioCodecs[0]
            }
           ],
            "imageUri": camera.imageURL
          }
          log("DEBUG", "Alexa.CameraController ", JSON.stringify(response));
		  context.succeed(response);
	} else {
		    context.fail(generateControlError3(request.directive, 'BRIDGE_UNREACHABLE', 'Could not find camera'));
	}
}


function reportState(request, context) {
  // get device ID passed in during discovery

  var deviceCategory=request.directive.endpoint.cookie.deviceCategory;
  var endpointId=request.directive.endpoint.cookie.deviceId;
  var properties=[];
  getVeraSession(username,password,PK_Device,function (ServerRelay,RelaySessionToken,PK_Device){
      if(deviceCategory=="SCENE"){
		  var sceneStatus=Statuses.scenes.find(o => o.id === deviceId);
		  var sceneActive=sceneStatus.active;
		  // ALEXA DOES NOT CURRENTLY REPORT SCENES
      } else {
    getDeviceStatus(ServerRelay,PK_Device,RelaySessionToken,endpointId,function (statusText){
      var Statuses = parseJson(statusText,"status");
	  var timeOfSample=new Date().toISOString();

        var deviceStatuses=Statuses['Device_Num_'+endpointId].states;
          var healthStatus=deviceStatuses.find(o => o.variable === "CommFailure");
          if(healthStatus){
		  var healthStatusValue=healthStatus.value;
		  if(healthStatusValue!==""){
		    var property={
			  "namespace": "Alexa.EndpointHealth",
			  "name": "connectivity",
			  "timeOfSample":timeOfSample,
			  "uncertaintyInMilliseconds": 50
			};
			if(healthStatusValue=="0"){
				property.value={value:"OK"};
		    } else {
				property.value={value:"UNREACHABLE"};
		    }
			properties.push(property);
        }
	}

        if(deviceCategory=="urn:schemas-upnp-org:device:DimmableLight:1"
        ||deviceCategory=="urn:schemas-upnp-org:device:BinaryLight:1"
        ||deviceCategory=="urn:schemas-upnp-org:device:DimmableRGBLight:1"
        ||deviceCategory=="urn:schemas-upnp-org:device:DimmableRGBLight:2"){ //dimmer or switch
          var powerStatus=deviceStatuses.find(o => ( o.service === "urn:upnp-org:serviceId:SwitchPower1" && o.variable==="Status"));
          if(powerStatus){
		  var powerStatusValue=powerStatus.value;
		  var powerState="OFF";
		  if(powerStatusValue==="1"){
			  powerState="ON";
	      }
	      var property2={
            "namespace": "Alexa.PowerController",
            "name": "powerState",
            "value": powerState,
			"timeOfSample":timeOfSample,
            "uncertaintyInMilliseconds": 50
          };
          properties.push(property2);
	  }
	    }
	    if(deviceCategory=="urn:schemas-upnp-org:device:DimmableLight:1"
	    ||deviceCategory=="urn:schemas-upnp-org:device:DimmableRGBLight:1"
	    ||deviceCategory=="urn:schemas-upnp-org:device:DimmableRGBLight:2"){ //dimmer
		  var levelStatus=deviceStatuses.find(o =>  o.variable==="LoadLevelStatus");
		  if(levelStatus){
			var levelStatusValue=parseInt(levelStatus.value);
			var property3={
		    "namespace": "Alexa.BrightnessController",
		    "name": "brightness",
		    "value": levelStatusValue,
			"timeOfSample":timeOfSample,
		    "uncertaintyInMilliseconds": 50
		  };
		  properties.push(property3);
	  }
	    }

	    if(deviceCategory=="urn:schemas-micasaverde-com:device:TemperatureSensor:1"
	    ||deviceCategory=="urn:schemas-upnp-org:device:HVAC_ZoneThermostat:1"){ //thermostat or temperature sensor
		  var temperatureStatus=deviceStatuses.find(o =>  o.variable==="CurrentTemperature");
		  if(temperatureStatus){
			var temperatureStatusValue=parseInt(temperatureStatus.value);
			var property4={
		    "namespace": "Alexa.TemperatureSensor",
		    "name": "temperature",
		    "value": {value:temperatureStatusValue,scale:((scale=="C") ? "CELSIUS" : "FAHRENHEIT")},
			"timeOfSample":timeOfSample,
		    "uncertaintyInMilliseconds": 50
		  };
		  properties.push(property4);
	  }
	    }
	    if(deviceCategory=="urn:schemas-upnp-org:device:HVAC_ZoneThermostat:1"){ //thermostat
		  var temperatureSetpoint=deviceStatuses.find(o =>  o.variable==="CurrentSetpoint");
		  if(temperatureSetpoint){
			var temperatureSetpointValue=parseInt(temperatureSetpoint.value);
			var property5={
		    "namespace": "Alexa.ThermostatController",
		    "name": "targetSetpoint",
		    "value": {value:temperatureSetpointValue,scale:((scale=="C") ? "CELSIUS" : "FAHRENHEIT")},
			"timeOfSample":timeOfSample,
		    "uncertaintyInMilliseconds": 50
		  };
		  properties.push(property5);
	  }

		  var modeStatus=deviceStatuses.find(o =>  o.variable==="ModeStatus");
		  if(modeStatus){
			var modeStatusValue=modeStatus.value;
			var thermostatMode="OFF";
			if(modeStatusValue==="HeatOn") thermostatMode="HEAT";
			if(modeStatusValue==="CoolOn") thermostatMode="COOL";
			if(modeStatusValue==="AutoChangeOver") thermostatMode="AUTO";
			var property6={
		    "namespace": "Alexa.ThermostatController",
		    "name": "thermostatMode",
		    "value": modeStatusValue,
			"timeOfSample":timeOfSample,
		    "uncertaintyInMilliseconds": 50
		  };
		  properties.push(property6);
	  }
	    }
	    if(deviceCategory=="urn:schemas-micasaverde-com:device:DoorLock:1"){ //lock
		  var lockStatus=deviceStatuses.find(o =>  ( o.service === "urn:micasaverde-com:serviceId:DoorLock1" && o.variable==="Status"));
		  if(lockStatus){
			var lockStatusValue=lockStatus.value;
			var property7={
		    "namespace": "Alexa.LockController",
		    "name": "lockState",
		    "value": ((lockStatusValue=="0") ? "UNLOCKED" : "LOCKED"),
			"timeOfSample":timeOfSample,
		    "uncertaintyInMilliseconds": 50
		  };
		  properties.push(property7);
	  }
		}
		if(deviceCategory=="urn:schemas-upnp-org:device:DimmableRGBLight:1"
			    ||deviceCategory=="urn:schemas-upnp-org:device:DimmableRGBLight:2"){ //RGB
				  var colorStatus=deviceStatuses.find(o =>  o.variable==="CurrentColor");
				  if(colorStatus){
					var colorStatusValue=parseInt(colorStatus.value);
					var property8={
				    "namespace": "Alexa.ColorTemperatureController",
				    "name": "colorTemperatureInKelvin",
				    "value": colorStatusValue,
					"timeOfSample":timeOfSample,
				    "uncertaintyInMilliseconds": 50
				  };
				  properties.push(property8);
			  }
			    }


  var event = request.directive;
  event.header.name = "StateReport";
  log("DEBUG", "StateReport: ", JSON.stringify({ "event":event, context:{"properties":properties}}));
  context.succeed({ "event":event, context:{"properties":properties}});
    });
      }
  });


}


function getVeraSession(username,password,device,cbfunc){
  getAuthToken( username,password, function ( AuthToken, AuthSigToken, Server_Account ) {
    var AuthTokenDecoded = new Buffer(AuthToken, 'base64');
    var AuthTokenJson = parseJson(AuthTokenDecoded,"auth");
    var PK_Account = AuthTokenJson.PK_Account;
    getSessionToken( Server_Account, AuthToken, AuthSigToken, function(AuthSessionToken) {
      getDeviceList(Server_Account,PK_Account,AuthSessionToken,function(deviceTable) {
        var Devices = parseJson(deviceTable,"device");
        if(device === ""){
          device = Devices.Devices[0].PK_Device;
          Server_Device = Devices.Devices[0].Server_Device;
        } else {
          var deviceArrayLength = Devices.Devices.length;
          for (var i = 0; i < deviceArrayLength; i++) {
            if(Devices.Devices[i].PK_Device == device){
              Server_Device = Devices.Devices[i].Server_Device;
              break;
            }
          }
        }
        getSessionToken(Server_Device, AuthToken, AuthSigToken, function(ServerDeviceSessionToken) {
          getServerRelay(Server_Device,device,ServerDeviceSessionToken,function(sessionRelayText){
            var Relays = parseJson(sessionRelayText,"relays");
            var ServerRelay = Relays.Server_Relay;
            getSessionToken(ServerRelay, AuthToken, AuthSigToken, function(RelaySessionToken) {
              cbfunc(ServerRelay,RelaySessionToken,device);
            });
          });
        });
      });
    });
  });
}

function getAuthToken( user, pwd, cbfunc ){
  var keepAliveAgent = new https.Agent({ keepAlive: true });
  var options = {hostname: 'vera-us-oem-autha.mios.com',path: '/autha/auth/username/'+user+'?SHA1Password='+pwd+'&PK_Oem=1',port:443,agent:keepAliveAgent};
  https.get(options, function(response) {
    var body = '';
    response.on('data', function(d) { body += d;});
    response.on('end', function() {
      var result = parseJson(body,"auth");
      var AuthToken = result.Identity;
      var AuthSigToken = result.IdentitySignature;
      var Server_Account = result.Server_Account;
      cbfunc(AuthToken,AuthSigToken,Server_Account);
    });
    response.on("error",function(e){log("getAuthToken","Got error: " + e.message);});
  });
}

function getSessionToken(server, AuthToken, AuthSigToken, cbfunc ){
  var keepAliveAgent = new https.Agent({ keepAlive: true });
  var options = {hostname: server,port: 443,path: '/info/session/token',headers: {"MMSAuth":AuthToken,"MMSAuthSig":AuthSigToken},agent:keepAliveAgent};
  https.get(options, function(response) {
    var SessionToken = '';
    response.on('data', function(d) {SessionToken += d;});
    response.on('end', function() {cbfunc(SessionToken);});
    response.on("error",function(e){log("Got error: " + e.message);});
  });
}

function getDeviceList( Server_Account,PK_Account,SessionToken, cbfunc ){
  var keepAliveAgent = new https.Agent({ keepAlive: true });
  var options = { hostname: Server_Account,port: 443,path: '/account/account/account/'+PK_Account+'/devices',headers: {"MMSSession":SessionToken},agent:keepAliveAgent};
  https.get(options, function(response) {
    var body = '';
    response.on('data', function(d) {body += d;});
    response.on('end', function() {cbfunc(body);});
    response.on("error",function(e){log("Got error: " + e.message); });
  });
}

function getServerRelay( ServerDevice,PK_Device,SessionToken, cbfunc ){
  var keepAliveAgent = new https.Agent({ keepAlive: true });
  var options = {hostname: ServerDevice,port: 443,path: '/device/device/device/'+PK_Device,headers: {"MMSSession":SessionToken},agent:keepAliveAgent};
  https.get(options, function(response) {
    var body = '';
    response.on('data', function(d) {body += d;});
    response.on('end', function() {cbfunc(body);});
    response.on("error",function(e){log("Got error: " + e.message); });
  });
}

function getUserData( ServerRelay,PK_Device,RelaySessionToken, cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=user_data&ns=1',ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}

function getStatuses( ServerRelay,PK_Device,RelaySessionToken, cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=sdata',ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}

function getFullStatuses( ServerRelay,PK_Device,RelaySessionToken, cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=status',ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}

function getDeviceStatus( ServerRelay,PK_Device,RelaySessionToken, deviceId,cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=status&DeviceNum='+deviceId,ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}



function switchDevice( ServerRelay,PK_Device,RelaySessionToken, deviceId,deviceState,cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&DeviceNum='+deviceId+'&serviceId=urn:upnp-org:serviceId:SwitchPower1&action=SetTarget&newTargetValue='+deviceState+'&output_format=json',ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}

function runScene( ServerRelay,PK_Device,RelaySessionToken, sceneId,cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&serviceId=urn:micasaverde-com:serviceId:HomeAutomationGateway1&action=RunScene&SceneNum='+sceneId+'&output_format=json',ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}

function stopScene( ServerRelay,PK_Device,RelaySessionToken, sceneId,cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&serviceId=urn:micasaverde-com:serviceId:HomeAutomationGateway1&action=SceneOff&SceneNum='+sceneId+'&output_format=json',ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}

function dimDevice( ServerRelay,PK_Device,RelaySessionToken, deviceId,dimLevel,cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&DeviceNum='+deviceId+'&serviceId=urn:upnp-org:serviceId:Dimming1&action=SetLoadLevelTarget&newLoadlevelTarget='+dimLevel+'&output_format=json',ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}

function getCurrentDimLevel( ServerRelay,PK_Device,RelaySessionToken, deviceId,cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=variableget&DeviceNum='+deviceId+'&serviceId=urn:upnp-org:serviceId:Dimming1&Variable=LoadLevelTarget',ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}

function colorTemperatureDevice( ServerRelay,PK_Device,RelaySessionToken, deviceId,colorTemperatureInKelvin,cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&DeviceNum='+deviceId+'&serviceId=urn:upnp-org:serviceId:Color1&action=SetColorTemp&newColorTempTarget='+colorTemperatureInKelvin+'&output_format=json',ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}

function getCurrentTemperature( ServerRelay,PK_Device,RelaySessionToken, deviceId,cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=variableget&DeviceNum='+deviceId+'&serviceId=urn:upnp-org:serviceId:TemperatureSetpoint1&Variable=CurrentSetpoint',ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}

function getTargetTemperature( ServerRelay,PK_Device,RelaySessionToken, deviceId,cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=variableget&DeviceNum='+deviceId+'&serviceId=urn:upnp-org:serviceId:TemperatureSetpoint1&Variable=SetpointTarget',ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}

function setTemperature( ServerRelay,PK_Device,RelaySessionToken, deviceId,temperature,cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&DeviceNum='+deviceId+'&serviceId=urn:upnp-org:serviceId:TemperatureSetpoint1&action=SetCurrentSetpoint&NewCurrentSetpoint='+temperature+'&output_format=json',ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}

function getCameraUri( ServerRelay,PK_Device,RelaySessionToken, deviceId,cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=variableget&DeviceNum='+deviceId+'&serviceId=urn:micasaverde-com:serviceId:Camera1&Variable=VideoURLs',ServerRelay,RelaySessionToken,function(response){
	  responseArray=response.split(":");
	  if(responseArray.length>1){
		  cbfunc(responseArray[1]);
	  } else {
        cbfunc(response);
      }
  });
}

function getLockState( ServerRelay,PK_Device,RelaySessionToken, deviceId,cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=variableget&DeviceNum='+deviceId+'&serviceId=urn:micasaverde-com:serviceId:DoorLock1&Variable=Status',ServerRelay,RelaySessionToken,function(response){
    cbfunc(response);
  });
}

function setLockState( ServerRelay,PK_Device,RelaySessionToken, deviceId,state,cbfunc ){
  runVeraCommand('/relay/relay/relay/device/'+PK_Device+'/port_3480/data_request?id=action&DeviceNum='+deviceId+'&serviceId=urn:micasaverde-com:serviceId:DoorLock1&SetTarget='+state,ServerRelay,RelaySessionToken,function(response){
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

function getTemperatureMode( ServerRelay, PK_Device, RelaySessionToken, deviceId, cbfunc ){
  runVeraCommand('/relay/relay/relay/device/' +
    PK_Device +
    '/port_3480/data_request?id=variableget&DeviceNum=' +
    deviceId +
    '&serviceId=urn:upnp-org:serviceId:HVAC_UserOperatingMode1&Variable=ModeStatus',
    ServerRelay,
    RelaySessionToken,
    function(response){
      switch (response){
        case "CoolOn":
          cbfunc("COOL");
          break;
        case "HeatOn":
          cbfunc("HEAT");
          break;
        case "AutoChangeOver":
          cbfunc("AUTO");
          break;
        case "Off":
          cbfunc("OFF");
          break;
        default:
          cbfunc("Unknown");
      }
    }
  );
}

/**
 * Utility functions.
 */

function parseJson(jsonMessage,requestType){
  try {
    return JSON.parse(jsonMessage);
  } catch (ex){
    log("Parsing Error","error parsing JSON message of type " + requestType + ": " + jsonMessage);
    console.error(ex);
  }
}

    function log(message, message1, message2) {
        console.log(message + message1 + message2);
    }

function generateControlError3(directive, code, description) {

	directive.header.name="ErrorResponse";
	directive.payload={type: code,message: description};

  return directive;
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