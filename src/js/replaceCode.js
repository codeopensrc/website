"use strict";

let hasRendered = false;

module.exports = function replaceCode() {
   setTimeout(function() {
       $(".code:not(.sameLine), code").each(function(i, elem) {
            let newText = elem.innerHTML.replace(/<br>/g, "\n")
            newText = newText.replace(/&gt;/g, ">")
            newText = newText.replace(/&lt;/g, "<")
            var MyCodeMirror = CodeMirror(function(mirror) {
                elem.parentNode.replaceChild(mirror, elem)
            }, {value: newText, readOnly: true, lineNumbers: true, viewportMargin: 0})
            hasRendered = true;
        })
        if(!hasRendered) { setTimeout(replaceCode, 100)}
    }, 10)
}
