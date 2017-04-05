# Backbone json api
[![Build Status](https://travis-ci.org/dbrekalo/backbone-json-api.svg?branch=master)](https://travis-ci.org/dbrekalo/backbone-json-api)
[![Coverage Status](https://coveralls.io/repos/github/dbrekalo/backbone-json-api/badge.svg?branch=master)](https://coveralls.io/github/dbrekalo/backbone-json-api?branch=master)
[![NPM Status](https://img.shields.io/npm/v/backbone-json-api.svg)](https://www.npmjs.com/package/backbone-json-api)

Backbone Model and Collection extensions for working with json:api formatted datasets and server responses.
Traverse attributes and relations with simple and powerful api.

[Visit documentation site](http://dbrekalo.github.io/backbone-json-api/).

"If you’ve ever argued with your team about the way your JSON responses should be formatted, JSON API can be your anti-bikeshedding tool."
If you are new to JSON api we recommend you browse [json api website](http://jsonapi.org/) and examples to familiarize yourself with specification.
This library is built upon standards and conventions of JSON api and provides a simple way to traverse and retrieve all those attributes and relations.

## Examples and api
Examples coming soon

## Installation
Backbone json api is packaged as UMD library so you can use it in CommonJS and AMD environment or with browser globals.

```bash
npm install backbone-json-api --save
```

```js
// with bundlers
var backboneJsonApi = require('backbone-json-api');

// with browser globals
var backboneJsonApi = window.backboneJsonApi;
```