/**
 * @author linhuiw
 * @desc 工具方法
 */
import * as path from 'path';
import * as _ from 'lodash';
import * as fs from 'fs';
import {
  PROJECT_CONFIG,
  KIWI_CONFIG_FILE,
  Options,
} from './const';
import * as prettier from 'prettier';
import * as ts from 'typescript';
import { readFiles } from './extract/file';
import * as slash from 'slash2';
import { Translate } from './translate';

const xlsx = require('node-xlsx').default;
const Progress = require('progress');

const { log } = console;
const chalk = require('chalk');

// 查询指定文件
function lookForFiles(dir: string, fileName: string): any {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const currName = path.join(dir, file);
    const info = fs.statSync(currName);
    if (info.isDirectory()) {
      if (file === '.git' || file === 'node_modules') {
        continue;
      }
      const result = lookForFiles(currName, fileName);
      if (result) {
        return result;
      }
    } else if (info.isFile() && file === fileName) {
      return currName;
    }
    return null;
  }
}

function readFile(filename: string) {
  return fs.readFileSync(filename, { encoding: 'utf8' });
}

/**
 * 获得项目配置信息
 */
function getProjectConfig() {
  const rootDir = path.resolve(process.cwd(), './');
  const configFile = lookForFiles(rootDir, KIWI_CONFIG_FILE);
  let obj = PROJECT_CONFIG.defaultConfig;

  if (configFile && fs.existsSync(configFile)) {
    obj = _.merge(obj, JSON.parse(fs.readFileSync(configFile, 'utf8')));
  }
  return obj;
}

/**
 * 获取语言资源的根目录
 */
function getKiwiDir() {
  const config = getProjectConfig();
  return config?.kiwiDir;
}

/**
 * 获取对应语言的目录位置
 * @param lang
 */
function getLangDir(lang: string | undefined) {
  const { kiwiDir, srcLang } = getProjectConfig();
  return path.resolve(kiwiDir, lang || srcLang);
}

/**
 * 深度优先遍历对象中的所有 string 属性，即文案
 */
function traverse(
  obj: any,
  cb: {
    (message: any, key: any): void;
    (text: any, path: any): void;
    (text: any, path: any): void;
    (text: any, path: any): void;
  },
) {
  function traverseInner(
    object: any,
    callback: (arg0: string, arg1: string) => void,
    pathList: any[],
  ) {
    _.forEach(object, (val, key) => {
      if (typeof val === 'string') {
        callback(val, [...pathList, key].join('_'));
      } else if (typeof val === 'object' && val !== null) {
        traverseInner(val, callback, [...pathList, key]);
      }
    });
  }
  traverseInner(obj, cb, []);
}

/**
 * 获取所有文案
 */
function getAllMessages(lang?: string, filter = () => true) {
  const CONFIG = getProjectConfig();
  const l = lang || CONFIG.srcLang;
  const srcLangDir = getLangDir(l);
  try {
    const files = readFiles(srcLangDir, /\.(js|ts)$/);
    return getAllData(files, filter);
  } catch (error) {
    return {};
  }
}

/**
 * 重试方法
 * @param asyncOperation
 * @param times
 */
function retry(asyncOperation: () => Promise<any>, times = 1) {
  let runTimes = 1;

  const handleReject = (e: any): Promise<any> => {
    if (runTimes++ < times) {
      return asyncOperation().catch(handleReject);
    } else {
      return Promise.reject(e);
    }
  };

  return asyncOperation().catch(handleReject);
}

/**
 * 设置超时
 * @param promise
 * @param ms
 */
