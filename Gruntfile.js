/*jslint node: true */
"use strict";

module.exports = function (grunt)
{
    grunt.initConfig(
    {
        jshint: {
            src: [ '*.js', 'test/**/*.js' ]
        },

        mochaTest: {
            src: ['test/*.js'],
            options: {
                bail: true
            }
        },

        apidox: {
            input: ['index.js'],
            output: 'README.md',
            fullSourceDescription: true,
            extraHeadingLevels: 1
        },

        bgShell: {
            cover: {
                cmd: './node_modules/.bin/istanbul cover ./node_modules/.bin/grunt -- test',
                fail: true,
                execOpts: {
                    maxBuffer: 0
                }
            },

            check_cover: {
                cmd: './node_modules/.bin/istanbul check-coverage --statement 100 --branch 100 --function 100 --line 100'
            },

            coveralls: {
                cmd: 'cat coverage/lcov.info | coveralls'
            },

            certs: {
                cmd: 'make -C test -f Makefile.certs',
                fail: true
            }
        }
    });
    
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-apidox');
    grunt.loadNpmTasks('grunt-bg-shell');

    grunt.registerTask('lint', 'jshint');
    grunt.registerTask('test', ['bgShell:certs', 'mochaTest']);
    grunt.registerTask('docs', 'apidox');
    grunt.registerTask('coverage', ['bgShell:cover', 'bgShell:check_cover']);
    grunt.registerTask('coveralls', 'bgShell:coveralls');
    grunt.registerTask('default', ['lint', 'test']);
};
