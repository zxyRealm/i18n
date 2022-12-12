/**
 * @author doubledream
 * @desc 更新文件
 */

import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as ts from 'typescript';
import { readFile, writeFile } from './file';
import { getLangData, getSuggestLangObj } from './getLangData';
import {
  getProjectConfig,
  getLangDir,
  getProjectDependencies,
  prettierFile,
  templateTransform,
} from '../utils';
import * as slash from 'slash2';
import * as vueCompiler from 'vue-template-compiler';

const chalk = require('chalk');

const { log } = console;
const CONFIG = getProjectConfig();
const srcLangDir = getLangDir(CONFIG.srcLang);

// 更新语言包文件
/*
 * type 更新类型
    extract: 默认值，扫描更新，新生成文件名根据 keyValue 进行处理
    sync: 同步更新，新生成文件直接应用 filePath
*/

export function updateLangFiles(
  keyValue: string,
  text: string,
  validateDuplicate: boolean,
  filePath: string,
  type?: string,
  lang?: string,
) {
  const packageJson = getProjectDependencies();
  // 是否使用 typescript
  const isTS = packageJson.typescript;
  // // 是否是Vue 项目
  // const isVueFile = !!packageJson.vue
  // // 是否 react 项目
  // const isReact = packageJson.react
  // // 是否使用 umi
  // const isUmi = packageJson.umi

  let [,filename] = keyValue.split('.');
  const [, , ...restPath] = keyValue.split('.');
  let fullKey = restPath.join('.');
  // 根据项目文件生成语言文件目录，以 src 为基础目录在语言包文件进行映射，目录层级大于3时进行合并
  const isDefaultType = (!type || type === 'extract');
  const files = slash(filePath).split('/');
  let srcFiles = files.slice(+files.findIndex((i: string) => i === 'src') + 1);
  srcFiles = srcFiles.length > 4 ? srcFiles.slice(0, 4) : srcFiles;
  filename = srcFiles.join('/').lastIndexOf('.') === -1 ? srcFiles.join('/') : srcFiles.join('/').substring(0, srcFiles.join('/').lastIndexOf('.'));
  fullKey = keyValue.replace('-', '_');
  const targetFilename = !isDefaultType ? filePath : slash(`${srcLangDir}/${filename}.${isTS ? 'ts' : 'js'}`);
  const allLangs = getSuggestLangObj(lang);
  // 当前 key: value 不存在时可创建新文件
  const keyValueIsNot = allLangs[fullKey] === undefined || allLangs[fullKey] !== text;
  if (!fs.existsSync(targetFilename) && keyValueIsNot) {
    fs.outputFileSync(targetFilename, generateNewLangFile(fullKey, text));
    addImportToMainLangFile(filename, lang);
    log(chalk.green(`成功新建语言文件 ${targetFilename}`));
  } else {
    // 清除 require 缓存，解决手动更新语言文件后再自动抽取，导致之前更新失效的问题
    const mainContent = getLangData(targetFilename);
    const obj = mainContent;

    if (Object.keys(obj).length === 0) {
      log(chalk.yellow(`${filePath} 该文件无可替换文案`));
    }

    if (validateDuplicate && _.get(obj, fullKey) !== undefined) {
      // log(chalk.red(`${targetFilename} 中已存在 key 为 \`${fullKey}\` 的翻译，请重新命名变量`));
      throw new Error('duplicate');
    }

    if (!keyValueIsNot && lang !== CONFIG.srcLang) return;
    if (allLangs[fullKey] !== text && allLangs[fullKey] !== undefined && lang !== CONFIG.srcLang) {
      log(chalk.red(`${targetFilename} 已存在 ${fullKey} 的翻译`));
    }

    // \n 会被自动转义成 \\n，这里转回来
    text = text.replace(/\\n/gm, '\n');
    const data = { ...obj, [fullKey]: text };
    // _.set(obj, fullKey, text);
    fs.outputFileSync(targetFilename, prettierFile(`export default ${JSON.stringify(data, null, 2)}`));
  }
}


function generateNewLangFile(key: string, value: any) {
  const obj = { [key]: value };

  return prettierFile(`export default ${JSON.stringify(obj, null, 2)}`);
}

