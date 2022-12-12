/**
 * @author linhuiw
 * @desc 导入翻译文件
 */
import * as fs from 'fs';
import * as path from 'path';
import * as _ from 'lodash';
import { tsvParseRows } from 'd3-dsv';
import { getAllMessages, getProjectConfig, traverse } from './utils';


require('ts-node').register({
  compilerOptions: {
    module: 'commonjs',
  },
});

const CONFIG = getProjectConfig();


function getMessagesToImport(file: string) {
  const content = fs.readFileSync(file, { encoding: 'utf8' }).toString();
  const messages = tsvParseRows(content, ([key, value]: [string, any]) => {
    try {
      // value 的形式和 JSON 中的字符串值一致，其中的特殊字符是以转义形式存在的，
      // 如换行符 \n，在 value 中占两个字符，需要转成真正的换行符。
      value = JSON.parse(`"${value}"`);
    } catch (e) {
      throw new Error(`Illegal message: ${value}`);
    }
    return [key, value];
  });
  const rst = {};
  const duplicateKeys = new Set();
  messages.forEach(([key, value]: [string, any]) => {
    if (rst[key]) {
      duplicateKeys.add(key);
    }
    rst[key] = value;
  });
  if (duplicateKeys.size > 0) {
    const errorMessage = `Duplicate messages detected: \n${[...duplicateKeys].join('\n')}`;
    console.error(errorMessage);
    process.exit(1);
  }
  return rst;
}

function writeMessagesToFile(messages: any, file: string, lang: string) {
  const { kiwiDir } = CONFIG;
  const srcMessages = require(path.resolve(kiwiDir, CONFIG.srcLang, file)).default;
  const dstFile = path.resolve(kiwiDir, lang, file);
  const oldDstMessages = require(dstFile).default;
  const rst = {};
  traverse(srcMessages, (message, key) => {
    _.setWith(rst, key, _.get(messages, key) || _.get(oldDstMessages, key), Object);
  });
  fs.writeFileSync(`${dstFile}.js`, `export default ${JSON.stringify(rst, null, 2)}`);
}

function importMessages(file: string, lang: string) {
  let messagesToImport = getMessagesToImport(file);
  const allMessages: Object = getAllMessages(CONFIG.srcLang);
  messagesToImport = _.pickBy(messagesToImport, (message, key) => allMessages[key]);
  const keysByFiles = _.groupBy(Object.keys(messagesToImport), (key) => key.split('.')[0]);

  const messagesByFiles = _.mapValues(keysByFiles, (keys, f) => {
    const rst = {};
    _.forEach(keys, (key) => {
      _.setWith(rst, key.substr(f.length + 1), messagesToImport[key], Object);
    });
    return rst;
  });

  _.forEach(messagesByFiles, (messages, f) => {
    writeMessagesToFile(messages, f, lang);
  });
}

export { importMessages };
