import { LANDMARKS, type Rect, type WorldState } from './world'
import { shaftConnected, springVisible, suggestedBreakthrough, waterSpan } from './exploration'
import { canBuildMorePods, waitingPartnerList, waitingPartners } from './partners'
import { DINING_SITE_ID, KITCHEN_SITE_ID } from './meal'
import { siteById } from './sites'

/**
 * 任务（missions）：给"问题和目标"，不规定唯一解。
 * 完成判定只依赖世界数据（进度位 + 地图），与玩家的操作顺序无关；
 * 进度位单调（撤销挖掘不会让任务回退），自由建设打乱节奏也能正确判定。
 */
export interface Mission {
  id: string
  /** 一句话目标（徽章标题） */
  title: string
  /** 小鼹鼠阿土说的话：为什么 + 现在要做什么（面向 7 岁儿童） */
  speech: string
  /** 现在做什么（短句） */
  todo: string
  /** 做完会发生什么 */
  outcome: string
  /** 完成条件：基于世界数据的纯判定 */
  isDone: (world: WorldState) => boolean
}

/** 第一夜当前主线：找到能源石 → 收好它 → 修好核心 → 安置睡眠舱 */
export const FIRST_NIGHT_MISSIONS: readonly Mission[] = [
  {
    id: 'find-energy-stone',
    title: '找到发光的能源石',
    speech: '外面风雪好大！先在地下安家吧。挖开左边泛蓝光的泥土，找能源石把家照亮。',
    todo: '点一点泛蓝光的泥土，一格一格挖开它。',
    outcome: '能源石能把家照亮。',
    isDone: (world) => world.progress.crystalFound,
  },
  {
    id: 'collect-energy-stone',
    title: '收好能源石',
    speech: '找到啦！点一下亮晶晶的小石头，把它收好。',
    todo: '点一下露出来的蓝色能源石。',
    outcome: '拿上它，去修大厅里的大机器。',
    isDone: (world) => world.progress.crystalCollected,
  },
  {
    id: 'repair-energy-core',
    title: '修好能源核心，点亮家园',
    speech: '把石头放进中间的大机器，家就能亮起来了！',
    todo: '点一下大厅中间的能源核心。',
    outcome: '灯一盏一盏亮起来，阿灯也敢出来了。',
    isDone: (world) => world.progress.coreRepaired,
  },
  {
    id: 'build-sleep-pod',
    title: '给伙伴留床',
    speech: '亮了！阿灯一直守着这座旧避难所，可她和我还没有床。挖出一间暖窝，给我们留两张床吧！',
    todo: '挖出左边的暖窝空间，蓝图出现后点“开工”。',
    outcome: '阿土和阿灯住下来，地下才真正像一个家。',
    isDone: (world) => world.pods.length > 0,
  },
]

export interface MissionProgress {
  mission: Mission
  done: boolean
}

/** 全部任务的完成情况 */
export function getMissionProgress(world: WorldState): MissionProgress[] {
  return FIRST_NIGHT_MISSIONS.map((mission) => ({ mission, done: mission.isDone(world) }))
}

/** 当前任务：第一个尚未完成的任务；全部完成时为 null */
export function currentMission(world: WorldState): Mission | null {
  return FIRST_NIGHT_MISSIONS.find((mission) => !mission.isDone(world)) ?? null
}

/** 完成数量汇总（用于进度徽章） */
export function missionSummary(world: WorldState): { done: number; total: number } {
  const progress = getMissionProgress(world)
  return { done: progress.filter((item) => item.done).length, total: progress.length }
}

/** 当前步骤在地图上的高亮指引（线索，不是唯一挖法） */
export type GuideHighlight =
  | { kind: 'dig'; rect: Rect }
  | { kind: 'collect'; rect: Rect }
  | { kind: 'repair'; rect: Rect }
  /** 有了水之后回第一层给新朋友安床 / 种菜 */
  | { kind: 'build'; rect: Rect }
  | { kind: 'none' }

export function guideHighlight(world: WorldState): GuideHighlight {
  const { crystalFound, crystalCollected, coreRepaired } = world.progress
  if (!crystalFound) return { kind: 'dig', rect: LANDMARKS.crystalZone }
  if (!crystalCollected) return { kind: 'collect', rect: LANDMARKS.crystalZone }
  if (!coreRepaired) return { kind: 'repair', rect: LANDMARKS.generatorZone }
  if (world.pods.length) {
    const e = world.exploration
    const x = e.shaftX ?? suggestedBreakthrough(world)
    if (!e.clueFound) return { kind: 'dig', rect: { x, y: 11, w: 1, h: 2 } }
    if (!e.pickaxeUpgraded) return { kind: 'repair', rect: { x, y: 11, w: 1, h: 2 } }
    if (!shaftConnected(world)) {
      const y = Array.from({ length: 10 }, (_, i) => i + 12).find((row) => world.tiles[row][x] !== 0) ?? 12
      return { kind: 'dig', rect: { x, y, w: 1, h: 1 } }
    }
    if (!e.entered) return { kind: 'collect', rect: { x, y: 11, w: 1, h: 2 } }
    if (!e.springFound) {
      const span = waterSpan(world)
      const frontier = span ? span.left > LANDMARKS.spring.x - 1 ? span.left - 1 : span.right + 1 : x
      return { kind: 'collect', rect: { x: springVisible(world) ? LANDMARKS.spring.x : frontier, y: 21, w: 1, h: 1 } }
    }
    // 找到水之后先把它接进菜园（点面板上的「把水接到菜园」）
    if (!world.farm.waterSupplied) return { kind: 'repair', rect: { ...LANDMARKS.spring, w: 1, h: 1 } }
    // 先给新朋友安床；住下之后，菜园在第二层泉水边。
    if (canBuildMorePods(world)) return { kind: 'build', rect: LANDMARKS.buildSuggestion }
    if (world.farm.harvests === 0) return { kind: 'build', rect: LANDMARKS.gardenSuggestion }
    // 第一夜过完了：家里有电，该顺着梯道送到下面去了
    if (!world.powerDown) return { kind: 'repair', rect: LANDMARKS.generatorZone }
    // 章末三步都在泉边洞室：修灶台 → 摆餐桌 → 第一顿饭。
    if (!world.builtSites.some((site) => site.id === KITCHEN_SITE_ID)) return { kind: 'build', rect: siteById(KITCHEN_SITE_ID)! }
    if (!world.builtSites.some((site) => site.id === DINING_SITE_ID)) return { kind: 'build', rect: siteById(DINING_SITE_ID)! }
    if (world.farm.sharedMeals === 0) return { kind: 'collect', rect: siteById(DINING_SITE_ID)! }
  }
  return { kind: 'none' }
}

