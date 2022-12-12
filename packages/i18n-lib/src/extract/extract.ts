/**
 * @author doubledream
 * @desc 提取指定文件夹下的中文
 */
import * as _ from 'lodash';
import * as randomstring from 'randomstring';
import * as slash from 'slash2';
import { getSpecifiedFiles, readFile, writeFile } from './file';
import { findChineseText } from './findChineseText';
import { getSuggestLangObj } from './getLangData';
import {
  translateText,
  findMatchKey,
  findMatchValue,
  getProjectConfig,
} from '../utils';
import { replaceAndUpdate, hasImportI18N, createImportI18N } from './replace';

const chalk = require('chalk');

const { log } = console;
const CONFIG = getProjectConfig();

/**
 * 递归匹配项目中所有的代码的中文
 */
function findAllChineseText(dir: string) {
  const files = getSpecifiedFiles(dir, CONFIG.include, CONFIG.exclude);
  const filterFiles = files.filter((file) => {
    return file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.vue') || file.endsWith('.js');
  });
  const allTexts = filterFiles.reduce((pre: any[], file: string) => {
    const code = readFile(file);
    const texts = findChineseText(code, file);
    // 调整文案顺序，保证从后面的文案往前替换，避免位置更新导致替换出错
    const sortTexts = _.sortBy(texts, (obj) => -obj.range.start);

    if (texts.length > 0) {
      log(chalk.green(`${file} 发现中文文案 ${texts.length} 条`));
    }

    return texts.length > 0 ? pre.concat({ file, texts: sortTexts }) : pre;
  }, []);

  // 统计本次扫描新增文案条数
  const textList = allTexts.reduce((pre, curr) => {
    return pre.concat(curr.texts);
  }, []);
  if (textList.length) {
    log(chalk.green(`发现可替换文案 ${textList.length} 条`));
  }
  return allTexts;
}

// promise 链式调用
export function getAllAsyncResults(list: any[], func: Function, formatArgs = (val: any) => val) {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    let index = 0;
    const recursive = (i: number) => {
      list[i] && func(formatArgs(list[i])).then((res: any) => {
        results.push(res);
        if (i === list.length - 1) {
          resolve(results);
        } else {
          index++;
          const delayTime = formatArgs(list[index]).length > 25 ? 3000 : 1200;
          setTimeout(() => {
            recursive(index);
          }, delayTime);
        }
      }).catch((e: any) => {
        reject(e);
      });
    };
    recursive(0);
  });
}

// 将对象的 key: value 颠倒
export function reverseObjectKeyValue(obj: any) {
  if (!obj) return {};
  return Object.keys(obj).reduce((pre, curr) => {
    return {
      ...pre,
      [obj[curr]]: curr,
    };
  }, {});
}

// 截取要翻译成 key 的中文
const formatText = (txt: string) => {
  const reg = /[^a-zA-Z\x00-\xff]+/g;
  const findText = txt?.match(reg);
  const transText = findText ? findText.join('').slice(0, 6) : '中文符号';
  return transText;
};

/**
 * 递归匹配项目中所有的代码的中文
 * @param {dirPath} 文件夹路径
 */
function extractAll(dirPath?: string) {
  const dir = dirPath || './src';
  const allTargetStrings = findAllChineseText(dir);

  if (!allTargetStrings.length) {
    log(chalk.yellow('没有发现可替换的文案！'));
    return;
  }
  const finalLangObj = getSuggestLangObj();
  // 暂存文件中所有的中文文本
  const virtualMemory = {};
  // const start = Date.now();
  // 转换成异步任务列表
  const taskList = async () => {
    for (const item of allTargetStrings) {
      // 文件名
      const fileName = item.file;
      // 中文文案列表
      const targetStrings = item.texts;

      const pathList = slash(fileName).replace(/(.+)\.[a-zA-Z]+$/, '$1').split('/');
      const suggestion = pathList.slice(+pathList.findIndex((i: string) => i === 'src') + 1);

      // eslint-disable-next-line no-async-promise-executor
      const subTasks = () => new Promise(async (resolve, reject) => {
        try {
        // 填充翻译得到的 key 值
          const getStrings = async () => {
            const includeKeyList = [];
            for (const curr of targetStrings) {
            // 判断已有语言文件是否存在相同的中文信息，如果存在返回对应的 key
              const key = findMatchKey(finalLangObj, curr.text);
              // 原文件或者已翻译的内容中如果存在当前要翻译的中文文本，则直接取用已有的 key 值
              if (key) {
                virtualMemory[curr.text] = key;
                includeKeyList.push({
                  target: curr,
                  key,
                });
              } else if (!virtualMemory[curr.text]) {
                try {
                  const uuidKey = `${randomstring.generate({
                    length: 8,
                    charset: 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM',
                  })}`;
                  // 翻译后文本
                  // let englishText;
                  const englishText = await translateText(formatText(curr.text), 'en').catch(() => {}) as string;

                  // 驼峰格式转换
                  const handleText = englishText ? _.camelCase(englishText) : uuidKey;
                  // 对于翻译后的英文再次过滤，只保留英文字符
                  const purifyText = handleText.replace(/[^a-z]/ig, '');
                  const transText = purifyText || 'chineseSymbols';
                  let transKey = `${suggestion.length ? `${suggestion.join('_')}_` : ''}${transText}`;
                  let occurTime = 1;
                  // 防止出现翻译后 key 相同, 但是对应的中文文案不同的情况
                  while (
                    findMatchValue(finalLangObj, transKey) !== curr.text &&
                  _.keys(finalLangObj).includes(`${transKey}${occurTime >= 2 ? occurTime : ''}`)
                  ) {
                    occurTime++;
                  }
                  if (occurTime >= 2) {
                    transKey = `${transKey}${occurTime}`;
                  }
                  virtualMemory[curr.text] = transKey;
                  finalLangObj[transKey] = curr.text;
                  includeKeyList.push({
                    target: curr,
                    key: transKey,
                  });
                } catch (e) {
                  Promise.reject(e);
                  continue;
                }
              } else {
                includeKeyList.push({
                  target: curr,
                  key: virtualMemory[curr.text],
                });
              }
            }
            return includeKeyList;
          };
          const replaceableStrings = await getStrings();
          // 翻译完成即可继续开始下一个文件翻译处理，无需等待文件的写入完成
          resolve(true);
          // 替换源文件中的中文，并将 key: value 值写入语言包文件
          replaceableStrings
            .reduce((prev, obj) => {
              return prev.then(() => {
                return replaceAndUpdate(fileName, obj.target, `${obj.key}`, false);
              });
            }, Promise.resolve())
            .then(() => {
            // 添加 import I18N
              if (!hasImportI18N(fileName)) {
                const code = createImportI18N(fileName);
                writeFile(fileName, code);
              }
              log(chalk.green(`${fileName}替换完成！`));
            })
            .catch(() => {
            });
        } catch (error) {
          log(chalk.red((error && typeof error === 'object' && JSON.stringify(error)) || error));
          reject(error);
        }
      });
      await subTasks();
    }
  };

  taskList();
}

export { extractAll };
