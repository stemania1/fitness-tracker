import type { OuraSummary } from "./oura"
import { formatSleepDuration } from "./oura"

export type InsightType = "workout" | "sleep" | "recovery" | "activity" | "health"
export type InsightPriority = "high" | "medium" | "low"

export interface OuraInsight {
  type: InsightType
  priority: InsightPriority
  title: string
  body: string
  icon: "dumbbell" | "moon" | "zap" | "flame" | "heart" | "brain" | "shield" | "wind" | "trending-up"
}

/**
 * Analyze today's Oura data and generate 2-4 actionable insights
 * based on recovery, sleep quality, stress, and activity levels.
 */
export function generateInsights(summary: OuraSummary): OuraInsight[] {
  const insights: OuraInsight[] = []

  const readiness = summary.readiness?.score ?? null
  const sleepScore = summary.sleep?.score ?? null
  const stressSummary = summary.stress?.day_summary ?? null
  const resilience = summary.resilience?.level ?? null
  const sleepPeriod = summary.sleepPeriod
  const activity = summary.activity
  const spo2Avg = summary.spo2?.spo2_percentage?.average ?? null
  const tempDev = summary.readiness?.temperature_deviation ?? null
  const vo2Max = summary.vo2Max

  // --- Workout intensity recommendation ---
  if (readiness != null) {
    if (readiness >= 85 && (stressSummary === "restored" || stressSummary === "normal")) {
      insights.push({
        type: "workout",
        priority: "high",
        title: "Great day for a hard workout",
        body: `Readiness ${readiness} and stress is ${stressSummary ?? "manageable"}. Your body is primed for high-intensity training — push yourself today.`,
        icon: "dumbbell",
      })
    } else if (readiness >= 70) {
      insights.push({
        type: "workout",
        priority: "medium",
        title: "Moderate workout recommended",
        body: `Readiness ${readiness} — solid but not peak. A moderate session is ideal. Save the PRs for a day when you're above 85.`,
        icon: "dumbbell",
      })
    } else if (readiness < 70) {
      insights.push({
        type: "workout",
        priority: "high",
        title: "Consider a light day or rest",
        body: `Readiness is ${readiness} — your body is still recovering. A light walk or stretching session would be better than heavy lifting today.`,
        icon: "zap",
      })
    }
  }

  // --- Sleep quality insight ---
  if (sleepScore != null || sleepPeriod) {
    const duration = summary.sleep?.total_sleep_duration ?? sleepPeriod?.total_sleep_duration
    const hrv = sleepPeriod?.average_hrv
    const deepSleep = sleepPeriod?.deep_sleep_duration ?? summary.sleep?.deep_sleep_duration
    const remSleep = sleepPeriod?.rem_sleep_duration ?? summary.sleep?.rem_sleep_duration

    if (sleepScore != null && sleepScore < 65) {
      const parts: string[] = []
      if (duration != null && duration < 6 * 3600) {
        parts.push(`only ${formatSleepDuration(duration)} of sleep`)
      }
      if (hrv != null && hrv < 30) {
        parts.push(`low HRV (${hrv}ms)`)
      }
      insights.push({
        type: "sleep",
        priority: "high",
        title: "Poor sleep last night",
        body: `Sleep score ${sleepScore}${parts.length > 0 ? " — " + parts.join(", ") : ""}. Prioritize recovery today: avoid caffeine after noon, aim for an earlier bedtime tonight.`,
        icon: "moon",
      })
    } else if (sleepScore != null && sleepScore >= 85) {
      const parts: string[] = []
      if (duration != null) parts.push(formatSleepDuration(duration))
      if (hrv != null) parts.push(`HRV ${hrv}ms`)
      insights.push({
        type: "sleep",
        priority: "low",
        title: "Excellent sleep",
        body: `Sleep score ${sleepScore}${parts.length > 0 ? " (" + parts.join(", ") + ")" : ""}. Well rested — take advantage of this recovery with a solid training session.`,
        icon: "moon",
      })
    } else if (deepSleep != null && remSleep != null && duration != null && duration > 0) {
      const deepPct = Math.round((deepSleep / duration) * 100)
      const remPct = Math.round((remSleep / duration) * 100)
      if (deepPct < 15) {
        insights.push({
          type: "sleep",
          priority: "medium",
          title: "Low deep sleep",
          body: `Deep sleep was ${deepPct}% of total (${formatSleepDuration(deepSleep)}). Deep sleep is critical for muscle recovery. Try avoiding alcohol and screens before bed.`,
          icon: "moon",
        })
      } else if (remPct < 15) {
        insights.push({
          type: "sleep",
          priority: "medium",
          title: "Low REM sleep",
          body: `REM sleep was ${remPct}% of total (${formatSleepDuration(remSleep)}). REM is important for mental recovery and learning. A consistent sleep schedule can help.`,
          icon: "moon",
        })
      }
    }
  }

  // --- Stress & recovery ---
  if (stressSummary === "strained") {
    const stressMinutes = summary.stress?.stress_high != null
      ? Math.round(summary.stress.stress_high / 60)
      : null
    insights.push({
      type: "recovery",
      priority: "high",
      title: "High stress detected",
      body: `Your body is strained today${stressMinutes ? ` (${stressMinutes}min in high stress)` : ""}. Consider breathing exercises, a walk outside, or cutting your workout shorter than planned.`,
      icon: "brain",
    })
  } else if (stressSummary === "restored") {
    const recoveryMinutes = summary.stress?.recovery_high != null
      ? Math.round(summary.stress.recovery_high / 60)
      : null
    insights.push({
      type: "recovery",
      priority: "low",
      title: "Well recovered",
      body: `Stress levels are restored${recoveryMinutes ? ` with ${recoveryMinutes}min of deep recovery` : ""}. Your nervous system is balanced — a great foundation for training.`,
      icon: "brain",
    })
  }

  // --- Temperature deviation warning ---
  if (tempDev != null && (tempDev > 1.0 || tempDev < -1.0)) {
    insights.push({
      type: "health",
      priority: "high",
      title: "Unusual body temperature",
      body: `Temperature is ${tempDev > 0 ? "+" : ""}${tempDev.toFixed(1)}° from baseline. This can indicate illness, overtraining, or hormonal changes. Listen to your body and take it easy if you feel off.`,
      icon: "heart",
    })
  }

  // --- SpO2 warning ---
  if (spo2Avg != null && spo2Avg < 95) {
    insights.push({
      type: "health",
      priority: "high",
      title: "Blood oxygen is low",
      body: `SpO2 averaged ${spo2Avg}% (normal is 95-100%). This could indicate poor breathing during sleep or altitude effects. Consider consulting a doctor if this persists.`,
      icon: "wind",
    })
  }

  // --- Activity encouragement ---
  if (activity) {
    if (activity.steps < 3000) {
      insights.push({
        type: "activity",
        priority: "medium",
        title: "Low movement so far",
        body: `Only ${activity.steps.toLocaleString()} steps today. Even a 10-minute walk can boost your mood and metabolism. Try to get moving!`,
        icon: "flame",
      })
    } else if (activity.steps >= 10000) {
      insights.push({
        type: "activity",
        priority: "low",
        title: "Great step count",
        body: `${activity.steps.toLocaleString()} steps — well above average. Keep it up!`,
        icon: "flame",
      })
    }
  }

  // --- Resilience insight ---
  if (resilience === "limited") {
    insights.push({
      type: "recovery",
      priority: "medium",
      title: "Resilience is limited",
      body: "Your recovery capacity is low. Focus on quality sleep and stress management before ramping up training intensity.",
      icon: "shield",
    })
  } else if (resilience === "strong" || resilience === "exceptional") {
    insights.push({
      type: "recovery",
      priority: "low",
      title: `Resilience is ${resilience}`,
      body: "Your body is handling stress well and recovering efficiently. You have headroom to push harder in training if you want.",
      icon: "shield",
    })
  }

  // --- VO2 Max context ---
  if (vo2Max != null) {
    if (vo2Max >= 50) {
      insights.push({
        type: "health",
        priority: "low",
        title: "Excellent cardio fitness",
        body: `VO2 Max of ${vo2Max.toFixed(1)} ml/kg/min puts you in the excellent range. Your endurance training is paying off.`,
        icon: "trending-up",
      })
    } else if (vo2Max < 35) {
      insights.push({
        type: "health",
        priority: "medium",
        title: "Room to improve cardio fitness",
        body: `VO2 Max is ${vo2Max.toFixed(1)} ml/kg/min. Adding 2-3 sessions of moderate cardio per week (brisk walking, cycling, jogging) can significantly improve this.`,
        icon: "trending-up",
      })
    }
  }

  // Sort by priority, return top 4
  const priorityOrder: Record<InsightPriority, number> = { high: 0, medium: 1, low: 2 }
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
  return insights.slice(0, 4)
}
