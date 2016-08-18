# AmazonEcho-to-Vera for Amazon Smart Home V2


Amazon Echo to Vera integration, Martin Millmore, [MillieSoft](http://www.millisoft.co.uk).

# Introduction

This code allows you to control your Vera home automation system using your Amazon Echo, using the standard Echo home automation techniques (i.e. no bridge needs to be hosted or any other hacks). You need to deploy it yourself on the (free) Amazon cloud because Amazon won't approve for distribution a skill which doesn't connect to a system which uses OAuth. You can run it yourself though - just not distribute it.

Note, the Amazon Echo still requires OAuth2 to connect to the target device. Since the Vera does not support OAuth2, you need to set one a different OAuth2 server. Fortunatly you can use Login with Amazon as a dummy OAuth server and add your credentials in the code. This is simple to do and is free. 

Instructions for setup are in SetupSteps.pdf

### Help!

If something doesn't work, there is a forum on micasaverde at http://forum.micasaverde.com/index.php/topic,34527.0.html
