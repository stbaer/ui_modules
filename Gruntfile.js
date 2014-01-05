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

//        concat: {
//            options: {
//                separator: ';'
//            }
//            ,
//            dist: {
//                options: {
//                    banner: '<%= banners.base %><%= banners.dist %>'
//                },
//                src: ['...'],
//                dest: 'dist/....js',
//                nonull: true
//            }
//            ,
//
//            css: {
//                options: {
//                    separator: '\n'
//                },
//                src: [ ],
//                dest: '...',
//                nonull: true
//            }
//        },
//        cssmin: {
//            options: {
//                report: 'min'
//            },
//            minify: {
//                files: {
//                    'dist/css/... .css': ['<%= concat.css.dest %>']
//                }
//            }
//        },

        watch: {
            options: {
                livereload: true
            },
            scripts: {
                files: ['<%= jshint.all %>', '!modules/**/*.hbs.js'],
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
//        strip_code: { 'dest.js': 'src.js' },

        clean: {
            builds: ['dist']
        }
    });

    //Register Tasks
    grunt.registerTask('default', ['connect', 'watch']);
    grunt.registerTask('server', ['connect:server:keepalive']);
    grunt.registerTask('build', ['clean', /*'concat' */, 'strip_code', /* 'copy' */, 'cssmin']);
};
