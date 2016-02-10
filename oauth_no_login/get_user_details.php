<?php
  
// include our OAuth2 Server object
require_once __DIR__.'/server.php';

  if (!$server->verifyResourceRequest(OAuth2\Request::createFromGlobals())) {
    $server->getResponse()->send();
    die;
  }
  

$token = $server->getAccessTokenData(OAuth2\Request::createFromGlobals());
  $userComponents=explode(':',$token['user_id']);
  
  $user=array();
  if(count($userComponents==2)){
    $user["username"]=$userComponents[0];
    $user["password"]=$userComponents[1];
  }
header('Content-Type: application/json');
  echo json_encode($user);

?>
