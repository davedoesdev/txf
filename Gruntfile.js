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
                cmd: './node_modules/.bin/nyc ./node_modules/.bin/grunt test',
                fail: true,
                execOpts: {
                    maxBuffer: 0
                }
            },

            cover_report: {
                cmd: './node_modules/.bin/nyc report -r lcov',
                fail: true
            },

            cover_check: {
                cmd: './node_modules/.bin/nyc check-coverage --statements 100 --branches 100 --functions 100 --lines 100',
                fail: true
            },

            coveralls: {
                cmd: 'cat coverage/lcov.info | coveralls',
                fail: true
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
    grunt.registerTask('coverage', ['bgShell:cover',
                                    'bgShell:cover_report',
                                    'bgShell:cover_check']);
    grunt.registerTask('coveralls', 'bgShell:coveralls');
    grunt.registerTask('default', ['lint', 'test']);
};
