// 更新语言包文件（强制更新已翻译的文案）
/*
1. 已中文语言包未基础,同步其他语言包文件 key值
2. 读取 excel 中所有 key 值
3. 根据 excel 中读取 key 值，更新语言包中 key 对应的 value 值
*/
import * as slash from 'slash2';
import { readFiles } from './extract/file';
import { updateLangFiles } from './extract/replace';
import {
  transformToObject,
  getProjectConfig,
  getAllMessages,
  readSheetData,
} from './utils';


// 获取源语言包文件 key list
function originKeysList(lang?: string) {
  const config = getProjectConfig();
  const l = lang || config.srcLang;
  const dir = `${config.kiwiDir}/${l}`;
  if (!config.distLangs.includes(l)) {
    return console.error(`当前配置 distLangs 中未包含 ${l} 语言类型`);
  }
  const keyList: any[] = readFiles(dir)
    .map(slash)
    .map((i) => {
      return {
        fileName: i,
        keys: transformToObject(i as string),
      };
    });
  return keyList;
}

// 同步各种语言的 key
function syncKeys() {
  const { distLangs, srcLang, kiwiDir } = getProjectConfig();
  const srcKeysList = originKeysList();
  if (!srcKeysList) return;
  distLangs
    .filter((lang) => lang !== srcLang)
    .forEach((lang) => {
      const allMessages = getAllMessages(lang);
      srcKeysList.forEach((item) => {
        const distFilename = item.fileName.replace(`${kiwiDir}/${srcLang}`, `${kiwiDir}/${lang}`);
        Object.keys(item.keys).forEach((key) => {
          if (allMessages[key] === undefined) {
            updateLangFiles(key, item.keys[key], false, distFilename, 'sync', lang);
          }
        });
      });
    });
}


// 更新指定类型语言 key、value
function update(file?: string, lang?: string) {
  syncKeys();
  const sheetData = readSheetData(file);
  const targetKeys = originKeysList(lang);
  if (!targetKeys) return;
  targetKeys.forEach((item) => {
    Object.keys(item.keys).forEach((key) => {
      if (sheetData[key]) {
        updateLangFiles(key, sheetData[key], false, item.fileName, 'update', lang);
      }
    });
  });
}

export { update };
