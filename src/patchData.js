// VNodeData 里对 DOM Property 或是有大写字母的匹配(innerHtml 或 textContent 等必须用 DOM Prop 的方式设置属性)
const domPropsRE = /\[A-Z]|^(?:value|checked|selected|muted)$/ // 匹配字符串中含有 A-Z 任意一个大写字母 或者 value/checked/selected/muted 其中之一

export default function patchData (el, key, prevValue, nextValue) {
  switch (key) {
    case 'style':
      // 把新 vnode 的样式全部更新到现有 dom 上
      for (let k in nextValue) {
        el.style[k] = nextValue[k]
      }
      // 再把现有 dom 原本有的 style 但新 vnode 没有的，给删除掉
      for (let k in prevValue) {
        if (!nextValue.hasOwnProperty(k)) {
          el.style[k] = ''
        }
      }
      break
    case 'class':
      el.className = nextValue
      break
    default:
      if(key[0] === 'o' && key[1] === 'n') {
        // 事件
        // 移除旧事件
        if (prevValue) {
          el.removeEventListener(key.slice(2), prevValue)
        }
        // 添加新事件
        if (nextValue) {
          el.addEventListener(key.slice(2), nextValue)
        }
      }
      if (domPropsRE.test(key)) {
        // 当作 DOM Props 处理
        el[key] = nextValue
      } else {
        // 当作 Attr 处理
        el.setAttribute(key, nextValue)
      }
      break
  }
}