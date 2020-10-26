import { VNodeFlags, ChildrenFlags } from './flags'

export const Fragment = Symbol()
export const Portal = Symbol()

// 辅助创建 vNode 的 h 函数
export default function h(tag, data = null, children = null) {
  // 确定 vNodes 类型
  let flags = null;
  if (typeof tag === 'string') {
    flags = tag === 'svg' ? VNodeFlags.ELEMENT_SVG : VNodeFlags.ELEMENT_HTML

    if (data) {
      data.class = normalizeClass(data.class)
    }
  } else if (tag === Fragment) {
    flags = VNodeFlags.FRAGMENT
  } else if (tag === Portal) {
    flags = VNodeFlags.PORTAL
    tag = data && data.target
  } else { // 组件 vNode
    if (tag !== null && typeof tag === 'object') { // 兼容 Vue2 的对象式组件
      flags = tag.functional
        ? VNodeFlags.COMPONENT_FUNCTIONAL      // 函数式组件
        : VNodeFlags.COMPONENT_STATEFUL_NORMAL // 有状态组件
    } else if(typeof tag === 'function') {
      // Vue 3 的类组件
      flags = tag.prototype && tag.prototype.render
        ? VNodeFlags.COMPONENT_STATEFUL_NORMAL  // 有状态组件
        : VNodeFlags.COMPONENT_FUNCTIONAL       // 函数式组件
    }
  }

  // 确定 children 类型 -> 注：针对非组件类型 VNode。因为组件类型的 VNode 的 children 都应作为 slot 存在，应把 children 转化为 slots 再把 children 设置为 null
  let childFlags = null;
  if(Array.isArray(children)) {
    const { length } = children
    if(length === 0) {
      // 没有 children
      childFlags = ChildrenFlags.NO_CHILDREN
    } else if (length === 1) {
      // 单个子节点
      childFlags = ChildrenFlags.SINGLE_VNODE
      children = children[0]
    } else {
      // 多个子节点，且子节点使用 key
      childFlags = ChildrenFlags.KEYED_VNODES
      children = normalizeVNodes(children); // 没有 key 的手动加
    }
  } else if (children == null) {
    // 没有子节点
    childFlags = ChildrenFlags.NO_CHILDREN
  } else if (children._isVNode) {
    // 单个子节点
    childFlags = ChildrenFlags.SINGLE_VNODE
  } else {
    // 其他情况都视作文本节点处理，即单个子节点，创建文本类型的 VNode
    childFlags = ChildrenFlags.SINGLE_VNODE
    children = createTextVNode(children + '')
  }


  return {
    _isVNode: true,
    flags,
    tag,
    data,
    key: data && data.key ? data.key : null,
    children,
    childFlags,
    // 当虚拟节点挂载到真实 DOM 上时，el 值变为该虚拟节点对应真实 DOM 的引用
    el: null
  }
}

function normalizeVNodes(arr) {
  const newChildren = []
  // 为 arr 每个 item 手动添加 key
  for(let i = 0; i < arr.length; i++) {
    const child = arr[i]
    if (child.key == null) {
      child.key = '|' + i
    }
    newChildren.push(child);
  }
  // 返回新的 children, 此时的 children 类型就是 ChildrenFlags.KEYED_VNODES
  return newChildren;
}

function normalizeClass (cls) {
  /* 
  class: 'xxx xxx' / class: {'xxx': true} / class: ['xxx', 'xxx', ['xxx', 'xxx'], {'xxx': false }]
  都 normalize 为
  class: '字符串1 字符串2 ...' 的格式
  */
  let res = ''

  if (typeof cls === 'string') {
    res = cls
  } else if (Array.isArray(cls)) {
    for (let i = 0; i < cls.length; i++) {
      res += normalizeClass(cls[i]) + ' '
    }
  } else if (Object.prototype.toString.call(cls) === '[object Object]') {
    for (let k in cls) {
      if (cls[k]) {
        res += k + ' '
      }
    }
  }

  return res.trim();
}

export function createTextVNode(txt) {
  // 创建一个纯文本节点
  return {
    _isVNode: true,
    flags: VNodeFlags.TEXT,
    tag: null,
    data: null,
    children: txt,
    // 文本节点没有子节点
    childFlags: ChildrenFlags.NO_CHILDREN
  }
}