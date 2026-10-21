import changelog from '../../CHANGELOG.md?raw'

/** 更新记录里的一节：标题 + 短条目 + 普通段落 */
export interface ReleaseNoteSection {
  title: string
  items: string[]
  paragraphs: string[]
}

const LINK = /\[([^\]]+)\]\([^)]*\)/g

/** CHANGELOG 只用了极简 Markdown；这里去掉标记，保留孩子能读的文字。 */
function plain(text: string): string {
  return text
    .replace(LINK, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim()
}

/**
 * 解析 CHANGELOG.md 的二级标题与列表。
 * 不引入 Markdown 依赖，也不把文案复制到第二处——更新记录始终只有一份来源。
 */
export function parseReleaseNotes(markdown: string): ReleaseNoteSection[] {
  const sections: ReleaseNoteSection[] = []
  let section: ReleaseNoteSection | null = null
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('## ')) {
      section = { title: plain(line.slice(3)), items: [], paragraphs: [] }
      sections.push(section)
      continue
    }
    // 文档大标题不是一节更新。
    if (line.startsWith('# ')) continue
    if (!section) {
      section = { title: '更新记录', items: [], paragraphs: [] }
      sections.push(section)
    }
    if (line.startsWith('- ')) section.items.push(plain(line.slice(2)))
    else section.paragraphs.push(plain(line))
  }
  return sections.filter((item) => item.items.length > 0 || item.paragraphs.length > 0)
}

export const RELEASE_NOTES: readonly ReleaseNoteSection[] = parseReleaseNotes(changelog)
