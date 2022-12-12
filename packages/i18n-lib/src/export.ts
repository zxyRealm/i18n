/**
 * @author linhuiw
 * @desc 导出未翻译文件
 */

import { tsvFormatRows } from 'd3-dsv';
import { getAllMessages, getProjectConfig, getProjectVersion } from './utils';
import { DOUBLE_BYTE_REGEX } from './const';

const xlsx = require('node-xlsx').default;
const fs = require('fs-extra');

require('ts-node').register({
  compilerOptions: {
    module: 'commonjs',
  },
});

const sheetHeader = (lang?: string) => {
  return [
    'key',
    lang || '原文',
    '译文',
  ];
};

// 根据原文件目录结构生成新文件目录
function createXlsxFile(filename: string, sheetData: any) {
  const data = [sheetHeader()];
  const newRootDir = '.';
  if (Array.isArray(sheetData)) {
    data.push(...sheetData);
  } else {
    Object.keys(sheetData).forEach((key) => {
      if (key) {
        data.push([key, sheetData[key]]);
      }
    });
  }

  const buffer = xlsx.build([{ data }], { '!cols': [{ wch: 30 }, { wch: 50 }, { wch: 30 }] });
  const filePath = `${newRootDir}/${filename}.xlsx`;
  fs.outputFileSync(filePath, buffer);
}

// 导出未翻译的 key: value 值
function exportMessages(lang?: string, file?: string) {
  const CONFIG = getProjectConfig();
  const langs = lang ? [lang] : CONFIG.distLangs;
  const allMessages = getAllMessages(CONFIG.srcLang);
  // 默认判断中文
  const zhCnMessages = getAllMessages(CONFIG.zhLang);
  langs
    .filter((item) => ![CONFIG.srcLang, CONFIG.zhLang].includes(item))
    .forEach((l) => {
      // 过滤出未翻译的文案 keys
      const currentMessages = getAllMessages(l) || {};
      /*
      * 1. 非中文语言包中包含中文
      * 2. 中文语言包中 key 在其他语言包中不存在
      * 3. 中文语言包中 key 对应的 value 和 其他语言包中 key: value 一致, 并且 value 中包含中文
      */
      const messagesToTranslate = Object.keys(allMessages)
        .filter((key) => {
          const curText = currentMessages[key];
          // const text = allMessages[key]
          const zhText = zhCnMessages[key];
          const unTranslate = curText === undefined
          || DOUBLE_BYTE_REGEX.test(curText)
          || (DOUBLE_BYTE_REGEX.test(curText)
           && curText === zhText);

          return unTranslate;
        })
        .map((key) => {
          let message = allMessages[key];
          message = JSON.stringify(message).slice(1, -1);
          return [key, message, zhCnMessages[key]];
        });

      if (messagesToTranslate.length === 0) {
        console.log('All the messages have been translated.');
        return;
      }
      const content = tsvFormatRows(messagesToTranslate);
      const sourceFile = file || `./export-${l}.txt`;
      const version = getProjectVersion();
      fs.writeFileSync(sourceFile, content);
      createXlsxFile(`export-${l}_${version}`, messagesToTranslate);
      console.log(`Exported ${l} ${messagesToTranslate.length} message(s).`);
    });
}

export { exportMessages, createXlsxFile };
