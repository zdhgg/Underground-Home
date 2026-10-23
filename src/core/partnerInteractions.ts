import { shaftConnected, springVisible } from './exploration'
import { ripePlanters } from './farm'
import { pickaxeUpgrade, wideLampUpgrade, type PartnerUpgrade } from './partnerAbilities'
import { partnerById, type PartnerId } from './partners'
import type { WorldState } from './world'

export type PartnerAction = 'look-at-clue' | 'prepare-nest' | 'upgrade-pickaxe' | 'learn-wide-lamp' | 'place-wide-lamp'
export interface PartnerConversation {
  partnerId: PartnerId
  name: string
  species: string
  verb: string
  lines: string[]
  upgrade: PartnerUpgrade | null
  action: { id: PartnerAction; label: string } | null
}

/** 根据眼前世界生成简短回应，不领取任务、不修改进度、不新增愿望待办。 */
export function partnerConversation(world: WorldState, id: string): PartnerConversation | null {
  const partner = partnerById(id)
  if (!partner?.joins(world)) return null
  const result: PartnerConversation = {
    partnerId: partner.id, name: partner.name, species: partner.species, verb: partner.verb,
    lines: [], upgrade: null, action: null,
  }
  if (partner.id === 'atu') {
    const e = world.exploration
    result.upgrade = world.pods.length > 0 || e.clueFound || e.pickaxeUpgraded ? pickaxeUpgrade(world) : null
    result.lines = !world.progress.coreRepaired
      ? ['一起把家点亮吧！', '左边的土里有亮光。']
      : !world.pods.length
        ? ['这里能修出暖暖的房间。', '点“两人小窝”，再点“开工”，我来挖！']
        : !e.clueFound
          ? ['岩壁里好像有水声。', '点裂纹，我去听听！']
          : !e.pickaxeUpgraded
            ? ['下面真的有水声！', '换把小镐，就能凿开。']
            : !shaftConnected(world)
              ? ['新镐子能凿裂纹啦！', '你点哪段，我就去挖。']
              : !e.entered
                ? ['梯子接到洞底啦！', '咱们下去看看？']
                : !e.springFound
                  ? [springVisible(world) ? '水就在那儿！' : '水声还在前面。', '你来选一条路吧。']
                  : ['新地方连上我们的家啦！', '下一间房，你想放哪？']
    result.action = result.upgrade?.state === 'ready'
      ? { id: 'upgrade-pickaxe', label: '换上小铁镐' }
      : { id: 'look-at-clue', label: e.pickaxeUpgraded && !shaftConnected(world) ? '看看能挖的裂纹' : '看看眼前的线索' }
  } else if (partner.id === 'adeng') {
    result.upgrade = world.progress.coreRepaired && world.exploration.springFound ? wideLampUpgrade(world) : null
    if (result.upgrade?.state === 'ready') {
      result.lines = ['壁灯旁的新地方还偏暗。', '加个灯罩，能照得更远！']
      result.action = { id: 'learn-wide-lamp', label: '学会做聚光灯罩' }
      return result
    }
    if (result.upgrade?.state === 'equipped') {
      result.lines = ['聚光灯罩准备好啦！', '你选灯位，我来加装。']
      result.action = { id: 'place-wide-lamp', label: '去布置聚光灯' }
      return result
    }
    result.lines = !world.progress.coreRepaired
      ? ['……这里好黑。', '我在角落等你。']
      : !world.pods.length ? ['我是阿灯，谢谢你把家点亮！', '我也想有张暖暖的床。一起准备小窝吧？']
        : world.exploration.springFound ? ['暗的地方可以安灯。', '选个壁灯位置，我来装！'] : ['你把家点亮了！', '我喜欢亮亮的通道。']
    if (world.progress.coreRepaired && !world.pods.length) result.action = { id: 'prepare-nest', label: '去准备小窝' }
  } else if (partner.id === 'xiaoman') {
    result.lines = !world.farm.waterSupplied
      ? ['你好，我是小满！我一路追着水汽跑到这里。', '肚子咕咕叫……先找到水，再给我们留一间暖暖的住处，好吗？']
      : world.farm.food > 0 ? ['有新鲜菜啦！', '咱们一起吃一口？']
        : ripePlanters(world).length > 0 ? ['菜长熟啦！', '点菜槽，我走过去收。']
          : world.farm.planters.length > 0 ? ['小芽正在长大。', '你忙建设，我看着菜。'] : ['水到菜园啦！', '去第二层种一槽菜，我来照顾。']
  } else {
    result.lines = world.farm.waterSupplied
      ? ['水已经流到菜园啦。', '泉水边能种菜了。']
      : ['哗啦！我是小泉，这口泉水一直在等人听见。', '我能把水送回家……如果你们也给我和小满留个住处。']
  }
  return result
}
