# page-loader

[![hexlet-check](https://github.com/irinata/fullstack-javascript-project-4/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/irinata/fullstack-javascript-project-4/actions/workflows/hexlet-check.yml)
[![Test and lint project](https://github.com/irinata/fullstack-javascript-project-4/actions/workflows/main-test.yml/badge.svg)](https://github.com/irinata/fullstack-javascript-project-4/actions/workflows/main-test.yml)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=irinata_fullstack-javascript-project-4&metric=coverage)](https://sonarcloud.io/summary/new_code?id=irinata_fullstack-javascript-project-4)


gendiff is a utility to download the provided webpage for offline viewing.

## Install

npm ci

npm link

## Usage

page-loader -o /tmp/testdir https://ru.hexlet.io/courses

page-loader can provide detailed logs about its work. Logging is disabled by default.
To enable it set DEBUG environment variable to 'page-loader' for common logs
or 'axios' for axios-specific logs or both.

All logs go to stderr and can be redirected to a file:
DEBUG=page-loader,axios page-loader -o /tmp/testdir https://ru.hexlet.io/courses 2>/tmp/testdir/err.log


## page-loader usage record
Usage example
https://asciinema.org/a/Uq71LEBvjTXZjesiEmfkbBBLm

Turn on logging
https://asciinema.org/a/y1VjngoajPLlnIoe0UOcd0xQk

Directory access error
https://asciinema.org/a/7G6u12g7QcdqNheZlXt4M3fTE

Resource download errors
https://asciinema.org/a/wZ3u5SwmKhqzPYFbP1YwHcVjk
