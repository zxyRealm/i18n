
import { getProjectDependencies, getAllMessages, prettierFile } from './utils';

const fs = require('fs-extra');

require('ts-node').register({
  compilerOptions: {
    module: 'commonjs',
  },
});

//  导出重复文本
function exportRepeatWords() {
  const allMessages = getAllMessages();
  // 去重后 value:key map
  const unitMap = {};
  Object.keys(allMessages).forEach((key) => {
    const newKey = allMessages[key];
    if (!unitMap[newKey]) {
      unitMap[newKey] = {
        count: 1,
        keys: [key],
      };
    } else {
      unitMap[newKey] = {
        count: unitMap[newKey].count + 1,
        keys: [...unitMap[newKey].keys, key],
      };
    }
  });

  const commonLang = {};
  let commonText = '';
  // 提取重复 key: value, 生成公共文件
  Object.keys(unitMap).forEach((val) => {
    if (unitMap[val]?.count >= 2) {
      const originKey = unitMap[val].keys[0];
      const key = `common${originKey.substr(originKey.lastIndexOf('_'))}`;
      commonLang[key] = val;
      commonText += `${unitMap[val].keys[0]}  ${unitMap[val].keys.slice(1).join(',')}\n\n`;
    }
  });

  const deps = getProjectDependencies();
  fs.writeFileSync(`./common.${deps.typescript ? 'ts' : 'js'}`, prettierFile(`export default ${JSON.stringify(commonLang, null, 2)}`));
  fs.writeFileSync('./common_lang.txt', commonText);
}

export { exportRepeatWords };

