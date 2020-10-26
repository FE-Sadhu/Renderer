/*
  渲染器的核心工作:
  把 virtual DOM 渲染成特定平台下的真实 "DOM"。
  1. 若无旧虚拟节点树，则把该 VNodes 渲染成真实 DOM 挂载在挂载点上
  2. 若有旧 VNodes 且无新 VNodes，则从挂载点 remove 现有 DOM。
  3. 若有旧 VNodes 也有新 VNodes，则进入 patch 机制，diff 对比新旧节点，更新差异到现有 DOM。

  其余工作：
  1. 控制部分组件生命周期钩子的调用
  2. 多端渲染的桥梁，可配置操作特定平台的 "DOM"
  3. 与异步渲染有直接关系
  4. diff 算法
*/
import { VNodeFlags, ChildrenFlags } from './flags'
import { createTextVNode } from './h'
import patchData from './patchData'

export default function render(vnode, container) {
  const prevVNode = container.vnode // 旧的 VNodes
  if (prevVNode == null) { // 情况 1.
    // 挂载 vnode
    mount(vnode, container)
    container.vnode = vnode
  } else {
    if (vnode) { // 情况 3.
      // diff 对比，更新差异
      patch(prevVNode, vnode, container)
      // 更新旧节点
      container.vnode = vnode
    } else { // 情况 2.
      container.removeChild(prevVNode.el)
      container.vnode = null
    }
  }
}

// mount 函数的本质就是把不同类型的 vnode 渲染成真实 DOM，并挂载到挂载点上。
function mount(vnode, container, isSVG, refNode) {
  const { flags } = vnode
  if(flags & VNodeFlags.ELEMENT) {
    // 挂载普通元素
    mountElement(vnode, container, isSVG, refNode)
  } else if (flags & VNodeFlags.COMPONENT) {
    // 挂载组件
    mountComponent(vnode, container, isSVG)
  } else if (flags & VNodeFlags.TEXT) {
    // 挂载文本
    mountText(vnode, container)
  } else if (flags & VNodeFlags.FRAGMENT) {
    // 挂载 Fragment
    mountFragment(vnode, container, isSVG)
  } else if (flags & VNodeFlags.PORTAL) {
    // 挂载 Portal
    mountPortal(vnode, container, isSVG)
  }
}


function mountElement(vnode, container, isSVG, refNode) {
  isSVG = isSVG || vnode.flags & VNodeFlags.ELEMENT_SVG
  const el = isSVG
    ? document.createElementNS('http://www.w3.org/2000/svg', vnode.tag)
    : document.createElement(vnode.tag)
  vnode.el = el

  /* 处理 VNodeData */
  // key 无非就是 style、class、DOM 属性、事件
  const data = vnode.data
  if (data) {
    for (let key in data) {
      // key 可能是 style class on 等等
      patchData(el, key, null, data[key])
    }
  }

  /* 处理 VNode 子节点 */
  const childFlags = vnode.childFlags
  const children = vnode.children
  /* 自顶向下递归（传递已经有的父节点真实 DOM -> el），自底向上挂载（节点自身生成真实 DOM 后挂载到传递下来的父真实 DOM 上） */
  // 检测如果没有子节点则无需递归挂载
  if (childFlags !== ChildrenFlags.NO_CHILDREN) {
    if (childFlags & ChildrenFlags.SINGLE_VNODE) {
      // 如果是单个子节点则调用 mount 函数挂载
      mount(children, el, isSVG)
    } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
      // 如果是单多个子节点则遍历并调用 mount 函数挂载
      for (let i = 0; i < children.length; i++) {
        mount(children[i], el, isSVG)
      }
    }
  }

  refNode ? container.insertBefore(el, refNode) : container.appendChild(el)
}

function mountText(vnode, container) {
  const el = document.createTextNode(vnode.children)
  vnode.el = el
  container.appendChild(el)
}

