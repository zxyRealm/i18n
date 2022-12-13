/**
 * @author linhuiw
 * @desc 项目配置文件配置信息
 */
import { Tld } from 'google-translate-open-api';


export const KIWI_CONFIG_FILE = 'kiwi-config.json';

export const I18N_GLOBAL_PROPERTY = '$t' || 'i18n.t';

export const matchExpReg = (flags?: string) => new RegExp(`\\${I18N_GLOBAL_PROPERTY}\\(('|"|\`)(.*?)('|"|\`)`, flags);

interface Config {
  dir: string;
  configFile: string;
  defaultConfig: {
    kiwiDir: string;
    configFile: string;
    srcLang: string;
    zhLang: string;
    distLangs: string[];
    translateOptions: {
      tld?: Tld;
      concurrentLimit: number;
      timeout: number;
      appid: string;
      secretKey: string;
      minBreakTime?: number;
      [key: string]: any;
    };
    prettierConfig?: {};
    excelOptions: {
      keyIndex: number;
      valueIndex: number;
      sortOriginIndex?: number;
      sortTargetIndex?: number;
    };
    importI18N: string;
    exclude?: string | RegExp | Array<string | RegExp>;
    include?: string | RegExp | Array<string | RegExp>;
    jsTemplate?: string;
    htmlTemplate?: string;
  };
  langMap: {};
  zhIndexFile?: string;
  zhTestFile?: string;
}

// baidu translate options
export interface Options {
  from?: string;
  to?: string;
  requestOpts?: object;
  appid: string;
  secretKey: string;
  [key: string]: any;
}

export interface translateResponseType {
  from: string;
  to: string;
  trans_result: {
    dst: string;
    src: string;
  };
}

export const PROJECT_CONFIG: Config = {
  dir: './.kiwi',
  configFile: `./.kiwi/${KIWI_CONFIG_FILE}`,
  defaultConfig: {
    kiwiDir: './.kiwi',
    configFile: `./.kiwi/${KIWI_CONFIG_FILE}`,
    srcLang: 'zh-CN',
    zhLang: 'zh-CN',
    distLangs: ['en', 'zh-CN'],
    translateOptions: {
      appid: '',
      secretKey: '',
      concurrentLimit: 10,
      timeout: 6000,
      minBreakTime: 1500,
    },
    excelOptions: {
      keyIndex: 0,
      valueIndex: 1,
      // sortOriginIndex: 1,
      // sortTargetIndex: 2
    },
    prettierConfig: {},
    importI18N: 'import i18n from \'@/locale\';',
    exclude: ['node_modules'],
    include: ['src'],
    jsTemplate: '',
    htmlTemplate: '',
  },
  langMap: {
    'en-US': 'en',
    en_US: 'en',
  },
  zhIndexFile: `import common from './common';
  export default {
    ...common
  }`,
  zhTestFile: `export default {
    test: 'ceshi'
  }`,
};

const DOUBLE_BYTE_REGEX = /[\u4e00-\u9fa5]/g;

export { DOUBLE_BYTE_REGEX };
