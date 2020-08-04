#!/usr/bin/env node

import { version } from '../package.json';
const program = require('commander');

program
  .version(version)
  .command('init [project-name]', 'Create a react project with actbase')
  .command('i18n', 'init Language Pack')
  .command('assets', 'apply to assets')
  .command('codepush', 'apply to code-push')
  .command('bugsnag', 'apply to bugsnag')
  .parse(process.argv);