function mountFragment(vnode, container, isSVG) {
  const { children, childFlags } = vnode

  switch (childFlags) {
    case ChildrenFlags.SINGLE_VNODE:
      mount(children, container, isSVG)
      vnode.el = children.el
      break
    case ChildrenFlags.NO_CHILDREN:
      // 没有子节点的话，等于挂载空片段，创建个空文本节点占位
      const placeholder = createTextVNode('')
      mount(placeholder, container)
      vnode.el = placeholder.el
      break
    default:
      // 多个子节点就遍历挂载
      for (let i = 0; i < children.length; i++) {
        mount(children[i], container, isSVG)
      }
      // 片段的第一个 vnode DOM 引用作为该 Fragment vnode 的 DOM 引用
      vnode.el = children[0].el
      break
  }
}

function mountPortal(vnode, container, isSVG) {
  // 子节点会渲染到给定目标，但还是会在原处挂一个占位 DOM ，为了事件捕获、触发、冒泡机制
  const { tag, children, childFlags } = vnode

  // 子节点渲染到 target 下
  const target = typeof tag === 'string' ? document.querySelector(tag) : tag
  if (childFlags & ChildrenFlags.SINGLE_VNODE) {
    mount(children, target, isSVG)
  } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
    for (let i = 0; i < children.length; i++) {
      mount(children[i], target, isSVG)
    }
  }

  // 占位文本节点渲染到 container 下
  const placeholder = createTextVNode('')
  mountText(placeholder, container)
  // 该 Portal vnode 的 DOM 引用指向占位节点
  vnode.el = placeholder.el
}

function mountComponent(vnode, container, isSVG) {
  if (vnode.flags & VNodeFlags.COMPONENT_STATEFUL) {
    mountStatefulComponent(vnode, container, isSVG)
  } else {
    mountFunctionalComponent(vnode, container, isSVG)
  }
}

function mountStatefulComponent(vnode, container, isSVG) {
  // 1. 创建组件实例
  const instance = (vnode.children = new vnode.tag()) // 这个实例化的过程包含了对 data computed watch life-circle 的初始化过程

  // 被动更新，初始化 props
  instance.$props = vnode.data // 简略操作，当成这样提取到 props，实则要过滤 class style 事件 等

  /** 把 2 3 4 步封装成一个 _update 函数，用作组件内状态变化更新使用
    // 2. 生成 vnode
    instance.$vnode = instance.render()
    // 3. 生成真实 DOM 挂载到 container
    mount(instance.$vnode, container, isSVG)
    // 4. 组件 vnode 的 el 以及 组件实例.$el 都指向组件的根节点 DOM 
    vnode.el = instance.$el = instance.$vnode.el
  */

  instance._update = function () {
    if (instance._mounted) {
      // 更新操作
      // 1. 拿到旧 vnode
      const prevVNode = instance.$vnode
      // 2. 生成 vnode
      const nextVNode = (instance.$vnode = instance.render())
      // 3. patch 更新
      patch(prevVNode, nextVNode, prevVNode.el.parentNode)
      // 4、更新 vnode.el 和 $el
      instance.$el = vnode.el = instance.$vnode.el
    } else {
      // 首次挂载
      // 2. 生成 vnode
      instance.$vnode = instance.render()
      // 3. 挂载 vnode
      mount(instance.$vnode, container, isSVG)
      // 4、更新 vnode.el 和 $el
      instance.$el = vnode.el = instance.$vnode.el

      instance._mounted = true // 组件已挂载的标识
      // 手动调用 Mounted 钩子造成自身状态变化，对应例子 18 食用 (主动更新)
      instance.mounted && instance.mounted()
    }
  }

  instance._update()
}

