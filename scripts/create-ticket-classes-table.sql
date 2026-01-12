-- 수강권과 클래스의 다대다(N:M) 관계를 위한 조인 테이블
CREATE TABLE IF NOT EXISTS ticket_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ticket_id, class_id)
);

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_ticket_classes_ticket_id ON ticket_classes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_classes_class_id ON ticket_classes(class_id);

-- RLS 정책 (필요 시)
ALTER TABLE ticket_classes ENABLE ROW LEVEL SECURITY;

-- 기본 정책: 인증된 사용자 읽기 허용
CREATE POLICY "Enable read access for authenticated users" ON ticket_classes
  FOR SELECT
  TO authenticated
  USING (true);

-- 서비스 역할은 모든 작업 허용
CREATE POLICY "Enable all access for service role" ON ticket_classes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
