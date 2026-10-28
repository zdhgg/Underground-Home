import { RUINS_MOTIFS,RUINS_STORIES,ruinsStory } from './ruins'
import { foundRelics, RELICS } from './relics'
import { WARM_CRYSTAL } from './personal'
import type { WorldState } from './world'

export interface BagItem {
  id: string; kind: 'material' | 'relic'; name: string; count: number; description: string
  origin?: 'crystal' | 'hall' | 'garden' | 'reservoir' | 'ventilation' | 'ruins' | 'finale'
}
const STORIES: Record<string, string> = {
  'seed-pouch': '小布袋里装着干种子。以前住在这里的伙伴，也盼着有一天能种出新鲜蔬菜。先把它好好收藏起来。',
  wrench: '扳手的边缘磨得亮亮的。它一定帮以前的伙伴修过不少东西，现在成了阿土珍藏的小宝贝。',
  'lamp-shade': '旧灯罩上还有小划痕。它曾照亮过这个家，现在和我们一起留在暖暖的地下。',
  'old-photo': '一张有点泛黄的照片：以前住在这里的伙伴们，围坐在长桌旁一起吃饭。原来这张桌子，很早以前就热闹过。',
  'old-key': '一把旧钥匙，握在手里沉甸甸的。更深的旧大厅门上留下了相似的纹路；它是一段旧故事，不是进入新楼层的必需品。',
}

