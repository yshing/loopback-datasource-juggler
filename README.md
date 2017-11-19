# My Loopback Filter.

Current Loopback-filters module doesn't compliance with the actual behavior of the filter function in loopback and Cannot run in browser.

This is the Loopback style filter implentmation taken from the current Memory Connector @strongloop/loopback-datasource-juggler.

Testcase was taken from @strongloop/loopback-filters.

Modified to suit into both browser (webpack-ed) and node.

## This package exports:
### 1. applyLoopbackFilter : Fn (<ArrayOfObjects>, <LoopbackStyleFilter>) => Filtered Array (Copied) .
Example:  
```js
var filter = require('my-loopback-filter');
var morties = [
    {no: 1, dead: false, earth: 1012, location: {lat: 22.2799926, lng: 114.1827414}},
    {no: 2, dead: false, earth: 208, location: {lat: 22.278762, lng: 114.170961}},
    {no: 3, dead: true, earth: 309, location: {lat: 21.5799926, lng: 113.1827414}, b: 4},
    {no: 4, dead: false, earth: 107, location: {lat: 22.278762, lng: 114.130961}},
    ];
var filterOption = {
        order: 'earth DESC',
        where: {
            dead: false,
            earth: {lt: 300},
            location: {
                near: {
                    lat: 22.278762,
                    lng: 114.170961
                },
                maxDistance: 1,
                unit: 'kilometers'
            }       
        }
    };
filter.applyLoopbackFilter(morties, filterOption);
/* returns:
[ { no: 2,
    dead: false,
    earth: 208,
    location: { lat: 22.278762, lng: 114.170961 } } ]
Morty NO.4 is too far away from destinated location, if maxDestance set to 5 it will return
[ { no: 2,
    dead: false,
    earth: 208,
    location: { lat: 22.278762, lng: 114.170961 } },
  { no: 4,
    dead: false,
    earth: 107,
    location: { lat: 22.278762, lng: 114.130961 } } ]
*/

```
### 2. whereFilter: Fn (<LoopbackStyleFilter>) => SortingFunction
Example:
```js
var filter = require('my-loopback-filter');
var morties = [
    {no: 1, dead: false, earth: 1012, location: {lat: 22.2799926, lng: 114.1827414}},
    {no: 2, dead: false, earth: 208, location: {lat: 22.278762, lng: 114.170961}},
    {no: 3, dead: true, earth: 309, location: {lat: 21.5799926, lng: 113.1827414}, b: 4},
    {no: 4, dead: false, earth: 107, location: {lat: 22.278762, lng: 114.130961}},
    ];
var whereFilter = filter.whereFilter({
    where: {no: {gte: 4}}
})
morties.filter(whereFilter)
/*
[ { no: 4,
    dead: false,
    earth: 107,
    location: { lat: 22.278762, lng: 114.130961 } } ]
*/
```
## Documentation:
As the Loopback 3 filters
https://loopback.io/doc/en/lb3/Querying-data.html
https://loopback.io/doc/en/lb3/Where-filter.html
