/**
 * academy_images 테이블 삭제 스크립트
 * 
 * 실행 방법:
 * 1. Supabase 대시보드의 SQL Editor에서 실행 (권장)
 *    - scripts/delete-academy-images-table.sql 파일의 내용을 복사하여 실행
 * 
 * 2. 또는 이 스크립트를 실행 (서비스 키 필요)
 *    npx tsx scripts/delete-academy-images.ts
 */

import { createClient } from '@supabase/supabase-js';

async function deleteAcademyImagesTable() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 환경 변수가 설정되지 않았습니다.');
  }

  if (!supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
    console.warn('Supabase 대시보드의 SQL Editor에서 직접 실행하세요:');
    console.warn('scripts/delete-academy-images-table.sql 파일의 내용을 복사하여 실행하세요.');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 외래키 제약조건 삭제
    console.log('외래키 제약조건 삭제 중...');
    const { error: fkError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE IF EXISTS public.academy_images DROP CONSTRAINT IF EXISTS academy_images_academy_id_fkey;',
    });

    if (fkError) {
      console.warn('외래키 제약조건 삭제 실패 (이미 삭제되었을 수 있음):', fkError.message);
    } else {
      console.log('외래키 제약조건 삭제 완료');
    }

    // 테이블 삭제
    console.log('테이블 삭제 중...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: 'DROP TABLE IF EXISTS public.academy_images;',
    });

    if (dropError) {
      // RPC 함수가 없을 수 있으므로, 직접 SQL 실행을 시도
      console.warn('RPC 함수를 통한 실행 실패, Supabase 대시보드에서 직접 실행하세요.');
      console.warn('SQL:', 'DROP TABLE IF EXISTS public.academy_images;');
      throw dropError;
    }

    console.log('✅ academy_images 테이블 삭제 완료');
  } catch (error: any) {
    console.error('❌ 오류 발생:', error.message);
    console.log('\n대신 Supabase 대시보드의 SQL Editor에서 다음 SQL을 실행하세요:');
    console.log('\n' + '='.repeat(50));
    const fs = require('fs');
    const sql = fs.readFileSync(__dirname + '/delete-academy-images-table.sql', 'utf-8');
    console.log(sql);
    console.log('='.repeat(50));
  }
}

deleteAcademyImagesTable();


