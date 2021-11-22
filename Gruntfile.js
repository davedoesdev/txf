/*jslint node: true */
"use strict";

const c8 = "npx c8 -x Gruntfile.js -x 'test/**'";

module.exports = function (grunt)
{
    grunt.initConfig(
    {
        jshint: {
            src: [ '*.js', 'test/**/*.js' ],
            options: {
                esversion: 6
            }
        },

        apidox: {
            input: ['index.js'],
            output: 'README.md',
            fullSourceDescription: true,
            extraHeadingLevels: 1
        },

        exec: Object.fromEntries(Object.entries({
            test: 'mocha --bail',

            cover: `${c8} npx grunt test`,

            cover_report: `${c8} report -r lcov`,

            cover_check: `${c8} check-coverage --statements 100 --branches 100 --functions 100 --lines 100`,

            certs: 'make -C test -f Makefile.certs'
        }).map(([k, cmd]) => [k, { cmd, stdio: 'inherit' }]))
    });
    
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-apidox');
    grunt.loadNpmTasks('grunt-exec');

    grunt.registerTask('lint', 'jshint');
    grunt.registerTask('test', ['exec:certs', 'exec:test']);
    grunt.registerTask('docs', 'apidox');
    grunt.registerTask('coverage', ['exec:cover',
                                    'exec:cover_report',
                                    'exec:cover_check']);
    grunt.registerTask('default', ['lint', 'test']);
};
