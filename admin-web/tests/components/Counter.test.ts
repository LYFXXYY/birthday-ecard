// tests/components/Counter.test.ts - Vue 组件测试入门示例
// 演示 Vue Test Utils 的核心操作：挂载、查找元素、读取内容、触发交互
//
// 【组件测试要解决的问题】
// 不是测"长得好不好看"，而是测"行为对不对"：
// - 点了按钮，数字有没有 +1？
// - 输入框打字，绑定的值有没有更新？
// - 满足条件时，某个元素有没有显示/隐藏？
//
// 【为了聚焦教学，这里用一个内置的简单组件演示】
// 真实项目里，把 mount 的对象换成你的 .vue 组件即可，套路完全一样。

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';

// 一个演示用的计数器组件（真实测试中换成 import MyComponent from '@/components/MyComponent.vue'）
const Counter = defineComponent({
  props: {
    start: { type: Number, default: 0 },
  },
  setup(props) {
    const count = ref(props.start);
    const increment = () => count.value++;
    return { count, increment };
  },
  template: `
    <div class="counter">
      <span class="value">{{ count }}</span>
      <button class="inc" @click="increment">+1</button>
      <p v-if="count >= 5" class="tip">已达上限</p>
    </div>
  `,
});

describe('Counter 组件', () => {

  // ── 基础渲染：初始状态是否正确 ──
  it('应正确渲染初始值', () => {
    const wrapper = mount(Counter, { props: { start: 3 } });

    // find 定位元素，text() 读取文本内容
    expect(wrapper.find('.value').text()).toBe('3');
  });

  // ── 交互测试：点击按钮后状态更新 ──
  it('点击 +1 按钮后数字应增加', async () => {
    const wrapper = mount(Counter, { props: { start: 0 } });

    // trigger 模拟用户点击；因为 DOM 更新是异步的，要 await
    await wrapper.find('.inc').trigger('click');

    expect(wrapper.find('.value').text()).toBe('1');

    // 连点两次
    await wrapper.find('.inc').trigger('click');
    await wrapper.find('.inc').trigger('click');
    expect(wrapper.find('.value').text()).toBe('3');
  });

  // ── 条件渲染：v-if 控制的元素按状态出现/消失 ──
  it('数字达到 5 时才显示提示，之前不显示', async () => {
    const wrapper = mount(Counter, { props: { start: 4 } });

    // 初始 4，还没到 5，提示不应存在
    expect(wrapper.find('.tip').exists()).toBe(false);

    // 点一次变 5，提示应出现
    await wrapper.find('.inc').trigger('click');
    expect(wrapper.find('.tip').exists()).toBe(true);
    expect(wrapper.find('.tip').text()).toContain('上限');
  });

  // ── 默认 props：不传值时用默认值 ──
  it('不传 start 时默认从 0 开始', () => {
    const wrapper = mount(Counter);
    expect(wrapper.find('.value').text()).toBe('0');
  });
});

// 【测真实 Element Plus 组件的注意点】
// 如果组件用了 el-button / el-input 等，mount 时要注册插件，否则标签无法解析：
//   import ElementPlus from 'element-plus'
//   mount(MyComp, { global: { plugins: [ElementPlus] } })
// 如果组件用了路由/状态，还要加 plugins: [router, pinia] 或 mocks 注入。
