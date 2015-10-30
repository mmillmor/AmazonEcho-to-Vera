# AmazonEcho-to-Vera

This code allows you to directly connect your Amazon Echo to your Vera. To make it work, you need to follow the steps described at https://developer.amazon.com/public/binaries/content/assets/html/alexa-lighting-api.html

Note, the Amazon Echo requires OAuth2 to connect to the target device. You will need to set up your own OAuth server to do this. I used https://github.com/bshaffer/oauth2-server-php, and you can find the extra files for that in the oauth folder. Be sure to change the function to point to your own oauth server.
