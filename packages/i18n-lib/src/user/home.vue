<template>
  <div>
    <template slot-scope="{ name }">
      {{`${$t('这是一个 slot-scope template')} ${name}`}}
      <template slot="title">
        {{`${$t('这是一个内嵌的插槽')}`}}
      </template>
      <template slot="content">
        {{`${$t('这是一个content插槽')}`}}
      </template>
      <template slot="footer">
        {{`${$t('这是一个footer插槽')}`}}
      </template>
      <template slot-scope="{ title }">
        {{`${$t(`这是一个内嵌的 slot-scope 插槽 {title}`, { title })}`}}
      </template>
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

<style scoped lang="scss">
.time-input {
  width: 120px;
}
.door-no {
  width: calc(100% - 40px);
  margin-right: 10px;
}

.seperate-line {
  height: 1px;
  margin-bottom: 20px;
  background: $M7;
}
/deep/.el-table {
  &__body {
    &-wrapper {
      height: calc(100% - 50px);
    }
  }
}

</style>
