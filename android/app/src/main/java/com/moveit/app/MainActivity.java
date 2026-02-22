package com.moveit.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private MoveitWebChromeClient moveitWebChromeClient;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        applyNavigationBarInsets();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleMoveitAppScheme(intent);
    }

    @Override
    protected void load() {
        super.load();
        if (getBridge() == null || getBridge().getWebView() == null) return;
        // 결제 등 window.open() 시 앱 내 WebView에서만 열리도록 처리 (외부 브라우저 미오픈)
        getBridge().getWebView().getSettings().setSupportMultipleWindows(true);
        moveitWebChromeClient = new MoveitWebChromeClient(getBridge());
        getBridge().getWebView().setWebChromeClient(moveitWebChromeClient);
        // 토스/결제 URL이 메인 WebView에서 로드될 때도 외부 브라우저로 나가지 않도록
        getBridge().setWebViewClient(new MoveitBridgeWebViewClient(getBridge()));
        handleMoveitAppScheme(getIntent());
    }

    /**
     * 토스 appScheme(moveitapp://)으로 복귀 시 동일 경로의 https URL을 WebView에 로드해 결제 결과 페이지로 이동.
     */
    private void handleMoveitAppScheme(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null || !"moveitapp".equals(data.getScheme())) return;

        Bridge bridge = getBridge();
        if (bridge == null) return;
        WebView webView = bridge.getWebView();
        if (webView == null) return;

        // moveitapp:// 복귀 시 결제 오버레이가 남아 있으면 제거 (카드사 앱 복귀 후 오버레이가 화면을 가리는 문제 방지)
        if (moveitWebChromeClient != null) {
            moveitWebChromeClient.removeOverlayFromMainThread();
        }

        String appUrl = bridge.getAppUrl();
        if (appUrl == null || appUrl.isEmpty()) return;

        Uri appUri = Uri.parse(appUrl);
        String base = appUri.getScheme() + "://" + appUri.getHost()
            + (appUri.getPort() > 0 && appUri.getPort() != 443 && appUri.getPort() != 80 ? ":" + appUri.getPort() : "");
        String path = data.getPath();
        String query = data.getQuery();
        if (path == null || path.isEmpty()) path = "/";
        String fullUrl = base + path + (query != null && !query.isEmpty() ? "?" + query : "");
        webView.loadUrl(fullUrl);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "moveit_default",
                "MOVEIT 알림",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("MOVEIT 앱 푸시 알림");
            channel.enableVibration(true);
            channel.setShowBadge(true);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void applyNavigationBarInsets() {
        View contentView = findViewById(android.R.id.content);
        if (contentView == null) return;

        ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
            Insets navBarInsets = windowInsets.getInsets(WindowInsetsCompat.Type.navigationBars());
            v.setPadding(
                v.getPaddingLeft(),
                v.getPaddingTop(),
                v.getPaddingRight(),
                navBarInsets.bottom
            );
            return windowInsets;
        });
    }
}
