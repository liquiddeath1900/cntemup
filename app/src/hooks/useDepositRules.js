import { useMemo } from 'react'
import { STATE_RULES, hasDepositLaw } from '../data/stateRules'

// Hook for deposit rules — returns rates and calculator for a given state
export function useDepositRules(stateCode) {
  const rules = useMemo(() => {
    if (!stateCode || !hasDepositLaw(stateCode)) return null
    return STATE_RULES[stateCode]
  }, [stateCode])

  // Standard deposit rate for this state
  const depositRate = useMemo(() => {
    if (!rules) return 0
    return rules.deposit_rates.standard
  }, [rules])

  // Calculate total deposit for a count
  // Uses standard rate by default — special rates need container type info
  const calculateDeposit = useMemo(() => {
    return (count, containerType = 'standard') => {
      if (!rules) return 0

      const rates = rules.deposit_rates

      // California: size-based tiers
      if (stateCode === 'CA') {
        if (containerType === 'large') return count * (rates.large || 0.10)
        if (containerType === 'wine_pouch') return count * (rates.wine_pouch || 0.25)
        return count * rates.standard
      }

      // Maine/Vermont: liquor tier
      if ((stateCode === 'ME' || stateCode === 'VT') && containerType === 'liquor') {
        return count * (rates.wine_liquor || rates.liquor || 0.15)
      }

      // Hawaii: deposit + handling fee
      if (stateCode === 'HI') {
        return count * (rates.standard + (rates.handling_fee || 0))
      }

      // All others: flat standard rate
      return count * rates.standard
    }
  }, [rules, stateCode])

  // Format deposit value as currency
  const formatDeposit = useMemo(() => {
    return (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(amount)
    }
  }, [])

  return {
    rules,
    depositRate,
    hasDeposit: hasDepositLaw(stateCode),
    calculateDeposit,
    formatDeposit,
  }
}
