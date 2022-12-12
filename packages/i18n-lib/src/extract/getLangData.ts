/**
 * @author doubledream
 * @desc 获取语言文件
 */

import * as globby from 'globby';
import * as fs from 'fs';
import * as path from 'path';
import { getProjectConfig, flatten } from '../utils';
import { readFile } from './file';

const CONFIG = getProjectConfig();

const I18N_GLOB = (lang?: string) => {
  const LANG_DIR = path.resolve(CONFIG.kiwiDir, lang || CONFIG.srcLang);
  return `${LANG_DIR}/**/*.{ts,js}`;
};

/**
 * 获取对应文件的语言
 */
function getLangData(fileName: string) {
  if (fs.existsSync(fileName)) {
    return getLangJson(fileName);
  } else {
    return {};
  }
}

/**
 * 获取文件 Json
 */
function getLangJson(fileName: string) {
  const fileContent = readFile(fileName);
  const langList = fileContent.match(/export\s*default\s*({[\s\S]+);?$/);
  if (!langList) return {};
  let obj = langList[1];
  obj = obj.replace(/\s*;\s*$/, '');
  let jsObj = {};
  try {
    // eslint-disable-next-line no-eval
    jsObj = eval(`(${obj})`);
  } catch (err) {
    console.error(err);
  }
  return jsObj;
}

function expandObject(obj: any) {
  const newObj = {};
  Object.keys(obj).forEach((key) => {
    if (typeof obj[key] === 'string') {
      newObj[key] = obj[key];
    } else {
      expandObject(obj[key]);
    }
  });
  return newObj;
}

function getI18N(lang?: string) {
  const paths = globby.globbySync(I18N_GLOB(lang));
  const langObj = paths.reduce((prev: any, curr: any) => {
    const filename = curr
      .split('/')
      .pop()
      .replace(/\.(tsx?|vue|js)$/, '');

    if (filename.replace(/\.(tsx?|vue|js)/, '') === 'index') {
      return prev;
    }

    const fileContent = expandObject(getLangData(curr));
    const jsObj = fileContent;

    return {
      ...prev,
      ...jsObj,
    };
  }, {});
  return langObj;
}

/**
 * 获取全部语言, 展平
 */
function getSuggestLangObj(lang?: string) {
  const langObj = getI18N(lang);
  const finalLangObj = flatten(langObj);
  return finalLangObj;
}


export { getSuggestLangObj, getLangData };
