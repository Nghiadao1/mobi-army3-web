package army2.web;

import org.teavm.jso.JSBody;
import org.teavm.jso.JSFunctor;
import org.teavm.jso.JSObject;
import org.teavm.interop.Async;
import org.teavm.interop.AsyncCallback;

public final class BrowserInputDialog {
    @JSFunctor interface Result extends JSObject { void finish(String value); }
    @Async private static native String prompt(String message, String initial);
    private static void prompt(String message, String initial, AsyncCallback<String> callback) {
        open(message, initial, callback::complete);
    }
    @JSBody(params={"message", "initial", "done"}, script="""
        var overlay=document.createElement('div');
        overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:#0009;display:grid;place-items:center';
        var form=document.createElement('form');
        form.style.cssText='padding:24px;border:4px solid #e4bf42;border-radius:8px;background:#c9d5eb;color:#233b52;font:16px sans-serif;max-width:85vw';
        var label=document.createElement('label');label.textContent=message;label.style.display='block';
        var input=document.createElement('input');input.type='text';input.value=initial || '';input.setAttribute('aria-label',message);
        input.style.cssText='display:block;font:18px sans-serif;padding:10px;margin:14px 0;max-width:65vw';label.appendChild(input);form.appendChild(label);
        var accept=document.createElement('button');accept.type='submit';accept.textContent='Xác nhận';accept.style.cssText='padding:10px 18px;margin-right:12px';
        var cancel=document.createElement('button');cancel.type='button';cancel.textContent='Hủy';cancel.style.cssText='padding:10px 18px';
        form.appendChild(accept);form.appendChild(cancel);overlay.appendChild(form);document.body.appendChild(overlay);
        var finished=false;var close=function(value){if(finished)return;finished=true;overlay.remove();document.getElementById('canvas').focus();done(value);};
        form.onsubmit=function(e){e.preventDefault();close(input.value);};cancel.onclick=function(){close(null);};
        overlay.onkeydown=function(e){e.stopPropagation();if(e.key==='Escape')close(null);};
        overlay.onkeyup=function(e){e.stopPropagation();};overlay.onkeypress=function(e){e.stopPropagation();};
        overlay.onmousedown=function(e){e.stopPropagation();};overlay.onmouseup=function(e){e.stopPropagation();};
        input.focus();input.select();
        """)
    private static native void open(String message, String initial, Result done);
    public static String showInputDialog(Object parent, Object message, Object initial) { return prompt(String.valueOf(message), String.valueOf(initial)); }
    public static String showInputDialog(Object parent, String message) { return prompt(message, ""); }
    public static String showInputDialog(Object message) { return prompt(String.valueOf(message), ""); }
}
