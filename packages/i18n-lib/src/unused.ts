/**
 * @author linhuiw
 * @desc 查找未使用的 key
 */
import * as fs from 'fs';
import * as path from 'path';
import { getKiwiDir, traverse } from './utils';


function findUnUsed() {
  const srcLangDir = path.resolve(getKiwiDir(), 'zh-CN');
  let files = fs.readdirSync(srcLangDir);
  files = files.filter((file) => file.endsWith('.ts') && file !== 'index.ts');
  const unUsedKeys = [];
  files.forEach((file) => {
    const srcFile = path.resolve(srcLangDir, file);
    const { default: messages } = require(srcFile);
    const filename = path.basename(file, '.ts');

    traverse(messages, (text, p) => {
      const key = `i18n_${filename}_${p}`;
      const hasKey = recursiveReadFile('./src', key);
      if (!hasKey) {
        unUsedKeys.push(key);
      }
    });
  });
}

/**
 * 递归查找文件
 * @param fileName
 */
function recursiveReadFile(fileName: string, text: string) {
  let hasText = false;
  if (!fs.existsSync(fileName)) return false;
  if (isFile(fileName) && !hasText) {
    check(fileName, text, () => {
      hasText = true;
    });
  }
  if (isDirectory(fileName)) {
    const files = fs.readdirSync(fileName).filter((file) => {
      return !file.startsWith('.') && !['node_modules', 'build', 'dist'].includes(file);
    });
    files.forEach((val) => {
      const temp = path.join(fileName, val);
      if (isDirectory(temp) && !hasText) {
        hasText = recursiveReadFile(temp, text);
      }
      if (isFile(temp) && !hasText) {
        check(temp, text, () => {
          hasText = true;
        });
      }
    });
  }
  return hasText;
}

/**
 * 检查文件
 * @param fileName
 */
function check(fileName: string, text: string, callback: Function) {
  const data = readFile(fileName);
  const exc = new RegExp(text);
  if (data && exc.test(data)) {
    callback();
  }
}

/**
 * 判断是文件夹
 * @param fileName
 */
function isDirectory(fileName: string) {
  if (fs.existsSync(fileName)) {
    return fs.statSync(fileName).isDirectory();
  }
  return false;
}

/**
 * 判断是否是文件
 * @param fileName
 */
function isFile(fileName: string) {
  if (fs.existsSync(fileName)) {
    return fs.statSync(fileName).isFile();
  }
  return false;
}

/**
 * 读取文件
 * @param fileName
 */
function readFile(fileName: string) {
  if (fs.existsSync(fileName)) {
    return fs.readFileSync(fileName, 'utf-8');
  }
  return '';
}

export { findUnUsed };
