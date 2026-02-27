import { useMemo } from 'react'

// Premium feature flags — reads profile.is_premium
export function usePremium(profile) {
  const isPremium = profile?.is_premium === true

  const features = useMemo(() => ({
    isPremium,
    canSetAlert: isPremium,
    canViewHistory: isPremium,
    // Tips are free for everyone
    canViewTips: true,
    alertTarget: isPremium ? (profile?.alert_target || 0) : 0,
    subscriptionStatus: profile?.subscription_status || 'none',
    premiumSince: profile?.premium_since || null,
  }), [isPremium, profile?.alert_target, profile?.subscription_status, profile?.premium_since])

  return features
}
