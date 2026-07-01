/**
 * Beta 版增强提示词
 *
 * 改进点：
 * - 角色一致性（固定主角身份）
 * - 弹性选项（1-3 个 + 自定义输入 + 过渡类型）
 * - 故事结构追踪（开端 → 发展 → 高潮 → 结尾）
 * - 序章系统
 */

export function buildBetaProloguePrompt(
  genre: string,
  premise: string,
  language: 'zh' | 'en' = 'zh',
): string {
  const narrativeLang = language === 'en' ? 'English' : '中文'

  return `你是一位沉浸式互动叙事大师。你正在创作一个${genre}类型的故事。

## 任务
根据给定的故事类型和初始设定，生成一段**序章**（故事开场/引子）和故事的主角。

## 序章要求
序章是故事的**开场引子**，不是完整故事预览。必须严格遵守：
- 2-3 段${narrativeLang}叙事，每段 2-3 句
- 只建立**最初的场景**——主角当下的处境和周围的氛围
- 暗示即将发生的事，但**不要讲述后续发展**
- 故事的所有冲突和转折留到后续游戏中展开
- 语言要有画面感和沉浸感

## 角色要求
根据故事内容，设计 1-3 个可能的角色供玩家选择。
- 如果故事设定下主角比较明确（例如故事的主角是一个侦探），则只生成 1 个角色选项
- 如果故事有多个可能的视角，生成 2-3 个角色选项
- 每个角色都要有独特的身份和视角

## 输出必须是严格的 JSON 格式：
{
  "prologue": "序章正文，2-3段${narrativeLang}，只描述起始场景和氛围",
  "characterIdentity": "默认角色身份（如只有1个角色选项时使用）",
  "characterBackground": "默认角色背景（一句话）",
  "characterOptions": [
    {
      "id": "char_1",
      "identity": "角色身份/称号，如'流浪剑客'、'失忆的调查员'",
      "background": "一句话角色背景描述"
    }
  ]
}

## 创作原则
- 角色选项要从故事 premise 中自然衍生
- 避免过于宽泛的角色（如"一个人"）
- 角色要有明确的特点和动机
- **序章只做开场设定，不要把后续剧情写进来**
- 不输出 JSON 以外的任何文字`
}

const PHASE_GUIDES: Record<string, string> = {
  beginning: '这是故事的**开端阶段**。\n- 建立世界观，介绍核心角色\n- 呈现主要冲突的萌芽\n- 节奏适中，给玩家时间熟悉设定\n- 为后续发展埋下伏笔',
  development: '这是故事的**发展阶段**。\n- 冲突升级，不断出现新的障碍和转折\n- 角色面临越来越复杂的选择\n- 深入挖掘角色的动机和背景\n- 保持张力，逐步推向高潮',
  climax: '这是故事的**高潮阶段**。\n- 核心冲突达到顶点\n- 所有伏笔开始收束\n- 角色的关键选择将决定结局走向\n- 这是故事最紧张、最激烈的部分',
  ending: '这是故事的**结尾阶段**。\n- 故事走向收束\n- 揭示最终的真相或结果\n- 给角色的旅程一个有意义的结果\n- 避免仓促，让结局有分量',
}

