package army2.web;

import com.github.xpenatan.gdx.teavm.backends.web.WebApplication;
import com.github.xpenatan.gdx.teavm.backends.web.WebApplicationConfiguration;
import com.teamobi.mobiarmy2.MainGame;

public final class WebLauncher {
    public static void main(String[] args) {
        WebApplicationConfiguration config = new WebApplicationConfiguration("canvas");
        config.width = 960;
        config.height = 540;
        config.storagePrefix = "mobiarmy2-original";
        config.showDownloadLogs = true;
        new WebApplication(new MainGame() {
            @Override public void create() {
                BrowserPlatform.prepareServerList();

                MarvelRoster.load();
                super.create();
            }
        }, config);
    }
}
