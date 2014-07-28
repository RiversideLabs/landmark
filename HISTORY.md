# Landmark

## v0.1.29 / 2014-07-28

* fixed; errors uploading to cloudinary fields
* fixed; issues starting with SSL
 
## v0.1.28 / 2014-07-25
* fixed; docs domain

## v0.1.27 / 2014-07-25
* fixed; issues saving location field values
* fixed; filtering on select fields was broken in the Admin UI
* added; list totals are recalculated after items are deleted
* added; feature to select images from cloudinary
* fixed; issues with field required / initial validation
* fixed; better handling of default / alt behaviour for remove / delete functionality with cloudinary fields

## v0.1.26 / 2014-07-25

* improved; more Admin UI visual tweaks
* fixed; allowing nested values to be provided to the UpdateHandler for name and location fields
* added; cloudinary folders feature, enabled with field option `folder` or defaulting to `[prefix (if exists)]/[list path]/[path]`
* added; ability to specify a field to use as the cloudinary public_id
* added; cloudinary image replace on upload option
* fixed; initial sortOrder on a sortable List
* added; ability to read multiple static files from an Array
* added; default values for text fields are displayed in the create items form now
