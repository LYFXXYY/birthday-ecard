// 公共常量和工具函数

/**
 * 将员工职级代码映射为中文显示文本
 * @param level 职级代码：management / manager / employee / all
 */
export function getLevelText(level?: string | null): string {
  const map: Record<string, string> = {
    management: '管理层',
    manager: '三级经理',
    employee: '普通员工',
    all: '通用'
  }
  return map[level || ''] || level || '未知'
}
