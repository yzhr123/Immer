/** 课程难度 */
export type LearnDifficulty = 'beginner' | 'intermediate' | 'advanced'

/** 学科分类（自定义课程可使用任意字符串） */
export type LearnSubject = string

/** 学习阶段 */
export type LearnPhase = 'concept' | 'scenario' | 'practice' | 'review'

/** 课程定义 */
export interface LearnCourse {
  id: string
  subject: LearnSubject
  title: string
  description: string
  difficulty: LearnDifficulty
  estimatedMinutes: number
  totalNodes: number
  icon: string
  /** 学习目标列表 */
  objectives: string[]
  /** 前置课程 ID */
  prerequisites?: string[]
}

/** 学习选择项 */
export interface LearnChoice {
  id: string
  text: string
  /** 是否为正确答案（null 表示无标准答案） */
  isCorrect: boolean | null
  /** 选择后的解释反馈 */
  explanation: string
}

/** 知识点 */
export interface KnowledgePoint {
  id: string
  name: string
  /** 掌握的判断：该知识点相关的 choice 是否做对 */
  mastered: boolean
  /** 在哪个场景节点获得的 */
  acquiredAt?: number
}

/** 学习场景响应（API 返回） */
export interface LearnSceneResponse {
  narrative: string
  choices: LearnChoice[]
  /** 本场景涉及的知识点 */
  knowledgePoints: { id: string; name: string }[]
  /** 导师提示 */
  companionTip: string
  isEnd: boolean
  /** 仅在结束时返回总结 */
  summary?: string
  score?: number
}

/** 错误记录 */
export interface LearnMistake {
  sceneIndex: number
  question: string
  userAnswer: string
  correctAnswer: string
  explanation: string
}

/** 学习进度（持久化） */
export interface LearnProgress {
  courseId: string
  status: 'not-started' | 'in-progress' | 'completed'
  currentNode: number
  knowledgePoints: KnowledgePoint[]
  mistakes: LearnMistake[]
  score: number
  completedAt?: string
}

/** 系列课程深度级别 */
export type SeriesDepthLevel = 'overview' | 'detailed' | 'comprehensive'

export const SERIES_DEPTH_LABELS: Record<SeriesDepthLevel, string> = {
  overview: '概览了解',
  detailed: '深入学习',
  comprehensive: '全面掌握',
}

/** 系列课程知识点 */
export interface SeriesKnowledgePoint {
  id: string
  name: string
  description: string
  courseId?: string
  completed: boolean
}

/** 系列课程定义 */
export interface LearnSeries {
  id: string
  title: string
  topic: string
  depth: SeriesDepthLevel
  icon: string
  knowledgePoints: SeriesKnowledgePoint[]
  createdAt: number
}

/** Store 状态 */
export interface LearnStore {
  /** 所有课程的进度 keyed by courseId */
  progresses: Record<string, LearnProgress>
  /** 用户自定义课程 */
  userCourses: LearnCourse[]
  /** 已删除的课程 ID（对所有课程生效） */
  deletedCourseIds: string[]
  /** 更新进度 */
  updateProgress: (courseId: string, patch: Partial<LearnProgress>) => void
  /** 重置进度 */
  resetProgress: (courseId: string) => void
  /** 添加自定义课程，返回课程 id */
  addUserCourse: (course: Omit<LearnCourse, 'id'>, overrideId?: string) => string
  /** 删除自定义课程 */
  removeUserCourse: (courseId: string) => void
  /** 删除任意课程（加入黑名单，同时清除进度） */
  deleteCourse: (courseId: string) => void
  /** 更新自定义课程 */
  updateCourse: (courseId: string, patch: Partial<Omit<LearnCourse, 'id'>>) => void
  /** 系列课程 */
  series: LearnSeries[]
  addSeries: (data: Omit<LearnSeries, 'id' | 'createdAt'>) => string
  updateSeries: (seriesId: string, patch: Partial<Omit<LearnSeries, 'id' | 'createdAt'>>) => void
  updateSeriesKp: (seriesId: string, kpId: string, patch: Partial<SeriesKnowledgePoint>) => void
  removeSeries: (seriesId: string) => void
}
