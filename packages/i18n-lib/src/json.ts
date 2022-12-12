import { findTextInTs } from './extract/findChineseText';
import { getProjectConfig, getProjectVersion, readSheetData, prettierFile } from './utils';
import { getSpecifiedFiles, readFile, writeFile } from './extract/file';
import { createXlsxFile } from './export';
import * as _ from 'lodash';
import * as fs from 'fs';
import { tsvFormatRows } from 'd3-dsv';

const chalk = require('chalk');

const { log } = console;
const CONFIG = getProjectConfig();

// 导出中文 excel
function exportTextsExcel(allTexts: any[]) {
  // 构建 excel 数据结构
  const sheetData: any[] = [];
  const keyMap = {};
  let total = 0;
  allTexts.length && allTexts.forEach((file) => {
    total += file?.texts?.length || 0;
    file.texts && file.texts.forEach((texts: any) => {
      if (!keyMap[texts.text]) {
        sheetData.push([null, texts.text]);
        keyMap[texts.text] = 1;
      } else {
        keyMap[texts.text]++;
      }
    });
  });

  const content = tsvFormatRows(sheetData);
  if (sheetData.length > 1) {
    createXlsxFile(`export-json_${getProjectVersion() || ''}`, sheetData);
    fs.writeFileSync('export-json.txt', content);
    log(chalk.green(`excel 导出成功, 总计 ${total} 条，去重后${sheetData.length - 1} 条`));
  } else {
    log(chalk.yellow('未检测到中文文本'));
  }
}

// 根据中文 json 文件，生成指定语言的其他语言文件
function updateOtherLangFile(
  allTexts: any[],
  dir: string,
  excelFilePath: string,
  lang?: string,
): void {
  // 读取语言 excel 生成 以中文为 key 的 map 对象
  const sheetData = readSheetData(excelFilePath);
  const prePath = dir.replace(/(.*)\/$/, '$1');
  allTexts.forEach((file) => {
    // 更新语言文件的文件名
    const newFileName = `${prePath}/${lang}${file.file.replace(prePath, '')}`;
    let code = readFile(file.file);
    file.texts.forEach((text: any) => {
      if (sheetData[text.text] !== undefined) {
        code = replaceInJson(code, text, sheetData[text.text]);
      }
    });
    writeFile(newFileName, prettierFile(code));
  });
  //
}

// 替换 json 中的中文
function replaceInJson(code: string, arg: any, val: string) {
  const { start, end } = arg.range;
  const finalReplaceVal = `'${val.replace(/[\\"']/g, '\\$&')}'`;
  return `${code.slice(0, start)}${finalReplaceVal}${code.slice(end)}`;
}


// 扫描 json 文件中的中文文案
function ExtractJsonInText(dir: string, excelFilePath?: string, lang?: string) {
  // const langPath = `${dir}/${CONFIG.srcLang}`
  const files = getSpecifiedFiles(dir, CONFIG.include);
  const filterFiles = files.filter((file) => {
    return file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.vue') || file.endsWith('.js') || file.endsWith('.json');
  });
  // 目录下所有中文文案
  const allTexts = filterFiles.reduce((pre: any[], file: string) => {
    const code = readFile(file);
    const texts = findTextInTs(code, file, true);
    // 调整文案顺序，保证从后面的文案往前替换，避免位置更新导致替换出错
    const sortTexts = _.sortBy(texts, (obj) => -obj.range.start);

    if (texts.length > 0) {
      log(chalk.green(`${file} 发现中文文案 ${texts.length} 条`));
    }
    return texts.length > 0 ? pre.concat({ file, texts: sortTexts }) : pre;
  }, []);

  if (!allTexts.length) {
    return log(chalk.yellow('未发现中文文案'));
  }
  // 将中文导出到 excel
  !excelFilePath && exportTextsExcel(allTexts);
  // 扁平化后的数组列表
  if (excelFilePath && fs.existsSync(excelFilePath)) {
    updateOtherLangFile(allTexts, dir, excelFilePath, lang);
  } else if (excelFilePath) {
    log(chalk.red(`${excelFilePath} 文件不存在`));
  }
}

export default ExtractJsonInText;
