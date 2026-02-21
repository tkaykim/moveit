package com.moveit.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

/** 결제 딥링크 수신 시 로드할 웹 도메인 (capacitor.config server.url과 동일) */
public class MainActivity extends BridgeActivity {

    private static final String WEB_BASE = "https://moveit-xi.vercel.app";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        applyNavigationBarInsets();
        setupPaymentWebViewClient();
        handleMoveitDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleMoveitDeepLink(intent);
    }

    private void setupPaymentWebViewClient() {
        getWindow().getDecorView().post(() -> {
            Bridge bridge = getBridge();
            if (bridge == null) return;
            WebView webView = bridge.getWebView();
            if (webView == null) return;
            WebViewClient current = webView.getWebViewClient();
            webView.setWebViewClient(new PaymentAwareWebViewClient(current));
        });
    }

    /** moveit://payment/... 딥링크 → https 웹 URL로 WebView 로드 */
    private void handleMoveitDeepLink(Intent intent) {
        if (intent == null) return;
        Uri uri = intent.getData();
        if (uri == null || !"moveit".equals(uri.getScheme())) return;

        String host = uri.getHost();
        String path = uri.getPath();
        String query = uri.getQuery();
        String fullPath = (host != null ? "/" + host : "") + (path != null ? path : "") + (query != null ? "?" + query : "");

        if (fullPath.contains("/payment/")) {
            String loadUrl = WEB_BASE + fullPath;
            getWindow().getDecorView().post(() -> {
                Bridge bridge = getBridge();
                if (bridge != null) {
                    WebView wv = bridge.getWebView();
                    if (wv != null) wv.loadUrl(loadUrl);
                }
            });
        }
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
