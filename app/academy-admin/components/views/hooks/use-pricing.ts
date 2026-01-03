import { useMemo } from 'react';

interface UsePricingProps {
  selectedProduct: any;
  discountMode: 'policy' | 'manual';
  selectedPolicyId: string | null;
  manualDiscountType: 'amount' | 'percent';
  manualDiscountValue: number;
  discountPolicies?: any[];
}

export function usePricing({
  selectedProduct,
  discountMode,
  selectedPolicyId,
  manualDiscountType,
  manualDiscountValue,
  discountPolicies = [],
}: UsePricingProps) {
  return useMemo(() => {
    if (!selectedProduct) return { original: 0, discount: 0, final: 0 };

    let original = selectedProduct.price;
    let discount = 0;

    if (discountMode === 'policy' && selectedPolicyId) {
      const policy = discountPolicies.find((p) => p.id === selectedPolicyId);
      if (policy) {
        if (policy.type === 'percent') {
          discount = original * (policy.value / 100);
        } else {
          discount = policy.value;
        }
      }
    } else if (discountMode === 'manual') {
      if (manualDiscountType === 'percent') {
        discount = original * (manualDiscountValue / 100);
      } else {
        discount = Number(manualDiscountValue);
      }
    }

    // 할인 금액이 원금보다 크지 않게
    if (discount > original) discount = original;
    if (discount < 0) discount = 0;

    return {
      original,
      discount,
      final: original - discount,
    };
  }, [selectedProduct, discountMode, selectedPolicyId, manualDiscountType, manualDiscountValue, discountPolicies]);
}

