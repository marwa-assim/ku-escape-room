/* Player-side kiosk hardening.
 * This supplements (but does not replace) Windows/Edge kiosk mode.
 * It does not alter game buttons or puzzle logic.
 */
(function () {
    'use strict';

    document.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    document.addEventListener('dragstart', function (event) { event.preventDefault(); });

    document.addEventListener('keydown', function (event) {
        const key = String(event.key || '').toLowerCase();
        const blockedFunctionKey = /^f(?:1|2|3|4|5|6|7|8|9|10|11|12)$/.test(key);
        const blockedCtrl = event.ctrlKey && ['l','n','o','p','r','s','t','u','w','+','-','0'].includes(key);
        const blockedAlt = event.altKey && ['left','right','home'].includes(key);
        const blockedBrowserKey = ['browserback','browserforward','browserrefresh','browserhome'].includes(key);

        if (blockedFunctionKey || blockedCtrl || blockedAlt || blockedBrowserKey) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, true);
})();
