import bag from '../assets/art/items/bag-v1.png'
import stone from '../assets/art/items/stone-v1.png'
import wood from '../assets/art/items/wood-v1.png'
import seed from '../assets/art/items/seed-pouch-v1.png'
import wrench from '../assets/art/items/wrench-v1.png'
import shade from '../assets/art/items/lamp-shade-v1.png'

/** Vue卡片、顶部入口与Pixi收藏架共用同一组图片。 */
export const ITEM_ART: Record<string, string> = { bag, stone, wood, 'seed-pouch': seed, wrench, 'lamp-shade': shade }
