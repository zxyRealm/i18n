#!/usr/bin/env node

import * as inquirer from 'inquirer';
import { initProject } from './init';
import { exportMessages } from './export';
import { importMessages } from './import';
import { exportExcel } from './excel-export';
import { compareExcel } from './excel-compare';
import { findUnUsed } from './unused';
import { translateExcelLanguage } from './mock';
import { extractAll } from './extract/extract';
import { update } from './update';
import { sameExcel } from './excel-same';
import { exportRepeatWords } from './deduplication';
import JsonScanner from './json';
import * as ora from 'ora';
import * as chalk from 'chalk';

const leven = require('leven');
const { Command } = require('commander');

const program = new Command();

/**
 * 进度条加载
 * @param text
 * @param callback
 */
function spining(text: string, callback: Function) {
  const spinner = ora({
    text: `${text}中...`,
    color: 'green',
  }).start();

  const timer = setInterval(() => {
    if (spinner.isSpinning) {
      spinner.text = `${text}中...`;
    }
  }, 1000);
  if (callback) {
    callback();
  }
  spinner.succeed(`${text}成功`);
  clearInterval(timer);
}

program
  .version(`kiwi ${require('../package.json').version}`)
  .usage('<command> [options]');


program
  .option('--init', '初始化项目', { isDefault: true })
  .option('--import [file] [lang]', '导入翻译文案')
  .option('--export [file] [lang]', '导出未翻译的文案')
  .option('--excel [langDir] [lang]', '导出 excel')
  .option('--compare [originFile] [targetFile]', '对比导出 key 差异')
  .option('--same [originFile] [targetFile] [targetFileValueIndex] [targetFileKeyIndex]', '同步excel中相同内容')
  .option('--update [file] [lang]', '更新语言包')
  .option('--json [file]', 'json 数据中文扫描')
  .option('--dedup', '提取重复文案')
  .option('--sync', '同步各种语言的文案')
  .option('--mock', '使用 Google 翻译')
  .option('--unused', '导出未使用的文案')
  .option('--extract [dirPath]', '一键替换指定文件夹下的所有中文文案')
  .parse(process.argv);

if (program.init) {
  (async () => {
    const result = await inquirer.prompt({
      type: 'confirm',
      name: 'confirm',
      default: true,
      message: '项目中是否已存在kiwi相关目录？',
    });

    if (!result.confirm) {
      spining('初始化项目', async () => {
        initProject();
      });
    } else {
      const value = await inquirer.prompt({
        type: 'input',
        name: 'dir',
        message: '请输入相关目录：',
      });
      spining('初始化项目', async () => {
        initProject(value.dir);
      });
    }
  })();
}

if (program.compare) {
  spining('对比导出excel 中 key 差异', () => {
    if (program.compare === true || program.args.length === 0) {
      console.log('请按格式输入：--compare originFile targetFile');
    } else if (program.args) {
      compareExcel(program.compare, program.args[0]);
    }
  });
}

if (program.json) {
  spining('JSON 文件中文文本扫描', () => {
    if (program.json === true) {
      console.log('请按格式输入：--json [path] [originFile] [lang]');
    } else {
      if (program.args[0] && !program.args[1]) {
        console.log(chalk.red('请按格式输入：--json [path] [originFile] [lang]'));
      }
      JsonScanner(program.json, ...program.args);
    }
  });
}


if (program.same) {
  spining('excel 相同内容同步', () => {
    if (program.same === true || program.args.length === 0) {
      console.log('请按格式输入：--same originFile targetFile [targetFileValueIndex] [targetFileKeyIndex]');
    } else if (program.args) {
      const [targetFile, ...rest] = program.args;
      sameExcel(program.same, targetFile, ...rest);
    }
  });
}

if (program.dedup) {
  spining('提取重复文案', () => {
    exportRepeatWords();
  });
}

// export all language excel file
program
  .command('excel <langDir>')
  .description('导出 excel')
  .option('-d --dir [langDir]', '导出文件路径地址')
  .option('-l --lang [lang]', '导出语言文件类型')
  .action((cmd: string) => {
    console.log('cmd', cmd);
  });

if (program.excel) {
  spining('导出 excel', () => {
    console.log('args', program.args);
    exportExcel(program.args.length && program.excel, program.args && program.args[0]);
  });
}

if (program.import) {
  spining('导入翻译文案', () => {
    if (program.import === true || program.args.length === 0) {
      console.log('请按格式输入：--import [file] [lang]');
    } else if (program.args) {
      importMessages(program.import, program.args[0]);
    }
  });
}

if (program.export) {
  spining('导出未翻译的文案', () => {
    if (program.export === true && program.args.length === 0) {
      exportMessages();
    } else if (program.args) {
      exportMessages(program.export, program.args[0]);
    }
  });
}

// if (program.sync) {
//   spining('文案同步', () => {
//     sync();
//   });
// }

if (program.update) {
  spining('文案更新', () => {
    if (program.update === true && program.args.length === 0) {
      update();
    } else if (program.args.length) {
      update(program.update, ...program.args);
    } else {
      console.warn('请按格式输入：--update [file] [lang]');
    }
  });
}

if (program.unused) {
  spining('导出未使用的文案', () => {
    findUnUsed();
  });
}

if (program.mock) {
  const spinner = ora('使用 Google 翻译中...').start();
  if (program.mock === true) {
    translateExcelLanguage(program.args[0], program.args[1], program.args[2]);
    spinner.succeed('使用 Google 翻译成功');
  }
}

if (program.extract) {
  if (program.extract === true) {
    extractAll();
  } else {
    extractAll(program.extract);
  }
}


// output help information on unknown commands
program
  .arguments('<command>')
  .action((cmd: string) => {
    program.outputHelp();
    console.log(`  ${chalk.red(`Unknown command ${chalk.yellow(cmd)}.`)}`);
    suggestCommands(cmd);
  });

// add some useful info on help
program.on('--help', () => {
  console.log(`  Run ${chalk.cyan('kiwi <command> --help')} for detailed usage of given command.`);
});

function suggestCommands(unknownCommand: any) {
  const availableCommands = program.commands.map((cmd: any) => cmd._name);

  let suggestion: any;

  availableCommands.forEach((cmd: any) => {
    const isBestMatch = leven(cmd, unknownCommand) < leven(suggestion || '', unknownCommand);
    if (leven(cmd, unknownCommand) < 3 && isBestMatch) {
      suggestion = cmd;
    }
  });

  if (suggestion) {
    console.log(`  ${chalk.red(`Did you mean ${chalk.yellow(suggestion)}?`)}`);
  }
}

