import * as md5 from 'js-md5';
import * as qs from 'qs';

const request = require('request');
// import { getRandomStr, encodeUtf8 } from './utils'
// Thanks libretranslate.com free translate service
// api address: https://libretranslate.com/docs/

interface LdResultType {
  srcLangs: string[];
  srclangs_confidences: number[];
  extended_srclangs: string[];
}
interface SentencesType {
  trans: string;
  orig: string;
  backend: number;
}
export interface TranslateResponseType {
  sentences: SentencesType[];
  src: string;
  confidence: number;
  spell: object;
  ld_result: LdResultType;
}

export interface Options {
  q?: string;
  to?: string;
  from?: string;
  secretKey: string;
  appid: string;
  [key: string]: any;
}

// 获取随机盐值
function getRandomStr(length = 4): string {
  let result = Math.floor(Math.random() * 90 + 10).toString();
  for (let i = 0; i < length - 2; i++) {
    const ranNum = Math.ceil(Math.random() * 25);
    result += String.fromCharCode(65 + ranNum).toString();
  }
  return result;
}

// api 文档  https://libretranslate.com/docs/
export function Translate(text: string, options?: Options, delay?: number) {
  const { appid, secretKey } = options || {};
  const salt = getRandomStr(8);
  const signStr = `${appid}${text}${salt}${secretKey}`;
  const sign = md5(signStr);
  const params = {
    q: text,
    engine: 'libre',
    from: 'auto',
    to: 'en',
    appid,
    salt,
    sign,
    ...options,
  };
  return new Promise((resolve, reject) => {
    request({
      url: `http://api.fanyi.baidu.com/api/trans/vip/translate?${qs.stringify(params)}`,
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (error: any, response: any, body: string) => {
      const time = delay;
      if (error) return reject(error);
      try {
        const result = JSON.parse(body);
        if (result.error_code) {
          setTimeout(() => {
            reject(result);
          }, time);
        } else {
          const t = result.trans_result[0].dst;
          setTimeout(() => {
            resolve(t);
          }, time);
        }
      } catch (e) {
        reject(error);
        console.error(e);
      }
    });
  });
}
