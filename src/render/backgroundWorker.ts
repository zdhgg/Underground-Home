/// <reference lib="webworker" />
import { SCORE_LAYERS, synthesizeScore } from './backgroundScore'

// 只做一次纯 PCM 计算，转移内存后退出；不访问存档、网络或游戏状态。
const samples = Object.fromEntries(SCORE_LAYERS.map(layer => [layer, synthesizeScore(layer)]))
self.postMessage(samples, { transfer: Object.values(samples).map(data => data.buffer) })
self.close()
