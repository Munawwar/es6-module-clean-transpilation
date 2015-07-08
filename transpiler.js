/**
 * "write once, and compile to anywhere" philosophy.
 * The idea is to use only a subset of ES6 imports during development of a software and to nicely "compile"
 * the code cleanly to any dependency management.
 *
 * Only default import and default single export is supported and nothing else.
 * i.e. "import name from 'path';" and "export default blah;" can be
 * nicely rewritten to *all* of the supported dependency management - CJS, AMD, UMD and globals.
 * The source code being passed needs to keep discipline to follow this subset.
 * Every source file should have exactly one default export (no less and no more).
 */

// I don't want to use a JS parser like acorn for doing this.
var fs = require('fs'),
    nomnom = require("nomnom"),
    sh = require('shelljs');


var importRegEx = /^[ ]*import[ ]*([^ ]+)[ ]*from[ ]*(.+?)[;]*$/,
    exportRegEx = /^([ ]*export[ ]*default[ ]*)(.+?)[;]*$/;


function transform(source, output, opts) {
    var result = source;

    var lf = (/\r\n/).test(source) ? '\r\n' : '\n',
        newlineLength = (/\r\n/).test(source) ? 2 : 1; //assume consistent newline characters.

    var imports = [],
        exports,
        lines = source.split(/(?:\r\n|\n)/);

    var first = {line: -1, char: -1},
        last = {line: -1, char: -1},
        curChar = 0,
        match;

    //Find the first sequence of ES6 imports.
    var line;
    for (var i = 0; i < lines.length; i += 1) {
        line = lines[i];
        if ((match = line.match(importRegEx))) {
            imports.push(match.slice(1));
            if (first.line < 0) {
                first.line = i;
                first.char = curChar;
            }
            last.line = i;
            last.char = curChar + line.length;
        } else if (first.line > -1 && line.trim()) {
            break;
        }
        curChar += line.length + newlineLength;
    }

    //Find the only export line
    exports = {s: -1, e: -1, variableName: '', varPos: -1};
    curChar = 0;
    for (i = 0; i < lines.length; i += 1) {
        line = lines[i];
        if ((match = line.match(exportRegEx))) {
            exports.variableName = match[2];
            exports.varPos = curChar + match[1].length;
            exports.s = curChar;
            exports.e = curChar + line.length;
            break;
        }
        curChar += line.length + newlineLength;
    }

    //If no exports line, assume the file doesn't require compilation.
    //Why? Because this library mandates all JS files to be AMD-fyable even if user don't intend to use AMD.
    //Supporting the "common denominator". Mandatory for users to follow the convention.
    if (exports.s < 0) {
        if (output === 'stdout') {
            console.log(result);
        } else if (output) {
            fs.writeFileSync(output, result);
        }
        return result;
    }

    //helper functions
    function getVars(arr) {
        var code = '';
        arr.forEach(function (im) {
            code += im[0] + ', ';
        });
        if (arr.length) {
            code = code.slice(0, -2);
        }
        return code;
    }
    function getPaths(arr) {
        var code = '';
        arr.forEach(function (im) {
            code += im[1] + ', ';
        });
        if (arr.length) {
            code = code.slice(0, -2);
        }
        return code;
    }

    /**
     * First line is index zero.
     */
    function indent(startLine, endLine) {
        var lines = result.split(/(?:\r\n|\n)/),
            curChar = 0;
        if (endLine < 0) {
            endLine = lines.length + endLine;
        } else {
            endLine = (endLine === undefined || endLine > lines.length) ? lines.length : endLine;
        }
        for (var i = 0; i < endLine; i += 1) {
            var line = lines[i];
            if (i >= startLine) {
                result = result.substr(0, curChar) + '    ' + result.substr(curChar);
                curChar += 4;
            }
            curChar += line.length + newlineLength;
        }
    }
    function insert(s, text) {
        result = result.substring(0, s) + text + result.substring(s);
    }
    function replace(s, e, text) {
        result = result.substring(0, s) + text + result.substring(e);
    }

    //Convert them
    var code;
    if (opts.type === 'amd') {
        //Change things from bottom to up so that inserts/replace doesn't affect subsequent indexes.

        //convert the only export statement
        if (source.slice(-newlineLength) === lf) {
            replace(source.length - newlineLength, source.length, '');
        }
        insert(result.length, lf + '});' + lf);
        replace(exports.s, exports.varPos, 'return ');


        //Convert imports
        code = 'define([' + getPaths(imports) + '], function (' + getVars(imports) + ') {' + lf;

        if (last.char > 0) {
            replace(first.char, last.char + newlineLength, ''); //remove \n as well
        }
        insert((first.char < 0 ? 0 : first.char), code);

        indent((first.line < 0 ? 0 : first.line) + 1, -2);
    } else if (opts.type === 'globals') {
        //Change things from bottom to up so that inserts/replace doesn't affect subsequent indexes.

        var vars = getVars(imports);
        if (vars) {
            vars = ', ' + vars;
        }

        //append
        code = lf + '}(this' + vars + '));' + lf;
        insert(result.length, code);

        //convert the only export statement
        if (source.slice(-newlineLength) === lf) {
            replace(source.length - newlineLength, source.length, '');
        }
        replace(exports.s, exports.varPos, 'global.' + exports.variableName + ' = ');

        //Convert imports
        code = '(function (global' + vars + ') {' + lf;

        if (last.char > 0) {
            replace(first.char, last.char + newlineLength, ''); //remove \n as well
        }
        insert((first.char < 0 ? 0 : first.char), code);

        indent((first.line < 0 ? 0 : first.line) + 1, -2);
    } else if (opts.type === 'cjs') {
        //Change things from bottom to up so that inserts/replace doesn't affect subsequent indexes.

        //convert the only export statement
        if (source.slice(-newlineLength) === lf) {
            replace(source.length - newlineLength, source.length, '');
        }
        replace(exports.s, exports.varPos, 'module.exports = ');

        //Convert imports
        code = '';
        imports.forEach(function (im) {
            code += im[0] + ' = require(' + im[1] + '),' + lf;
        });
        if (imports.length) {
            code = 'var ' + code.slice(0, -1 - newlineLength) + ';' + lf;
        }

        if (last.char > 0) {
            replace(first.char, last.char + newlineLength, ''); //remove \n as well
        }
        insert((first.char < 0 ? 0 : first.char), code);
    }

    if (output === 'stdout') {
        console.log(result);
    } else if (output) {
        fs.writeFileSync(output, result);
    }

    return result;
}

