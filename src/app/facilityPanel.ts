import { planterAt, RIPE_STAGE } from '../core/farm'
import { sharedMealReady } from '../core/meal'
import { DINING_SITE_ID, KITCHEN_SITE_ID, siteById } from '../core/sites'
import type { WorldState } from '../core/world'

/**
 * 设施面板（S2 试点）：已建设施的交互面。
 *
 * 设施表在这里声明每个设施的标题、状态摘要和"当前最该做的一件事"；
 * 面板按钮只负责派发目标——收菜/浇水/开饭仍由伙伴沿真实通路到场执行，
 * 结算与直点入口共用同一套规则（serveMeal / harvestPlanter / advancePlanters）。
 * 本批次不出现"升级"入口；升级入口留给后续内容批次（2C 育苗等）。
 */

/** 第一批接入面板的设施：泉边菜园、灶台、餐桌。 */
export const PANEL_FACILITY_IDS = ['spring-garden', KITCHEN_SITE_ID, DINING_SITE_ID] as const
export type FacilityId = (typeof PANEL_FACILITY_IDS)[number]

/** 菜园面板的状态图示：每一槽菜的生长档位。 */
export interface FacilitySlot { stage: number }

export type FacilityPrimary =
  | { kind: 'harvest'; label: string; x: number; y: number }
  | { kind: 'watering'; label: string; x: number; y: number }
  | { kind: 'plant'; label: string }
  | { kind: 'meal'; label: string }
  | { kind: 'none'; label: string }

export interface FacilityUI {
  active: boolean
  id: FacilityId | null
  title: string
  icon: string
  /** 菜园面板的菜槽图示；灶台/餐桌为空。 */
  slots: FacilitySlot[]
  summary: string
  primary: FacilityPrimary
  /** 主操作下的一句说明（为什么现在做这件事/做不了）。 */
  hint: string
  /** 「自己摆菜槽」入口（仅菜园）。 */
  canPlant: boolean
}

export const emptyFacilityUI = (): FacilityUI => ({
  active: false, id: null, title: '', icon: '', slots: [], summary: '',
  primary: { kind: 'none', label: '' }, hint: '', canPlant: false,
})

/** 调用方保证设施已建成（builtSites 里存在）。 */
export function facilityView(world: WorldState, id: FacilityId): FacilityUI {
  const site = siteById(id)!
  if (id === 'spring-garden') {
    const slots = world.farm.planters.map((planter) => ({ stage: planter.growth }))
    const ripe = world.farm.planters.filter((planter) => planter.growth >= RIPE_STAGE)
    const unripe = world.farm.planters.find((planter) => planter.growth < RIPE_STAGE)
    const primary: FacilityPrimary = ripe.length > 0
      ? { kind: 'harvest', label: '叫小满来收菜', x: ripe[0].x, y: ripe[0].y }
      : unripe
        ? { kind: 'watering', label: '请小满浇浇水', x: unripe.x, y: unripe.y }
        : { kind: 'plant', label: '去种一槽菜' }
    return {
      active: true, id, title: site.name, icon: site.icon, slots,
      summary: world.farm.planters.length ? `熟了 ${ripe.length} 槽 · 共 ${world.farm.planters.length} 槽菜` : '还没有菜槽',
      primary,
      hint: ripe.length > 0 ? '点一下，小满走过去收。' : unripe ? '浇一次水，菜就长一档；干活也会让菜长大。' : '泉边的空地上还能再摆菜槽。',
      canPlant: true,
    }
  }
  const kitchen = id === KITCHEN_SITE_ID
  if (kitchen) {
    const ready = sharedMealReady(world)
    const primary: FacilityPrimary = !ready
      ? { kind: 'none', label: '再配上餐桌' }
      : world.farm.food > 0
        ? { kind: 'meal', label: '做饭，请大家吃' }
        : { kind: 'none', label: '先收一份菜' }
    return {
      active: true, id, title: site.name, icon: site.icon, slots: [],
      summary: ready ? `家里有 ${world.farm.food} 份食材` : '灶台修好啦',
      primary,
      hint: ready ? (world.farm.food > 0 ? '灶台热起来，大家到餐桌围坐。' : '收一份菜就能开饭。') : '餐桌好了就能围坐吃饭。',
      canPlant: false,
    }
  }
  const ready = sharedMealReady(world)
  const primary: FacilityPrimary = !ready
    ? { kind: 'none', label: '再修一个灶台' }
    : world.farm.food > 0
      ? { kind: 'meal', label: '大家坐下来吃饭' }
      : { kind: 'none', label: '先收一份菜' }
  return {
    active: true, id, title: site.name, icon: site.icon, slots: [],
    summary: ready ? `大家一起吃过 ${world.farm.sharedMeals} 顿饭` : '等灶台修好',
    primary,
    hint: ready ? (world.farm.food > 0 ? '同一份结算：只扣 1 份食材。' : '收一份菜就能开饭。') : '灶台好了就能围坐吃饭。',
    canPlant: false,
  }
}

/** 点到的格子是不是这批有面板的已建设施（菜槽本身走直点，不开面板）。 */
export function panelFacilityAt(world: WorldState, x: number, y: number): FacilityId | null {
  const site = PANEL_FACILITY_IDS
    .map((id) => siteById(id)!)
    .find((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h)
  if (!site) return null
  if (!world.builtSites.some((built) => built.id === site.id)) return null
  if (planterAt(world, x, y)) return null
  return site.id as FacilityId
}

/** 一次只开一间设施的面板；面板状态全部由世界数据推导，不写存档。 */
export class FacilityPanel {
  private current: FacilityId | null = null
  constructor(private readonly ports: { world(): WorldState; emit(state: FacilityUI): void }) {}
  get active(): boolean { return this.current !== null }
  get id(): FacilityId | null { return this.current }
  open(id: FacilityId): void { this.current = id; this.refresh() }
  close(): void { if (!this.current) return; this.current = null; this.refresh() }
  toggle(id: FacilityId): void { this.current === id ? this.close() : this.open(id) }
  refresh(): void { this.ports.emit(this.current ? facilityView(this.ports.world(), this.current) : emptyFacilityUI()) }
}
