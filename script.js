/* Reel Knotty Call/Text fallback.
 *
 * Some in-app browsers (e.g. the Muse share-frame WebView) cannot hand a
 * tel: or sms: link off to the phone app: tapping one navigates the
 * WebView itself to the sms:/tel: URL and shows a blank page. In a real
 * browser the links hand off fine.
 *
 * So every tel:/sms: link on this site is intercepted: instead of
 * navigating directly, we show an in-page card with the number and (for
 * texts) the pre-written message, each with a tap-to-copy button, plus a
 * best-effort "Open in dialer / Open in Messages" link that still tries
 * the original href. The card stays until dismissed — the visitor always
 * leaves with something usable.
 *
 * The original hrefs are never changed, so real browsers keep working
 * exactly as before.
 */
(function () {
  var PHONE_DISPLAY = '646-261-6400';

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function copyText(text, btn) {
    function done() {
      if (!btn) return;
      var orig = btn.getAttribute('data-label') || btn.textContent;
      btn.setAttribute('data-label', orig);
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = orig; }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        fallbackCopy(text);
        done();
      });
    } else {
      fallbackCopy(text);
      done();
    }
  }

  function messageFromSmsHref(href) {
    var m = href.match(/[?&]body=([^&]*)/);
    if (!m) return '';
    try {
      return decodeURIComponent(m[1].replace(/\+/g, ' '));
    } catch (e) {
      return '';
    }
  }

  var overlay = null;
  var lastFocus = null;

  function closeModal() {
    if (overlay) overlay.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function buildModal() {
    overlay = document.createElement('div');
    overlay.className = 'rk-modal-overlay';
    overlay.id = 'rk-contact-modal';
    overlay.hidden = true;

    var card = document.createElement('div');
    card.className = 'rk-modal';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'rk-modal-title');
    overlay.appendChild(card);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'rk-modal-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', closeModal);
    card.appendChild(closeBtn);

    var title = document.createElement('h2');
    title.id = 'rk-modal-title';
    card.appendChild(title);

    var sub = document.createElement('p');
    sub.className = 'rk-modal-sub';
    card.appendChild(sub);

    var numRow = document.createElement('div');
    numRow.className = 'rk-copy-row';
    var numVal = document.createElement('span');
    numVal.className = 'rk-copy-value';
    numVal.textContent = PHONE_DISPLAY;
    numRow.appendChild(numVal);
    var numBtn = document.createElement('button');
    numBtn.className = 'btn btn-primary rk-copy-btn';
    numBtn.type = 'button';
    numBtn.textContent = 'Copy number';
    numBtn.addEventListener('click', function () {
      copyText(PHONE_DISPLAY, numBtn);
    });
    numRow.appendChild(numBtn);
    card.appendChild(numRow);

    var msgRow = document.createElement('div');
    msgRow.className = 'rk-copy-row';
    var msgVal = document.createElement('span');
    msgVal.className = 'rk-copy-value';
    msgRow.appendChild(msgVal);
    var msgBtn = document.createElement('button');
    msgBtn.className = 'btn btn-primary rk-copy-btn';
    msgBtn.type = 'button';
    msgBtn.textContent = 'Copy message';
    msgBtn.addEventListener('click', function () {
      copyText(msgVal.textContent, msgBtn);
    });
    msgRow.appendChild(msgBtn);
    card.appendChild(msgRow);

    var openLink = document.createElement('a');
    openLink.className = 'btn btn-primary rk-open-link';
    openLink.setAttribute('data-rk-open', '1');
    card.appendChild(openLink);

    var note = document.createElement('p');
    note.className = 'rk-modal-note';
    card.appendChild(note);

    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) closeModal();
    });

    document.body.appendChild(overlay);

    return {
      title: title,
      sub: sub,
      msgRow: msgRow,
      msgVal: msgVal,
      openLink: openLink,
      note: note,
      closeBtn: closeBtn
    };
  }

  var parts = null;

  function showModal(kind, href) {
    if (!parts) parts = buildModal();
    lastFocus = document.activeElement;
    if (kind === 'sms') {
      var msg = messageFromSmsHref(href);
      parts.title.textContent = 'Text Reel Knotty';
      parts.sub.textContent = 'Copy the number and message below, then paste them into a new text — or try opening Messages directly.';
      parts.msgRow.style.display = '';
      parts.msgVal.textContent = msg;
      parts.openLink.textContent = 'Open in Messages';
      parts.openLink.href = href;
      parts.note.textContent = "If Messages doesn't open, copy the number and message above and text Rich yourself — he'll get back to you.";
    } else {
      parts.title.textContent = 'Call Reel Knotty';
      parts.sub.textContent = 'Tap below to call — or copy the number and dial it yourself.';
      parts.msgRow.style.display = 'none';
      parts.openLink.textContent = 'Open in dialer';
      parts.openLink.href = href;
      parts.note.textContent = "If the dialer doesn't open, copy the number above and call Rich yourself.";
    }
    overlay.hidden = false;
    parts.closeBtn.focus();
  }

  document.addEventListener('click', function (ev) {
    var link = ev.target && ev.target.closest
      ? ev.target.closest('a[href^="tel:"], a[href^="sms:"]')
      : null;
    if (!link) return;
    if (link.getAttribute('data-rk-open')) return; // modal's own open link
    ev.preventDefault();
    var href = link.getAttribute('href');
    showModal(href.indexOf('sms:') === 0 ? 'sms' : 'tel', href);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && overlay && !overlay.hidden) closeModal();
  });
})();
