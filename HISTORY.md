# Landmark


## v0.1.18 / 2014-06-19

* updated; Admin UI visual tweaks
* added; new CSRF implementation for more granular control
* fixed; several UI and functionality issues with the new list recent-searches feature
* added; S3 file - ability to specify a protocol for the file url
* added; `cookie signin` option to control session persistence
* added; `session options` option for better control over keys and stores, also exposes the final configuration after `start()` is called, thanks [killerbobjr](https://github.com/killerbobjr)
* improved; Landmark now throws an error when no cookie secret is provided


## v0.1.17 / 2014-06-06
 +
 +* added; recent searches UI and functionality in the Admin UI
 +* fixed; strict type checking for field.options.required
 +* added; `CloudinaryImage.updateItem()`` allows updates from data
 +* added; native support for node-sass via the `sass` option, make sure you include `node-sass` in your project dependencies to use it
 +* fixed; field validation methods for location & password fields
 +* fixed; `landmark.createItems()` now creates items in series, not parallel
 +* added; support for dynamic queries for relationship values in `landmark.createItems()`
 +* added; verbose logging and strict ref checking options for `landmark.createItems()`
 +* improved; performance when using the `id` property as part of a field's autokey

## v0.1.0 / 2014-05-27

* Initial release.
