'use client'

import { create } from 'zustand'
import type { LearnCourse, LearnProgress, LearnStore } from './types'

const PROGRESS_KEY = 'learn_progresses'
const COURSES_KEY = 'learn_user_courses'
const DELETED_KEY = 'learn_deleted_ids'

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function saveToStorage(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* empty */ }
}

export const useLearnStore = create<LearnStore>((set) => ({
  progresses: loadFromStorage<Record<string, LearnProgress>>(PROGRESS_KEY, {}),
  userCourses: loadFromStorage<LearnCourse[]>(COURSES_KEY, []),
  deletedCourseIds: loadFromStorage<string[]>(DELETED_KEY, []),

  updateProgress: (courseId, patch) =>
    set((state) => {
      const prev = state.progresses[courseId] || {
        courseId,
        status: 'not-started',
        currentNode: 0,
        knowledgePoints: [],
        mistakes: [],
        score: 0,
      }
      const next = { ...prev, ...patch }
      const progresses = { ...state.progresses, [courseId]: next }
      saveToStorage(PROGRESS_KEY, progresses)
      return { progresses }
    }),

  resetProgress: (courseId) =>
    set((state) => {
      const progresses = { ...state.progresses }
      delete progresses[courseId]
      saveToStorage(PROGRESS_KEY, progresses)
      return { progresses }
    }),

  addUserCourse: (course, overrideId) => {
    const id = overrideId || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const newCourse: LearnCourse = { ...course, id }
    set((state) => {
      const userCourses = [...state.userCourses, newCourse]
      saveToStorage(COURSES_KEY, userCourses)
      return { userCourses }
    })
    return id
  },

  removeUserCourse: (courseId) =>
    set((state) => {
      const userCourses = state.userCourses.filter((c) => c.id !== courseId)
      saveToStorage(COURSES_KEY, userCourses)
      return { userCourses }
    }),

  deleteCourse: (courseId) =>
    set((state) => {
      const deletedCourseIds = [...new Set([...state.deletedCourseIds, courseId])]
      saveToStorage(DELETED_KEY, deletedCourseIds)

      // Also remove from userCourses if it's a custom course
      const userCourses = state.userCourses.filter((c) => c.id !== courseId)

      // Also remove progress
      const progresses = { ...state.progresses }
      delete progresses[courseId]

      saveToStorage(COURSES_KEY, userCourses)
      saveToStorage(PROGRESS_KEY, progresses)
      return { deletedCourseIds, userCourses, progresses }
    }),

  updateCourse: (courseId, patch) =>
    set((state) => {
      let userCourses = [...state.userCourses]
      const idx = userCourses.findIndex((c) => c.id === courseId)
      if (idx === -1) {
        return state
      }
      userCourses[idx] = { ...userCourses[idx], ...patch }
      saveToStorage(COURSES_KEY, userCourses)
      return { userCourses }
    }),
}))