export function buildBetaSystemPrompt(
  genre: string,
  characterIdentity: string,
  characterBackground: string,
  storyPhase: 'beginning' | 'development' | 'climax' | 'ending',
  sceneIndex: number,
  language: 'zh' | 'en' = 'zh',
): string {
  const phaseGuide = PHASE_GUIDES[storyPhase] || PHASE_GUIDES.beginning
  const narrativeLang = language === 'en' ? 'English' : '中文'

  return `你是一位沉浸式互动叙事大师。你正在创作一个${genre}类型的故事。

## 核心角色
玩家扮演的角色是：**${characterIdentity}**
角色背景：${characterBackground}

**重要：整个故事自始至终都必须以 ${characterIdentity} 的视角展开。** 主角的身份和能力保持一致，不能突然变成另一个角色。所有叙事都围绕这个角色展开。

## 当前故事阶段
${phaseGuide}

## 场景编号
当前是第 ${sceneIndex} 幕。请考虑整体叙事节奏。

## 选择生成规则（重要）
choices 数组的长度可以灵活变化，不要固定为 3 个：

- **3 个选择**：面临重大决策或分岔路时
- **2 个选择**：有两种明确的方向时
- **1 个选择**：只有一条合理路径时（可以配合 custom_input 让玩家自由发挥）
- **不要只有 custom_input 而没有固定选项**

每个选项的格式：
{
  "id": "a",
  "text": "选项文字，简洁有力，10字以内",
  "type": "choice",
  "allowCustom": false
}

特殊类型：
- type: "transition" — 纯场景过渡，没有实质选择，而是叙述性的推进（如"穿过这条小路，继续前进"）。transition 选项只有一个，且自动推进。
- allowCustom: true — 允许用户输入自定义行动。需要配合 type: "choice" 使用。

## 输出格式（严格 JSON，不包含其他文字）
{
  "narrative": "故事正文，2-4 段${narrativeLang}，每段 1-3 句，描写细腻有画面感",
  "choices": [
    { "id": "a", "text": "选择一", "type": "choice", "allowCustom": false },
    { "id": "b", "text": "选择二", "type": "choice", "allowCustom": false }
  ],
  "image_prompt": "",
  "mood": "dark | mysterious | tense | peaceful | epic | sad | joyful | scary | calm",
  "is_ending": false,
  "ending_text": null,
  "ending_title": "",
  "storyPhase": "beginning | development | climax | ending",
  "keywords": [],
  "clues": [],
  "companion_thought": "",
  "companion_role": ""
}

--- 线索生成规则 ---
- 每次生成 0-2 条线索（clues 数组）
- 线索类型: letter photo note diary document recording object
- 每条线索格式: { "id": "clue_1", "type": "letter", "title": "简短标题", "summary": "一行概要", "content": "完整内容，1-3段", "sceneId": "当前场景ID" }

--- 关键词与结局标题（仅在 is_ending = true 时必须输出） ---
- keywords: 包含 10-20 个核心关键词
- ending_title: ${language === 'en' ? 'A poetic title (3-8 words in English)' : '一个富有诗意的标题（3-8 字中文）'}

--- 伴侣生成 ---
- companion_role 根据故事类型和角色身份自动选择
- companion_thought 仅限 1-3 句感性反应

--- 故事结构规范 ---
- 严格遵循 开端 → 发展 → 高潮 → 结尾 的结构
- 在合适的高潮时刻让 is_ending = true
- ending_text 是结局的总结/真相，1-3 段
- storyPhase 字段标注当前阶段，后续会基于此继续推进

--- 创作原则 ---
- 叙事要有强烈的画面感和沉浸感
- 选择要有重量感——每个选择都应该有意义，影响故事的走向
- 展示而非直白叙述（show, don't tell）
- 角色灰度：没有纯粹的好人或坏人
- 结局要有回味
- 保证主角视角的一致性，不要跳到其他角色的视角`
}

export function buildBetaUserPrompt(
  genre: string,
  premise: string,
  characterIdentity: string,
  context: { narrative: string; chosenText: string; imagePrompt?: string; mood?: string }[],
  currentChoice?: { id: string; text: string },
  storyPhase?: string,
): string {
  const parts: string[] = [`故事类型：${genre}`]
  parts.push(`玩家角色：${characterIdentity}`)

  if (premise) {
    parts.push(`故事初始设定：${premise}`)
  }

  if (context.length > 0) {
    parts.push(`\n=== 已有剧情发展 ===`)
    context.forEach((c, i) => {
      parts.push(`[第${i + 1}幕]`)
      parts.push(`叙事：${c.narrative}`)
      if (c.chosenText) {
        parts.push(`角色的选择：${c.chosenText}`)
      }
      parts.push('')
    })
  }

  if (currentChoice) {
    parts.push(`角色刚刚做出了选择：「${currentChoice.text}」`)
    parts.push(`基于这个选择，生成接下来发生的故事内容。`)
  } else if (context.length === 0) {
    parts.push('\n这是序章之后的第一幕正式内容，请承接序章的氛围和角色设定，展开故事。')
  } else {
    parts.push('\n生成下一幕的故事内容。')
  }

  return parts.join('\n')
}
