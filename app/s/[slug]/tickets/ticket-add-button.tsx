'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight } from 'lucide-react';
import { addToCart, readCart } from '@/lib/miniapp/cart';

/** 수강권을 장바구니에 담는다. 금액은 서버가 판정하므로 여기서 보내지 않는다. */
export function TicketAddButton({
  slug,
  academyId,
  ticketId,
  ticketName,
  unitLabel,
}: {
  slug: string;
  academyId: string;
  ticketId: string;
  ticketName: string;
  unitLabel: string;
}) {
  const router = useRouter();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const sync = () =>
      setAdded(
        readCart(academyId).some(
          (e) => e.item.item_type === 'TICKET_PURCHASE' && e.item.ticket_id === ticketId
        )
      );
    sync();
    window.addEventListener('miniapp-cart-changed', sync);
    return () => window.removeEventListener('miniapp-cart-changed', sync);
  }, [academyId, ticketId]);

  if (added) {
    return (
      <button
        type="button"
        data-testid="ticket-in-cart"
        onClick={() => router.push(`/s/${slug}/cart`)}
        className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
        style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
      >
        <Check size={11} /> 담김
      </button>
    );
  }

  return (
    <button
      type="button"
      data-testid="ticket-add"
      data-ticket-id={ticketId}
      onClick={() =>
        addToCart(academyId, {
          label: ticketName,
          sublabel: unitLabel,
          item: {
            item_type: 'TICKET_PURCHASE',
            ticket_id: ticketId,
            count_option_index: null,
            fixed_class_id: null,
          },
        })
      }
      className="inline-flex items-center gap-0.5 mt-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
      style={{ backgroundColor: 'var(--primary)' }}
    >
      담기 <ChevronRight size={11} />
    </button>
  );
}
