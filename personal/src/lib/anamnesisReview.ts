type ProtocolResponseLike = {
  id?: string
  student_id?: string | null
  created_at?: string
  data?: unknown
  content?: unknown
  reviewed_at?: string | null
}

function toRecord(value: unknown): Record<string, any> | null {
  if (!value) return null

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, any>
        : null
    } catch {
      return null
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>
  }

  return null
}

export function getAnamnesisResponseData(response: ProtocolResponseLike): Record<string, any> {
  const primaryCandidates = [toRecord(response.data), toRecord(response.content)]

  for (const candidate of primaryCandidates) {
    if (!candidate) continue

    if (
      candidate.reviewed_at ||
      candidate.modelId ||
      candidate.answers ||
      candidate.questions
    ) {
      return candidate
    }

    const nestedData = toRecord(candidate.data)
    if (
      nestedData &&
      (
        nestedData.reviewed_at ||
        nestedData.modelId ||
        nestedData.answers ||
        nestedData.questions
      )
    ) {
      return nestedData
    }
  }

  return primaryCandidates[0] || primaryCandidates[1] || {}
}

export function isAnamnesisAwaitingReview(response: ProtocolResponseLike): boolean {
  const responseData = getAnamnesisResponseData(response)
  return !response.reviewed_at && !responseData.reviewed_at
}

export function countPendingAnamnesisReviews(
  responses: ProtocolResponseLike[],
  activeStudentIds: Set<string>,
  hasModels: boolean
): number {
  if (!hasModels) return 0

  let count = 0

  responses.forEach(response => {
    if (!response.student_id || !activeStudentIds.has(response.student_id)) return
    if (isAnamnesisAwaitingReview(response)) {
      count += 1
    }
  })

  return count
}
