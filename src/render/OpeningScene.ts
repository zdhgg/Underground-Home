import { Container, Graphics, Text } from 'pixi.js'
import { LANDMARKS, SURFACE_Y, TILE_SIZE as T } from '../core/world'
import { MoleVisual, MOLE_FOOT_Y, type MoleTextures } from './moleVisual'
import type { OpeningFrame } from './openingTimeline'
import { OPENING_BEATS } from './openingTimeline'

const FONT = 'ui-rounded, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'

/** 开场专用替身；结束即隐藏，正式阿土的位置从未被修改。 */
export class OpeningScene {
  readonly view = new Container({ label: 'opening-scene', eventMode: 'none' })
  private readonly actor = new Container()
  private readonly bubble = new Container({ label: 'opening-speech' })
  private readonly bubbleBox = new Graphics()
  private readonly speech = new Text({
    text: '',
    style: { fontFamily: FONT, fontSize: 14, fontWeight: '700', fill: 0x394a45, lineHeight: 18 },
  })
  private readonly warmth = new Graphics()
  private readonly clue = new Graphics()
  private readonly steps = new Graphics()
  private readonly reactions = new Graphics({ label: 'opening-reactions' })
  private readonly mole: MoleVisual | null
  constructor(textures: MoleTextures | null) {
    this.mole = textures ? new MoleVisual(textures) : null
    const fallback = new Graphics().ellipse(0, 0, 11, 13).fill(0xb49478)
      .roundRect(-12, -16, 24, 9, 4).fill(0xf4cb70)
      .circle(-4, -2, 1.5).circle(4, -2, 1.5).fill(0x403c38)
    this.actor.addChild(this.mole?.view ?? fallback)
    if (this.mole) fallback.destroy()
    this.bubble.addChild(this.bubbleBox, this.speech)
    this.bubble.visible = false
    this.view.addChild(this.warmth, this.clue, this.steps, this.actor, this.reactions, this.bubble)
    this.view.visible = false
  }
  update(frame: OpeningFrame): void {
    const shiverOffset = Math.sin(frame.t * 31) * 1.5 * frame.shiver
    const discoveryAge = Math.max(0, Math.min(1, (frame.t - OPENING_BEATS.notice) / .45))
    const discoveryHop = Math.sin(Math.PI * discoveryAge) * 4
    const warmSettle = frame.phase === 'shelter' ? Math.sin(frame.t * 2.8) * .5 * frame.warmth : 0
    this.actor.position.set(frame.x + shiverOffset, frame.footY - MOLE_FOOT_Y - discoveryHop - warmSettle)
    this.actor.rotation = shiverOffset * .012
    this.actor.scale.set(1 - frame.shiver * .025 + frame.warmth * .012, 1 + frame.shiver * .018 - frame.warmth * .006)
    this.mole?.face(frame.facing)
    this.mole?.update(frame.t * (frame.phase === 'approach' ? 1.7 : 1), frame.pose, .75 + frame.warmth * .25)

    // 一口白气和收拢的爪子说明“冷”；发现时的小亮线只出现一次。
    this.reactions.clear()
    if (frame.shiver > .01) {
      const puff = (frame.t % 1.15) / 1.15
      const alpha = Math.sin(Math.PI * puff) * .42 * frame.shiver
      this.reactions.ellipse(frame.x + 11 + puff * 19, frame.footY - 28 - puff * 9, 3 + puff * 8, 2 + puff * 4)
        .fill({ color: 0xe5f4fa, alpha })
      for (const side of [-1, 1]) {
        this.reactions.ellipse(frame.x + side * 4 + shiverOffset, frame.footY - 18, 3.4, 4)
          .fill({ color: 0x96765e, alpha: frame.shiver * .8 })
      }
    }
    if (frame.notice > .01) {
      for (const [dx, dy] of [[-8, -5], [0, -8], [8, -5]]) {
        this.reactions.moveTo(frame.x + dx!, frame.footY - 45 + dy!)
          .lineTo(frame.x + dx! * 1.5, frame.footY - 49 + dy! * 1.5)
          .stroke({ color: 0xffe5a3, alpha: frame.notice, width: 2 })
      }
    }

    const entranceX = (LANDMARKS.shaft.x + LANDMARKS.shaft.w / 2) * T
    const entranceY = SURFACE_Y * T - 8
    this.warmth.clear()
    if (frame.entranceGlow > .001) {
      const breathing = .88 + Math.sin(frame.t * 3.2) * .12
      this.warmth.ellipse(entranceX, entranceY - 6, 43, 47).fill({ color: 0xffb95d, alpha: .08 * frame.entranceGlow * breathing })
      this.warmth.ellipse(entranceX, entranceY + 8, 24, 32).fill({ color: 0xffd98a, alpha: .12 * frame.entranceGlow * breathing })
    }
    if (frame.warmBurst > .01) {
      this.warmth.ellipse(frame.x, frame.footY - 18, 25, 30)
        .fill({ color: 0xffcf78, alpha: frame.warmBurst * .08 })
    }

    const speech = frame.speech
    this.bubble.visible = speech.length > 0
    if (speech) {
      if (this.speech.text !== speech) this.speech.text = speech
      const width = Math.max(76, this.speech.width + 24)
      const height = Math.max(31, this.speech.height + 14)
      const leftOfActor = frame.x > entranceX - 70
      const x = leftOfActor ? frame.x - width - 18 : frame.x + 18
      const y = frame.footY - MOLE_FOOT_Y - 76 - discoveryHop
      this.bubbleBox.clear()
        .roundRect(x, y, width, height, 8).fill({ color: 0xfff7df, alpha: .96 })
        .roundRect(x, y, width, height, 8).stroke({ color: 0x526963, width: 1.5 })
      if (leftOfActor) {
        this.bubbleBox.poly([x + width - 16, y + height - 2, frame.x - 13, frame.footY - 57, x + width - 34, y + height - 2])
          .fill({ color: 0xfff7df })
          .stroke({ color: 0x526963, width: 1.5 })
      } else {
        this.bubbleBox.poly([x + 16, y + height - 2, frame.x + 13, frame.footY - 57, x + 34, y + height - 2])
          .fill({ color: 0xfff7df })
          .stroke({ color: 0x526963, width: 1.5 })
      }
      this.speech.position.set(x + 12, y + 7)
    }

    // 下梯时手脚交替贴住梯档；身体仍在两根梯轨之间。
    this.steps.clear()
    if (frame.pose === 'climb') {
      const beat = Math.sin(frame.t * 13) * 4
      for (const side of [-1, 1]) {
        this.steps.ellipse(frame.x + side * 10, frame.footY - 26 + side * beat, 3.5, 2.5).fill(0xb49478)
        this.steps.ellipse(frame.x + side * 7, frame.footY - 2 - side * beat * .5, 4, 2).fill(0x806653)
      }
    }
    this.clue.clear()
    const x = (LANDMARKS.crystal.x + .5) * T, y = (LANDMARKS.crystal.y + .5) * T
    for (const [radius, alpha] of [[34, .04], [22, .07], [10, .13]]) {
      this.clue.circle(x, y, radius).fill({ color: 0x8dedfd, alpha: alpha! * frame.clue * (.85 + Math.sin(frame.t * 5) * .15) })
    }
  }
}
