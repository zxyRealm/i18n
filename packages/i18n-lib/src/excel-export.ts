import {
  getProjectConfig,
  getAllData,
} from './utils';

const fs = require('fs-extra');
const slash = require('slash2');
const dirs = require('node-dir');
const xlsx = require('node-xlsx').default;

const chalk = require('chalk');

const { log } = console;

export function readFile(filename: string) {
  return fs.readFileSync(filename, { encoding: 'utf8' });
}

// 统一表头格式
const sheetHeader = (lang?: string) => {
  return [
    'key',
    lang || '原文',
    '译文',
  ];
};

// 列宽设置
const sheetOptions = { '!cols': [{ wch: 30 }, { wch: 40 }, { wch: 40 }, { wch: 40 }, { wch: 40 }] };

// 遍历语言包文件
function exportExcel(langDir?: string, lang?: string) {
  const CONFIG = getProjectConfig();
  langDir = langDir || CONFIG.kiwiDir;
  const directory = fs.readdirSync(langDir);
  // 语言包目录深度
  const langDirLength: number = langDir.split('/').filter((i) => i && i !== '.').length;
  // 语言文件名称列表
  const excelList = directory.filter((dir: string) => !/\.[a-zA-Z-_\d]+$/.test(dir));

  dirs.readFiles(langDir, {
    match: /\.(js|ts|json)$/,
  }, (error: any, content: any, next: Function) => {
    if (error) throw new Error(error);
    next();
  }, (error: any, files: any[]) => {
    if (error) throw new Error(error);
    // 根据 locales 目录下的一级目录区分语言类型
    const langObj = {};

    files.map((file) => slash(file)).forEach((item) => {
      // 语言包文件一级目录视为语言类型
      const langName = item.split('/')[langDirLength];
      // 是否是语言类型文件夹名，排除非文件夹
      const isLangDir = !/\.[a-zA-Z-_\d]+$/.test(langName);
      if (isLangDir) {
        langObj[langName] ? langObj[langName].push(item) : langObj[langName] = [item];
      }
    });
    const allDataList: any[] = [];

    Object.keys(langObj).forEach((langName) => {
      if (lang && !langObj[lang]) {
        return log(chalk.red(`${lang} 语言文件不存在，请从 ${excelList.join('|')} 中选取`));
      }
      const dataObj = getAllData(lang ? langObj[lang] : langObj[langName]);
      if (lang) {
        if (langObj[lang]) createXlsxFile(langName, dataObj);
      } else {
        createXlsxFile(langName, dataObj);
        allDataList.push(dataObj);
      }
    });

    createXlsxFile('all', ...allDataList);
  });
}

// 根据原文件目录结构生成新文件目录
function createXlsxFile(filename: string, ...sheetData: any[]) {
  const CONFIG = getProjectConfig();
  const { sortOriginIndex, sortTargetIndex } = CONFIG.excelOptions;
  let data = [sheetHeader()];
  const newRootDir = './export-excel';
  Object.keys(sheetData[0]).forEach((key) => {
    if (key) {
      const dataList = (k: string) => sheetData.map((d) => d[k]);
      data.push([key, ...dataList(key)]);
    }
  });

  if (filename === 'all' && sortOriginIndex && sortTargetIndex) {
    data = data.sort((a) => (a[sortOriginIndex] === a[sortTargetIndex] ? 1 : -1));
  }

  const buffer = xlsx.build([{ data }], sheetOptions);
  const filePath = `${newRootDir}/${filename}.xlsx`;
  fs.outputFileSync(filePath, buffer);
}

export { exportExcel };
