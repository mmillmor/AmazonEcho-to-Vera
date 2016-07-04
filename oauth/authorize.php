<?php
// include our OAuth2 Server object
require_once __DIR__.'/server.php';
$request = OAuth2\Request::createFromGlobals();
$response = new OAuth2\Response();

// validate the authorize request
if (!$server->validateAuthorizeRequest($request, $response)) {
    $response->send();
    die;
}
// display an authorization form
if (empty($_POST)) {
  exit('
    <html>
    <head>
    <title>PowerController for Vera</title>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min.js"></script>
    <link rel="stylesheet" href="https://ajax.googleapis.com/ajax/libs/jqueryui/1.11.4/themes/smoothness/jquery-ui.css">
    <script src="https://ajax.googleapis.com/ajax/libs/jqueryui/1.11.4/jquery-ui.min.js"></script>
    <style>
    body {font-family: Verdana,Arial,sans-serif;}
     </style>
    </head>
    <body>
    <div style="text-align: center"><img  src="logo2_sm.png" /></div>
    <h1 align="center">PowerController for Vera</h1>
    <p>This site is an OAuth2 server for accessing your home automation device from an Amazon Echo device. Please log in with your Vera credentials.
    Note, your encrypted access details will be stored on MillieSoft servers. They will only be used for allowing your Amazon Echo device to talk to
    your home automation device, and will not be transferred, sold or used in any other way.<p>
    <p>If you have more than one Vera device, you can optionally enter the device number to control. If you only have one Vera, leave it blank.</p>
<form method="post">
 <p align="center">
  <input type="text" name="username" placeholder="username"><br/>
  <input type="password" name="password" placeholder="password" value=""><br/>
  <input type="text" name="device" value="" placeholder="optional device number"><br/>
    <button type="submit" name="authorized" value="yes">Authorize</button>&nbsp
    <button type="submit" name="authorized" value="no">Cancel</button>
</p>
</form>
</body>
</html>
    ');
}

// print the authorization code if the user has authorized your client
$is_authorized = ($_POST['authorized'] === 'yes');
$server->handleAuthorizeRequest($request, $response, $is_authorized);
if ($is_authorized) {
  // this is only here so that you get to see your code in the cURL request. Otherwise, we'd redirect back to the client
  $code = substr($response->getHttpHeader('Location'), strpos($response->getHttpHeader('Location'), 'code=')+5, 40);
//  exit("SUCCESS! Authorization Code: $code");
}
$response->send();
?>
