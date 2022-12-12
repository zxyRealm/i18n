import * as ts from 'typescript';
import {
  DOUBLE_BYTE_REGEX,
  matchExpReg,
  I18N_GLOBAL_PROPERTY,
} from '../const';
import { checkTextIsIgnore } from '../utils';

export function findTextInVueTs(code: string, fileName: string, startNum: number) {
  const matches: any[] = [];
  const ast = ts.createSourceFile('', code, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS);

  function visit(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      case ts.SyntaxKind.StringLiteral: {
        /** 判断 Ts 中的字符串含有中文 */
        const { text } = node as ts.StringLiteral;
        const start = node.getStart();
        const end = node.getEnd();
        const ignoreText = checkTextIsIgnore(code, start);
        if (text.match(DOUBLE_BYTE_REGEX) && !ignoreText) {
          /** 加一，减一的原因是，去除引号 */
          // 判断字符串是否已经被 i18n.t() 包裹
          const prevChar = code.substr(start - 3, 3);
          const isGlobal = (['.t(', '$t('].includes(prevChar));
          matches.push({
            type: isGlobal ? 'jsGlobal' : 'jsStr',
            start: startNum + start + Number(isGlobal),
            end: startNum + end - Number(isGlobal),
            text,
          });
        }
        break;
      }
      case ts.SyntaxKind.TemplateExpression: {
        const { pos, end: endIndex } = node;
        let templateContent = code.slice(pos, endIndex);
        templateContent = templateContent.toString().replace(/\$\{[^}]+\}/, '');
        const start = node.getStart();
        const end = node.getEnd();
        const ignoreText = checkTextIsIgnore(code, start);
        if (templateContent.match(DOUBLE_BYTE_REGEX) && !ignoreText) {
          /** 加一，减一的原因是，去除`号 */
          const texts = filterTemplateStr(code.substring(start, end), startNum + start, 'jsTemplate');
          matches.push(...texts);
        }
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

// 匹配 text 中所有 `` 结构内的文案
export function filterTemplateStr(str: string, sIndex: number, type?: string) {
  if (!str) return [];
  const matches: any[] = [];
  // 对 `` 内文案进行匹配
  const matchText = (text: string, startIndex = 0) => {
    if (!text || !text.trim()) return;
    const varMatch: any = text.match(/(\$\{.*?\})/);
    if (!varMatch) {
      const start = startIndex + (text.length - text.trimLeft().length);
      matches.push({
        type: type || 'template',
        text: text.trim(),
        start,
        end: start + text.trim().length,
      });
    } else {
      // 模板中存在插入变量时，先匹配第一部分文案，再递归匹配之后的所有文案
      const firstStr = text.substring(0, varMatch.index);
      if (firstStr && firstStr.match(DOUBLE_BYTE_REGEX)) {
        const start = startIndex + (firstStr.length - firstStr.trimLeft().length);
        matches.push({
          type: type || 'template',
          text: firstStr.trim(),
          start,
          end: start + firstStr.trim().length,
        });
      }
      // 下部分文本开始位置
      const nextStart = varMatch.index + varMatch[1].length;
      matchText(text.substring(nextStart), nextStart + startIndex);
    }
  };

  const matchTempItem = (text: string, startIndex = 0) => {
    let ex;
    let start;
    const exTemplate: any = text.match(/`(.*?)`/);
    if (exTemplate && exTemplate[1].match(DOUBLE_BYTE_REGEX)) {
      ex = exTemplate;
      start = startIndex + exTemplate.index + 1;
      // 判断模板字符串是否包含变量插值
      // 如果模板字符串中无变量应用则直接输入字符串
      matchText(exTemplate[1], start);
      const nextStart = ex.index + ex[0].length;
      matchTempItem(text.substr(nextStart), startIndex + nextStart);
      matches.push(...filterTempStr(exTemplate[1], start));
    }
  };
  matchTempItem(str, sIndex);
  return matches;
}

// 匹配 text 中所有 $t() 结构中的文案
export function filterGlobalStr(str: string, sIndex: number) {
  if (!str) return [];
  const matches: any[] = [];
  const matchText = (text: string, startIndex = 0) => {
    const exGlobal: any = text.match(matchExpReg());
    if (exGlobal && exGlobal[2].match(DOUBLE_BYTE_REGEX)) {
      const start = startIndex + exGlobal.index + I18N_GLOBAL_PROPERTY.length + 2;
      matches.push({
        type: 'global',
        text: exGlobal[2],
        start,
        end: start + exGlobal[2].length,
      });
      const nextStart = exGlobal.index + exGlobal[0].length;
      matchText(text.substr(nextStart), startIndex + nextStart);
    }
  };

  matchText(str, sIndex);
  return matches;
}

// TODO: 静态文案和 {{}} 共存时文案匹配
// 匹配 text 中的静态文案
export function filterStaticStr(str: string, sIndex: number) {
  const ignoreText = checkTextIsIgnore(str, sIndex);
  if (!str || ignoreText) return [];
  const matches = [];
  // 不存在{{}}
  const matchTemp = str.match(/\{\{(.*?)\}\}/);
  if (!matchTemp && str.match(DOUBLE_BYTE_REGEX)) {
    const start = sIndex + str.length - str.trimLeft().length;
    matches.push({
      type: 'static',
      text: str.trim(),
      start,
      end: start + str.trim().length,
    });
  } else if (matchTemp) {
    matches.push(...filterTempStr(str, sIndex));
  }
  return matches;
}

// {{}} 、 `` 中静态文案
export function filterTempStr(str: string, sIndex: number) {
  const matches: any[] = [];
  const matchTempText = (string: string, startIndex = 0) => {
    const matchTempStatic: any = string.match(/('|")(.+?)('|")/);
    if (matchTempStatic && matchTempStatic[2] && matchTempStatic[2].match(DOUBLE_BYTE_REGEX)) {
      const start = startIndex + matchTempStatic.index;
      const text = matchTempStatic[2];
      matches.push({
        type: 'tempStatic',
        text,
        start,
        end: start + text.length + 2,
      });
      const nextText = string.substr(matchTempStatic.index + text.length + 2);
      if (nextText) {
        matchTempText(nextText, start + text.length + 2);
      }
    }
  };
  matchTempText(str, sIndex);
  return matches;
}

// 过滤标签 attribute 上的文案
/*
* @param {object} attrsMap ast 解析得到的 attrsMap 对象
*/
export function filterAttrsText(attrsMap: object) {
  if (!attrsMap) return [];
  const handleAttrObj = (attrObj: any) => {
    // 变量处理
    // attrs 中的起始位置为上一个属性结束为下一位，因此需要注意的是 start - end 范围的字符串起始可能包含换行符，位置查询时可从结束位置计算
    const { end, name, value } = attrObj;
    if (attrObj.name.indexOf(':') === 0) {
      const text = `${name}="${value}"`;
      const tStart = end - value.length - name.length - 3;
      if (value.match(/`(.*?)`/)) {
        return filterTemplateStr(text, tStart);
      } else if (value.match(matchExpReg())) {
        return filterGlobalStr(text, tStart);
      }
      return [];
    } else {
      const valEnd = end - 1;
      return [{
        ...attrObj,
        type: 'attrStr',
        start: valEnd - value.length,
        end: valEnd,
        text: value,
      }];
    }
  };
  const matches: any[] = [];
  attrsMap && Object.keys(attrsMap).forEach((key) => {
    if (attrsMap[key].value.match(DOUBLE_BYTE_REGEX)) {
      matches.push(...handleAttrObj(attrsMap[key]));
    }
  });

  return matches;
}
