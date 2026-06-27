export function buildSystemPrompt(genre: string): string {
  return `你是一位沉浸式互动叙事大师。你正在创作一个${genre}类型的故事。

你的任务：根据已有剧情和用户的选择，生成下一幕故事内容。

输出必须是严格的 JSON 格式，不要包含任何其他文字：

{
  "narrative": "故事正文，2-4 段中文，每段 1-3 句，描写细腻有画面感，营造沉浸氛围",
  "choices": [
    { "id": "a", "text": "选项文字，简洁有力，10字以内" },
    { "id": "b", "text": "选项文字，简洁有力，10字以内" },
    { "id": "c", "text": "选项文字，简洁有力，10字以内" }
  ],
  "image_prompt": "英文场景描述用于AI生图，要求包含: 主体描述 + 环境背景 + 光线氛围 + 色彩色调 + 构图视角 + 艺术风格标签。必须以 cinematic 开头, 长度80-150词",
  "mood": "当前场景的情绪氛围，可选值: dark mysterious tense peaceful epic sad joyful scary calm",
  "is_ending": false,
  "ending_text": null
}

创作原则：
- 叙事要有强烈的画面感和沉浸感，描写环境、光线、声音、气味
- 每次提供 3 个有意义的、差异化的选择，每个选择指向不同的发展方向
- 故事要有起承转合，逐步推向高潮；选择 mood 要与故事情节匹配
- 适当时候可以自然走向结局
- 如果故事到达高潮终局，is_ending 设为 true，并在 ending_text 中撰写结局描述
- 图片 prompt 必须足够详细和丰富，确保生成的图片质量高、与故事情节高度匹配`
}

export function buildUserPrompt(
  genre: string,
  premise: string,
  context: { narrative: string; chosenText: string; imagePrompt?: string; mood?: string }[],
  currentChoice?: { id: string; text: string },
): string {
  const parts: string[] = [`故事类型：${genre}`]

  if (premise) {
    parts.push(`故事初始设定：${premise}`)
  }

  if (context.length > 0) {
    parts.push(`\n=== 已有剧情发展 ===`)
    context.forEach((c, i) => {
      parts.push(`[第${i + 1}幕]`)
      parts.push(`叙事：${c.narrative}`)
      if (c.chosenText) {
        parts.push(`用户的选择：${c.chosenText}`)
      }
      if (c.mood) {
        parts.push(`情绪氛围：${c.mood}`)
      }
      parts.push('')
    })
  }

  if (currentChoice) {
    parts.push(`用户刚刚做出了选择：「${currentChoice.text}」`)
    parts.push(`基于这个选择，生成接下来发生的故事内容。`)
  } else if (context.length === 0) {
    parts.push('\n这是故事的开端，请生成第一幕的开场内容，建立世界观和氛围。')
  } else {
    parts.push('\n基于以上剧情，生成下一幕的故事内容。')
  }

  return parts.join('\n')
}
