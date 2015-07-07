# ES6 Module Clean Transpilation

## WHY?

Philosophy is to "write once and compile *cleanly* to any dependency management".

The idea is to be **able** to compile to all dependency management (AMD, CJS, globals) even
if you don't intend to publish your library/code with support for all of them.

Secondly the generated code should be usable by existing AMD and globals using code bases.

And hence this comes with some trade-offs and code conventions. Only a subset of the current ES6 module syntax can be supported.
Specifically only default imports and default exports can be supported. Named imports, named imports and bare imports are excluded (more info on that later in this page).

**Hence it is mandatory to follow the convention: All JS files should export a default object and when importing, only use default imports**.

## Usage

The transpiler can be used directly from the command line:

```
node transpiler.js -t amd -i src/ -o dist/
```

Here is the basic usage:

```bash
Usage: node transpiler.js [options]

Options:
   -i, --input    path to file
   -o, --output   path to output file or directory  [stdout]
   -t, --type     Type of output required - amd, cjs, umd or globals  [amd]
```

### Library

You can also use the transpiler as a library:

```javascript
var compiler = require("es6-module-clean-transpilation");

var output = compiler({
  type: 'amd',
  input: 'path/to/input',
  output: 'path/to/output'
});
```

## Supported ES6 Module Syntax

### Default Exports and Imports

You can use *default* export. For example, an ES6ified jQuery might
look like this:

```javascript
// jquery.js
var jQuery = function() {};

jQuery.prototype = {
  // ...
};

export default = jQuery;
```

It is mandatory that **all** javascript files have a default export (only then, AMD can be perfectly supported).

Then, an app that uses jQuery could import it with:

```javascript
import $ from "jquery";
```

The default export of the "jquery" module is now aliased to `$`.

A default export makes the most sense as a module's "main" export, like the
`jQuery` object in jQuery. You can use default and named exports in parallel.

### Unsupported Syntax

### Bare imports

Bare imports like:
```
import "jquery"
```
isn't AMD and CJS friendly (but only globals friendly). Hence, it isn't supported (going with "the common denominator").
One should write code in such a way that all dependency management is supported.

### Named Exports

Won't support named exports nor multiple export statements, as they cannot be compiled to nice AMD code.

If we had to support both default and named exports then *the consumer of a module would have to add boilerplate code* like this:

```js
define(["jquery"],
  function(jQuery) {
    var $ = jQuery['default'];
    ...
  });
```
And *that* isn't convenient for users of your code (especially when trying to use a compiled reusable library in an non-compiled app).

#### `module`

Currently we don't support this as this fork already doesn't support multiple exports. So this syntax is redundant.

The following..:
```js
module foobar from "foobar";
console.log(foobar.foo);  // "foo"
```

..can be replaced with:
```js
import foo from "foobar";
console.log(foo);  // "foo"
```