function mountFunctionalComponent(vnode, container, isSVG) {
  // 比有状态组件少了个实例化的过程
  // 函数式组件就只处理 slot prop 这类只接收数据的方法，然后生成 vnode

  /* 考虑函数式组件的更新，重构代码，同样封装一个 update 函数，绑定在组件 vnode 上
  // 初始化 props
  const props = vnode.data

  const $vnode = (vnode.children = vnode.tag(props))

  mount($vnode, container, isSVG)
  // el 引用组件的根元素 DOM 
  vnode.el = $vnode.el
  */

  vnode.handle = {
    prev: null, // 存储旧的函数式组件 VNode
    next: vnode, // 存储新的函数式组件 VNode
    container,
    update: () => {
      if(vnode.handle.prev !== null) {
        // 函数式组件更新的逻辑
        const prevVNode = vnode.handle.prev // 旧的组件 vnode
        const nextVNode = vnode.handle.next // 新的组件 vnode

        const prevTree = prevVNode.children // 组件产出的旧 vnode

        // 更新 Props
        const props = nextVNode.data

        const nextTree = (nextVNode.children = nextVNode.tag(props)) // 组件产出的新 vnode

        patch(prevTree, nextTree, vnode.handle.container) // patch 更新组件产出的新旧 vnode

      } else {
        // 首次挂载逻辑
        // 初始化 props
        const props = vnode.data
        // 生成 VNode
        const $vnode = (vnode.children = vnode.tag(props))
        // 挂载 vnode
        mount($vnode, container, isSVG)
        // el 引用组件的根元素 DOM
        vnode.el = $vnode.el
      }
    }
  }

  // 立即调用 vnode.handle.update 完成初次挂载
  vnode.handle.update()
}

function patch(prevVNode, nextVNode, container) {
  /*
    对比新旧 vnode, 更新 DOM 原则:
    1. 如果新旧 vnode 的类型都不一样，直接 replaceVNode 替换旧 vnode
    2. 如果新旧 vnode 类型一样，则分别调用 patchXxx 方法进一步对比
  */
  
  const prevFlags = prevVNode.flags
  const nextFlags = nextVNode.flags

  if (prevFlags !== nextFlags) {
    replaceVNode(prevVNode, nextVNode, container)
  } else if (nextFlags & VNodeFlags.ELEMENT) {
    patchElement(prevVNode, nextVNode, container)
  } else if (nextFlags & VNodeFlags.COMPONENT) {
    patchComponent(prevVNode, nextVNode, container)
  } else if (nextFlags & VNodeFlags.TEXT) {
    patchText(prevVNode, nextVNode)
  } else if (nextFlags & VNodeFlags.FRAGMENT) {
    patchFragment(prevVNode, nextVNode, container)
  } else if (nextFlags & VNodeFlags.PORTAL) {
    patchPortal(prevVNode, nextVNode)
  }
}

function replaceVNode(prevVNode, nextVNode, container) {
  // 删除旧 vnode 的 DOM
  container.removeChild(prevVNode.el)

  // 如果将要被移除的 VNode 类型是组件，则需要调用该组件实例的 unmounted 钩子函数
  if (prevVNode.flags & VNodeFlags.COMPONENT_STATEFUL_NORMAL) {
    // 类型为有状态组件的 VNode，其 children 属性被用来存储组件实例对象
    const instance = prevVNode.children
    instance.unmounted && instance.unmounted()
  }

  // 挂载新 vnode 的 DOM
  mount(nextVNode, container)
}

function patchElement(prevVNode, nextVNode, container) {
  /*
    虽然新旧 vnode 类型相同
    但新旧 vnode 描述的 DOM 元素(标签比如 div, ul)可能不同
    1. 对于不同标签也是直接替换旧的 vnode
    2. 对于描述相同的标签，则只可能是 VNodeData 和 Children 不同
  */
  if (prevVNode.tag !== nextVNode.tag) {
    replaceVNode(prevVNode, nextVNode, container)
    return
  }

  /* 对比更新新旧 vnode 的 VNodeData */
  const el = (nextVNode.el = prevVNode.el) // 把新 vnode 的 el 也指向旧 vnode 的 DOM 
  const prevData = prevVNode.data
  const nextData = nextVNode.data
  
  // 遍历新的 VNodeData，将旧值和新值都传递给 patchData 函数
  if (nextData) {
    for (let key in nextData) {
      const nextValue = nextData[key]
      const prevValue = prevData[key] // 可能不存在
      patchData(el, key, prevValue, nextValue)
    }
  }

  // 遍历旧的 VNodeData，将已经不存在于新的 VNodeData 中的数据移除
  if (prevData) {
    for (let key in prevData) {
      const prevValue = prevData[key]
      if (prevValue && !nextData.hasOwnProperty(key)) {
        // 第四个参数为 null，代表移除数据
        patchData(el, key, prevValue, null)
      }
    }
  }

  /* 对比更新新旧 vnode 的 子节点 */
  // 递归更新子节点
  patchChildren(
    prevVNode.childFlags, // 旧的子节点类型
    nextVNode.childFlags, // 新的子节点类型
    prevVNode.children, // 旧的子节点
    nextVNode.children, // 新的子节点
    el // 子节点的父节点 （当前节点）
  )
}

