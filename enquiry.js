/* Radken Consolidated: enquiry capture + notifications, shared by every page.
   Every WhatsApp or email button first asks for the client's name, email and WhatsApp
   number (once per visit), emails Kenny a copy (cc the division's contact) through
   FormSubmit (free, no server), then carries on to WhatsApp/email as before.
   Request forms on division pages call radkenNotify() themselves on submit.
   Usage: <script src="enquiry.js" data-division="Radken Graphics"></script> */
(function(){
  var NOTIFY_TO = 'kennyrodgers36@outlook.com';
  var me = document.currentScript;
  var DIVISION = (me && me.getAttribute('data-division')) || 'Radken Consolidated';
  var EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  window.EMAIL_OK = EMAIL_OK;

  function sw(){ return document.documentElement.lang === 'sw'; }
  function T(en, s){ return sw() ? s : en; }

  /* Division contact to copy in: the clicked card's email, else the page's current contact */
  function ccFor(a){
    var card = a && a.closest('.card'), m = card && card.querySelector('a[href^="mailto:"]');
    var e = m ? m.getAttribute('href').slice(7).split('?')[0] : '';
    if(!e && window.CONTACTS && window.CTRY && CONTACTS[CTRY]) e = CONTACTS[CTRY].email;
    return e && e.toLowerCase() !== NOTIFY_TO ? e : '';
  }

  function notify(subject, data, cc){
    var body = Object.assign({
      _subject: DIVISION + ' enquiry: ' + subject,
      _template: 'table', _captcha: 'false',
      division: DIVISION, page: location.href
    }, data);
    cc = cc === undefined ? ccFor(null) : cc;
    if(cc) body._cc = cc;
    try{
      fetch('https://formsubmit.co/ajax/' + NOTIFY_TO, {method:'POST',
        headers:{'Content-Type':'application/json', Accept:'application/json'},
        body: JSON.stringify(body), keepalive:true}).catch(function(){});
    }catch(e){}
  }
  window.radkenNotify = notify;

  /* ---- the "how to reach you" box ---- */
  var css = '.enq{border:1px solid var(--line,#D9E1E8);border-radius:14px;padding:0;max-width:420px;width:calc(100% - 32px);background:var(--surface,#fff);color:var(--fg,#13233A)}' +
    '.enq::backdrop{background:rgba(5,15,30,.55)}' +
    '.enq form{display:grid;gap:12px;padding:22px 20px;font-family:var(--body,system-ui,sans-serif)}' +
    '.enq h3{font-family:var(--display,inherit);font-size:21px;margin:0;line-height:1.15}' +
    '.enq-sub{color:var(--muted,#55657A);font-size:14px;margin:-6px 0 0}' +
    '.enq label{display:grid;gap:4px;font-size:14px;font-weight:600}' +
    '.enq input,.enq textarea{font:inherit;font-weight:400;font-size:15px;padding:10px 12px;border:1px solid var(--line,#D9E1E8);border-radius:8px;background:var(--bg,#F5F8FA);color:var(--fg,#13233A);width:100%;box-sizing:border-box}' +
    '.enq-err{color:#C0392B;font-size:14px;margin:0}' +
    '.enq-acts{display:flex;gap:10px;flex-wrap:wrap}' +
    '.enq-acts button{font:inherit;font-weight:600;font-size:15px;padding:12px 20px;border-radius:6px;cursor:pointer;border:1.5px solid var(--line,#D9E1E8);background:var(--surface,#fff);color:var(--fg,#13233A)}' +
    '.enq-acts .enq-go{background:var(--teal-bright,var(--teal,#0E9E84));border-color:transparent;color:var(--on-accent,#03213A)}';

  function build(){
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var d = document.createElement('dialog'); d.className = 'enq'; d.id = 'enq';
    d.innerHTML = '<form method="dialog" novalidate><h3></h3><p class="enq-sub"></p>' +
      '<label><span data-k="name"></span><input name="name" type="text" autocomplete="name"></label>' +
      '<label><span data-k="email"></span><input name="email" type="email" autocomplete="email" placeholder="name@example.com"></label>' +
      '<label><span data-k="wa"></span><input name="whatsapp" type="tel" autocomplete="tel" placeholder="0712 345 678"></label>' +
      '<label><span data-k="need"></span><textarea name="need" rows="3"></textarea></label>' +
      '<p class="enq-err" hidden></p>' +
      '<div class="enq-acts"><button class="enq-go" type="submit"></button><button type="button" class="enq-no"></button></div></form>';
    document.body.appendChild(d);
    return d;
  }

  function words(d){
    d.querySelector('h3').textContent = T('Tell us how to reach you', 'Tuambie jinsi ya kukufikia');
    d.querySelector('.enq-sub').textContent = T("We'll reply on WhatsApp or email.", 'Tutakujibu kwa WhatsApp au barua pepe.');
    var L = {name:['Your name','Jina lako'], email:['Email address','Barua pepe'], wa:['WhatsApp number','Namba ya WhatsApp'], need:['What do you need? (optional)','Unahitaji nini? (si lazima)']};
    [].forEach.call(d.querySelectorAll('[data-k]'), function(s){ var w = L[s.getAttribute('data-k')]; s.textContent = T(w[0], w[1]); });
    d.querySelector('.enq-go').textContent = T('Continue', 'Endelea');
    d.querySelector('.enq-no').textContent = T('Cancel', 'Ghairi');
  }

  function label(a){
    var box = a.closest('.more-card,.row,.card'), h = box && box.querySelector('h3,b');
    return h ? h.textContent.trim() : (a.href.indexOf('mailto:') === 0 ? 'Email button' : 'WhatsApp chat');
  }

  function init(){
    var dlg = build(); if(!dlg.showModal) return; /* very old browsers: links work as before */
    var f = dlg.querySelector('form'), err = dlg.querySelector('.enq-err'), pending = null, known = null;
    try{ known = JSON.parse(sessionStorage.getItem('radken-enq') || 'null'); }catch(e){}

    function go(a){
      var href = a.href, d = known || {};
      if(d.name && href.indexOf('wa.me/') > -1){
        var u = new URL(href);
        var msg = (u.searchParams.get('text') || '') + '\n\nName: ' + d.name + '\nEmail: ' + d.email + '\nWhatsApp: ' + d.whatsapp + (d.need ? '\nNeed: ' + d.need : '');
        u.searchParams.set('text', msg.trim()); href = u.toString();
      }
      if(href.indexOf('mailto:') === 0) location.href = href; else window.open(href, '_blank', 'noopener');
    }

    document.addEventListener('click', function(e){
      var a = e.target.closest('a[href*="wa.me/"],a[href^="mailto:"]');
      if(!a || a.closest('#rq-done')) return; /* request-form results already sent their own notification */
      e.preventDefault();
      pending = {a:a, what:label(a), cc:ccFor(a)};
      if(known){ notify(pending.what, Object.assign({service:pending.what}, known), pending.cc); go(a); return; }
      words(dlg); err.hidden = true; dlg.showModal(); f.elements.name.focus();
    });
    dlg.querySelector('.enq-no').addEventListener('click', function(){ dlg.close(); });
    f.addEventListener('submit', function(e){
      e.preventDefault();
      var d = {name:f.elements.name.value.trim(), email:f.elements.email.value.trim(), whatsapp:f.elements.whatsapp.value.trim(), need:f.elements.need.value.trim()};
      var msg = !d.name ? T('Please enter your name', 'Tafadhali andika jina lako')
        : !EMAIL_OK.test(d.email) ? T('Please enter a valid email address', 'Tafadhali andika barua pepe sahihi')
        : d.whatsapp.replace(/\D/g, '').length < 9 ? T('Please enter a valid WhatsApp number', 'Tafadhali andika namba ya WhatsApp sahihi') : '';
      if(msg){ err.textContent = msg; err.hidden = false; return; }
      known = d; try{ sessionStorage.setItem('radken-enq', JSON.stringify(d)); }catch(e){}
      notify(pending.what, Object.assign({service:pending.what}, d), pending.cc);
      dlg.close(); go(pending.a);
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
