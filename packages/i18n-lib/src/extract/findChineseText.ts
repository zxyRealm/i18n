/**
 * @author doubledream
 * @desc 利用 Ast 查找对应文件中的中文文案
 */

import * as ts from 'typescript';
import * as compiler from '@angular/compiler';
import * as vueCompiler from 'vue-template-compiler';
import {
  findTextInVueTs,
  filterStaticStr,
  filterTemplateStr,
  filterGlobalStr,
  filterAttrsText,
} from './findChineseInVue';
import { DOUBLE_BYTE_REGEX, matchExpReg } from '../const';
import { replaceOccupyStr, checkTextIsIgnore } from '../utils';

/**
 * 去掉文件中的注释
 * @param code
 * @param fileName
 */
function removeFileComment(code: any, fileName: string) {
  const printer = ts.createPrinter({ removeComments: true });
  const sourceFile = ts.createSourceFile(
    '',
    code,
    ts.ScriptTarget.ES2015,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  return printer.printFile(sourceFile);
}

/**
 * 查找 Ts 文件中的中文
 * @param code
 */
function findTextInTs(code: string, fileName: string, isJSON?: boolean, startIndex?: number) {
  const matches: any[] = [];
  const ast = ts.createSourceFile('', code, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TSX);

  function visit(node: ts.Node) {
    switch (node && node.kind) {
      case ts.SyntaxKind.JsxElement: {
        const { children } = node as ts.JsxElement;
        switch (node && node.kind) {
          default:
            children.forEach((child) => {
              switch (child && child.kind) {
                case ts.SyntaxKind.JsxText: {
                  const text = child.getText();
                  /** 修复注释含有中文的情况，Angular 文件错误的 Ast 情况 */
                  const noCommentText = removeFileComment(text, fileName);

                  if (noCommentText.match(DOUBLE_BYTE_REGEX)) {
                    const start = child.getStart();
                    const end = child.getEnd();
                    const range = { start, end };
                    matches.push({
                      range,
                      text: text.trim(),
                      isString: false,
                      type: 'JsxText',
                    });
                  }
                  break;
                }
                default:
                  break;
              }
            });
            break;
        }
        break;
      }
      case ts.SyntaxKind.TemplateExpression: {
        const { pos, end: endIndex } = node;
        const templateContent = code.slice(pos, endIndex);
        const start = node.getStart();
        const end = node.getEnd();
        const ignoreText = checkTextIsIgnore(code, start);
        if (templateContent.match(DOUBLE_BYTE_REGEX) && !ignoreText) {
          const range = { start, end };
          matches.push({
            type: 'jsTemplate',
            range,
            text: code.slice(start + 1, end - 1),
            isString: true,
          });
        }
        break;
      }
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral: {
        const { pos, end: endIndex } = node;
        const templateContent = code.slice(pos, endIndex);
        const start = node.getStart();
        const end = node.getEnd();
        const ignoreText = checkTextIsIgnore(code, start);
        if (templateContent.match(DOUBLE_BYTE_REGEX) && !ignoreText) {
          const range = { start, end };
          matches.push({
            range,
            text: code.slice(start + 1, end - 1),
            isString: true,
          });
        }
        break;
      }
      case ts.SyntaxKind.StringLiteral: {
        matchTsStringLiteralText(node as ts.StringLiteral,
          code, matches,
          fileName,
          isJSON,
          startIndex);
        break;
      }
      default:
        break;
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(ast, visit);

  return matches;
}

// 匹配 ast 中 StringLiteral 类型中的内中文文本
function matchTsStringLiteralText(
  node: ts.StringLiteral,
  code: any,
  matches: any[],
  fileName: string,
  isJSON?: boolean,
  startIndex = 0,
) {
  const { text } = node;
  const start = +node.getStart() + startIndex;
  const end = +node.getEnd() + startIndex;
  const ignoreText = checkTextIsIgnore(code, start);
  // 获取文本前标志判断文本类型
  const textPrefix = (code.substr(start - 50, 50) || '').trim().split('').reverse().join('');
  const isConsole = textPrefix.indexOf('.elosnoc') <= 6 && textPrefix.indexOf('.elosnoc') > -1;
  if (text.match(DOUBLE_BYTE_REGEX) && !ignoreText && !isConsole) {
    let type = 'jsGlobal';
    const isGlobal = ['.t(', '$t('].includes(code.substr(start - 3, 3));
    if (fileName.includes('src/routes')) {
      type = 'isRoutes';
    } else if (textPrefix.indexOf('=') === 0) {
      type = 'attrStr';
    } else if (!isGlobal) {
      type = 'jsStr';
    }
    const range = {
      start: start + Number(isGlobal),
      end: end - Number(isGlobal),
    };

    if (isJSON && /^(\{\{).*(\}\})$/.test(text)) {
      matches.push(...findTextInTs(text, fileName, isJSON, start + 1));
    } else {
      matches.push({
        type,
        range,
        text,
        isString: true,
      });
    }
  }
}

/**
 * 查找 HTML 文件中的中文
 * @param code
 */
function findTextInHtml(code: any) {
  const matches: any[] = [];
  const ast = compiler.parseTemplate(code, 'ast.html', {
    preserveWhitespaces: false,
  });

  function visit(node: any) {
    const { value } = node;
    if (value && typeof value === 'string' && value.match(DOUBLE_BYTE_REGEX)) {
      const valueSpan = node.valueSpan || node.sourceSpan;
      const {
        start: { offset: startOffset },
        end: { offset: endOffset },
      } = valueSpan;
      const nodeValue = code.slice(startOffset, endOffset);
      let isString = false;
      /** 处理带引号的情况 */
      if (nodeValue.charAt(0) === '"' || nodeValue.charAt(0) === "'") {
        isString = true;
      }
      const ignoreText = checkTextIsIgnore(value, startOffset);
      if (ignoreText) return;
      const range = { start: startOffset, end: endOffset };
      matches.push({
        range,
        text: value,
        isString,
      });
    } else if (value && typeof value === 'object' && value.source && value.source.match(DOUBLE_BYTE_REGEX)) {
      /*
       * <span>{{expression}}中文</span> 这种情况的兼容
       */
      const chineseMatches: any[] = value.source.match(DOUBLE_BYTE_REGEX);
      chineseMatches.forEach((match: any[]) => {
        const valueSpan = node.valueSpan || node.sourceSpan;
        const {
          start: { offset: startOffset },
          end: { offset: endOffset },
        } = valueSpan;
        const ignoreText = checkTextIsIgnore(value, startOffset);
        if (ignoreText) return;
        const nodeValue = code.slice(startOffset, endOffset);
        const start = nodeValue.indexOf(match);
        const end = +start + match.length;
        const range = { start, end };
        matches.push({
          range,
          text: match[0],
          isString: false,
        });
      });
    }

    if (node.children && node.children.length) {
      node.children.forEach(visit);
    }
    if (node.attributes && node.attributes.length) {
      node.attributes.forEach(visit);
    }
  }

  if (ast.nodes && ast.nodes.length) {
    ast.nodes.forEach(visit);
  }
  return matches;
}

/*
* 从一个字符串中过滤出 文案的内容、位置信息、来源类型
* @param {string} 源字符串
* @param {number} 源字符串起始位置
* @return {array} 包含文案内容，位置信息，来源类型的数组
*/
function filterTextInString(str: string, sIndex: number) {
  const ignoreText = checkTextIsIgnore(str, sIndex);
  if (!str || ignoreText) return [];
  const matches: any[] = [];
  // 优先获取模板字符串中内容
  const matchText = (text: string, startIndex = 0) => {
    // $t() 结构
    const isIgnore = checkTextIsIgnore(text, startIndex);
    if (isIgnore) return;
    const exGlobal = text.match(matchExpReg());
    if (exGlobal) {
      matches.push(...filterGlobalStr(text, startIndex));
    }
    /*
    * 由于 `` 中可能存在 $t()结构, 所以应该先将此部分替换成占位符
    */
    // `` 字符串模板
    const templateText = replaceOccupyStr(text, matchExpReg('g'));
    const exTemplate = templateText.match(/`(.*?)`/);
    if (exTemplate) {
      // 判断模板字符串是否包含变量插值
      // 如果模板字符串中无变量应用则直接输入字符串
      const itemList = filterTemplateStr(templateText, sIndex);
      matches.push(...itemList);
    }
    // 纯静态文案匹配
    const staticText = replaceOccupyStr(templateText, /`(.*?)`/g);
    matches.push(...filterStaticStr(staticText, startIndex));
  };
  matchText(str, sIndex);
  return matches;
}

/*
* 处理文案首先区分 attribute 和 标签内容文案
*/
function getAllChildrenContent(obj: any) {
  if (!obj) return [];
  // obj.scopedSlots && obj.scopedSlots['"default"'] ? obj = obj.scopedSlots['"default"'] : obj
  return (obj.children || []).reduce((pre: any[], cur: any) => {
    cur = cur.block || cur;
    const { start } = cur;
    // 提取 attrs 中文案
    const attrsMap = cur.rawAttrsMap;
    const attrsList = filterAttrsText(attrsMap);
    const ignoreText = checkTextIsIgnore(cur.text, start);
    pre = pre.concat(attrsList);

    const itemText = !ignoreText
    && !cur.ifConditions
    && cur.text
    && cur.text.match(DOUBLE_BYTE_REGEX)
    && cur.text.match(DOUBLE_BYTE_REGEX).reduce((pre2: any[], cur2: any) => {
      return pre2.concat(cur2);
    }, []);

    // 获取文案信息 并计算的得出每段文案起始终止位置
    // 文案内容不能重复匹配
    let itemList;
    if (itemText) {
      itemList = filterTextInString(cur.text, start);
    }
    // 处理 if 条件句中文案提取
    if (cur.ifConditions) {
      cur.ifConditions.forEach((item: any) => {
        if (item.block) {
          pre = pre.concat(getAllChildrenContent(item.block));
        }
      });
    }

    pre = pre.concat(scanSlotScopedText(cur));

    // eslint-disable-next-line max-len
    return (!cur.ifConditions && cur.children) ? pre.concat(getAllChildrenContent(cur)) : pre.concat(itemText ? itemList : []);
  }, []);
}

// 扫描处理 slot-scope 结构中文案
export function scanSlotScopedText(obj: any): any[] {
  const ssTemplate = obj && obj.scopedSlots && obj.scopedSlots['"default"'];
  if (!obj || !ssTemplate) {
    return [];
  } else {
    return getAllChildrenContent(ssTemplate).concat(scanSlotScopedText(ssTemplate)) || [];
  }
}


function findTextInVue(code: string, filename: string) {
  const matches = [];
  // 处理实体字符空格问题
  const rexSpace1 = new RegExp(/&ensp;/, 'g');
  const rexSpace2 = new RegExp(/&emsp;/, 'g');
  const rexSpace3 = new RegExp(/&nbsp;/, 'g');
  const repSpace1 = new RegExp(/ccsp&;/, 'g');
  const repSpace2 = new RegExp(/ecsp&;/, 'g');
  const repSpace3 = new RegExp(/ncsp&;/, 'g');
  code = code.replace(rexSpace1, 'ccsp&;').replace(rexSpace2, 'ecsp&;').replace(rexSpace3, 'ncsp&;');

  const vueObject = vueCompiler.compile(code.toString(), { outputSourceRange: true });
  const vueAst = vueObject.ast;
  let textList: any[] = getAllChildrenContent(vueAst);
  const sfc: any = vueCompiler.parseComponent(code.toString());
  const scriptText = sfc.script ? findTextInVueTs(sfc.script.content, filename, sfc.script.start) : [];
  textList = textList.concat(scriptText);
  textList.sort((pre, next) => {
    return pre.start - next.start;
  });

  matches.push(...textList.map((item) => {
    const { start, end, range } = item;
    return {
      ...item,
      range: range || {
        start, end,
      },
      text: item.text.replace(repSpace1, '&ensp;').replace(repSpace2, '&emsp;').replace(repSpace3, '&nbsp;'),
    };
  }));
  return matches;
}

/*
 * 递归匹配代码的中文
 * @param code
 */
function findChineseText(code: string, fileName: string) {
  if (fileName.endsWith('.html')) {
    return findTextInHtml(code);
  } else if (fileName.endsWith('.vue')) {
    return findTextInVue(code, fileName);
  }
  return findTextInTs(code, fileName);
}

export { findChineseText, findTextInTs };
