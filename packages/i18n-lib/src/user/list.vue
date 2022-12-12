<template>
  <div>
    <template slot-scope="{ name }">
      {{`这里相同内容哦！${name}`}}
      <!-- ignore {{text}} -->
      <p>你和谁长得比较像呢</p>
    </template>
  </div>
</template>

<script>
import i18n from '@/locales'

export default {
  name: 'controller-dialog',
  components: {
    IpInput
  },
  props: {
    data: {
      type: Object,
      default: () => ({})
    },
    visible: {
      type: Boolean,
      default: false
    }
  },
  data () {
    return {
      show: false,
      isDispaly: false,
      text: /* ignore */'哈哈哈哈哈哈'
    }
  }
}
</script>
