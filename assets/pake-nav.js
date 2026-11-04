/* ============================================================
 * Pake 导航增强脚本 v2（后退 / 前进 / 刷新 / 回首页）
 * 不再依赖 Tauri invoke，纯浏览器历史 + 三重兜底
 * ============================================================ */
(function () {
  'use strict';

  var GUARD = '__pakeNavInstalledV2__';
  if (window[GUARD]) return;
  window[GUARD] = true;

  /* ---------------- 基础：首页地址与自管访问栈 ---------------- */

  var HOME = location.href.split('#')[0];
  var STACK_KEY = '__pakeNavStackV2__';

  function readStack() {
    try {
      var raw = sessionStorage.getItem(STACK_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(arr) === '[object Array]' ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeStack(arr) {
    try {
      sessionStorage.setItem(STACK_KEY, JSON.stringify(arr.slice(-60)));
    } catch (e) {
      /* 忽略 */
    }
  }

  function pushHash(h) {
    var s = readStack();
    if (s[s.length - 1] === h) return;
    s.push(h);
    writeStack(s);
  }

  pushHash(location.hash);
  window.addEventListener('hashchange', function () {
    pushHash(location.hash);
  });

  /* ---------------- 1. 同源 window.open 改为同窗导航 ---------------- */

  var nativeOpen = window.open;

  function resolveInternal(raw) {
    if (!raw) return null;
    try {
      var abs = new URL(String(raw), location.href);
      if (abs.origin !== location.origin) return null;
      if (
        abs.pathname === location.pathname &&
        abs.search === location.search &&
        abs.hash
      ) {
        return abs.hash;
      }
      return abs.href;
    } catch (e) {
      return null;
    }
  }

  function goSame(url) {
    var target = resolveInternal(url);
    if (!target) return false;
    if (target.charAt(0) === '#') {
      if (location.hash === target) {
        try {
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        } catch (e) {
          window.dispatchEvent(new Event('hashchange'));
        }
      } else {
        location.hash = target;
      }
    } else {
      location.href = target;
    }
    return true;
  }

  window.open = function (url) {
    if (goSame(url)) return window;
    return nativeOpen.apply(window, arguments);
  };

  /* ---------------- 2. 同源 _blank 链接改同窗 ---------------- */

  document.addEventListener(
    'click',
    function (e) {
      var el = e.target;
      if (!el || !el.closest) return;
      var a = el.closest('a[href]');
      if (!a) return;
      if (a.target !== '_blank' && a.target !== '_new') return;
      if (goSame(a.getAttribute('href'))) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  /* ---------------- 3. 导航：纯浏览器历史 + 三重兜底 ---------------- */

  function fallbackBack() {
    var s = readStack();
    if (s.length >= 2) {
      s.pop();
      var prev = s[s.length - 1];
      writeStack(s);
      if (prev !== undefined && prev !== location.hash) {
        location.hash = prev;
        return;
      }
    }
    location.replace(HOME);
  }

  function goBack() {
    var before = location.href;

    if (window.history.length > 1) {
      window.history.back();
      setTimeout(function () {
        if (location.href === before) fallbackBack();
      }, 350);
      return;
    }

    fallbackBack();
  }

  function goForward() {
    if (window.history.length > 1) window.history.forward();
  }

  function reload() {
    location.reload();
  }

  /* ---------------- 4. 悬浮按钮（Shadow DOM 隔离） ---------------- */

  var host = null;

  var ICON = {
    back:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    forward:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
    reload:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 3.5v5.5H15"/></svg>',
    home:
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/></svg>'
  };

  function build() {
    if (host && host.isConnected) return;
    if (!document.body) return;

    host = document.createElement('div');
    host.id = 'pake-nav-host';
    host.setAttribute(
      'style',
      'position:fixed;left:14px;bottom:24px;z-index:2147483647;margin:0;padding:0;border:0;background:transparent;'
    );

    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>' +
      '.wrap{display:flex;flex-direction:column;gap:8px;opacity:.4;transition:opacity .18s ease;}' +
      '.wrap:hover{opacity:1;}' +
      'button{width:38px;height:38px;box-sizing:border-box;padding:0;border-radius:50%;' +
      'border:1px solid rgba(255,255,255,.4);background:rgba(28,30,36,.74);color:#fff;' +
      'display:flex;align-items:center;justify-content:center;cursor:pointer;' +
      'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
      'box-shadow:0 2px 10px rgba(0,0,0,.3);transition:background .15s ease,transform .1s ease;' +
      'font-size:0;line-height:0;-webkit-appearance:none;outline:none;}' +
      'button:hover{background:rgba(52,56,66,.96);}' +
      'button:active{transform:scale(.9);}' +
      'button svg{display:block;pointer-events:none;}' +
      '</style>' +
      '<div class="wrap">' +
      '<button data-act="back" title="后退 (Alt+左 或 Ctrl+[)">' + ICON.back + '</button>' +
      '<button data-act="forward" title="前进 (Alt+右 或 Ctrl+])">' + ICON.forward + '</button>' +
      '<button data-act="home" title="回到首页">' + ICON.home + '</button>' +
      '<button data-act="reload" title="刷新 (Ctrl+R)">' + ICON.reload + '</button>' +
      '</div>';

    var stop = function (e) {
      e.stopPropagation();
    };
    root.addEventListener('pointerdown', stop, true);
    root.addEventListener('mousedown', stop, true);
    root.addEventListener(
      'click',
      function (e) {
        e.stopPropagation();
        var t = e.target;
        var btn = t && t.closest ? t.closest('button[data-act]') : null;
        if (!btn) return;
        var act = btn.getAttribute('data-act');
        if (act === 'back') goBack();
        else if (act === 'forward') goForward();
        else if (act === 'home') location.href = HOME;
        else if (act === 'reload') reload();
      },
      true
    );

    document.body.appendChild(host);
  }

  setInterval(function () {
    if (!host || !host.isConnected) build();
  }, 1200);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

  /* ---------------- 5. 快捷键兜底 ---------------- */

  document.addEventListener(
    'keydown',
    function (e) {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
      }
    },
    true
  );
})();
