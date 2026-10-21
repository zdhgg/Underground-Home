// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import InventoryDialog from '../src/components/InventoryDialog.vue'
import { bagItems } from '../src/core/bag'
import { createInitialWorld } from '../src/core/world'

let app: App | undefined
afterEach(async () => { app?.unmount(); app = undefined; await nextTick(); document.body.innerHTML = ''; vi.restoreAllMocks() })
async function mount() {
  const trigger = document.createElement('button'); trigger.textContent = '打开物品栏'; document.body.appendChild(trigger); trigger.focus()
  const host = document.createElement('div'); document.body.appendChild(host)
  const close = vi.fn(), find = vi.fn(), collection = vi.fn()
  const state = reactive({ items: bagItems(createInitialWorld()) })
  app = createApp({ render: () => h(InventoryDialog, { items: state.items, collectionAvailable: true, onClose: close, onFind: find, onCollection: collection }) })
  app.mount(host); await nextTick(); await nextTick()
  return { trigger, host, close, find, collection, state }
}

describe('背包模态框的实际组件行为', () => {
  it('打开聚焦关闭按钮，Tab留在弹窗里，卸载后焦点回到入口', async () => {
    const { host, trigger } = await mount()
    const dialog = host.querySelector('[role="dialog"]')!, close = host.querySelector<HTMLButtonElement>('[aria-label="关闭物品栏"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true'); expect(document.activeElement).toBe(close)
    const done = host.querySelector<HTMLButtonElement>('.done')!
    done.focus(); done.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(close)
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(done)
    app!.unmount(); app = undefined; await nextTick(); expect(document.activeElement).toBe(trigger)
  })
  it('Esc只关闭背包，不传到后面的游戏；外侧和大关闭按钮也可退出', async () => {
    const { host, close } = await mount(), gameKey = vi.fn()
    window.addEventListener('keydown', gameKey)
    host.querySelector<HTMLButtonElement>('.close')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(close).toHaveBeenCalledOnce(); expect(gameKey).not.toHaveBeenCalled()
    host.querySelector<HTMLElement>('.bag-backdrop')!.click(); expect(close).toHaveBeenCalledTimes(2)
    host.querySelector<HTMLButtonElement>('.done')!.click(); expect(close).toHaveBeenCalledTimes(3)
    window.removeEventListener('keydown', gameKey)
  })
  it('材料卡片实时更新；旧物可定位，找到后显示故事和收藏架入口', async () => {
    const { host, state, find, collection } = await mount()
    expect(host.querySelectorAll('.item-card')).toHaveLength(5)
    expect(host.querySelectorAll('.item-card img')).toHaveLength(5)
    state.items[0]!.count = 17; await nextTick()
    expect(host.querySelector('[aria-label="石料，17个"]')).not.toBeNull()
    host.querySelector<HTMLButtonElement>('.relic')!.click(); await nextTick()
    expect(host.querySelector('.item-detail')!.textContent).toContain('泥土里的小秘密')
    host.querySelector<HTMLButtonElement>('.action')!.click(); expect(find).toHaveBeenCalledWith('seed-pouch')
    state.items[2]!.count = 1; state.items[2]!.description = '小布袋里装着干种子。'; await nextTick()
    expect(host.querySelector('.item-detail')!.textContent).toContain('干种子')
    expect(host.querySelector('.relic')!.textContent).toContain('已放上收藏架')
    host.querySelector<HTMLButtonElement>('.action')!.click(); expect(collection).toHaveBeenCalledOnce()
  })
})
