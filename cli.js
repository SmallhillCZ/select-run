#!/usr/bin/env node

/**
 * @author Alek Shnayder
 * See LICENSE file in root directory for full license.
 */
"use strict"

const chalk = require('chalk');
const fuzzy = require('fuzzy')
const path = require('path');
const inquirer = require('inquirer');
const npmRunAll = require("npm-run-all");
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');

const packageJsonPath = path.join(process.cwd(), 'package.json');

const argv = yargs(hideBin(process.argv))
  .command('[filter]', 'select and run scripts', (yargs) => {
    return yargs.positional('filter', {describe: 'pre-filter scripts'})
  })
  .option('aggregate-output', {
    type: 'boolean',
    description: 'Avoid interleaving output by delaying printing of each command\'s output until it has finished.'
  })
  .option('continue-on-error', {
    alias: 'c',
    type: 'boolean',
    description: 'Set the flag to continue executing other/subsequent tasks even if a task threw an error. \'npm-run-all\' itself will exit with non-zero code if one or more tasks threw error(s).'
  })
  .option('max-parallel', {
    type: 'number',
    description: 'Set the maximum number of parallelism. Default is unlimited.'
  })
  .option('npm-path', {
    type: 'string',
    description: 'Set the path to npm. Default is the value of environment variable npm_execpath. If the variable is not defined, then it\'s "npm." In this case, the "npm" command must be found in environment variable PATH.'
  })
  .option('print-label', {
    alias: 'l',
    type: 'boolean',
    description: 'Set the flag to print the task name as a prefix on each line of output. Tools in tasks may stop coloring their output if this option was given.'
  })
  .option('print-name', {
    alias: 'n',
    type: 'boolean',
    description: 'Set the flag to print the task name before running each task.'
  })
  .option('parallel', {
    alias: 'p',
    type: 'boolean',
    description: 'Run a group of tasks in parallel. e.g. \'npm-run-all -p foo bar\' is similar to \'npm run foo & npm run bar\'.'
  })
  .option('race', {
    alias: 'r',
    type: 'boolean',
    description: 'Set the flag to kill all tasks when a task finished with zero. This option is valid only with \'parallel\' option.'
	  })
  .option('sequential', {
    alias: 's',
    type: 'boolean',
    description: 'Run a group of tasks sequentially. e.g. \'npm-run-all -s foo bar\' is similar to \'npm run foo && npm run bar\'. \'--serial\' is a synonym of \'--sequential\'.'
  })
  .option('serial', {
    type: 'boolean',
    description: '\'--serial\' is a synonym of \'--sequential\'.'
  })
  .option('silent', {
    type: 'boolean',
    description: 'Set \'silent\' to the log level of npm.'
	})
  .parse()
  console.log(argv)

const [filter] = argv["_"]

if(filter){
	console.log(chalk.yellow('Pre-filtered on:'), filter);
}

let packageJson;
try{
	packageJson = require(packageJsonPath);
}
catch(error) {
	// no package.json found
	errorMsg('package.json could not be read, you in the right directory?')
}

console.log(chalk.gray(`path: ${packageJsonPath}\n`) );

/* add checkbox-plus to inquirer prompt type */
inquirer.registerPrompt('checkbox-plus', require('inquirer-checkbox-plus-prompt'));
userInterview();



/**
 * @function userInterview
 * start the user interview with checkbox multi-select
 */
function userInterview () {
	const interviewMessage =
		`Select scripts -- (Press ${chalk.cyan('<space>')} to select,` +
		` ${chalk.cyan('<return>')} to complete)` +
		`\n${chalk.yellow('filter')}: `;

	inquirer
		.prompt({
			type:"checkbox-plus",
			name: 'selectedScripts',
			message:interviewMessage,
			pageSize: 15,
			highlight: true,
			searchable: true,
			default: [filter],
			source: (_answersSoFar, input) => {
				input = input || (filter ? filter : '');
				return new Promise((resolve) => {
				const fuzzyResult = fuzzy.filter(input, Object.keys(packageJson.scripts));
				const data = fuzzyResult.map(element => element.original);
				resolve(data);
				});
			},
			choices: Object.keys(packageJson.scripts)
		})
		.then(selected => {
			runSelected(selected)
		})
		.catch(err => errorMsg(`inquirer interview failed, \n${err}`));
}



/**
 * @function runSelected
 * run the npm scripts that were selected
 * @param {string[]} selectedScripts - keys of package.json scripts
 */
function runSelected({selectedScripts}) {
	if( selectedScripts && selectedScripts.length > 0 ) {
		console.log(`\n[ ${chalk.green('running selected scripts')} ]`)
		npmRunAll(selectedScripts, {
			stdout: process.stdout,
			stderr: process.stderr,
      aggregateOutput: argv['aggregate-output'],
      continueOnError: argv['continue-on-error'],
      maxParallel: argv['max-parallel'],
      npmPath: argv['npm-path'],
      printLabel: argv['print-label'],
			parallel: argv['parallel'],
      printName: argv['print-name'],
      race: argv['race'],
      sequential: argv['sequential'] || argv['serial'],
      silent: argv['silent'],
    }).catch((err) => {
			errorMsg(`run-all failed, \n${err}`)
    });
	} else {
		console.log(chalk.gray('nothing selected'));
		process.exit(0);
	}
}



/**
 * @function errorMsg
 * give user error messages
 * @param {string} msg - message to be logged out
 * @param {boolean} exit - if should exit after message, default true
 */
function errorMsg (msg, exit = true) {
	console.error(chalk.red(`Error! ${msg}`));
	exit && process.exit(1);
}