/** 背包与收藏架读取同一份地图，不额外保存旧物数量，撤销和旧档无需另做迁移。 */
export function bagItems(w: WorldState): BagItem[] {
  const found = new Set(foundRelics(w).map(r => r.id))
  return [
    { id: 'stone', kind: 'material', name: '石料', count: w.inventory.stone, description: '修建洞室和菜槽时会用到。挖开泥土或裂纹岩，就有机会找到；建造时自动使用。' },
    { id: 'wood', kind: 'material', name: '旧木料', count: w.inventory.wood, description: '可以修床、做座椅和菜槽。挖土时能找到，建造时会自动从物品栏取用。' },
    ...RELICS.map(r => ({ id: r.id, kind: 'relic' as const, name: r.name, count: found.has(r.id) ? 1 : 0,
      description: found.has(r.id) ? STORIES[r.id]! : '还藏在第一层的泥土里。挖一挖，也许会有小发现！' })),
    ...(w.finale.entered?[{id:'earth-warmth',origin:'finale' as const,kind:'relic' as const,name:WARM_CRYSTAL,count:w.finale.foundWarmth?1:0,description:'最深处的心形暖晶散发的温柔金色。晶体留在原岩层，我们在旁边建九位伙伴的家。终章之后也可以回来看看。'}]:[]),
    ...(w.ruins.entered?[
      {id:'ruins-seal',origin:'ruins' as const,kind:'relic' as const,name:'旧石印',count:w.ruins.foundSeal?1:0,description:'岩层里的小小印纹，像以前住户留下的记号。原物留在原处。'},
      {id:'ruins-footprint',origin:'ruins' as const,kind:'relic' as const,name:'旧小爪印',count:w.ruins.foundFootprint?1:0,description:'一排小印子朝着旧故事壁，原来从前也有伙伴一起走过。'},
      ...RUINS_MOTIFS.map(m=>({id:`ruins-${m}`,origin:'ruins' as const,kind:'relic' as const,name:`${RUINS_STORIES[m].name}拓印`,count:w.ruins.rubbings.includes(m)?1:0,description:ruinsStory(w,m)})),
    ]:[]),
    ...(w.ventilation.entered ? [
      {id:'wind-echo',origin:'ventilation' as const,kind:'relic' as const,name:'回声石',count:w.ventilation.foundEcho?1:0,description:'圆圆岩窝把细小的风声送回来。铃铃说，先听清楚，再连风路。岩窝留在原处，故事记进物品栏。'},
      {id:'wind-vane',origin:'ventilation' as const,kind:'relic' as const,name:'旧风标',count:w.ventilation.foundVane?1:0,description:'旧伙伴也用小飘带观察风，细细的线还留在岩壁里。现在又有九位朋友，一起听见家园的风。'},
    ] : []),
    ...(w.reservoir.entered ? [
      { id: 'water-shell', origin: 'reservoir' as const, kind: 'relic' as const, name: '水纹贝印', count: w.reservoir.foundShell ? 1 : 0, description: '岩壁里留下从前的小贝壳。水曾在这里走过很久很久，贝印留在原处，故事记进物品栏。' },
      { id: 'water-reed', origin: 'reservoir' as const, kind: 'relic' as const, name: '芦苇小穗', count: w.reservoir.foundReed ? 1 : 0, description: '细细的根贴着潮湿岩壁生长。团团说，水路旁的小生命也有自己的家。' },
    ] : []),
    ...(w.garden.entered ? [
      { id: 'garden-food', kind: 'material' as const, name: '家园食物', count: w.farm.food, description: '蔬菜和培育的菌伞放在同一个粮仓。菌床每次收获添两份，回暖光大厅就能请老朋友吃饭。' },
      { id: 'garden-spores', origin: 'garden' as const, kind: 'relic' as const, name: '孢子云', count: w.garden.foundSpores ? 1 : 0, description: '细小光点围着菌伞打转，像岩洞里的星尘。发现留在原地，故事记进物品栏。' },
      { id: 'garden-root', origin: 'garden' as const, kind: 'relic' as const, name: '根须印', count: w.garden.foundRoot ? 1 : 0, description: '旧岩壁里留下根须的印痕。苔苔说，细细的根也能把很远的地方连起来。' },
    ] : []),
    ...(w.hall.entered ? [
      { id: 'hall-mural', origin: 'hall' as const, kind: 'relic' as const, name: '家园壁画', count: w.hall.muralFound ? 1 : 0, description: '第四层旧岩壁里，六个小伙伴围着一盏灯。以前的伙伴也把岩洞建成了家。这份发现留在原地，故事记进相册。' },
      { id: 'warm-wick', origin: 'hall' as const, kind: 'relic' as const, name: '旧灯芯', count: w.hall.warmLightFound ? 1 : 0, description: '石缝里小小一截旧灯芯。暖光从一束变成一路，把四层连成一个家。' },
    ] : []),
    ...(w.deep.entered ? [
      { id: 'crystal-energy', kind: 'material' as const, name: '晶簇', count: w.deep.crystals, description: '第三层采集台取下的晶尖。给配电箱、壁灯和工坊部件供能，晶根留在岩壁里继续生长。' },
      { id: 'ore', kind: 'material' as const, name: '矿石', count: w.deep.ore, description: '采集晶簇时找到的小矿石。小石炉每次把矿石 2 加工成金属锭 2。' },
      { id: 'ingot', kind: 'material' as const, name: '金属锭', count: w.deep.ingots, description: '小石炉加工好的材料。岩壁工坊能把它做成电梯和工具的部件。' },
      { id: 'part', kind: 'material' as const, name: '设施部件', count: w.deep.parts, description: '阿木在工坊做的部件。竖井支撑用 1 个，三层电梯用 3 个；第四层的加固、大厅和长桌也会用到。' },
      { id: 'crystal-cluster', origin: 'crystal' as const, kind: 'relic' as const, name: '天然晶簇', count: w.deep.foundCrystal ? 1 : 0, description: '岩壁里的一小片星空。我们只取松动的晶尖，留下晶根，让这片晶光继续陪着家园。' },
      { id: 'crystal-moss', origin: 'crystal' as const, kind: 'relic' as const, name: '晶苔', count: w.deep.foundMoss ? 1 : 0, description: '晶簇旁潮湿岩壁上的小生命，把一点点光留成了紫色的小星星。它留在原地，在家园里慢慢发亮。' },
      { id: 'old-drill', origin: 'crystal' as const, kind: 'relic' as const, name: '旧钻头', count: w.deep.foundDrill ? 1 : 0, description: '工坊旧址里的钻头，螺纹已经磨圆。以前的伙伴也在这里修过工具、把家往下建。这次，我们接着把家连起来。' },
    ] : []),
  ]
}

/** 大厅后墙上的小收藏架，不占可建造地块，不改变通行。 */
export const COLLECTION_SHELF = { x: 17, y: 8, w: 2, h: 1 } as const
