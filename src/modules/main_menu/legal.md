### Policies

Please find our [Terms of Service](https://www.frankerfacez.com/terms) on our main
website at https://www.frankerfacez.com/terms

## Third-party Services

### Sentry

This client uses Sentry.io for automatic error reporting. When an error occurs, a report
is automatically sent to Sentry's API with information about the error and the state of
the client at the time to assist us with reproducing and fixing the issue. We attempt to filter personal information such as API keys from error reports before they
are submitted to Sentry.

To see an example of the submitted data or to opt-out of automatic error reporting, please
view the settings available under `Data Management > Reporting`.

### Link Information

This client does not directly contact third-party APIs and websites when gathering data
for use in rendering rich content embeds and tool-tips. No personal information is sent
to third-party APIs or websites when gathering information.

Clients request link information from our own API, sending only the exact link requested
without any context such as the channel the client is viewing at the time. Our server
makes requests from third-party APIs and websites on the behalf of the client and formats
the data for clients to display.

We use the APIs of the following services for scraping link information:

* Discord ([Terms of Service](https://discordapp.com/terms), [Developer Terms of Service](https://discordapp.com/developers/docs/legal))
* Gyazo ([Terms of Service](https://gyazo.com/doc/terms))
* Imgur ([Terms of Service](https://imgur.com/tos))
* Pretzel Rocks ([Terms of Service](https://www.pretzel.rocks/terms))
* Splits.io
* Strawpoll.me ([Terms of Service](https://www.curse.com/terms-of-service))
* Twitch ([Terms of Service](https://www.twitch.tv/p/legal/terms-of-service/), [Developer Agreement](https://www.twitch.tv/p/legal/developer-agreement/))
* Twitter ([Terms of Service](https://twitter.com/en/tos), [Developer Terms](https://developer.twitter.com/en/more/developer-terms.html))
* xkcd
* YouTube ([Terms of Service](https://www.youtube.com/t/terms), [Developer Terms of Service](https://developers.google.com/youtube/terms/developer-policies))

In addition to scraping via APIs, our link information reads standard metadata tags from
HTML responses to support a wide array of other websites.

### Link Thumbnails

Thumbnail images for links are proxied through our own servers to avoid leaking user IP
addresses or other HTTP headers to third-party servers. We do not proxy thumbnail images
for a specific, trusted subset of websites. Websites we do not proxy image requests for
are as follows:

* Discord
* Gyazo
* Imgur
* Pretzel Rocks
* Twitch
* Twitter
* xkcd
* YouTube