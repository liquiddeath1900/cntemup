import { useMemo } from 'react'
import { STATE_RULES, hasDepositLaw } from '../data/stateRules'

// Container type options per multi-rate state
const CONTAINER_OPTIONS = {
  CA: [
    { value: 'standard', label: 'Standard (<24oz)', rate: 0.05 },
    { value: 'large', label: 'Large (≥24oz)', rate: 0.10 },
    { value: 'wine_pouch', label: 'Wine Pouch', rate: 0.25 },
  ],
  ME: [
    { value: 'standard', label: 'Standard', rate: 0.05 },
    { value: 'liquor', label: 'Wine/Liquor', rate: 0.15 },
  ],
  VT: [
    { value: 'standard', label: 'Standard', rate: 0.05 },
    { value: 'liquor', label: 'Liquor', rate: 0.15 },
  ],
}

// States that have multiple deposit rates based on container type
export const MULTI_RATE_STATES = new Set(['CA', 'ME', 'VT'])

// Get container options for a state (or null if single-rate)
export function getContainerOptions(stateCode) {
  return CONTAINER_OPTIONS[stateCode] || null
}

// Hook for deposit rules — returns rates and calculator for a given state
export function useDepositRules(stateCode, containerType = 'standard') {
  const rules = useMemo(() => {
    if (!stateCode || !hasDepositLaw(stateCode)) return null
    return STATE_RULES[stateCode]
  }, [stateCode])

  // Deposit rate factoring in container type for multi-rate states
  const depositRate = useMemo(() => {
    if (!rules) return 0
    const rates = rules.deposit_rates
    if (stateCode === 'CA') {
      if (containerType === 'large') return rates.large || 0.10
      if (containerType === 'wine_pouch') return rates.wine_pouch || 0.25
      return rates.standard
    }
    if ((stateCode === 'ME' || stateCode === 'VT') && containerType === 'liquor') {
      return rates.wine_liquor || rates.liquor || 0.15
    }
    if (stateCode === 'HI') {
      return rates.standard - (rates.handling_fee || 0)
    }
    return rates.standard
  }, [rules, stateCode, containerType])

  // Calculate total deposit for a count
  const calculateDeposit = useMemo(() => {
    return (count, overrideType) => {
      if (!rules) return 0
      const type = overrideType || containerType
      const rates = rules.deposit_rates

      if (stateCode === 'CA') {
        if (type === 'large') return count * (rates.large || 0.10)
        if (type === 'wine_pouch') return count * (rates.wine_pouch || 0.25)
        return count * rates.standard
      }

      if ((stateCode === 'ME' || stateCode === 'VT') && type === 'liquor') {
        return count * (rates.wine_liquor || rates.liquor || 0.15)
      }

      // Hawaii: deposit minus handling fee (1¢ deducted at redemption)
      if (stateCode === 'HI') {
        return count * (rates.standard - (rates.handling_fee || 0))
      }

      return count * rates.standard
    }
  }, [rules, stateCode, containerType])

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

  // Container options for this state (null if single-rate)
  const containerOptions = useMemo(() => getContainerOptions(stateCode), [stateCode])

  return {
    rules,
    depositRate,
    hasDeposit: hasDepositLaw(stateCode),
    calculateDeposit,
    formatDeposit,
    containerOptions,
    isMultiRate: MULTI_RATE_STATES.has(stateCode),
  }
}
