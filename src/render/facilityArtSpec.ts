import utilityShell from '../assets/art/rooms/utility-shell-v1.png'
import stove from '../assets/art/rooms/stove-furniture-v1.png'
import dining from '../assets/art/rooms/dining-furniture-v1.png'
import loungeShell from '../assets/art/rooms/lounge-shell-v1.png'
import loungeFurniture from '../assets/art/rooms/lounge-furniture-v1.png'
import emptyPlanter from '../assets/art/environment/planter-empty-v1.png'

export type FacilityKind = 'kitchen' | 'dining' | 'garden' | 'lounge'
export interface ArtLayer { role: string; url: string; left: number; top: number; width: number; height: number }
export interface FacilityArtSpec { aspect: number; layers: readonly ArtLayer[] }
/** 地图和建造卡共用同一组图片与比例，坐标相对洞室外壳。 */
export const FACILITY_ART: Record<FacilityKind, FacilityArtSpec> = {
  kitchen: { aspect: 1, layers: [
    { role: 'shell', url: utilityShell, left: 0, top: 0, width: 1, height: 1 },
    { role: 'furniture', url: stove, left: .10, top: .29, width: .80, height: .80 / 1.5 },
  ] },
  dining: { aspect: 5 / 3, layers: [
    { role: 'shell', url: loungeShell, left: 0, top: 0, width: 1, height: 1 },
    { role: 'furniture', url: dining, left: .12, top: .82 - .76 * 5 / 9, width: .76, height: .76 * 5 / 9 },
  ] },
  garden: { aspect: 1, layers: [
    { role: 'shell', url: utilityShell, left: 0, top: 0, width: 1, height: 1 },
    { role: 'planter', url: emptyPlanter, left: 1 / 12, top: .71, width: 1 / 3, height: 28 / 96 },
    { role: 'planter', url: emptyPlanter, left: 7 / 12, top: .71, width: 1 / 3, height: 28 / 96 },
  ] },
  lounge: { aspect: 5 / 3, layers: [
    { role: 'shell', url: loungeShell, left: 0, top: 0, width: 1, height: 1 },
    { role: 'furniture', url: loungeFurniture, left: .12, top: .82 - .76 * 5 / 9, width: .76, height: .76 * 5 / 9 },
  ] },
}
