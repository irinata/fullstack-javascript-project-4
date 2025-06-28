#!/usr/bin/env node

import { Command } from 'commander'
import loadPage from '../src/index.js'

async function command(url) {
  const filepath = await loadPage(url, program.opts().output)
  console.log(filepath)
}

const program = new Command()
program
  .description('Page loader utility')
  .version('1.0.0')
  .argument('<url>')
  .option('-o, --output [dir]', 'output dir', process.cwd())
  .action(command)
  .showHelpAfterError()
  .parse()
