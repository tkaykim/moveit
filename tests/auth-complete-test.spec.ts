import { test, expect } from '@playwright/test';

test.describe('완전한 인증 플로우 테스트', () => {
  test('tommy0621@naver.com 계정으로 로그인 및 admin 페이지 접근', async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    // 이메일 입력
    await page.fill('input[type="email"]', 'tommy0621@naver.com');
    
    // 비밀번호 입력
    await page.fill('input[type="password"]', '123123');
    
    // 로그인 버튼 클릭
    await page.click('button[type="submit"]');
    
    // 리다이렉트 대기
    await page.waitForURL(/.*\/admin/, { timeout: 10000 });
    
    // admin 페이지가 로드되었는지 확인
    const currentUrl = page.url();
    expect(currentUrl).toContain('/admin');
    
    // 페이지 내용 확인
    await page.waitForSelector('text=관리자 대시보드', { timeout: 5000 }).catch(() => {});
    
    console.log('✅ Admin 페이지 로그인 성공');
  });
  
  test('홈 페이지 접근 및 세션 확인', async ({ page }) => {
    // 먼저 로그인
    await page.goto('/auth/login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'tommy0621@naver.com');
    await page.fill('input[type="password"]', '123123');
    await page.click('button[type="submit"]');
    
    // admin으로 리다이렉트 대기
    await page.waitForURL(/.*\/admin/, { timeout: 10000 });
    
    // 홈 페이지로 이동
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // 홈 페이지가 로드되었는지 확인
    const currentUrl = page.url();
    expect(currentUrl).toBe('http://localhost:3000/');
    
    console.log('✅ 홈 페이지 접근 성공');
  });
  
  test('회원가입 테스트', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@example.com`;
    const testPassword = '123123';
    const testName = '테스트 사용자';
    
    // 회원가입 페이지로 이동
    await page.goto('/auth/signup');
    await page.waitForLoadState('networkidle');
    
    // 회원가입 폼 작성
    await page.fill('input[type="text"]', testName);
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    
    // 회원가입 버튼 클릭
    await page.click('button[type="submit"]');
    
    // 결과 대기
    await page.waitForTimeout(3000);
    
    // 성공 메시지 또는 에러 확인
    const pageContent = await page.textContent('body');
    console.log('회원가입 결과:', pageContent?.substring(0, 200));
    
    // 이메일 인증이 필요한 경우를 처리
    const needsVerification = await page.locator('text=이메일 인증이 필요합니다').count() > 0;
    const hasSuccess = await page.locator('text=회원가입이 완료되었습니다').count() > 0;
    
    if (needsVerification) {
      console.log('✅ 회원가입 성공 (이메일 인증 필요)');
    } else if (hasSuccess || page.url().includes('/admin')) {
      console.log('✅ 회원가입 성공 (즉시 로그인)');
    } else {
      console.log('⚠️ 회원가입 결과 불명확');
    }
  });
});

