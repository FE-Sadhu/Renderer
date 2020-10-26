## 启动项目
`npm run start`

## 项目目录
```
.
├── README.md
├── index.html
├── package-lock.json
├── package.json
├── src
│   ├── component.js  
│   ├── flags.js      // vnode 类型 和 vnodeChildren 类型
│   ├── h.js          // 创建 vnode
│   ├── index.js      // 测试用例
│   ├── patchData.js  // 比较更新 vnodeData
│   └── render.js     // 渲染器内核
└── webpack.config.js
```
## 核心工作

  把 virtual DOM 渲染成特定平台下的真实 "DOM"。
  1. 若无旧虚拟节点树，则把该 VNodes 渲染成真实 DOM 挂载在挂载点上
  2. 若有旧 VNodes 且无新 VNodes，则从挂载点 remove 现有 DOM。
  3. 若有旧 VNodes 也有新 VNodes，则进入 patch 机制，diff 对比新旧节点，更新差异到现有 DOM。

  其余工作：
  1. 控制部分组件生命周期钩子的调用
  2. 多端渲染的桥梁，可配置操作特定平台的 "DOM"
  3. diff 算法 （无 key 、 React 、 Vue 2.x 三种）

## 例子
例 1
```
/* 
<template>
  <div>
    <span></span>
  </div>
</template>
该模板的 VNode
*/
console.log(h("div", null, h("span")));
```
例 2
```
/* 
<template>
  <td></td>
  <td></td>
</template>
*/
console.log(h(Fragment, null, [h("td"), h("td")]));
```
例 3
```
/* 
<template>
  <Portal target="#box">
    <h1></h1>
  </Portal>
</template>
*/
console.log(
  h(
    Portal,
    {
      target: "#box",
    },
    h("h1")
  )
);
```
例 4
```
/* 
<template>
  <MyFunctionalComponent>
    <div></div>
  </MyFunctionalComponent>
</template>
函数式组件
*/

function MyFunctionalComponent() {}

console.log(h(MyFunctionalComponent, null, h("div")));
```
例 5
```
/* 
<template>
  <MyStatefulComponent>
    <div></div>
  </MyStatefulComponent>
</template>
有状态组件
*/
class MyStatefulComponent extends Component {}

console.log(h(MyStatefulComponent, null, h("div")));
```
例 6
```
/* 
  测试渲染器 renderer
*/

const elementVNode = h(
  "div",
  {
    style: {
      width: "100px",
      height: "100px",
      backgroundColor: "red",
    },
    class: {
      'a': true,
      'a1': false
    }
  },
  h("div", {
    style: {
      width: "50px",
      height: "50px",
      backgroundColor: "blue",
    },
    class: ['b', 'b1', ['b2', 'b3', ['b4', 'b5'], { 'b6': false, 'b7': true }]]
  }, 
  h('p', {
    style: {
      width: "25px",
      height: "25px",
      backgroundColor: "yellow",
    },
    class: 'cls_c cls_c1'
  }))
);

// render(elementVNode, document.getElementById("app"));
```
例 7
```
/* 
  test renderer VNodeData's DOM Properties and HTML Attributes
*/

const elementVNode2 = h('input', {
  style: {
    width: '30px',
    height: '30px'
  },
  class: ['cls-1', 'cls-2'],
  type: 'checkbox',
  checked: true,
  custom: 1
})

// render(elementVNode2, document.getElementById("app"))
```
例 8
```
/* 
  test add Event.
  注意：设计 VNode ，然后怎样让 template 变为我们设计的 VNode 是编译器做的事情
*/

const elementVNode3 = h('div', {
  style: {
    width: '30px',
    height: '30px',
    backgroundColor: "yellow",
  },
  // 点击事件，与 DOM 属性的区别在于前面有 on
  onclick: function () { alert('test add Event handler') }
})

// render(elementVNode3, document.getElementById("app"))
```
例 9
```
/* 
  Fragment, Portal, Text VNode
*/

const TextVNode = createTextVNode
// debugger
// render(TextVNode, document.getElementById("app"))

const fragmentVNode = h(Fragment, null, [
  createTextVNode('text1'),
  h('li', null, createTextVNode('number 2')),
  h('div', null, createTextVNode('div 3'))
])

// render(fragmentVNode, document.getElementById("app"))

const PortalVNode = h('div', {
  style: {
    height: '100px',
    width: '100px',
    background: 'red'
  }
}, h(
  Portal,
  {
    target: '#por'
  },
  [
    h('span', null, '我是标题1......'),
    h('span', null, '我是标题2......')
  ]
))

// render(PortalVNode, document.getElementById("app"))

// console.log(PortalVNode.el)
```
例 10
```
/* 
  test functional component
*/
function MyFunctionalComponent1() {
  return h(
    'div',
    {
      style: {
        background: 'green'
      }
    },
    [
      h('span', null, '我是组件的标题1......'),
      h('span', null, '我是组件的标题2......')
    ]
  )
}

const compVnode = h(MyFunctionalComponent1)
// render(compVnode, document.getElementById('app'))
// console.log(compVnode.el)
```
例 11
```
/* 
  test stateful component
*/

class MyStatefulComponent1 {
  render () {
    return h(
      'div',
      {
        style: {
          background: 'green'
        }
      },
      [
        h('span', null, '我是组件的标题1......'),
        h('span', null, '我是组件的标题2......')
      ]
    )
  }
}

const compVnode1 = h(MyStatefulComponent1)
// render(compVnode1, document.getElementById('app'))
// console.log(compVnode1.el)
```
例 12
```
/* 
  test patchElement
*/

// 旧的 VNode
const prevVNode = h('div', {
  style: {
    width: '100px',
    height: '100px',
    backgroundColor: 'red'
  }
})

// 新的 VNode
const nextVNode = h('div', {
  style: {
    width: '100px',
    height: '100px',
    border: '1px solid green',
    display: 'inline-block'
  }
})

// render(prevVNode, document.getElementById('app'))

// 2s 后更新
// setTimeout(() => {
//   render(nextVNode, document.getElementById('app'))
// }, 2000)
```
例 13
```
/* 
  test patchChildren
*/
// 旧的 VNode
const prevVNode3 = h(
  'div',
  null,
  h('p', {
    style: {
      height: '100px',
      width: '100px',
      background: 'red'
    }
  })
)

// 新的 VNode
const nextVNode3 = h('div')

// render(prevVNode3, document.getElementById('app'))

// // 2秒后更新
// setTimeout(() => {
//   render(nextVNode3, document.getElementById('app'))
// }, 2000)
```
例 14
```
/** 
 * 测试旧子节点是单个，新子节点是多个
 */
// 旧的 VNode
const prevVNode4 = h('div', null, h('p', null, '只有一个子节点'))

// 新的 VNode
const nextVNode4 = h('div', null, [
  h('p', null, '子节点 1'),
  h('p', null, '子节点 2')
])

// render(prevVNode4, document.getElementById('app'))

// // 2秒后更新
// setTimeout(() => {
//   render(nextVNode4, document.getElementById('app'))
// }, 2000)
```
例 15
```
/** 
 * 测试 patch 更新子文本节点
 */

 // 旧的 VNode
const prevVNode5 = h('p', null, '旧文本')

// 新的 VNode
const nextVNode5 = h('p', null, '新文本')

// render(prevVNode5, document.getElementById('app'))

// // 2秒后更新
// setTimeout(() => {
//   render(nextVNode5, document.getElementById('app'))
// }, 2000)
```
例 16
```
/** 
 * 测试 patch 更新片段
 */

// 旧的 VNode
const prevVNode6 = h(Fragment, null, [
  h('p', null, '旧片段子节点 1'),
  h('p', null, '旧片段子节点 2')
])

// 新的 VNode
const nextVNode6 = h(Fragment, null, [
  h('p', null, '新片段子节点 1'),
  h('p', null, '新片段子节点 2')
])

// render(prevVNode6, document.getElementById('app'))

// // 2秒后更新
// setTimeout(() => {
//   render(nextVNode6, document.getElementById('app'))
// }, 2000)
```
例 17
```
/** 
 * 测试 patchPortal
 */

 // 旧的 VNode
const prevVNode7 = h(
  Portal,
  { target: '#old-container' },
  h('p', null, '旧的 Portal')
)

// 新的 VNode
const nextVNode7 = h(
  Portal,
  { target: '#new-container' },
  h('p', null, '新的 Portal')
)

// render(prevVNode7, document.getElementById('app'))

// // 2秒后更新
// setTimeout(() => {
//   render(nextVNode7, document.getElementById('app'))
// }, 2000)
```
例 18
```
/** 
 * 例子测试有状态组件的主动更新 （_update）
 */

class MyComponent {
  constructor () {
    // 自身状态 or 本地状态
    this.localState = 'one'
  }
  // mounted 钩子
  mounted () {
    setTimeout(() => {
      this.localState = 'two'
      this._update() // 没结合响应式系统，数据变更时手动调用 _update 更新组件
    }, 2000)
  }

  render () {
    return h('div', null, this.localState)
  }
}

// render(h(MyComponent), document.getElementById('app'))
```
例 19
```
/** 
 * 测试有状态子组件拿到 props , 被动更新
 */

// 子组件类
class ChildComponent11 {
  render() {
    return h('div', null, this.$props.text)
  }
}
// 父组件类
class ParentComponent11 {
  
  constructor() {
    this.localState = 'one'
  }
  mounted() {
    setTimeout(() => {
      this.localState = 'two'
      this._update()
    }, 2000)
  }

  render() {
    return h(ChildComponent11, {
      text: this.localState
    })
  }
}
// 有状态组件 VNode
const compVNode = h(ParentComponent11)

// render(compVNode, document.getElementById('app'))
```
例 20 
```
/** 
 * 函数式组件的更新规则
 */

function MyFuncCmp (props) {
  return h('div', null, props.text)
}

class ParentStateFulCmp {
  constructor() {
    this.localState = 'one'
  }

  mounted() { // 模拟改变状态
    setTimeout(() => {
      this.localState = 'tow'
      this._update() // 模拟响应式系统，状态改变后，手动触发组件更新
    }, 2000)
  }
  render() {
    return h(MyFuncCmp, {
      text: this.localState
    })
  }
}

// render(h(ParentStateFulCmp), document.getElementById('app'))
```
例 21
```
/** 
 * 测试 react diff 
 */

 const oVNode = h('div', null, [
  h('p', { key: 'a' }, '节点1'),
  h('p', { key: 'b' }, '节点2'),
  h('p', { key: 'c' }, '节点3')
])

 const nVNode = h('div', null, [
  h('p', { key: 'd' }, '节点4'),
  h('p', { key: 'b' }, '节点2 更新'),
  h('p', { key: 'c' }, '节点3 更新')
 ])

// const nVNode = h('div', null, [
//   h('p', { key: 'c' }, '节点3'),
//   h('p', { key: 'a' }, '节点1'),
//   h('p', { key: 'b' }, '节点2')
//  ])

//  render(oVNode, document.getElementById('app'))

//   // 2秒后更新
//   setTimeout(() => {
//     render(nVNode, document.getElementById('app'))
//   }, 2000)
```
例 22 
```
/** 
 * 测试双端比较 diff
 */

 // 旧的 VNode
const prevVNode123 = h('div', null, [
  h('p', { key: 'a' }, '节点1'),
  h('p', { key: 'b' }, '节点2'),
  h('p', { key: 'c' }, '节点3')
])

// 新的 VNode1
const nextVNode123 = h('div', null, [
  h('p', { key: 'd' }, '节点4'),
  h('p', { key: 'a' }, '节点1'),
  h('p', { key: 'c' }, '节点3'),
  h('p', { key: 'b' }, '节点2')
])

// 新的 VNode2
const nextVNode1234 = h('div', null, [
  h('p', { key: 'd' }, '节点4'),
  h('p', { key: 'a' }, '节点1'),
  h('p', { key: 'c' }, '节点3'),
  h('p', { key: 'b' }, '节点2'),
  h('p', { key: 'e' }, '节点5'),
])

render(prevVNode123, document.getElementById('app'))

// 2秒后更新
setTimeout(() => {
  render(nextVNode1234, document.getElementById('app'))
}, 2000)
```