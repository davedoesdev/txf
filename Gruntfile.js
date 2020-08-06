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

        exec: {
            cover: "./node_modules/.bin/nyc -x Gruntfile.js -x 'test/**' ./node_modules/.bin/grunt test",

            cover_report: './node_modules/.bin/nyc report -r lcov',

            cover_check: './node_modules/.bin/nyc check-coverage --statements 100 --branches 100 --functions 100 --lines 100',

            coveralls: 'cat coverage/lcov.info | coveralls',

            certs: 'make -C test -f Makefile.certs'
        }
    });
    
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-mocha-test');
    grunt.loadNpmTasks('grunt-apidox');
    grunt.loadNpmTasks('grunt-exec');

    grunt.registerTask('lint', 'jshint');
    grunt.registerTask('test', ['exec:certs', 'mochaTest']);
    grunt.registerTask('docs', 'apidox');
    grunt.registerTask('coverage', ['exec:cover',
                                    'exec:cover_report',
                                    'exec:cover_check']);
    grunt.registerTask('coveralls', 'exec:coveralls');
    grunt.registerTask('default', ['lint', 'test']);
};
