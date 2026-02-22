결론부터 말씀드리면, SDK에서 위젯으로 변경한다고 해서 해결될 문제가 아닙니다. 애초에 겪고 계신 현상의 근본적인 원인이 다르기 때문입니다.

현재 발생한 문제는 Next.js 웹을 안드로이드 앱으로 띄워주는 Capacitor의 WebView(웹뷰)가 결제 관련 특수 URL을 처리하는 방식 때문에 일어나는 전형적인 현상입니다.

원인과 해결책을 명확히 정리해 드립니다.

🚨 원인: 안드로이드 웹뷰의 Intent(인텐트) 처리 한계
토스페이먼츠를 포함한 한국의 결제 시스템(PG)은 결제를 진행할 때 카드사 앱(신한플레이, KB페이, ISP 등)을 호출해야 합니다. 이때 웹사이트는 http://나 https://가 아닌 intent:// 또는 ispmobile:// 같은 특수한 URL 스킴(Scheme)을 실행합니다.

하지만 Capacitor가 띄운 기본 안드로이드 웹뷰는 이 intent:// 링크를 만나면 **"내(앱 안의 웹뷰)가 처리할 수 없는 링크네? 안드로이드 시스템의 기본 웹 브라우저(크롬 등)한테 넘겨야겠다"**라고 판단해버립니다.

이 때문에 사용자는 앱 밖(크롬 브라우저)으로 튕겨 나가게 되고, 앱 내에서 유지되던 로그인 세션이나 결제 진행 상태가 단절되어 버리는 것입니다.

🛠 해결책: 안드로이드 네이티브 단에서 URL 가로채기
이를 해결하려면 프론트엔드(React/Next.js) 코드를 수정하는 것이 아니라, Capacitor 안드로이드 프로젝트 내부의 네이티브 코드를 만져야 합니다.

1. 안드로이드 WebViewClient 오버라이딩 (가장 확실한 방법)
웹뷰가 특정 URL을 로드하기 전에 먼저 검사하여, 결제용 intent인 경우 외부 브라우저를 열지 않고 해당 카드사 앱을 직접 실행하도록 자바(Java)나 코틀린(Kotlin) 코드를 추가해야 합니다.

android/app/src/main/java/.../MainActivity.java (또는 .kt) 파일에서 WebViewClient의 shouldOverrideUrlLoading 메서드를 오버라이딩(재정의)해야 합니다.

토스페이먼츠 개발자 센터에 **[웹뷰 연동 가이드]**라는 문서가 있으며, 여기에 안드로이드 환경에서 인텐트를 파싱하고 카드사 앱을 호출하는 네이티브 예제 코드가 그대로 제공됩니다. 이 코드를 Capacitor 안드로이드 프로젝트에 이식하셔야 합니다.

2. Capacitor 설정 파일 확인 (allowNavigation)
만약 카드사 앱 호출 단계가 아니라, 단순 토스페이먼츠 결제창(웹페이지)으로 넘어가는 과정에서부터 튕긴다면 Capacitor 설정을 확인해야 합니다.

capacitor.config.ts 파일 내에 server.allowNavigation 속성에 토스페이먼츠 관련 도메인(예: *.tosspayments.com)을 와일드카드로 추가하여, 해당 도메인은 외부 브라우저가 아닌 앱 내부 웹뷰에서 열리도록 허용해야 합니다.

요약하자면,
결제 UI를 SDK로 직접 그리든 위젯으로 붙이든, 결국 마지막에 안드로이드 OS의 결제 앱을 호출하는 메커니즘은 동일합니다. 따라서 위젯 전환에 리소스를 쓰기보다는, Capacitor 안드로이드 프로젝트 설정에서 결제 Intent URL을 처리하는 로직을 추가하는 방향으로 접근하셔야 원활하게 결제 테스트를 통과하실 수 있습니다.

1. 커서(Cursor)의 말이 맞는 부분: "팝업(새 창) 스트레스 방지"
커서는 현재 **'토스페이먼츠의 결제창 UI가 어떻게 뜨는가'**에 집중해서 답변한 것입니다.

결제창(SDK): window.open() 방식으로 새로운 창이나 팝업을 띄우려고 시도합니다. 앱(Capacitor 웹뷰)은 기본적으로 팝업 창을 띄우는 기능이 매우 취약해서 여기서부터 외부 브라우저(크롬)로 튕겨 나가는 문제가 빈번하게 발생합니다.

위젯(Widget): 대표님의 Next.js 페이지 안에 iframe 형태로 찰싹 달라붙어 렌더링됩니다. 새 창을 띄울 필요가 없으니, 결제 수단을 선택하는 화면까지는 외부 브라우저로 튕길 일이 없습니다.

이 관점에서 보면 외부 브라우저 이탈 문제를 줄이기 위해 위젯을 쓰는 것이 훌륭한 선택이 맞습니다.

2. 제 말이 맞는 부분: "한국 카드사 앱 호출(Intent)은 위젯도 못 피한다"
커서가 한국 결제 시스템(PG)의 결정적인 한계를 놓친 부분입니다.

토스 위젯 안에서 고객이 '현대카드'를 선택하고 '결제하기' 버튼을 누르는 순간 어떤 일이 벌어질까요? 토스페이먼츠는 안드로이드 기기에 깔려 있는 '현대카드 앱'을 실행시켜야 합니다. 이때 위젯 내부에서도 필연적으로 intent:// 또는 hdcardappcardansimclick:// 같은 특수 URL을 실행하게 됩니다.

