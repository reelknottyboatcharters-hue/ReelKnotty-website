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

  /* The static sms: links use the Android form (?body=). iOS requires
   * &body= instead, so rewrite the separator at load time on iOS.
   * The "?&body=" form used previously is malformed and fails to hand
   * off in Chrome — it must not come back. */
  function rewriteSmsSeparators() {
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIOS) return;
    var links = document.querySelectorAll('a[href^="sms:"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (href && href.indexOf('?body=') !== -1) {
        links[i].setAttribute('href', href.replace('?body=', '&body='));
      }
    }
  }
  rewriteSmsSeparators();

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


/* Booking form + availability calendar (booking.html only). No backend:
 * the form builds the pre-written text from the visitor's choices and
 * updates the Text button's sms: link. The shared click interceptor
 * above shows the copy-fallback card for the tap, so a failed hand-off
 * still leaves the visitor with the copied message.
 *
 * Availability: taken dates come from booked-dates.json (YYYY-MM-DD).
 * Mondays, Tuesdays and Thursdays are never bookable — Rich teaches
 * those days — year-round. The calendar covers the 2027 season
 * (Jan–Dec 2027) and the date picker is limited to 2027 too. */
(function () {
  var form = document.getElementById('booking-form');
  if (!form) return;

  var BASE = 850, WAGYU = 200, DEPOSIT = 200;
  var SEASON_START = '2027-01-01', SEASON_END = '2027-12-31';
  var CLOSED_WEEKDAYS = [1, 2, 4]; // Mon, Tue, Thu — Rich teaches
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var dateInput = document.getElementById('bk-date');
  var guestsSel = document.getElementById('bk-guests');
  var wagyuBox = document.getElementById('bk-wagyu');
  var textBtn = document.getElementById('bk-text');
  var hint = document.getElementById('bk-hint');
  var sumDate = document.getElementById('sum-date');
  var sumGuests = document.getElementById('sum-guests');
  var sumWagyu = document.getElementById('sum-wagyu');
  var sumTotal = document.getElementById('sum-total');
  var sumDeposit = document.getElementById('sum-deposit');
  var grid = document.getElementById('cal-grid');
  var calTitle = document.getElementById('cal-title');
  var prevBtn = document.getElementById('cal-prev');
  var nextBtn = document.getElementById('cal-next');
  var calHint = document.getElementById('cal-hint');

  var taken = {}; // ISO date -> true, loaded from booked-dates.json
  var lastValid = '';
  var viewYear = 2027, viewMonth = 0; // January 2027

  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function money(n) { return '$' + n.toLocaleString('en-US'); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function isoOf(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function longDate(value) {
    if (!value) return '';
    return parseISO(value).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function isClosedWeekday(iso) {
    return CLOSED_WEEKDAYS.indexOf(parseISO(iso).getDay()) !== -1;
  }
  function isTaken(iso) { return !!taken[iso]; }
  function isPast(iso) { return iso < todayISO(); }

  /* '' means bookable; otherwise the reason it is not. */
  function bookableReason(iso) {
    if (!iso) return 'Pick a date.';
    if (iso < SEASON_START || iso > SEASON_END) return 'Bookings are for the 2027 season — pick a date in 2027.';
    if (isPast(iso)) return 'That date has already passed.';
    if (isTaken(iso)) return 'That date is already booked — pick another day.';
    if (isClosedWeekday(iso)) return "Rich doesn't run charters on Mondays, Tuesdays, or Thursdays — pick another day.";
    return '';
  }

  function buildMessage() {
    var lines = ["Hi Rich \u2014 I'd like to book a Reel Knotty Beach Charter."];
    lines.push('Date: ' + longDate(dateInput.value));
    var g = parseInt(guestsSel.value, 10);
    lines.push('Guests: ' + g);
    if (wagyuBox.checked) lines.push('Wagyu package: Added (+$200)');
    var total = BASE + (wagyuBox.checked ? WAGYU : 0);
    lines.push('Price: ' + money(total));
    lines.push('$200 deposit holds your date.');
    return lines.join('\n');
  }

  function smsHref(msg) {
    var href = 'sms:+16462616400?body=' + encodeURIComponent(msg);
    if (isIOS) href = href.replace('?body=', '&body=');
    return href;
  }

  function update() {
    var hasDate = !!dateInput.value;
    var g = parseInt(guestsSel.value, 10);
    var wagyu = wagyuBox.checked;
    var total = BASE + (wagyu ? WAGYU : 0);
    var due = total - DEPOSIT;
    sumDate.textContent = hasDate ? longDate(dateInput.value) : 'Pick a date';
    sumGuests.textContent = g + (g === 1 ? ' person' : ' people');
    sumWagyu.textContent = wagyu ? 'Added (+$200)' : 'Not added';
    sumTotal.textContent = money(total);
    sumDeposit.textContent = '$200 deposit holds your date \u00b7 ' + money(due) + ' due at the charter';
    if (hasDate) {
      textBtn.setAttribute('href', smsHref(buildMessage()));
      textBtn.classList.remove('disabled');
      textBtn.removeAttribute('aria-disabled');
    } else {
      textBtn.classList.add('disabled');
      textBtn.setAttribute('aria-disabled', 'true');
    }
  }

  function onDateChange() {
    var v = dateInput.value;
    var reason = bookableReason(v);
    if (reason) {
      dateInput.value = lastValid;
      hint.textContent = reason;
      update();
      renderCalendar();
      return;
    }
    lastValid = v;
    hint.textContent = 'Your text includes your date, guests, and price.';
    update();
    renderCalendar();
  }

  function onDayClick(ev) {
    var btn = (ev && ev.currentTarget) || this;
    var iso = btn.getAttribute('data-date');
    var reason = bookableReason(iso);
    if (reason) {
      calHint.textContent = reason;
      return;
    }
    lastValid = iso;
    dateInput.value = iso;
    calHint.textContent = '';
    hint.textContent = 'Your text includes your date, guests, and price.';
    update();
    renderCalendar();
  }

  function renderCalendar() {
    calTitle.textContent = MONTHS[viewMonth] + ' ' + viewYear;
    prevBtn.disabled = (viewYear === 2027 && viewMonth === 0);
    nextBtn.disabled = (viewYear === 2027 && viewMonth === 11);
    grid.innerHTML = '';
    var i, d;
    for (i = 0; i < 7; i++) {
      var h = document.createElement('div');
      h.className = 'cal-dow';
      h.textContent = DOW[i];
      grid.appendChild(h);
    }
    var firstDow = new Date(viewYear, viewMonth, 1).getDay();
    var days = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (i = 0; i < firstDow; i++) {
      var blank = document.createElement('div');
      blank.className = 'cal-day cal-blank';
      grid.appendChild(blank);
    }
    for (d = 1; d <= days; d++) {
      var iso = isoOf(viewYear, viewMonth, d);
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-day';
      cell.setAttribute('data-date', iso);
      var num = document.createElement('span');
      num.className = 'cal-num';
      num.textContent = d;
      cell.appendChild(num);
      var reason = bookableReason(iso);
      if (isTaken(iso)) {
        cell.classList.add('taken');
        var tag1 = document.createElement('span');
        tag1.className = 'cal-tag';
        tag1.textContent = 'Booked';
        cell.appendChild(tag1);
      } else if (isClosedWeekday(iso)) {
        cell.classList.add('closed');
        var tag2 = document.createElement('span');
        tag2.className = 'cal-tag';
        tag2.textContent = 'Closed';
        cell.appendChild(tag2);
      } else if (isPast(iso)) {
        cell.classList.add('past');
      } else {
        cell.classList.add('open');
      }
      if (iso === dateInput.value) cell.classList.add('selected');
      cell.title = reason || ('Book ' + longDate(iso));
      cell.addEventListener('click', onDayClick);
      grid.appendChild(cell);
    }
  }

  function loadTaken() {
    try {
      if (typeof fetch === 'undefined') { renderCalendar(); return; }
      fetch('booked-dates.json').then(function (r) { return r.json(); }).then(function (data) {
        (data.taken || []).forEach(function (d) { taken[d] = true; });
        renderCalendar();
      }).catch(function () { renderCalendar(); });
    } catch (e) { renderCalendar(); }
  }

  /* Guard runs at the target (before the document-level interceptor),
   * so a dateless tap never reaches the modal. */
  textBtn.addEventListener('click', function (ev) {
    if (!dateInput.value) {
      ev.preventDefault();
      ev.stopPropagation();
      dateInput.focus();
    }
  });

  prevBtn.addEventListener('click', function () {
    if (viewYear === 2027 && viewMonth === 0) return;
    if (viewMonth === 0) { viewMonth = 11; viewYear--; } else { viewMonth--; }
    renderCalendar();
  });
  nextBtn.addEventListener('click', function () {
    if (viewYear === 2027 && viewMonth === 11) return;
    if (viewMonth === 11) { viewMonth = 0; viewYear++; } else { viewMonth++; }
    renderCalendar();
  });

  dateInput.min = SEASON_START;
  dateInput.max = SEASON_END;
  dateInput.addEventListener('change', onDateChange);
  guestsSel.addEventListener('change', update);
  wagyuBox.addEventListener('change', update);
  update();
  renderCalendar();
  loadTaken();
})();

/* Tap-to-copy buttons: any element with a data-copy attribute copies
 * that value to the clipboard (with a textarea fallback), and briefly
 * shows "Copied!". Used by the Zelle number on the booking page. */
(function () {
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
  var btns = document.querySelectorAll('[data-copy]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function () {
      var text = this.getAttribute('data-copy');
      var btn = this;
      function done() {
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
    });
  }
})();
