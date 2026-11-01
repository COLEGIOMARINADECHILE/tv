package cl.marinadechile.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * App Android TV del Colegio Marina de Chile.
 *
 * - mainWeb: muestra la web (GitHub Pages) a pantalla completa.
 * - tvWeb:   muestra la señal del canal, ubicada exactamente sobre el
 *            recuadro del reproductor que la web informa vía window.AndroidTV.
 *            Al ser un WebView propio (no un iframe), las páginas de TVN, 13
 *            y CHV se pueden mostrar aunque bloqueen los iframes.
 */
public class MainActivity extends Activity {

    // ⚠️ Cambie por la URL de su GitHub Pages
    private static final String START_URL = "https://USUARIO.github.io/REPOSITORIO/index.html";

    // Agranda el video del sitio del canal para que ocupe todo su recuadro
    private static final String MAXIMIZE_JS =
        "(function(){var n=0;var t=setInterval(function(){n++;var best=null,area=0;" +
        "document.querySelectorAll('video,iframe').forEach(function(e){var r=e.getBoundingClientRect();" +
        "var a=r.width*r.height;if(a>area){area=a;best=e;}});" +
        "if(best&&area>20000){best.style.cssText+=';position:fixed!important;left:0!important;top:0!important;" +
        "width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;" +
        "z-index:2147483647!important;background:#000!important;border:0!important';" +
        "document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';" +
        "if(best.tagName==='VIDEO'&&best.paused){best.play&&best.play().catch(function(){});}}" +
        "if(n>20)clearInterval(t);},1500);})();";

    private WebView mainWeb;
    private WebView tvWeb;
    private String tvUrl = "";

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#06153a"));

        mainWeb = new WebView(this);
        configure(mainWeb);
        mainWeb.addJavascriptInterface(new Bridge(), "AndroidTV");
        mainWeb.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                hideTv(); // al cambiar de pantalla se apaga la TV
            }
        });

        tvWeb = new WebView(this);
        configure(tvWeb);
        tvWeb.setFocusable(false);            // el control remoto sigue en la web principal
        tvWeb.setFocusableInTouchMode(false);
        tvWeb.setBackgroundColor(Color.BLACK);
        tvWeb.setVisibility(View.GONE);
        tvWeb.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false; // todo se abre dentro del recuadro
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(MAXIMIZE_JS, null);
            }
        });

        root.addView(mainWeb, new FrameLayout.LayoutParams(-1, -1));
        root.addView(tvWeb, new FrameLayout.LayoutParams(0, 0));
        setContentView(root);
        hideSystemUi();

        mainWeb.loadUrl(START_URL);
        mainWeb.requestFocus();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configure(WebView w) {
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        w.setWebChromeClient(new WebChromeClient());
    }

    private void hideTv() {
        runOnUiThread(() -> {
            tvUrl = "";
            tvWeb.loadUrl("about:blank");
            tvWeb.setVisibility(View.GONE);
            mainWeb.requestFocus();
        });
    }

    /** Métodos llamados desde JavaScript: window.AndroidTV.showTv(...) */
    private class Bridge {
        @JavascriptInterface
        public void showTv(final String url, final int x, final int y, final int w, final int h) {
            runOnUiThread(() -> {
                float d = getResources().getDisplayMetrics().density;
                FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(Math.round(w * d), Math.round(h * d));
                lp.leftMargin = Math.round(x * d);
                lp.topMargin = Math.round(y * d);
                tvWeb.setLayoutParams(lp);
                tvWeb.setVisibility(View.VISIBLE);
                if (!url.equals(tvUrl)) {
                    tvUrl = url;
                    tvWeb.loadUrl(url);
                }
                mainWeb.requestFocus();
            });
        }

        @JavascriptInterface
        public void hideTv() {
            MainActivity.this.hideTv();
        }
    }

    @Override
    public void onBackPressed() {
        if (mainWeb.canGoBack()) mainWeb.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        super.onPause();
        tvWeb.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        tvWeb.onResume();
        hideSystemUi();
    }

    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
}
