import heart from '../assets/art/finale/heart-v1.png'
import folio from '../assets/art/ruins/folio-v1.png'
import gardenBell from '../assets/art/garden/bell-v1.png'
import bag from '../assets/art/items/bag-v1.png'
import stone from '../assets/art/items/stone-v1.png'
import wood from '../assets/art/items/wood-v1.png'
import seed from '../assets/art/items/seed-pouch-v1.png'
import wrench from '../assets/art/items/wrench-v1.png'
import shade from '../assets/art/items/lamp-shade-v1.png'
import oldPhoto from '../assets/art/items/old-photo-v1.svg'
import oldKey from '../assets/art/items/old-key-v1.svg'
import crystalRig from '../assets/art/deep/crystal-rig-v1.png'
import ingot from '../assets/art/deep/ingot-v1.svg'
import hallMemory from '../assets/art/hall/memory-v1.png'
import part from '../assets/art/deep/part-v1.svg'

/** Vue卡片与Pixi收藏架共用同一组图片；尚未配独立 PNG 的旧物使用内置小图。 */
export const ITEM_ART: Record<string, string> = {
  'earth-warmth':heart,
  'ruins-lamp':folio,'ruins-spring':folio,'ruins-tools':folio,
  'hall-mural': hallMemory, 'garden-food': gardenBell, 'garden-spores': gardenBell,
  bag, stone, wood, 'seed-pouch': seed, wrench, 'lamp-shade': shade,
  'old-photo': oldPhoto, 'old-key': oldKey,
  'crystal-energy': crystalRig, 'crystal-cluster': crystalRig, ore: stone, ingot, part,
}

export const ITEM_EMOJI: Record<string, string> = { 'ruins-seal':'🪨','ruins-footprint':'🐾', 'wind-echo':'🪨','wind-vane':'🎏', 'water-shell': '🐚', 'water-reed': '🌾', 'old-photo': '🖼️', 'old-key': '🗝️', 'crystal-moss': '🌿', 'old-drill': '🔩', 'warm-wick': '🕯️', 'garden-root': '🌿' }
