import { test, expect } from '@playwright/test';

test.describe('로그인 기능 테스트', () => {
  test('tommy0621@naver.com 계정으로 로그인 테스트', async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto('/auth/login');
    
    // 페이지가 로드될 때까지 대기
    await page.waitForLoadState('networkidle');
    
    // 이메일 입력
    await page.fill('input[type="email"]', 'tommy0621@naver.com');
    
    // 비밀번호 입력
    await page.fill('input[type="password"]', '123123');
    
    // 로그인 버튼 클릭
    await page.click('button[type="submit"]');
    
    // 로그인 처리 대기 (최대 10초)
    await page.waitForTimeout(2000);
    
    // 콘솔 로그 확인
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
      console.log('Console:', msg.text());
    });
    
    // 에러 확인
    const errorElement = page.locator('.bg-red-50, .bg-red-900\\/20');
    const errorText = await errorElement.textContent().catch(() => null);
    
    if (errorText) {
      console.log('에러 발견:', errorText);
    }
    
    // URL 확인 (로그인 성공 시 /admin으로 리다이렉트되어야 함)
    const currentUrl = page.url();
    console.log('현재 URL:', currentUrl);
    
    // 세션 확인을 위해 localStorage 확인
    const sessionData = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return keys.filter(k => k.includes('supabase') || k.includes('auth')).map(k => ({
        key: k,
        value: localStorage.getItem(k)?.substring(0, 100) // 처음 100자만
      }));
    });
    
    console.log('LocalStorage 세션 데이터:', sessionData);
    
    // 최종 URL 확인
    await page.waitForTimeout(2000);
    const finalUrl = page.url();
    console.log('최종 URL:', finalUrl);
    
    // 로그인 성공 여부 확인
    if (finalUrl.includes('/admin') || finalUrl.includes('/auth/login') === false) {
      console.log('✅ 로그인 성공 또는 리다이렉트됨');
    } else {
      console.log('❌ 로그인 실패 - 여전히 로그인 페이지에 있음');
    }
  });
  
  test('회원가입 후 로그인 테스트', async ({ page }) => {
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
    
    // 회원가입 처리 대기
    await page.waitForTimeout(3000);
    
    // 성공 메시지 또는 에러 확인
    const successMessage = page.locator('text=회원가입이 완료되었습니다, text=이메일 인증이 필요합니다');
    const errorMessage = page.locator('.bg-red-50, .bg-red-900\\/20');
    
    const hasSuccess = await successMessage.count() > 0;
    const hasError = await errorMessage.count() > 0;
    
    console.log('회원가입 결과:', { hasSuccess, hasError });
    
    // 이메일 인증이 필요한 경우
    if (hasSuccess && (await page.locator('text=이메일 인증이 필요합니다').count()) > 0) {
      console.log('이메일 인증이 필요한 경우입니다.');
      // 이 경우 테스트를 종료 (실제 이메일 인증은 불가능)
      return;
    }
    
    // 회원가입 성공 후 로그인 페이지로 이동
    if (hasSuccess) {
      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');
      
      // 로그인 시도
      await page.fill('input[type="email"]', testEmail);
      await page.fill('input[type="password"]', testPassword);
      await page.click('button[type="submit"]');
      
      await page.waitForTimeout(3000);
      
      const loginUrl = page.url();
      console.log('로그인 후 URL:', loginUrl);
    }
  });
});

