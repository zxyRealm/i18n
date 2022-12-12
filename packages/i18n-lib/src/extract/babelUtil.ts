import * as babel from '@babel/core';
import { DOUBLE_BYTE_REGEX } from '../const';
import * as ts from 'typescript';

function transferI18n(code: string, filename: string, lang?: string) {
  if (lang === 'ts') {
    return typescriptI18n(code);
  } else {
    return javascriptI18n(code, filename);
  }
}

function typescriptI18n(code: string) {
  const arr: any[] = [];
  const ast = ts.createSourceFile('', code, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS);
  function visit(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.StringLiteral: {
        /** 判断 Ts 中的字符串含有中文 */
        const { text } = node as ts.StringLiteral;
        if (text.match(DOUBLE_BYTE_REGEX)) {
          arr.push(text);
        }
        break;
      }
      default:
        break;
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(ast, visit);
  return arr;
}

function javascriptI18n(code: string, filename: string) {
  const arr: any[] = [];

  const visitor = {
    StringLiteral(path: any) {
      if (path.node.value.match(DOUBLE_BYTE_REGEX)) {
        const text = (path.node.value || '').trim();
        text && arr.push(text);
      }
    },
  };
  const arrayPlugin = { visitor };

  babel.transform(code.toString(), {
    filename,
    plugins: [arrayPlugin],
  });

  return arr;
}

// 必须将模板语法中的所有待翻译语句翻译完成才能进行ast的string解析
function findVueText(astObject: any) {
  const arr: any = [];
  const regex1 = /`(.+?)`/g;
  // 递归匹配获取文案信息
  function recursive(ast: any) {
    if (ast.expression) {
      const text = ast.expression.match(regex1);
      if (text && text[0].match(DOUBLE_BYTE_REGEX)) {
        text.forEach((itemText: string) => {
          itemText.match(DOUBLE_BYTE_REGEX) && arr.push({
            text: itemText,
            start: ast.start,
            end: ast.end,
          });
        });
      }
    } else {
      ast.children && ast.children.forEach((item: any) => {
        recursive(item);
      });
    }
  }
  recursive(astObject);
  return arr;
}
export { transferI18n, findVueText };