/**
 * 探索 + 引水 + 种植 + 共餐的主线引导（一步一步只显示当前这一步）。
 * 判定全部来自世界数据，顺序无关；进度位单调，收获过一次就不会回退。
 * 最后三步是第二层的章末：修灶台 → 摆餐桌 → 第一顿围坐饭。
 */
export function explorationGuide(world: WorldState): { title: string; speech: string; outcome: string; done: number; total: number; finished: boolean } {
  const e = world.exploration
  const farm = world.farm
  const connected = shaftConnected(world)
  const waiting = waitingPartners(world)
  const waitingNames = waitingPartnerList(world).map((partner) => partner.name).join('和')
  // 在找到水之前，这两步都不算数：那时"没等床的伙伴""没收成"只是还没开始。
  const friendsSettled = e.springFound && waiting === 0
  const harvested = farm.harvests > 0
  const powered = world.powerDown
  const kitchenBuilt = world.builtSites.some((site) => site.id === KITCHEN_SITE_ID)
  const diningBuilt = world.builtSites.some((site) => site.id === DINING_SITE_ID)
  const dined = farm.sharedMeals > 0
  const done = [e.clueFound, e.pickaxeUpgraded, connected, e.entered, e.springFound, farm.waterSupplied, friendsSettled, harvested, powered, kitchenBuilt, diningBuilt, dined].filter(Boolean).length
  const guide = !e.clueFound
    ? ['楼下有谁在喊饿', '床安好啦。楼下好像有小兔子的声音："我饿了……下面有水吗？" 点一下岩壁上的裂纹——我去听听里面有没有水声。', '有了水，就能种出吃的。']
    : !e.pickaxeUpgraded
      ? ['换上小铁镐', '裂缝里有凉凉的水汽！换上小铁镐，就能挖开这种带裂纹的岩石。', '坚硬的大岩石还要留着。']
      : !connected
        ? ['亲手挖出向下的梯道', '点带裂纹的岩石，我会走过去一镐一镐挖开、把梯子接长。练两次以后，点「一路挖到底」，我一口气挖到洞底！', '梯子连到洞底，我们才能下去。']
        : !e.entered
          ? ['沿梯子去第二层', '通啦！点“沿梯子下去”，我带你到新地方看看！', '顺着真实的梯子，抵达泉水层。']
          : !e.springFound
            ? ['找到滴答响的泉水', springVisible(world) ? '小满说：泉水露出来啦！点一下泉水，她跑过去看看。' : `小满说：水就在${(world.exploration.shaftX ?? 27) > LANDMARKS.spring.x ? '左' : '右'}边的土壁后面！点着泥土一格一格挖过去，挖到水边就能喝到啦。`, '找到水源，这里也能住人。']
            : !farm.waterSupplied
              ? ['把水接到菜园', '找到水啦！点「把水接到菜园」，小泉会沿通道把水接到泉边的菜地。', '水到了菜园，小满就能种菜了。']
              : waiting > 0
                ? ['给伙伴留床', `家里有水了！${waitingNames}刚来到这里，还在等床。回暖窝层挖出一间住处，或扩建已有住处，给${waiting > 1 ? '他们' : '他'}增加床位吧。`, '朋友住下来，家才热闹。']
                : !harvested
                  ? ['在泉水边种出第一份食物', '点泉边的“小菜园”，再点“开工”。挖到的石料和旧木料能用来修菜槽！菜熟了点一下，小满来收。', '有菜吃，小满就不饿了。']
                  : !powered
                    ? ['把家里的电送到下面', '家里亮堂堂的，可是第二层还是黑的。点「⚡ 把电送到下面」，我把电线顺着梯子铺下去。', '下面的灯也能亮了。']
                    : !kitchenBuilt
                      ? ['在泉边修一个灶台', '菜收好了，可我们还吃不上热乎的！点「泉边建设」，选「泉边灶台」再点「开工」。', '灶台热起来，收成就能做熟啦。']
                      : !diningBuilt
                        ? ['再摆一张餐桌', '灶台冒热气啦！再点「泉边建设」修一张围坐餐桌，大家就能坐在一起吃。', '围着桌子吃饭，家才热闹。']
                        : !dined
                          ? ['请大家吃第一顿饭', '灶台和餐桌都好啦！点下面的「请大家吃第一顿饭」。没有菜的话，先去菜园收一份。', '第一顿饭吃完，第二层就完整啦。']
                          : ['家越住越大！', '家里有水、有床、有新鲜菜，第一顿饭也吃上啦。想继续扩建就往左右挖一挖。', '地下小家园，还会一层一层长大。']
  return { title: guide[0], speech: guide[1], outcome: guide[2], done, total: 12, finished: friendsSettled && harvested && powered && kitchenBuilt && diningBuilt && dined }
}
