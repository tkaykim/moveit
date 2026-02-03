"use client";

import { useState, useEffect } from 'react';
import { StudentSelection } from './student-selection';
import { ProductSelection } from './product-selection';
import { DiscountApplication } from './discount-application';
import { PaymentSummary } from './payment-summary';
import { ConfirmModal } from './confirm-modal';
import { SuccessModal } from './success-modal';
import { StudentRegisterModal } from '../students/student-register-modal';
import { usePricing } from '../hooks/use-pricing';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface SalesFormProps {
  academyId: string;
  onPaymentComplete: (log: any) => void;
  onViewLogs: () => void;
}

export function SalesForm({ academyId, onPaymentComplete, onViewLogs }: SalesFormProps) {
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [discountMode, setDiscountMode] = useState<'policy' | 'manual'>('policy');
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [manualDiscountType, setManualDiscountType] = useState<'amount' | 'percent'>('amount');
  const [manualDiscountValue, setManualDiscountValue] = useState(0);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [discountPolicies, setDiscountPolicies] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [academyId]);

  const loadData = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // academy_students를 통해 해당 학원의 학생만 조회
      const { data: academyStudents, error: studentsError } = await supabase
        .from('academy_students')
        .select(`
          *,
          users (
            id,
            name,
            name_en,
            nickname,
            phone,
            email,
            birth_date,
            gender,
            address,
            nationality
          ),
          academies (
            id,
            name_kr,
            name_en
          )
        `)
        .eq('academy_id', academyId);

      if (studentsError) {
        console.error('Error loading academy students:', studentsError);
        setStudents([]);
      } else {
        // 중복 제거 (같은 user가 여러 번 나타날 수 있으므로)
        const uniqueUsers = new Map();
        (academyStudents || []).forEach((academyStudent: any) => {
          const userId = academyStudent.user_id;
          if (!uniqueUsers.has(userId)) {
            uniqueUsers.set(userId, {
              ...academyStudent.users,
              academy_students: []
            });
          }
          // 해당 user의 academy_students 정보 수집
          uniqueUsers.get(userId).academy_students.push({
            academy_id: academyStudent.academy_id,
            academy: academyStudent.academies,
            created_at: academyStudent.created_at,
            referral_source: academyStudent.referral_source,
            interested_genres: academyStudent.interested_genres,
            level: academyStudent.level,
          });
        });

        setStudents(Array.from(uniqueUsers.values()));
      }

      // 상품(수강권) 목록 로드
      const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('academy_id', academyId)
        .eq('is_on_sale', true);

      const getTicketCategory = (t: any): 'regular' | 'popup' | 'workshop' => {
        if (t.ticket_category === 'popup' || t.ticket_category === 'workshop') return t.ticket_category;
        if (t.access_group === 'popup') return 'popup';
        if (t.access_group === 'workshop') return 'workshop';
        if (t.is_coupon === true && t.access_group !== 'regular') return 'popup';
        return 'regular';
      };

      const formattedProducts: any[] = [];
      for (const ticket of tickets || []) {
        const category = getTicketCategory(ticket);
        const opts = ticket.count_options as { count?: number; price?: number; valid_days?: number | null }[] | null;
        const hasCountOptions = opts && Array.isArray(opts) && opts.length > 0 && (ticket.ticket_category === 'popup' || ticket.access_group === 'popup');
        if (hasCountOptions) {
          for (const o of opts) {
            const count = Number(o?.count ?? 1);
            const price = Number(o?.price ?? 0);
            if (count > 0) {
              formattedProducts.push({
                id: ticket.id,
                productKey: `${ticket.id}_${count}`,
                type: 'count',
                category,
                name: `${ticket.name} ${count}회권`,
                amount: count,
                days: o?.valid_days ?? ticket.valid_days,
                price,
              });
            }
          }
        } else {
          formattedProducts.push({
            id: ticket.id,
            productKey: ticket.id,
            type: ticket.ticket_type === 'COUNT' ? 'count' : 'period',
            category,
            name: ticket.name,
            amount: ticket.total_count,
            days: ticket.valid_days,
            price: ticket.price,
          });
        }
      }
      setProducts(formattedProducts);

      // 할인 정책 로드
      const { data: discounts } = await supabase
        .from('discounts')
        .select('*')
        .eq('academy_id', academyId)
        .eq('is_active', true);

      const formattedDiscounts = (discounts || []).map((discount: any) => ({
        id: discount.id,
        name: discount.name,
        type: discount.discount_type === 'PERCENT' ? 'percent' : 'amount',
        value: discount.discount_value,
      }));
      setDiscountPolicies(formattedDiscounts);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const pricing = usePricing({
    selectedProduct,
    discountMode,
    selectedPolicyId,
    manualDiscountType,
    manualDiscountValue,
    discountPolicies,
  });

  const handlePayment = () => {
    setIsConfirmModalOpen(true);
  };

  const confirmPayment = async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !selectedStudent || !selectedProduct) return;

    try {
      // 1. user_ticket 생성
      const { data: userTicket, error: ticketError } = await supabase
        .from('user_tickets')
        .insert([
          {
            user_id: selectedStudent.id,
            ticket_id: selectedProduct.id,
            remaining_count: selectedProduct.amount || 0,
            start_date: new Date().toISOString().split('T')[0],
            expiry_date: selectedProduct.days
              ? new Date(
                  Date.now() + selectedProduct.days * 24 * 60 * 60 * 1000
                ).toISOString().split('T')[0]
              : null,
            status: 'ACTIVE',
          },
        ])
        .select()
        .single();

      if (ticketError) throw ticketError;

      // 2. revenue_transaction 생성
      const { data: transaction, error: transactionError } = await supabase
        .from('revenue_transactions')
        .insert([
          {
            academy_id: academyId,
            user_id: selectedStudent.id,
            ticket_id: selectedProduct.id,
            user_ticket_id: userTicket.id,
            discount_id: selectedPolicyId || null,
            original_price: pricing.original,
            discount_amount: pricing.discount,
            final_price: pricing.final,
            payment_method: 'CARD',
            payment_status: 'COMPLETED',
          },
        ])
        .select()
        .single();

      if (transactionError) throw transactionError;

      // 3. 로그 생성
      const newLog = {
        id: transaction.id,
        date: new Date().toISOString(),
        studentName: selectedStudent.name || selectedStudent.nickname,
        studentId: selectedStudent.id,
        productName: selectedProduct.name,
        productType: selectedProduct.type,
        originalPrice: pricing.original,
        discountAmount: pricing.discount,
        finalPrice: pricing.final,
        discountDetail:
          discountMode === 'policy'
            ? discountPolicies.find((d) => d.id === selectedPolicyId)?.name || '선택 없음'
            : `직접 입력 (${manualDiscountType === 'percent' ? `${manualDiscountValue}%` : `${manualDiscountValue}원`})`,
      };

      onPaymentComplete(newLog);
      setIsConfirmModalOpen(false);
      setIsSuccessModalOpen(true);
    } catch (error: any) {
      console.error('Error processing payment:', error);
      alert(`결제 처리에 실패했습니다: ${error.message}`);
    }
  };

  const resetForm = () => {
    setSelectedStudent(null);
    setSelectedProduct(null);
    setSearchTerm('');
    setSelectedPolicyId(null);
    setManualDiscountValue(0);
    setIsSuccessModalOpen(false);
  };

  const handleStudentRegister = () => {
    setIsRegisterModalOpen(true);
  };

  const handleStudentRegisterClose = () => {
    setIsRegisterModalOpen(false);
    // 학생 등록 후 목록 다시 로드
    loadData();
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <StudentSelection
            selectedStudent={selectedStudent}
            searchTerm={searchTerm}
            students={students}
            onStudentSelect={setSelectedStudent}
            onSearchChange={setSearchTerm}
            onRegisterStudent={handleStudentRegister}
          />

          <ProductSelection
            selectedProduct={selectedProduct}
            products={products}
            onProductSelect={setSelectedProduct}
            disabled={!selectedStudent}
          />

          <DiscountApplication
            selectedProduct={selectedProduct}
            discountMode={discountMode}
            selectedPolicyId={selectedPolicyId}
            manualDiscountType={manualDiscountType}
            manualDiscountValue={manualDiscountValue}
            discountPolicies={discountPolicies}
            onDiscountModeChange={setDiscountMode}
            onPolicySelect={setSelectedPolicyId}
            onManualDiscountTypeChange={setManualDiscountType}
            onManualDiscountValueChange={setManualDiscountValue}
          />
        </div>

        <div className="lg:col-span-1">
          <PaymentSummary
            selectedStudent={selectedStudent}
            selectedProduct={selectedProduct}
            pricing={pricing}
            onPayment={handlePayment}
          />
        </div>
      </div>

      {isConfirmModalOpen && (
        <ConfirmModal
          selectedStudent={selectedStudent}
          selectedProduct={selectedProduct}
          pricing={pricing}
          onConfirm={confirmPayment}
          onCancel={() => setIsConfirmModalOpen(false)}
        />
      )}

      {isSuccessModalOpen && (
        <SuccessModal
          selectedStudent={selectedStudent}
          selectedProduct={selectedProduct}
          onReset={resetForm}
          onViewLogs={() => {
            resetForm();
            onViewLogs();
          }}
        />
      )}

      {isRegisterModalOpen && (
        <StudentRegisterModal
          academyId={academyId}
          onClose={handleStudentRegisterClose}
        />
      )}
    </>
  );
}
