package army2.web;

import org.teavm.jso.JSBody;

public final class BrowserInputDialog {
    @JSBody(params={"message", "initial"}, script="return window.prompt(message,initial || '');")
    private static native String prompt(String message, String initial);
    public static String showInputDialog(Object parent, Object message, Object initial) { return prompt(String.valueOf(message), String.valueOf(initial)); }
    public static String showInputDialog(Object parent, String message) { return prompt(message, ""); }
    public static String showInputDialog(Object message) { return prompt(String.valueOf(message), ""); }
}