function patchChildren(
  prevChildFlags,
  nextChildFLags,
  prevChildren,
  nextChildren,
  container
) {
  switch (prevChildFlags) {
    // 旧的 children 为单个子节点
    case ChildrenFlags.SINGLE_VNODE:
      switch (nextChildFLags) {
        case ChildrenFlags.SINGLE_VNODE:
          // 新旧 children 都是单个子节点时，调用 patch
          patch(prevChildren, nextChildren, container)
          break
        case ChildrenFlags.NO_CHILDREN:
          // 旧子节点是单个 vnode，新子节点无
          container.removeChild(prevChildren.el)
          break
        default:
          // 旧子节点是单个子节点，新子节点是多个子节点
          // 采取方案: 删除旧的单个子节点，逐个挂载新子节点
          container.removeChild(prevChildren.el)
          for (let i = 0; i < nextChildren.length; i++) {
            mount(nextChildren[i], container)
          }
          break
      }
      break
    // 旧的 children 为空
    case ChildrenFlags.NO_CHILDREN:
      switch (nextChildFLags) {
        case ChildrenFlags.SINGLE_VNODE:
          mount(nextChildren, container)
          break
        case ChildrenFlags.NO_CHILDREN:
          // 什么都不做
          break
        default:
          for (let i = 0; i < nextChildren.length; i++) {
            mount(nextChildren[i], container)
          }
          break
      }
      break
    // 旧的 children 有多个子节点时
    default:
      switch (nextChildFLags) {
        case ChildrenFlags.SINGLE_VNODE:
          // 把旧子节点全部删除
          for (let i = 0; i < prevChildren.length; i++) {
            container.removeChild(prevChildren[i].el)
          }
          // 挂载新子节点
          mount(nextChildren, container)
          break
        case ChildrenFlags.NO_CHILDREN:
          // 把旧子节点全部删除
          for (let i = 0; i < prevChildren.length; i++) {
            container.removeChild(prevChildren[i].el)
          } 
          break
        default:
          // 新旧子节点都是多个子节点时
          // diff 算法更新差异，尽可能去复用旧子节点

          /**
           * 方案一: 删除旧子节点，挂载新子节点
           * 优点: 简单，易理解
           * 缺点: 全是删除旧 DOM 、创建新 DOM、挂载新 DOM 的操作，性能耗费大
           */
            /*
            // 把旧子节点全部删除
            for (let i = 0; i < prevChildren.length; i++) {
              container.removeChild(prevChildren[i].el)
            }
            // 挂载所有新子节点
            for (let i = 0; i < nextChildren.length; i++) {
              mount(nextChildren[i], container)
            }
            */

          /**
           * 方案二: 无 key 时的 diff
           * 优点: 最好情况遍历新旧子节点一一对应都是相同标签，就可以复用所有 DOM；
           * 缺点: 最坏情况新旧子节点一一对照都不相同，照样需要删除、创建、挂载新 DOM
           */
            /*
            const prevLen = prevChildren.length,
                  nextLen = nextChildren.length;

            const commonLen = prevLen > nextLen ? nextLen : prevLen;

            for (let i = 0; i < commonLen; i++) {
              patch(prevChildren[i], nextChildren[i], container)
            }

            if (nextLen > prevLen) {
              for (let i = commonLen; i < nextLen; i++) {
                mount(nextChildren[i], container)
              }
            }

            if (prevLen > nextLen) {
              for (let i = commonLen; i < prevLen; i++) {
                container.removeChild(prevChildren[i].el)
              }
            }
            */
          
          /**
           * 方案三: react 的 diff 算法 (最大索引)
           * 优点:
           *    1. key 作为节点的唯一标识，建立起新旧 children 的节点之间的映射，以便在旧 children 中找到可复用的节点，尽可能复用 DOM。
           *    2. 根据适当的情况移动节点达到更新的目的
           * 
           * 缺点：虽能达到预期，但是不具备普适性
           */
            /*
            let lastIndex = 0 // 最大索引
            for (let i = 0; i < nextChildren.length; i++) {
              const nextVNode = nextChildren[i]
              let find = false

              for (let j = 0; j < prevChildren.length; j++) {
                const prevVNode = prevChildren[j]

                if (prevVNode.key === nextVNode.key) {
                  find = true
                  patch(prevVNode, nextVNode, container)
                  if (j < lastIndex) {
                    // 移动节点
                    const refNode = nextChildren[i - 1].el.nextSibling
                    container.insertBefore(prevVNode.el, refNode)
                  } else {
                    lastIndex = j // 更新最大索引
                  }
                  break
                }
              }

              if (!find) {
                // 该新节点在旧 children 中找不到可复用的节点
                const refNode = i - 1 < 0 ? prevChildren[0].el : nextChildren[i - 1].el.nextSibling
                mount(nextVNode, container, false, refNode)
              }
            }

            // 删除旧 children 中多余的节点
            for (let i = 0; i < prevChildren.length; i++) {
              const prevVNode = prevChildren[i]

              const has = nextChildren.find(nextVNode => nextVNode.key === prevVNode.key)

              if (!has) {
                container.removeChild(prevVNode.el)
              }
            }
            */
          
          /**
           * 双端比较法
           * 优点: 相较 react 的 diff 算法在移动 DOM 方面更具有普适性，性能更高些
           */

            let oldStartIdx = 0,
                oldEndIdx = prevChildren.length - 1,
                newStartIdx = 0,
                newEndIdx = nextChildren.length - 1;

            while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
              if (!prevChildren[oldStartIdx]) {
                oldStartIdx++
                continue
              } else if (!prevChildren[oldEndIdx]) {
                oldEndIdx--
                continue
              }
              if (prevChildren[oldStartIdx].key === nextChildren[newStartIdx].key) {
                patch(prevChildren[oldStartIdx], nextChildren[newStartIdx], container)

                oldStartIdx++;
                newStartIdx++;
              } else if (prevChildren[oldEndIdx].key === nextChildren[newEndIdx].key) {
                patch(prevChildren[oldEndIdx], nextChildren[newEndIdx], container)

                oldEndIdx--;
                newEndIdx--;
              } else if (prevChildren[oldStartIdx].key === nextChildren[newEndIdx].key) {
                patch(prevChildren[oldStartIdx], nextChildren[newEndIdx], container)

                container.insertBefore(prevChildren[oldStartIdx].el, prevChildren[oldEndIdx].el.nextSibling)

                oldStartIdx++;
                newEndIdx--;
              } else if (prevChildren[oldEndIdx].key === nextChildren[newStartIdx].key) {
                patch(prevChildren[oldEndIdx], nextChildren[newStartIdx], container)

                container.insertBefore(prevChildren[oldEndIdx].el, prevChildren[oldStartIdx].el)

                oldEndIdx--;
                newStartIdx++;
              } else {
                // 双端比较都找不到相同 key 的节点
                const newStartVNode = nextChildren[newStartIdx]

                const idxInOld = prevChildren.findIndex(oldVNode => oldVNode.key === newStartVNode.key)

                if (idxInOld >= 0) {
                  patch(prevChildren[idxInOld], newStartVNode, container)

                  container.insertBefore(prevChildren[idxInOld].el, prevChildren[oldStartIdx].el)
                  // 由于 idxInOld 处的旧 vnode 的 DOM 已被移动，所以就 children 这里置为 undefined
                  prevChildren[idxInOld] = undefined
                } else {
                  mount(newStartVNode, container, false, prevChildren[oldStartIdx].el)
                }

                newStartIdx++;
              }
            }

            /* 对双端没处理完的节点作 添加新元素 或 移除多余元素 的情况 */

            // 旧头指针大于了旧尾指针，代表旧 children 已处理完
            if (oldStartIdx > oldEndIdx) {
              // 如果新 children 还有没处理完的节点，那就挂载就行了
              for (let i = newStartIdx; i <= newEndIdx; i++) {
                mount(nextChildren[i], container, false, nextChildren[newEndIdx + 1] ? nextChildren[newEndIdx + 1].el : null)
              }
            }

            // 新头指针大于了新尾指针，代表新 children 已处理完
            if (newStartIdx > newEndIdx) {
              // 如果旧 children 还有没处理完的节点，就移除
              for (let i = oldStartIdx; i <= oldEndIdx; i++) {
                container.removeChild(prevChildren[i].el)
              }
            }
          break
      }
      break
  }
}