// 新增文件添加到 index 文件, 并自动 import & export
function addImportToMainLangFile(newFilename: string, lang?: string) {
  const isTs = getProjectDependencies().typescript;
  let mainContent = '';
  const filePath = `${getLangDir(lang) || srcLangDir}/index.${isTs ? 'ts' : 'js'}`;
  if (lang) {
    mainContent = readFile(`${srcLangDir}/index.${isTs ? 'ts' : 'js'}`);
  } else {
    const exportName = newFilename
      .replace(/[-_]/g, '/').split('/')
      .filter((i) => i)
      .map((str) => {
        return str.substr(0, 1).toLocaleUpperCase() + str.substr(1);
      })
      .join('');

    if (fs.existsSync(filePath)) {
      mainContent = fs.readFileSync(filePath, 'utf8');
      mainContent = mainContent.replace(/^(\s*import.*?;?)$/m, `$1\nimport ${exportName} from './${newFilename}'`);
      if (/(}\);?)/.test(mainContent)) {
        if (/,\n(}\);?)/.test(mainContent)) {
          /** 最后一行包含,号 */
          mainContent = mainContent.replace(/(}\))/, `  ...${exportName},\n$1`);
        } else {
          /** 最后一行不包含,号 */
          mainContent = mainContent.replace(/\n(}\))/, `,\n  ...${exportName},\n$1`);
        }
      }

      // 兼容 export default { common };的写法
      if (/(};?)/.test(mainContent)) {
        if (/,\n(};?)/.test(mainContent)) {
          /** 最后一行包含,号 */
          mainContent = mainContent.replace(/(})/, `  ...${exportName},\n$1`);
        } else {
          /** 最后一行不包含,号 */
          mainContent = mainContent.replace(/\n(})/, `,\n  ...${exportName},\n$1`);
        }
      }
    } else {
      mainContent = `import ${exportName} from './${newFilename}'\n\nexport default {\n ...${exportName},\n}`;
    }
  }
  fs.outputFileSync(filePath, prettierFile(mainContent));
}

/**
 * 检查是否添加 import I18N 命令
 * @param filePath 文件路径
 */
function hasImportI18N(filePath: string) {
  const code = readFile(filePath);
  if (code.indexOf(CONFIG.importI18N) > -1) {
    return true;
  } else {
    return false;
  }
  // const ast = ts.createSourceFile('', code, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TSX);
  // let hasImportI18N = false;

  // function visit(node: ts.Node) {
  //   if (node.kind === ts.SyntaxKind.ImportDeclaration) {
  //     const { importClause } = node;

  //     // import I18N from 'src/utils/I18N';
  //     if (importClause.kind === ts.SyntaxKind.ImportClause) {
  //       if (importClause.name) {
  //         if (importClause.name.escapedText === 'I18N') {
  //           hasImportI18N = true;
  //         }
  //       } else {
  //         const { namedBindings } = importClause;
  //         // import { I18N } from 'src/utils/I18N';
  //         if (namedBindings.kind === ts.SyntaxKind.NamedImports) {
  //           namedBindings.elements.forEach((element) => {
  //             if (element.kind === ts.SyntaxKind.ImportSpecifier && _.get(element, 'name.escapedText') === 'I18N') {
  //               hasImportI18N = true;
  //             }
  //           });
  //         }
  //         // import * as I18N from 'src/utils/I18N';
  //         if (namedBindings.kind === ts.SyntaxKind.NamespaceImport) {
  //           if (_.get(namedBindings, 'name.escapedText') === 'I18N') {
  //             hasImportI18N = true;
  //           }
  //         }
  //       }
  //     }
  //   }
  // }

  // ts.forEachChild(ast, visit);

  // return hasImportI18N;
}

/**
 * 在合适的位置添加 import I18N 语句
 * @param filePath 文件路径
 */
function createImportI18N(filePath: string) {
  const code = readFile(filePath);
  const ast = ts.createSourceFile('', code, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TSX);

  const isVueFile = _.endsWith(filePath, '.vue');
  const importStatement = `${CONFIG.importI18N}\n`;
  let pos = ast.getStart(ast, false);
  if (isVueFile) {
    const sfc: any = vueCompiler.parseComponent(code.toString());
    pos = sfc.script.start;
  }
  const updateCode = `${code.slice(0, pos)}${importStatement}${code.slice(pos)}`;
  return updateCode;
}

/*
 * 更新文件
 * @param filePath 当前文件路径
 * @param arg  目标字符串对象
 * @param val  目标 key
 * @param validateDuplicate 是否校验文件中已经存在要写入的 key
 */
