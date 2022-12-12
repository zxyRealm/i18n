const fs = require('fs-extra');
const xlsx = require('node-xlsx').default;

// 列宽设置
const sheetOptions = { '!cols': [{ wch: 30 }, { wch: 50 }, { wch: 30 }] };

// 读取 sheet 表中所有 key 值，默认第一列为 key
export function readSheetData(filename: string, type?: string, keyIndex = 1, valueIndex = 2) {
  if (!filename) return [];
  const sheets = xlsx.parse(filename);
  const dataMap = {};
  const keysList: any[] = [];
  sheets.forEach((sheet: any) => {
    const { data } = sheet;
    data.forEach((row: any) => {
      keysList.push(row);
      if (row[keyIndex]) dataMap[row[keyIndex]] = row[valueIndex];
    });
  });
  return type === 'obj' ? dataMap : keysList;
}

// 导出文件 key 值 对比
// 在目标表格中查找与源表格中中文内容 value 值相同的 key, 将对应的英文同步到源表格中
function sameExcel(originFile: string, targetFile: string, ...restParams: any) {
  // 目标文件 value 对应列的序列号，和 key 对应的序列号
  // 目标文件是以中文为 key, 获取其对应的其他语言值
  const [valueIndex = 2, keyIndex = 1] = restParams;
  const originData = readSheetData(originFile) as any[];
  const targetData = readSheetData(targetFile, 'obj', keyIndex, valueIndex);
  // 对比后数据结果
  // 默认第二列为中文 第三列为英文，对比中文值，获取其对应的英文值，必同步到源表格中
  let data: Array<Array<string|null>> = [
    [`${originFile} key`, '中文', '英文'],
  ];

  const noValueList: any[] = [];
  originData.forEach((item) => {
    if (targetData[item[1]]) {
      data.push([item[0], item[1], targetData[item[1]]]);
    } else {
      noValueList.push(item[1]);
    }
  });

  const noValueData: Array<Array<string|null>> = noValueList.map((i) => {
    return [null, i, null];
  });

  data = [...data, ...noValueData];

  const buffer = xlsx.build([{ data }], sheetOptions);
  const filePath = './excel-sync.xlsx';
  fs.outputFileSync(filePath, buffer);
  fs.writeFileSync('no-value.txt', noValueList.join('\n\n'));
}

export { sameExcel };