function withTimeout(promise: any, ms: number, text: any) {
  const timeoutPromise = new Promise((resolve, reject) => {
    setTimeout(() => {
      // eslint-disable-next-line prefer-promise-reject-errors
      reject({
        text,
        message: `Promise timed out after ${ms} ms.`,
      });
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]);
}


/*
 * 使用google翻译
 */
function translateText(text: string, toLang: string) {
  const CONFIG = getProjectConfig();
  // const { timeout } = CONFIG.translateOptions;
  const options: Options = {
    to: PROJECT_CONFIG.langMap[toLang] || 'en',
    ...CONFIG.translateOptions,
  };
  const startTime = Date.now();
  const minBreakTime = Number(CONFIG.translateOptions.minBreakTime) || 1500;
  const delayFun = (callback: { (): void; (): void; (): any }) => {
    const breakTime = Date.now() - startTime;
    const delay = breakTime < minBreakTime ? minBreakTime - breakTime : 0;
    setTimeout(() => {
      callback && callback();
    }, delay);
  };
  return new Promise((resolve, reject) => {
    Translate(text, options).then((res: any) => {
      delayFun(() => resolve(res));
    }).catch((error) => {
      log(chalk.red(error));
      log('translate error', chalk.red(`error code ${error.errno || error.error_code}`, error.errmsg || error.error_msg));
      delayFun(() => reject(error));
    });
  });
}
// 查询 value 值与当前 text 相同的 key
function findMatchKey(langObj: { [x: string]: any }, text: any) {
  for (const key in langObj) {
    if (langObj[key] === text) {
      return key;
    }
  }
  return null;
}

function findMatchValue(langObj: { [x: string]: any }, key: string) {
  return langObj[key];
}

/**
 * 将对象拍平
 * @param obj 原始对象
 * @param prefix
 */
function flatten(obj: { [x: string]: any }, prefix = '') {
  const propName = prefix ? `${prefix}_` : '';
  const ret = {};
  for (const attr in obj) {
    if (_.isArray(obj[attr])) {
      ret[attr] = obj[attr].join(',');
    } else if (typeof obj[attr] === 'object') {
      _.extend(ret, flatten(obj[attr], propName + attr));
    } else {
      ret[propName + attr] = obj[attr];
    }
  }
  return ret;
}

// 指定内容替换成占位符
// 目的是去除已经匹配到的中文
function replaceOccupyStr(str: string, regexp: RegExp, replacement?: string) {
  return str && str.replace(regexp, (...arg) => {
    return arg[0].split('').map(() => replacement || 'A').join('');
  });
}

// 将文件读取后转换问 js 对象
function transformToObject(filename: string, filter?: Function): object {
  const code = readFile(filename);
  const ast = ts.createSourceFile('', code, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS);
  const keysObject = {};

  function visit(node: ts.Node) {
    switch (node && node.kind) {
      case ts.SyntaxKind.PropertyAssignment: {
      /** 判断 Ts 中的字符串含有中文 */
        const {
          name,
          initializer,
        }: { name: any; initializer: any } = node as ts.PropertyAssignment;
        if (!filter || (typeof filter === 'function' && filter(initializer.text, name.text))) {
          keysObject[name.text] = initializer.text;
        }
        break;
      }
      default:
        break;
    }

    ts.forEachChild(node, visit);
  }
  ts.forEachChild(ast, visit);
  return keysObject;
}

function getAllData(files: string[], filter = () => true) {
  if (!files) return {};
  return files.reduce((prev, curr) => {
    const dataObj = transformToObject(curr, filter);
    return {
      ...prev,
      ...dataObj,
    };
  }, {});
}

// 读取 sheet 表中所有 key 值，默认第一列为 key
function readSheetData(filename?: string) {
  if (!filename) return {};
  const config = getProjectConfig();
  const { keyIndex = 0, valueIndex = 1 } = { ...config.excelOptions };
  const sheets = xlsx.parse(filename);
  const keysObject = {};
  sheets.forEach((sheet: { data: any }) => {
    const { data } = sheet;
    data.slice(1).forEach((row: any[]) => {
      if (keysObject[row[keyIndex]] !== undefined) {
        console.error(`${keysObject[row[keyIndex]]} key 已存在`);
      }
      keysObject[row[keyIndex]] = row[valueIndex];
    });
  });
  return keysObject;
}

// 获取项目 package.json 总 version 信息
function getProjectVersion() {
  const packageFilePath = `${slash(process.cwd())}/package.json`;
  if (fs.existsSync(packageFilePath)) {
    return JSON.parse(fs.readFileSync(packageFilePath, { encoding: 'utf8' })).version;
  } else {
    return '';
  }
}

/* TIP：不支持 vue 模板 html 内容中的忽略规则， 但可以通过将需要忽略的文案声明变量方式在js 文件中来注释
*@param {string} code 源码字符串
*@param {number} start 截取文本的其实位置
*/
function checkTextIsIgnore(code: string, start: number) {
  return !!code && (code.substr(start - 20, 20).indexOf('/* ignore */') > -1 || code.substr(start - 20, 20).indexOf('<!-- ignore -->') > -1);
}

// // 获取随机盐值
// function getRandomStr (length:number = 4): string {
//   let result = Math.floor(Math.random() * 90 + 10).toString()
//   for (let i = 0; i < length - 2; i++) {
//     let ranNum = Math.ceil(Math.random() * 25)
//     result += String.fromCharCode(65 + ranNum).toString()
//   }
//   return result
// }

// function encodeUtf8(text) {
//   const code = encodeURIComponent(text);
//   const bytes = [];
//   for (var i = 0; i < code.length; i++) {
//       const c = code.charAt(i);
//       if (c === '%') {
//           const hex = code.charAt(i + 1) + code.charAt(i + 2);
//           const hexVal = parseInt(hex, 16);
//           bytes.push(hexVal);
//           i += 2;
//       } else bytes.push(c.charCodeAt(0));
//   }
//   return bytes;
// }

// function decodeUtf8(bytes) {
//   var encoded = "";
//   for (var i = 0; i < bytes.length; i++) {
//       encoded += '%' + bytes[i].toString(16);
//   }
//   return decodeURIComponent(encoded);
// }


// 读取项目中文件
function readProjectFile(filepath: string) {
  // 项目根目录
  const rootDir = path.resolve(process.cwd(), './');
  const configFile = lookForFiles(rootDir, filepath);
  let obj = {};
  if (configFile && fs.existsSync(configFile)) {
    obj = _.merge(obj, JSON.parse(fs.readFileSync(configFile, 'utf8')));
  }
  return obj;
}

interface PackageJSONType {
  devDependencies?: any;
  dependencies?: any;
  [key: string]: any;
}

// 获取项目依赖信息 dependencies && devDependencies
function getProjectDependencies() {
  const packageJSON: PackageJSONType = readProjectFile('package.json');
  return {
    ...(packageJSON.devDependencies || {}),
    ...packageJSON.dependencies,
  };
}

// 线程式处理异步任务数组
async function processTaskArray(taskArray: any) {
  try {
    for (const item of taskArray) {
      await item?.();
    }
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
}

/*
 * 使用 Prettier 格式化文件
 * @param fileContent
 */
function prettierFile(fileContent: string) {
  const CONFIG = getProjectConfig();
  try {
    return prettier.format(fileContent, {
      parser: 'typescript',
      singleQuote: true,
      ...(CONFIG.prettierConfig || {}),
    });
  } catch (e: any) {
    console.error(`代码格式化报错！${e.toString()}\n代码为：${fileContent}`);
    return fileContent;
  }
}

// 进度条
function progressBar(config: any, name?: string) {
  const bar = new Progress(`${name || 'extracting'} [:bar] :percent :etas`, {
    complete: '=',
    incomplete: ' ',
    width: 20,
    ...config,
  });
  return bar;
}


function templateTransform(template: string, data: { [x: string]: any; key?: any }) {
  return template.replace(/\{\{[^{}]+\}\}/g, (matchStr: string) => {
    const key = matchStr.replace(/^\{\{([^{}]+)\}\}$/, '$1');
    return data?.[key] === undefined ? matchStr : data[key];
  });
}

export {
  getKiwiDir,
  getLangDir,
  traverse,
  retry,
  withTimeout,
  getAllMessages,
  getProjectConfig,
  translateText,
  findMatchKey,
  findMatchValue,
  flatten,
  lookForFiles,
  replaceOccupyStr,
  transformToObject,
  getAllData,
  readSheetData,
  getProjectVersion,
  checkTextIsIgnore,
  readProjectFile,
  getProjectDependencies,
  processTaskArray,
  prettierFile,
  progressBar,
  templateTransform,
};
