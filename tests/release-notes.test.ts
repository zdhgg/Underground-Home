import { describe, expect, it } from 'vitest'
import { parseReleaseNotes, RELEASE_NOTES } from '../src/app/releaseNotes'

describe('更新记录解析', () => {
  it('按二级标题分节，保留列表与普通段落', () => {
    const sections = parseReleaseNotes([
      '# 更新记录',
      '',
      '## 未发布 · 存档',
      '',
      '- **自动保存**：[说明](docs/save.md)',
      '- 首页可以继续游戏',
      '',
      '一句补充。',
      '',
      '## 0.1.0 · 2026-10-17',
      '',
      '首个版本。',
    ].join('\n'))

    expect(sections).toHaveLength(2)
    expect(sections[0]).toEqual({
      title: '未发布 · 存档',
      items: ['自动保存：说明', '首页可以继续游戏'],
      paragraphs: ['一句补充。'],
    })
    expect(sections[1].title).toBe('0.1.0 · 2026-10-17')
    expect(sections[1].paragraphs).toEqual(['首个版本。'])
  })

  it('空文档不产生空节', () => {
    expect(parseReleaseNotes('# 更新记录\n\n')).toEqual([])
  })

  it('实际 CHANGELOG 能被读出，且不把 Markdown 标记带到界面上', () => {
    expect(RELEASE_NOTES.length).toBeGreaterThanOrEqual(3)
    expect(RELEASE_NOTES[0].title).toContain('未发布')
    const text = RELEASE_NOTES.flatMap((section) => [section.title, ...section.items, ...section.paragraphs]).join('\n')
    expect(text).not.toContain('**')
    expect(text).not.toContain('](')
  })
})
