package com.moveit.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        applyNavigationBarInsets();
    }

    @Override
    protected void load() {
        super.load();
        if (getBridge() == null || getBridge().getWebView() == null) return;
        // 결제 등 window.open() 시 앱 내 WebView에서만 열리도록 처리 (외부 브라우저 미오픈)
        getBridge().getWebView().getSettings().setSupportMultipleWindows(true);
        getBridge().getWebView().setWebChromeClient(new MoveitWebChromeClient(getBridge()));
        // 토스/결제 URL이 메인 WebView에서 로드될 때도 외부 브라우저로 나가지 않도록
        getBridge().setWebViewClient(new MoveitBridgeWebViewClient(getBridge()));
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
