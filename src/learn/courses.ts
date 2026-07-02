import type { LearnCourse } from './types'

export const COURSES: LearnCourse[] = [
  {
    id: 'tax-startup-101',
    subject: 'tax',
    title: '初创企业税务合规',
    description: '扮演一家 SaaS 公司的财务负责人，从第一笔收入开始，经历发票管理、增值税申报、企业所得税汇算清缴等真实场景。',
    difficulty: 'beginner',
    estimatedMinutes: 25,
    totalNodes: 8,
    icon: '税',
    objectives: [
      '理解增值税发票的种类和管理规范',
      '掌握增值税纳税义务发生时间的判断',
      '了解企业所得税汇算清缴的基本流程',
      '认识常见的税务筹划思路与风险',
    ],
  },
  {
    id: 'tax-audit-201',
    subject: 'tax',
    title: '税务稽查应对实战',
    description: '你的公司收到税务局稽查通知。从准备材料到稽查约谈，模拟真实的税务稽查全流程。',
    difficulty: 'intermediate',
    estimatedMinutes: 30,
    totalNodes: 10,
    icon: '稽',
    prerequisites: ['tax-startup-101'],
    objectives: [
      '了解税务稽查的法定程序和权利边界',
      '掌握稽查应对的材料准备方法',
      '学习与税务机关沟通的技巧',
      '认识常见的稽查风险点及整改方案',
    ],
  },
  {
    id: 'stock-kline-101',
    subject: 'stock',
    title: 'K线技术分析入门',
    description: '从零开始学习 K 线图，在模拟交易场景中识别常见形态，做出买卖决策。',
    difficulty: 'beginner',
    estimatedMinutes: 20,
    totalNodes: 6,
    icon: 'K',
    objectives: [
      '理解 K 线的基本构成和含义',
      '识别常见的反转形态和持续形态',
      '掌握基本的支撑位和阻力位判断',
      '学会结合成交量分析市场情绪',
    ],
  },
  {
    id: 'economics-micro-101',
    subject: 'economics',
    title: '微观经济学：市场与价格',
    description: '经营一家街角咖啡店，在真实的供需波动中理解价格弹性、边际成本、市场均衡等核心概念。',
    difficulty: 'beginner',
    estimatedMinutes: 25,
    totalNodes: 8,
    icon: '经',
    objectives: [
      '理解供给与需求的基本原理',
      '掌握价格弹性的概念和应用',
      '了解边际成本与边际收益的决策逻辑',
      '认识市场均衡的形成和变化',
    ],
  },
  {
    id: 'cs-network-101',
    subject: 'cs',
    title: '计算机网络：数据包之旅',
    description: '扮演一个数据包，从浏览器出发穿越网络世界，理解 TCP/IP、DNS、路由等核心概念。',
    difficulty: 'beginner',
    estimatedMinutes: 20,
    totalNodes: 7,
    icon: '网',
    objectives: [
      '理解 TCP/IP 四层模型的基本结构',
      '掌握 DNS 解析的完整过程',
      '了解路由器的基本工作原理',
      '认识 TCP 三次握手和四次挥手',
    ],
  },
]

/** 根据学科分组 */
export function getCoursesBySubject() {
  const map: Record<string, LearnCourse[]> = {}
  for (const c of COURSES) {
    if (!map[c.subject]) map[c.subject] = []
    map[c.subject].push(c)
  }
  return map
}

/** 学科的中文名称 */
export const SUBJECT_LABELS: Record<string, string> = {
  tax: '税收',
  economics: '经济',
  stock: '股票',
  cs: '计算机',
  law: '法律',
}

/** 难度标签 */
export const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
}
