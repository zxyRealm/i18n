# i18n-lib

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test i18n-lib` to execute the unit tests via [Jest](https://jestjs.io).

## Running lint

Run `nx lint i18n-lib` to execute the lint via [ESLint](https://eslint.org/).

Kiwi 的 CLI 工具

## 如何使用

> yarn global add kiwi-clis

```txt
# 首先在项目的 .gitignore 文件中添加以下过滤规则

/*.xlsx
export-*.txt
/export-excel
/export-excel-*

```

## CLI 参数

### kiwi `--init`

初始化项目，生成 kiwi 的配置文件 `kiwi-config.json`

```js
{
  // kiwi文件根目录，用于放置提取的langs文件
  "kiwiDir": "./.kiwi",

  // 配置文件目录，若调整配置文件，此处可手动修改
  "configFile": "./.kiwi/kiwi-config.json",

  // 映射语言包中个语言文件夹名称，注意连线和下划线
  "srcLang": "zh-CN",
  "distLangs": ["en", "zh-CN"],
  // --update 功能中读取 excel 时 key: value 对应列的索引
  "excelOptions": {
      "keyIndex": 0,
      "valueIndex": 1
  },
  "jsTemplate": "I18n.t('{{key}}')", // js/ts 国际化替换模板
  "htmlTemplate": "$t('{{key}}')", // html 国际化替换模板; 目前仅在 vue 中使用
   // google-translate-open-api 插件配置项
  "translateOptions": {
      "browersUrl": "https://cors-anywhere.herokuapp.com/", // 默认在线代理地址
      "browers": true // 是否开在线代理（google翻译存在机器人检测机制，长时间使用会被禁用）
  },
  // import 语句，不同项目请自己配置
  "importI18N": "import I18n from '@/locales';",

  // 可跳过的文件夹名或者文加名，比如docs、mock等
  // 文件内单行文本添加忽略规则 示例： /* ignore */ 忽略扫描的中文文案
  // TIP: 忽略规则中空格不可省略，且忽略规则仅支持在 js/ts 中使用
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

### kiwi `--extract`

一键批量替换指定文件夹下的所有文案

```shell script
kiwi --extract [dirPath]
```

![批量替换](https://raw.githubusercontent.com/alibaba/kiwi/master/kiwi-cli/public/extract.gif)

> 长时间使用会存在 google 翻译被禁用的情况， 如出现 429 等错误。 此时的处理方式可以选择关闭在线代理或者更换在线代理地址

### kiwi `--export`

```
# 导出指定语言的文案，lang取值为配置中distLangs值，如en-US导出还未翻译成英文的中文文案
kiwi --export [filePath] en-US
```

导出未翻译的文案

### kiwi `--json`

```
# 导出 json 数据中文文案
kiwi --json

# 更新语言文件
kiwi --json [path] [excelFilePath] [lang]

path: 需要扫描的json 文件目录

excelFilePath: 已翻译的excel文件

lang: 需要替换的语言类型

```

### kiwi `--excel`

将语言包按照语言类型导出成单个 excel, 同时也会导出一个全部语言的合并文件 all.xlxs

### kiwi `--same`

```
kiwi --same [originFile] [targetFile] [targetFileValueIndex] [targetFileKeyIndex]

同步excel中相同内容

```

### kiwi `--compare`

根据导出的 excel, 对比不同语言类型和基础语言包之间的差异

### kiwi `--update`

```
# 优先同步源语言包与其他语言包的 key: value 映射关系，根据 excel 更新语言包中 key 对应的 value 值，默认会先将其他语言包中 key 与基础语言包进行一次同步处理
kiwi --update [filePath] [lang]

```
