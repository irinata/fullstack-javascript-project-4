#!/usr/bin/env node

import { Command } from 'commander'
import loadPage from '../src/page-loader.js'

async function command(url) {
  try {
    const filepath = await loadPage(url, program.opts().output)
    console.log(filepath)
    process.exit(0)
  }
  catch (error) {
    console.error(error.message || error)
    process.exit(1)
  }
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
