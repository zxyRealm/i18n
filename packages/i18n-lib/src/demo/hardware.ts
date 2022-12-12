// 硬件参数
export default {
  type: 'object',
  'x-component': 'tabpane',
  'x-component-props': {
    tab: '硬件参数',
  },
  properties: {
    antiTamper: {
      type: 'number',
      title: '防拆报警',
      'x-component': 'Switch',
      'x-component-props': {
        'active-value': 2,
        'inactive-value': 1,
      },
    },
    signalInputType1: {
      type: 'number',
      title: '信号输入类型',
      'x-component': 'Radio',
      enum: [
        { label: '火警输入', value: 1 },
        { label: '门磁输入', value: 2 },
        { label: '开门按钮输入', value: 3 },
        { label: '自定义', value: 100 },
      ],
      'x-linkages': [
        {
          type: 'value:state',
          target: '*(signalInputName1)',
          condition: '{{ $value == 100 }}',
          state: {
            display: true,
          },
          otherwise: {
            display: false,
          },
        },
      ],
    },
    scrImage1Url: {
      type: 'string',
      title: '显示图片1',
      'x-component': 'ImgUpload',
      'x-props': {
        itemClassName: 'custom-item-upload',
        type: 'orgLogo',
        addonAfter:
          "{{text(tips(link('查看默认图'),img({src: 'https://uniubi-front.oss-cn-hangzhou.aliyuncs.com/public/scrImage1Url.png', width: '148px', height: '148px'})), br(), '照片比例1:1，大小不得超过2M', br(), '文件格式支持jpg、jpeg、png', br(), '如：公司logo') }}",
      },
    },
  },
};
