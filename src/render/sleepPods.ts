import { Container, Graphics, Text } from 'pixi.js'
import { TILE_SIZE, type SleepPod } from '../core/world'
import { POD_SIZE } from '../core/build'

/** 玩法草案：嵌在洞壁里的双人床位，暂用程序化示意造型。 */
export function drawSleepPod(pod: Pick<SleepPod, 'x' | 'y' | 'door'>, preview = false): Container {
  const view = new Container()
  const g = new Graphics()
  const w = POD_SIZE.w * TILE_SIZE
  const h = POD_SIZE.h * TILE_SIZE
  g.roundRect(1, 1, w - 2, h - 2, 12).fill(0x314849).stroke({ width: 4, color: 0x84998a })
  g.roundRect(8, 7, w - 16, h - 14, 8).fill(0x192d36)
  for (let i = 0; i < 2; i++) {
    const y = 12 + i * 24
    g.roundRect(14, y + 9, w - 27, 9, 3).fill(0x738b7c)
    g.roundRect(20, y + 5, w - 38, 12, 4).fill(i === 0 ? 0xa2be94 : 0xd9a591)
    g.roundRect(pod.door === 'left' ? w - 33 : 15, y + 4, 15, 9, 3).fill(0xf1dfb8)
  }
  const doorX = pod.door === 'left' ? 4 : w - 8
  g.roundRect(doorX, h - 23, 4, 15, 2).fill(0xffdc95)
  view.addChild(g)
  if (!preview) {
    const label = new Text({ text: '双人睡眠舱', style: { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: 10, fill: 0xf6e9c4 } })
    label.anchor.set(0.5, 0)
    label.position.set(w / 2, h + 4)
    view.addChild(label)
  }
  view.position.set(pod.x * TILE_SIZE, pod.y * TILE_SIZE)
  return view
}
