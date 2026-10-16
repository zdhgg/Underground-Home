import { Assets, type Texture } from 'pixi.js'

// 第一批地形素材（来源：png素材/第01批，复制到 src/assets/art/terrain，勿手工改动）
// 规格：64px 源图 → 32px 显示；linear 过滤 + mipmap，降低缩放时的闪烁
import caveBgUrl from '../assets/art/terrain/cave-bg.png'
import rockBottomUrl from '../assets/art/terrain/edges/rock-bottom.png'
import rockLeftUrl from '../assets/art/terrain/edges/rock-left.png'
import rockRightUrl from '../assets/art/terrain/edges/rock-right.png'
import rockTopUrl from '../assets/art/terrain/edges/rock-top.png'
import soilBottomUrl from '../assets/art/terrain/edges/soil-bottom.png'
import soilLeftUrl from '../assets/art/terrain/edges/soil-left.png'
import soilRightUrl from '../assets/art/terrain/edges/soil-right.png'
import soilTopUrl from '../assets/art/terrain/edges/soil-top.png'
import grassTopUrl from '../assets/art/terrain/edges/surface-grass-top.png'
import rock01Url from '../assets/art/terrain/rock-variant-01.png'
import rock02Url from '../assets/art/terrain/rock-variant-02.png'
import rockUrl from '../assets/art/terrain/rock.png'
import soil01Url from '../assets/art/terrain/soil-variant-01.png'
import soil02Url from '../assets/art/terrain/soil-variant-02.png'
import soilUrl from '../assets/art/terrain/soil.png'

/** 边缘叠图方向（对应实心块哪一侧是空洞） */
export type EdgeDirection = 'top' | 'right' | 'bottom' | 'left'

export interface TerrainTextures {
  /** 泥土基础贴图（3 个确定性变体） */
  soil: Texture[]
  /** 岩石基础贴图（3 个确定性变体） */
  rock: Texture[]
  /** 洞穴背景（可平铺） */
  caveBg: Texture
  /** 泥土四向洞壁叠图 */
  soilEdges: Record<EdgeDirection, Texture>
  /** 岩石四向洞壁叠图 */
  rockEdges: Record<EdgeDirection, Texture>
  /** 地表草边（替代地表行实心块的顶边） */
  surfaceGrass: Texture
}

/**
 * 加载第一批地形素材。
 * 约定（来自素材包 manifest）：
 * - 基础贴图按 (x, y) 确定性 hash 选变体，不引入任何状态；
 * - 边缘叠图叠加在"实心块"上：北/东/南/西任一方向为空洞时，叠加对应方向叠图；
 * - 洞穴背景平铺在挖空区域之后。
 */
export async function loadTerrainTextures(): Promise<TerrainTextures> {
  const urls = [
    soilUrl,
    soil01Url,
    soil02Url,
    rockUrl,
    rock01Url,
    rock02Url,
    caveBgUrl,
    soilTopUrl,
    soilRightUrl,
    soilBottomUrl,
    soilLeftUrl,
    rockTopUrl,
    rockRightUrl,
    rockBottomUrl,
    rockLeftUrl,
    grassTopUrl,
  ]
  const [soil, soil01, soil02, rock, rock01, rock02, caveBg, ...edgeTextures] = await Promise.all(
    urls.map((url) => Assets.load<Texture>(url)),
  )

  const all = [soil, soil01, soil02, rock, rock01, rock02, caveBg, ...edgeTextures]
  for (const texture of all) {
    texture.source.scaleMode = 'linear'
    texture.source.autoGenerateMipmaps = true
  }
  // 洞穴背景需要平铺采样，避免接缝
  caveBg.source.addressMode = 'repeat'

  const [soilTop, soilRight, soilBottom, soilLeft, rockTop, rockRight, rockBottom, rockLeft, grassTop] = edgeTextures
  return {
    soil: [soil, soil01, soil02],
    rock: [rock, rock01, rock02],
    caveBg,
    soilEdges: { top: soilTop, right: soilRight, bottom: soilBottom, left: soilLeft },
    rockEdges: { top: rockTop, right: rockRight, bottom: rockBottom, left: rockLeft },
    surfaceGrass: grassTop,
  }
}