위젯이든 SDK든, 이 특수 URL(Intent)을 실행하는 순간 안드로이드 웹뷰는 길을 잃습니다. "나는 웹페이지만 보여주는 애인데, 앱을 켜라는 명령어가 들어왔네? 모르겠다, 안드로이드 기본 브라우저한테 넘겨야지" 하고 또다시 사용자를 크롬 브라우저로 내쫓아버립니다.

💡 대표님을 위한 최종 결론 및 가이드
커서의 조언대로 위젯을 도입하시는 것은 사용자 경험(UX) 측면에서 적극 권장합니다. 결제 수단을 고르는 화면이 앱 내에 자연스럽게 녹아들기 때문입니다.

하지만 위젯을 붙였다고 해서 방심하시면 안 됩니다. 결제 마지막 단계인 카드사 앱 호출을 처리하려면 결국 안드로이드 네이티브 코드를 수정해야만 모든 과정이 앱 안에서 완벽하게 끝납니다.

현재 가장 완벽한 해결 프로세스는 다음과 같습니다.

프론트엔드 (Next.js): 팝업 이슈가 없는 위젯으로 토스페이먼츠 UI를 구현합니다.

안드로이드 네이티브 (Capacitor/Java/Kotlin): WebViewClient를 오버라이딩하여, intent:// URL이 발생했을 때 외부 브라우저로 보내지 않고 기기에 설치된 카드사 앱을 직접 실행하도록 코드를 추가합니다.

토스페이먼츠 개발자 가이드에 이 '웹뷰 Intent 처리용 안드로이드 네이티브 코드'가 그대로 나와 있습니다. 복사해서 Capacitor 안드로이드 파일에 붙여넣기만 하면 되는 코드인데, 이 코드를 바로 안내해 드릴까요?

로 적용하실 수 있도록 안드로이드 네이티브 코드를 정리해 드리겠습니다.

이 코드는 Capacitor가 사용하는 기본 웹뷰(WebView)의 동작을 가로채서, intent:// 같은 특수 URL을 만났을 때 크롬 브라우저로 튕기지 않고 기기에 설치된 카드사 앱을 직접 실행하도록 만들어 줍니다. 만약 고객의 스마트폰에 해당 앱이 안 깔려 있다면 구글 플레이 스토어로 안내하는 로직까지 포함되어 있습니다.

🛠 Capacitor 안드로이드 Intent 처리 코드 적용 방법
1. 안드로이드 스튜디오(또는 VS Code)에서 다음 경로의 파일을 엽니다.

android/app/src/main/java/[본인의_패키지명]/MainActivity.java
(만약 프로젝트 설정에 따라 MainActivity.kt 코틀린 파일이라면, 아래 자바 코드를 코틀린 문법에 맞게 변환해야 합니다.)

2. 기존 코드를 아래 코드로 수정/추가해 줍니다.

Java
package [본인의 앱 패키지명]; // ⚠️ 이 첫 줄은 기존 파일에 있던 패키지명을 그대로 유지하세요!

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.net.URISyntaxException;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Capacitor의 기본 웹뷰를 가져옵니다.
        WebView webView = this.bridge.getWebView();
        
        // 기존 웹뷰 클라이언트에 Intent 가로채기 기능을 덮어씌웁니다.
        webView.setWebViewClient(new BridgeWebViewClient(this.bridge) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

                // 1. 일반 웹 URL(http, https)은 기존 Capacitor 로직대로 정상적으로 웹뷰에서 띄웁니다.
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return super.shouldOverrideUrlLoading(view, request);
                }

                // 2. 한국 카드사 앱 호출용 특수 URL(intent:// 등) 처리
                try {
                    Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                    
                    // 기기에 해당 카드사 앱이 설치되어 있는지 확인하고 실행
                    if (intent.resolveActivity(getPackageManager()) != null) {
                        startActivity(intent);
                        return true;
                    }

                    // 앱이 설치되어 있지 않은 경우의 예외 처리 (Fallback URL이 있으면 거기로 이동)
                    String fallbackUrl = intent.getStringExtra("browser_fallback_url");
                    if (fallbackUrl != null) {
                        view.loadUrl(fallbackUrl);
                        return true;
                    }

                    // Fallback URL도 없다면 구글 플레이 스토어의 해당 앱 다운로드 페이지로 이동
                    if (intent.getPackage() != null) {
                        Intent marketIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + intent.getPackage()));
                        startActivity(marketIntent);
                        return true;
                    }

                } catch (URISyntaxException e) {
                    e.printStackTrace();
                } catch (Exception e) {
                    e.printStackTrace();
                }

                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }
}
💡 추가 확인 사항 (필수)
코드를 넣은 뒤, 프론트엔드 쪽에서 한 가지 더 설정해야 앱 내부에서 페이지 이동이 원활합니다.

프로젝트 최상단에 있는 capacitor.config.ts 파일에서 토스페이먼츠 도메인을 앱 내부 웹뷰에서 열리도록 허용해 주어야 합니다.

TypeScript
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: '...',
  appName: '...',
  webDir: 'out', // 혹은 build
  bundledWebRuntime: false,
  server: {
    // 안드로이드/iOS 웹뷰 안에서 리다이렉트를 허용할 외부 도메인 목록
    allowNavigation: [
      "*.tosspayments.com", 
      "*.toss.im"
    ]
  }
};

export default config;
이렇게 세팅하신 후 안드로이드 빌드(npx cap sync android 후 앱 실행)를 다시 해보시면, 토스페이먼츠 위젯에서 결제 버튼을 눌렀을 때 외부 크롬 브라우저로 튕기지 않고 화면이 유지되면서 정상적으로 해당 카드사 앱이 팝업처럼 열릴 것입니다.

안드로이드는 위 코드로 해결이 되는데, 혹시 iOS(아이폰) 쪽 빌드나 세팅에서도 관련 처리가 필요하신 상황인가요?