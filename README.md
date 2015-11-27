# AmazonEcho-to-Vera

Amazon Echo to Vera integration, Martin Millmore, [MillieSoft](http://www.millisoft.co.uk).

# Introduction

This code allows you to directly connect your Amazon Echo to your Vera. To make it work, you need to follow the steps described at https://developer.amazon.com/public/binaries/content/assets/html/alexa-lighting-api.html

Note, the Amazon Echo requires OAuth2 to connect to the target device. You will need to set up your own OAuth server to do this. I used https://github.com/bshaffer/oauth2-server-php, and you can find the extra files for that in the oauth folder. Be sure to change the function to point to your own oauth server.

## Detailed instructions

### Setting up the code on AWS

1. Register for an Amazon developer account at http://aws.amazon.com/
2. Create a new Lambda Function and give it the permissions to run from the Amazon Echo. Full steps to do this are described at https://developer.amazon.com/public/binaries/content/assets/html/alexa-lighting-api-lambda-integration.html. The code you load for the Lambda function is alexa_lambda.js

### Setting up the OAuth2 server - option 1, deploy your own server

1. You'll need to have your own web site somewhere. This is really cheap these days, and you can easily find one for $5 a month or less if you don't already have one. You're going to need an ssl certificate though, so look out for one which has free shared or cheap individual ssl hosting.
2. Create a folder called "auth" below your main web site. Download and install the code from https://github.com/bshaffer/oauth2-server-php in to it
```
mkdir auth
cd auth
git clone https://github.com/bshaffer/oauth2-server-php.git -b master
```
3. Put the files from the oauth folder in to the auth directory. Make sure you copy the .htaccess file - it is required for the Authorization headers to be passed on to the code
4. Create a mysql database on your host for your oauth server. Create the tables as described in the schema step of http://bshaffer.github.io/oauth2-server-php-docs/cookbook/
5. Edit server.php to add your database connection details just below the `<?php` line. You'll need your database host, database name, database user and database user password
```
<?php
$dsn      = 'mysql:dbname=my_database_name;host=my_database_host';
$username = 'my_database_user';
$password = 'my_database_password';
```
6. In mysql, insert a row for the amazon client to talk to. You'll need to generate a random password. Also generate a row for the google test client to talk to - we'll use that to test our code
```
INSERT INTO oauth_clients (client_id, client_secret, scope,redirect_uri) VALUES ("echo_vera", "my_oauth_secret","profile" "https://pitangui.amazon.com/partner-authorization/establish");
INSERT INTO oauth_clients (client_id, client_secret, scope,redirect_uri) VALUES ("googletestclient", "test_secret","basic" "https://developers.google.com/oauthplayground");
```
7. Go to https://developers.google.com/oauthplayground/ to test your OAuth2 server. Click on the gear icon in the top right corner, and change the OAuth endpoints from Google to Custom. Enter your URL for the authorize.php and token.php endpoints (e.g. ```https://www.myserver.com/auth/authorize.php``` and ```https://www.myserver.com/auth/token.php```), and enter your client_id as  ```googletestclient``` and your client secret as ```test_secret```.
8. On the left hand side, type in a scope of ```basic``` and press Authorize APIs. If your OAuth2 server is set up correctly, it will redirect you to a login page to enter your Vera access details. Log in with your Vera remote user account.
9. This will send you back to Google with an access authorization code. Click on Exchange authorization code for tokens - and be quick, the code is only valid for 30 seconds
10. Now you can test the URL which gets the user details. In the request box, enter the url for get_user_details, e.g.  ```https://myserver.com/auth/get_user_details.php```. Press Send the request, and you should get your username and a hashed version of your password.

### Setting up the OAuth2 server - option 2, use Login With Amazon

If you don't want to deploy your own OAuth server, you can instead use Login With Amazon. To register for that, create an account at Login With Amazon as described at https://developer.amazon.com/public/community/post/TxNL8HYBBE7YTE/Tips-for-Using-Login-with-Amazon-in-Alexa-Connected-Home-CoHo-Skills

Note, if you use Login With Amazon, your credentials won't be stored on the OAuth server, so they have to be hard coded in the lambda file. Use the file alexa_lambda_amazon_oauth.js instead, entering your username and encoded password in there. You can use the file generate_sha1_password.html to generate your encoded password.

### Testing in Amazon

Now that you have a working OAuth2 server, you can test in Amazon. 

1. Open your lambda code again, and edit it. Go to the function getLoginDetails and put your server host name in there, e.g. ```www.myserver.com```.
2. Click on Actions, then Configure Test Event. Paste the contents of examples/discovery_input.json in to the test window. Change the text enterAccessToken for an access token from your google tests. Make sure it is still a valid access token - they do expire after a few hours. 
3. Click on Submit. You should see the code run and give you a list of devices on your Vera.

### Making it work with your Echo

You need to e-mail Amazon to ask them to enabled your code to run against your account. To do that, see steps 5, 6 and 7 of the **What You Need to Do** section at  https://developer.amazon.com/public/binaries/content/assets/html/alexa-lighting-api.html. 


### Help!

If something doesn't work, there is a forum on micasaverde at http://forum.micasaverde.com/index.php/topic,34527.0.html