function transpiler(opts) {
    if (opts.input && fs.statSync(opts.input).isDirectory()) {
        (function traverse(inputRoot, dir) {
            //make output directory
            var outputDir = opts.output + '/' + dir.substr(inputRoot.length);
            sh.mkdir('-p', outputDir);

            var files = fs.readdirSync(dir);
            files.forEach(function (file) {
                var path = dir + '/' + file;
                if (file.slice(-3).toLowerCase() === '.js') {
                    transform(fs.readFileSync(path).toString(), outputDir + '/' + file, opts);
                } else if (fs.statSync(path).isDirectory()) {
                    traverse(inputRoot, path);
                } else { //just copy the file over to the directory
                    sh.cp('', path, outputDir + '/' + file);
                }
            });
        }(opts.input, opts.input));
    } else {
        if (opts.output && opts.output !== 'stdout' && opts.output.slice(-3).toLowerCase() !== '.js') {
            sh.mkdir('-p', opts.output);
            var pos = opts.input.lastIndexOf('/');
            opts.output += '/' + opts.input.substr(pos < 0 ? 0 : pos);
        }
        return transform(opts.src || fs.readFileSync(opts.input).toString(), opts.output, opts);
    }
}


if (require.main === module) {
    var opts = nomnom
        .option('input', {
            abbr: 'i',
            help: 'path to file'
        })
        .option('output', {
            abbr: 'o',
            default: 'stdout',
            help: 'path to output file or directory or stdout'
        })
        .option('type', {
            abbr: 't',
            default: 'amd',
            help: 'Type of output required - amd, cjs, umd or globals'
        })
        .parse();

    //Called directly from command-line
    transpiler(opts);
}

module.exports = transpiler;
