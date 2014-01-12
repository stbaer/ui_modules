/*global module:false*/
module.exports = function (grunt) {

    require('load-grunt-tasks')(grunt);
    require('time-grunt')(grunt);

    grunt.initConfig({

        // meta
        pkg: grunt.file.readJSON('package.json'),
        banners: grunt.file.readJSON('banners.json'),
        // tasks
        jshint: {
            options: {
                jshintrc: '.jshintrc',
                reporter: require('jshint-stylish')
            },
            all: ['Gruntfile.js', 'modules/**/*.js', '!modules/**/*.hbs.js']
        },

        concat: {
            options: {
                separator: ';'
            },
            colorpicker: {
                src: ['assets/spectrum/spectrum.js', 'modules/colorpicker/colorpicker.js'],
                dest: 'dist/colorpicker/colorpicker.js',
                nonull: true
            },
            colorpicker_css: {
                src: ['assets/spectrum/spectrum.css' /*, 'modules/colorpicker/*.css' */],
                dest: 'dist/colorpicker/colorpicker.css',
                nonull: true
            },
            numspin: {
                src: ['modules/numspin/numspin.js'],
                dest: 'dist/numspin/numspin.js',
                nonull: true
            },
            numspin_css: {
                src: ['modules/numspin/numspin.css'],
                dest: 'dist/numspin/numspin.css',
                nonull: true
            },
            dist: {
                options: {
                    banner: '<%= banners.base %><%= banners.dist %>'
                },
                src: ['<%= concat.colorpicker.src %>', '<%= concat.numspin.src %>'],
                dest: 'dist/ui_modules.js',
                nonull: true
            },

            css: {
                options: {
                    separator: '\n',
                    banner: '<%= banners.base %><%= banners.dist_css %>'
                },
                src: ['<%= concat.colorpicker_css.src %>', '<%= concat.numspin_css.src %>'],
                dest: 'dist/ui_modules.css',
                nonull: true
            }
        },
        cssmin: {
            options: {
                report: 'min'
            },
            minify: {
                files: {
                    'dist/ui_modules.min.css': ['<%= concat.css.dest %>']
                }
            }
        },

        watch: {
            options: {
                livereload: true
            },
            scripts: {
                files: ['<%= jshint.all %>'],
                tasks: ['newer:jshint:all', 'build'],
                options: {
                    spawn: false
                }
            },
            reloadOnly: {
                files: ['demo/**/*.html']
            }
        },

        connect: {
            server: {
                options: {
                    port: 9000,
                    base: './'
                }
            }
        },

        //        copy: {
        //
        //        },

        // will remove anything between: test-code' and test-code-end block comments
        strip_code: { '<%= concat.dist.dest %>': '<%= concat.dist.dest %>' },

        clean: {
            builds: ['dist']
        }
    });

    //Register Tasks
    grunt.registerTask('default', ['connect', 'watch']);
    grunt.registerTask('server', ['connect:server:keepalive']);
    grunt.registerTask('build', ['concat', 'strip_code' /*, 'copy' */, 'cssmin']);
};
