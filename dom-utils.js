(function(window) {
    function getEl(id) {
        const el = document.getElementById(id);
        if (!el) {
            console.error(`Element with ID "${id}" not found.`);
        }
        return el;
    }

    function addEvent(id, event, handler) {
        const el = getEl(id);
        if (el) {
            el.addEventListener(event, handler);
        }
    }

    window.domUtils = { getEl, addEvent };
})(window);