function replaceAndUpdate(filePath: string, arg: any, val: string, validateDuplicate: boolean) {
  const deps = getProjectDependencies();
  const code = readFile(filePath);
  const isHtmlFile = _.endsWith(filePath, '.html');
  const isVueFile = !!deps.vue || _.endsWith(filePath, '.vue');
  const isReact = deps.umi || _.endsWith(filePath, '.tsx') || _.endsWith(filePath, '.jsx') || deps.react;
  val = val.replace(/-/g, '_');
  let newCode = code;
  let finalReplaceText = arg.text;
  const { start, end } = arg.range;
  // 若是字符串，删掉两侧的引号
  if (isVueFile) {
    newCode = replaceInVue(filePath, arg, val);
  } else if (isReact) {
    // 模板字符串中的插值语法 ${key} 需要替换成 {key} 的形式
    newCode = replaceInJsx(filePath, arg, val, (txt: string) => {
      finalReplaceText = txt;
    });
  } else if (isHtmlFile) {
    newCode = `${code.slice(0, start)}{{${val}}}${code.slice(end)}`;
  } else {
    newCode = `${code.slice(0, start)}{${val}}${code.slice(end)}`;
  }

  try {
    // 更新语言文件
    updateLangFiles(val, finalReplaceText, validateDuplicate, filePath);
    // 若更新成功再替换代码
    return writeFile(filePath, newCode);
  } catch (e: any) {
    console.error(e);
    return Promise.reject(e.message);
  }
}

// 替换 Vue 文件中 key 值
function replaceInVue(filePath: string, arg: any, val: string) {
  const code = readFile(filePath);
  // let finalReplaceText = arg.text
  const { start, end } = arg.range;
  const template = CONFIG.jsTemplate || 'i18n.t(\'{{key}}\')';
  const htmlTemplate = CONFIG.htmlTemplate || '$t(\'{{key}}\')';
  const replacedStr = templateTransform(template, { key: val });
  const htmlReplacedStr = templateTransform(htmlTemplate, { key: val });
  let finalReplaceVal = val;
  switch (arg.type) {
    case 'tempStatic':
      finalReplaceVal = htmlReplacedStr;
      break;
    case 'static':
      finalReplaceVal = `{{${htmlReplacedStr}}}`;
      break;
    case 'template':
      finalReplaceVal = `\${${htmlReplacedStr}}`;
      break;
    case 'attrStr':
      finalReplaceVal = `:${arg.name}="${htmlReplacedStr}"`;
      return `${code.slice(0, start - arg.name.length - 2)}${finalReplaceVal}${code.slice(end + 1)}`;
    case 'jsStr':
      finalReplaceVal = replacedStr;
      break;
    case 'jsTemplate':
      finalReplaceVal = `\${${replacedStr}}`;
      break;
    default:
      break;
  }
  return `${code.slice(0, start)}${finalReplaceVal}${code.slice(end)}`;
}

// 替换 jsx 语法文件中 key 值
function replaceInJsx(filePath: string, arg: any, val: string, callback: Function) {
  const code = readFile(filePath);
  const { start, end } = arg.range;
  let finalReplaceVal = val;
  const template = CONFIG.jsTemplate || 'intl.formatMessage({ id: \'{{key}}\' })';
  const replacedStr = templateTransform(template, { key: val });
  switch (arg.type) {
    case 'jsTemplate': {
      const values = (arg.text?.match(/\$\{(\w+)\}/g) || []).map((key: string) => key.replace(/\$\{(\w+)\}/g, '$1')).join(', ');
      // 更新text 回调
      callback && callback(arg.text.replace(/\$\{/g, '{'));
      arg.text = arg.text.replace(/\$\{/g, '{');
      // 示例： `姓名${name}, 年龄{age}, 生日${year}` 插值语法中插入值提取 { name, age, year }
      // 差值语法只允许使用直接变量值，不允许使用运算表达式
      finalReplaceVal = !values ? replacedStr : `${replacedStr.slice(0, replacedStr.length - 1)}, { ${values} })`;
      break;
    }
    case 'attrStr':
    case 'JsxElement':
    case 'JsxText':
      finalReplaceVal = `{${replacedStr}}`;
      break;
    case 'isRoutes':
      finalReplaceVal = `'${val}'`;
      break;
    default:
      finalReplaceVal = replacedStr;
      break;
  }
  return `${code.slice(0, start)}${finalReplaceVal}${code.slice(end)}`;
}

export { replaceAndUpdate, hasImportI18N, createImportI18N };
