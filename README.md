# My Loopback Filter.

[![CircleCI](https://circleci.com/gh/yshing/my-loopback-filter.svg?style=svg&circle-token=5ff072c7aa6a9f9a0fa533d29ab223b0fbde72a1)](https://circleci.com/gh/yshing/my-loopback-filter)

Current `Loopback-filters` package doesn't compliance with the actual behavior of the filter function in loopback and cannot run in browser.

Spent few hour to make this, everything is taken from existing Memory Connector Implementation @strongloop/loopback-datasource-juggler, so the beheavior would match.

Removed the hidden dependency of `nodejs-core/assert` so it should run in browser (webpack-ed).

Testcase was taken from @strongloop/loopback-filters.

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