function patchText(prevVNode, nextVNode) {
  // 利用文本节点的 nodeValue API
  // 新节点的 el 指向旧 DOM 
  const el = (nextVNode.el = prevVNode.el)
  // 只有当新旧文本内容不一致时才有必要更新
  if (nextVNode.children !== prevVNode.children) {
    el.nodeValue = nextVNode.children
  }
}

function patchFragment(prevVNode, nextVNode, container) {
  // 直接调用 patchChildren 函数更新 新旧片段的子节点即可
  patchChildren(
    prevVNode.childFlags, // 旧片段的子节点类型
    nextVNode.childFlags, // 新片段的子节点类型
    prevVNode.children,   // 旧片段的子节点
    nextVNode.children,   // 新片段的子节点
    container
  )

  // 更新新节点的 el 指向
  switch (nextVNode.childFlags) {
    case ChildrenFlags.SINGLE_VNODE:
      nextVNode.el = nextVNode.children.el
      break
    case ChildrenFlags.NO_CHILDREN:
      // 应该当 prevVNode 的子节点类型也为 NO_CHILDREN 时才能这样写
      nextVNode.el = prevVNode.el
      break
    default:
      nextVNode.el = nextVNode.children[0].el
  }
}

function patchPortal(prevVNode, nextVNode) {
  // 先在旧的 data.target 下更新 DOM 
  patchChildren(
    prevVNode.childFlags,
    nextVNode.childFlags,
    prevVNode.children,
    nextVNode.children,
    typeof prevVNode.tag === 'string' ? document.querySelector(prevVNode.tag) : prevVNode.tag // 注意容器元素是旧的 container
  )

  // 让 nextVNode.el 指向 prevVNode.el (Portal 是占位文本节点)
  nextVNode.el = prevVNode.el

  /**
   * 当我们调用 appendChild 方法向 DOM 中添加元素时，如果被添加的元素已存在于页面上，那么就会移动该元素到目标容器元素下。
   */
  // 如果新旧容器不同，才需要搬运
  if (nextVNode.tag !== prevVNode.tag) {
    // 获取新的容器元素，即挂载目标
    const container =
      typeof nextVNode.tag === 'string'
        ? document.querySelector(nextVNode.tag)
        : nextVNode.tag

    switch (nextVNode.childFlags) {
      case ChildrenFlags.SINGLE_VNODE:
        // 如果新的 Portal 是单个子节点，就把该节点搬运到新容器中
        container.appendChild(nextVNode.children.el)
        break
      case ChildrenFlags.NO_CHILDREN:
        // 新的 Portal 没有子节点，不需要搬运
        break
      default:
        // 如果新的 Portal 是多个子节点，遍历逐个将它们搬运到新容器中
        for (let i = 0; i < nextVNode.children.length; i++) {
          container.appendChild(nextVNode.children[i].el)
        }
        break
    }
  }
}

function patchComponent(prevVNode, nextVNode, container) {
  // tag 属性的值是组件类，通过比较新旧组件类是否相等来判断是否是相同的组件
  // 策略：认为不同的组件渲染不同的内容
  if (nextVNode.tag !== prevVNode.tag) { // 不同的子组件
    replaceVNode(prevVNode, nextVNode, container)
  } else if (nextVNode.flags & VNodeFlags.COMPONENT_STATEFUL_NORMAL) { // 检查组件是否是有状态组件
    // 1. 获取组件实例
    const instance = (nextVNode.children = prevVNode.children)
    // 2. 更新 props (被动更新)
    instance.$props = nextVNode.data
    // 3. 更新组件
    instance._update()
  } else {
    // 函数式组件的更新逻辑
    const handle = (nextVNode.handle = prevVNode.handle)

    // 更新 handle 对象
    handle.prev = prevVNode
    handle.next = nextVNode
    handle.container = container

    // 调用 update 函数完成更新
    handle.update()
  }
}