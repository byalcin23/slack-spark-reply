/* Slack adapter: reads selected visible context and inserts drafts on explicit request.
   All controls and credentials live in the isolated extension-origin panel. */
(() => {
  "use strict";
  if (window.__sparkReplyLoaded) return;
  window.__sparkReplyLoaded = true;
  const DEMO = location.hostname === "127.0.0.1";
  const EDITORS = '[contenteditable="true"][data-slate-editor="true"], .ql-editor[contenteditable="true"], [contenteditable="true"][data-spark-composer]';
  const THREADS = '.p-thread_view, [data-qa="thread_view"], [data-spark-pane="thread"]';
  const MESSAGES = '[data-qa="message_container"], [data-feat="message"], .c-message_kit__background, .c-message_kit__message';
  const SENDERS = '[data-qa="message_sender_name"], [data-qa="message_sender"], .c-message__sender_button, .c-message__sender, .c-message_kit__sender, .c-message_kit__sender_name';
  // message_content is a layout wrapper in Slack: it can contain sender and time.
  const BODIES = '[data-qa="message-text"], [data-qa="message_text"], .c-message_kit__text, .p-rich_text_block, .p-rich_text_section';
  const BODY_FALLBACK = '[data-qa="message_content"], .c-message__body';
  const MESSAGE_CHROME = SENDERS + ', [data-qa="message_timestamp"], .c-timestamp, time, [data-qa="message_avatar"], .c-message_kit__avatar, .c-message__avatar, .c-message_kit__reactions, .c-message__actions, [data-qa="message_actions"]';
  const nonce = crypto.randomUUID();
  const panelURL = new URL(DEMO ? "/panel.html" : chrome.runtime.getURL("panel.html"), location.href);
  const panelOrigin = DEMO ? location.origin : "chrome-extension://" + chrome.runtime.id;
  const identities = new WeakMap();
  let identity = 0, editor = null, snapshot = null, frame = null, ready = false, opened = false;
  let revision = 0, scanScheduled = false, preferredHeight = 620, uiLanguage = "tr";
  const host = document.createElement("div");
  host.id = "spark-reply-companion";
  host.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;z-index:2147483646;";
  const shadow = host.attachShadow({mode: DEMO ? "open" : "closed"});
  shadow.innerHTML = `<style>
    :host{all:initial;color-scheme:normal}*{box-sizing:border-box}[hidden]{display:none!important}
    button{position:fixed;width:34px;height:34px;display:grid;place-items:center;padding:0;border:1px solid #b8a3ef;border-radius:11px;background:#bda5f5;color:#302044;box-shadow:0 3px 12px #0002;cursor:pointer;transition:transform .15s;z-index:1}button:hover{transform:translateY(-2px);background:#cebafa}button:focus-visible{outline:3px solid #7a58be;outline-offset:3px}button svg{width:20px;height:20px;pointer-events:none}
    iframe{position:fixed;display:block;border:1px solid #9382a655;border-radius:18px;box-shadow:0 18px 65px #0004;background:transparent;z-index:2;color-scheme:normal}
    @media(prefers-reduced-motion:reduce){button{transition:none}}
  </style><button hidden title="Spark Reply" aria-label="Spark Reply" aria-haspopup="dialog" aria-expanded="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7Z"/><path d="M20 2v4m-2-2h4"/></svg></button>`;
  document.documentElement.append(host);
  const orb = shadow.querySelector("button");

  function visible(element) {
    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth && style.visibility !== "hidden" && style.display !== "none" && !element.closest('[aria-hidden="true"]');
  }
  function editorText(target) { return (target.innerText || target.textContent || "").trim(); }
  function memberId(node, deep = true) {
    if (!node) return "";
    for (const element of [node, ...(deep ? node.querySelectorAll('[data-member-id], [data-user-id]') : [])]) {
      const value = element.getAttribute("data-member-id") || element.getAttribute("data-user-id") || "";
      if (/^[UW][A-Z0-9]+$/.test(value)) return value;
    }
    return "";
  }
  function currentUser() {
    // Read only the account control, never a conversation header or another person's profile.
    const button = [...document.querySelectorAll('[data-qa="user-button"], [data-qa="user_menu_button"], [data-qa="user-menu-button"], .p-ia__nav__user__button, .p-ia4_user_button')].find(visible);
    if (!button) return null;
    const image = button.querySelector('img[alt]');
    const candidates = [image?.getAttribute("alt"), button.querySelector('[data-qa="user_name"]')?.textContent, button.getAttribute("aria-label"), button.getAttribute("title")];
    const name = candidates.map(value => (value || "").trim()).find(value => value && value.length <= 150 && !/^(avatar|profile|user|you|profil|sen|account|open|view|preferences|status|active|away|set|hesap|menü)(\s|$)/i.test(value)) || "";
    const id = memberId(button);
    // Generic avatar labels are not a person's identity.
    const display_name = /^(avatar|profile|user|you|profil|sen)(\s|$)/i.test(name) ? "" : name;
    return id || display_name ? {id, display_name, source:"slack_account"} : null;
  }
  function collectMessages(target) {
    const thread = target.closest(THREADS);
    let scope = thread;
    if (!scope) {
      for (let parent = target.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if ([...parent.querySelectorAll(MESSAGES)].some(item => !item.closest(THREADS))) { scope = parent; break; }
      }
    }
    if (!scope) return [];
    // One outer row per message: nested Slack wrappers must not split author/body.
    const all = [...scope.querySelectorAll(MESSAGES)].filter(item => (thread ? item.closest(THREADS) === thread : !item.closest(THREADS)));
    const rows = all.filter(item => !all.some(other => other !== item && other.contains(item)));
    const nameById = new Map(), ambiguous = new Set();
    function rowSender(item) {
      const sender = [...item.querySelectorAll(SENDERS)].find(node => !node.closest(BODIES));
      const avatar = item.querySelector('[data-qa="message_avatar"], .c-message_kit__avatar, .c-message__avatar');
      const author = (sender?.innerText || sender?.textContent || sender?.getAttribute("aria-label") || "").trim().slice(0,150);
      return {author, author_id:memberId(sender) || memberId(avatar) || memberId(item, false)};
    }
    for (const row of rows) {
      const {author,author_id} = rowSender(row);
      if (!author || !author_id) continue;
      if (nameById.has(author_id) && nameById.get(author_id) !== author) ambiguous.add(author_id);
      nameById.set(author_id,author);
    }
    const result = [];
    let previous = null;
    for (const item of rows) {
      const style = getComputedStyle(item);
      if (!item.getClientRects().length || style.display === "none" || style.visibility === "hidden" || item.closest('[aria-hidden="true"]')) { previous = null; continue; }
      let nodes = [...item.querySelectorAll(BODIES)];
      const fallback = !nodes.length;
      if (fallback) nodes = [...item.querySelectorAll(BODY_FALLBACK)];
      const bodies = nodes.filter(node => !nodes.some(other => other !== node && other.contains(node)));
      const text = bodies.map(node => {
        if (!fallback) return (node.innerText || node.textContent || "").trim();
        const copy = node.cloneNode(true);
        copy.querySelectorAll(MESSAGE_CHROME).forEach(element => element.remove());
        return (copy.textContent || "").trim();
      }).filter(Boolean).join("\n");
      let {author,author_id} = rowSender(item);
      if (!author && author_id && !ambiguous.has(author_id)) author = nameById.get(author_id) || "";
      const compact = (!item.querySelector('[data-qa="message_avatar"], .c-message_kit__avatar, .c-message__avatar') && !!item.querySelector('[data-qa="message_timestamp"], .c-timestamp') && !!item.querySelector('[data-qa="message_content"]')) || item.matches('.c-message_kit__message--group_middle, .c-message_kit__message--group_end, .c-message_kit__message--compact, .c-message--light') || !!item.querySelector('.c-message_kit__message--group_middle, .c-message_kit__message--group_end, .c-message_kit__message--compact, .c-message--light');
      // Only inherit a known sender on an explicitly compact consecutive row.
      // A divider, unknown full message, other ID, or another list breaks the chain.
      const list = item.closest('[data-qa="virtual-list"], .c-virtual_list__scroll_container, [role="list"]') || item.parentElement;
      const between = previous ? document.createRange() : null;
      let divider = false;
      if (between) {
        between.setStartAfter(previous.row); between.setEndBefore(item);
        divider = !!between.cloneContents().querySelector('[role="separator"], .c-message_list__day_divider, [data-qa="date_separator"]');
      }
      if (!author && compact && previous?.author && previous.list === list && !divider && (!author_id || author_id === previous.author_id)) {
        author = previous.author; author_id = author_id || previous.author_id;
      }
      previous = text && author ? {row:item,list,author,author_id} : null;
      if (text && visible(item)) result.push({author:author || "Unknown speaker",author_id,text:text.slice(0,2500)});
    }
    let remaining = 9500;
    return result.slice(-12).reverse().filter(item => { if (item.text.length > remaining) return false; remaining -= item.text.length; return true; }).reverse();
  }
  function send(type, data = {}) {
    if (ready && frame?.contentWindow) frame.contentWindow.postMessage({source:"spark-host",nonce,type,...data}, panelOrigin);
  }
  function capture() {
    if (!editor?.isConnected) return;
    if (!identities.has(editor)) identities.set(editor, ++identity);
    const draft = editorText(editor);
    snapshot = {editor,draft,url:location.href,revision:++revision};
    send("context", {context:{id:identities.get(editor)+":"+location.href, revision, workspace:location.pathname.split("/")[2] || location.host, current_user:currentUser(), messages:collectMessages(editor),draft}});
  }
  function ensureFrame() {
    if (frame) return;
    frame = document.createElement("iframe");
    frame.title = "Spark Reply";
    frame.setAttribute("allow", "clipboard-write");
    frame.referrerPolicy = "no-referrer";
    panelURL.searchParams.set("embedded", "1");
    panelURL.searchParams.set("parentOrigin", location.origin);
    panelURL.hash = "nonce=" + encodeURIComponent(nonce);
    frame.src = panelURL.href;
    shadow.append(frame);
  }
  function place() {
    if (!editor?.isConnected || !visible(editor)) { orb.hidden = true; if (opened) close(); return; }
    const box = editor.getBoundingClientRect();
    const x = Math.max(10,Math.min(innerWidth-44,box.right-46));
    const y = Math.max(10,Math.min(innerHeight-44,box.top-39));
    orb.hidden = false; orb.style.left=x+"px"; orb.style.top=y+"px";
    if (opened && frame) {
      const width=Math.min(420,innerWidth-20), height=Math.min(preferredHeight,innerHeight-24);
      frame.style.width=width+"px"; frame.style.height=height+"px";
      frame.style.left=Math.max(10,Math.min(x+34-width,innerWidth-width-10))+"px";
      frame.style.top=(y-height-9>=12 ? y-height-9 : Math.max(12,Math.min(y+43,innerHeight-height-12)))+"px";
    }
  }
  function open(target = editor) {
    if (!target?.isConnected) return;
    editor=target; opened=true; ensureFrame(); frame.hidden=false;
    orb.setAttribute("aria-expanded","true"); place();
    if (ready) { capture(); send("visibility",{visible:true}); }
  }
  function close(restoreFocus = false) {
    opened=false; send("visibility",{visible:false}); snapshot=null;
    if (frame) frame.hidden=true;
    orb.setAttribute("aria-expanded","false");
    if (restoreFocus && editor?.isConnected) editor.focus();
  }
  function insertReply(text, expectedRevision) {
    if (!opened || !snapshot || expectedRevision!==snapshot.revision || editor!==snapshot.editor || !editor.isConnected || location.href!==snapshot.url || editorText(editor)!==snapshot.draft) return {ok:false,error:"DRAFT_CHANGED"};
    if (typeof text!=="string" || !text.trim() || text.length>4000) return {ok:false,error:"INVALID_REPLY"};
    editor.focus();
    const range=document.createRange(); range.selectNodeContents(editor);
    const selection=window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    const inserted=document.execCommand("insertText",false,text);
    if (!inserted || editorText(editor)!==text.trim()) return {ok:false,error:"INSERT_FAILED"};
    snapshot.draft=editorText(editor);
    return {ok:true};
  }
  function handlePanelMessage(event) {
    const data=event.data;
    if (!frame || event.source!==frame.contentWindow || event.origin!==panelOrigin || !data || data.source!=="spark-panel" || data.nonce!==nonce) return;
    if (data.type==="ready") { ready=true; if(opened){capture();send("visibility",{visible:true});} return; }
    if (data.type==="resize" && Number.isFinite(data.height)) {preferredHeight=Math.max(300,Math.min(760,data.height));place();return;}
    if (data.type==="appearance") {
      uiLanguage=data.ui_language==="en"?"en":"tr";
      orb.title=uiLanguage==="tr"?"Spark Reply — Cevap öner":"Spark Reply — Suggest replies"; orb.setAttribute("aria-label",orb.title);return;
    }
    if (!opened) return;
    if (data.type==="close") close(true);
    else if (data.type==="refresh") capture();
    else if (data.type==="insert") {
      const result=insertReply(data.text,data.revision);
      send("insert-result",{requestId:data.requestId,...result});
    }
  }
  function scan() {
    scanScheduled=false;
    const editors=[...document.querySelectorAll(EDITORS)].filter(visible);
    if (editor && (!editor.isConnected || !editors.includes(editor))) {close();editor=null;}
    if(!editor) editor=editors[0]||null;
    if(snapshot && snapshot.url!==location.href) close();
    if(editor)place();else orb.hidden=true;
  }
  function scheduleScan(){if(!scanScheduled){scanScheduled=true;setTimeout(scan,120);}}
  document.addEventListener("focusin",event=>{
    const target=event.target instanceof Element?event.target.closest(EDITORS):null;
    if(target&&target!==editor){close();editor=target;place();}
  });
  orb.addEventListener("click",()=>opened?close():open());
  document.addEventListener("pointerdown",event=>{if(opened&&!event.composedPath().includes(host))close();},true);
  addEventListener("message",handlePanelMessage);
  addEventListener("resize",place);
  addEventListener("scroll",place,{capture:true,passive:true});
  new MutationObserver(scheduleScan).observe(document.body,{childList:true,subtree:true});
  scan();
  if(DEMO) window.SlackSparkTest={currentUser,collectMessages,open,close,insertReply,shadow,place,scan,capture,get frame(){return frame;},get revision(){return revision;},get opened(){return opened;},handlePanelMessage};
})();
