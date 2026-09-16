/* The extension-owned document keeps typed instructions and API credentials
 * outside Slack's DOM and keyboard event handlers. No remote code is loaded. */
(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const LOCAL = ["127.0.0.1", "localhost"].includes(location.hostname);
  const embedded = new URLSearchParams(location.search).get("embedded") === "1";
  const nonce = new URLSearchParams(location.hash.slice(1)).get("nonce") || "";
  const params = new URLSearchParams(location.search);
  let parentOrigin = "";
  try {
    const candidate = params.get("parentOrigin") || new URL(document.referrer).origin;
    const url = new URL(candidate);
    if (url.origin === "https://app.slack.com" || (LOCAL && ["127.0.0.1", "localhost"].includes(url.hostname) && url.protocol === "http:")) parentOrigin = url.origin;
  } catch (_) { /* A toolbar popup has no host document. */ }
  const icons = {
    spark: '<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3z"/><path d="M19 3v4M17 5h4"/>',
    translate: '<path d="M3 5h11M8 3v2M5 5c0 5 4 8 8 9M12 5c0 5-4 8-8 9M13 21l4-10 4 10M14.5 17h5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    moon: '<path d="M20.5 14A8.7 8.7 0 0110 3.5 9 9 0 1020.5 14z"/>',
    computer: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    settings: '<path d="M9.5 4.2L10 2h4l.5 2.2 1.7 1 2.2-.7 2 3.5-1.7 1.5v2l1.7 1.5-2 3.5-2.2-.7-1.7 1L14 20h-4l-.5-2.2-1.7-1-2.2.7-2-3.5L5.3 12v-2L3.6 8.5l2-3.5 2.2.7z"/><circle cx="12" cy="11" r="3"/>',
    conversation: '<path d="M21 11a8 8 0 01-8 8H5l-3 3V11a8 8 0 018-8h3a8 8 0 018 8z"/><path d="M7 9h9M7 13h6"/>',
    chevron: '<path d="M7 10l5 5 5-5"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5M5.5 7a8 8 0 0113-1L20 8M4 16l1.5 2a8 8 0 0013-1"/>',
    shield: '<path d="M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    link: '<path d="M10 14l4-4M8 16l-1 1a4.3 4.3 0 01-6-6l4-4a4.3 4.3 0 016 0M16 8l1-1a4.3 4.3 0 016 6l-4 4a4.3 4.3 0 01-6 0" transform="translate(0 -1)"/>',
    globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
    check: '<path d="M5 12l4 4L19 6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18M10 5.2c.6-.1 1.3-.2 2-.2 6.5 0 10 7 10 7a19 19 0 01-3.6 4.6M6.4 6.5A20 20 0 002 12s3.5 7 10 7c1.9 0 3.5-.6 5-1.4"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3"/>',
    insert: '<path d="M5 5v8a4 4 0 004 4h10M15 13l4 4-4 4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'
  };
  function icon(name) {
    const span = document.createElement("span");
    span.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (icons[name] || icons.spark) + '</svg>';
    return span;
  }
  function setIcon(element, name) { element.replaceChildren(icon(name)); }
  $$('[data-icon]').forEach(node => setIcon(node, node.dataset.icon));

  const strings = {
    en: {
      languages:"Languages",appearance:"Appearance",close:"Close",interfaceLanguage:"Interface language",replyLanguage:"Reply language",replies:"Replies",settings:"Settings",light:"Light",dark:"Dark",system:"System",
      connectTitle:"Connect OpenAI",connectHint:"Add an API key in Settings to generate replies.",connect:"Set up",demoNotice:"Example replies. No messages are sent to AI.",draftTitle:"Write a reply",draftHint:"Use selected messages and your instructions.",context:"Conversation context",refresh:"Refresh messages",intent:"What do you want to say?",intentPlaceholder:"e.g. Thank them and suggest a quick call tomorrow.",existingDraft:"Your current Slack draft",generate:"Suggest replies",generateAgain:"Suggest again",generating:"Drafting replies…",settingsHint:"Your connection and preferences, in one place.",notConnected:"Not connected",configured:"Key saved",connected:"Connected",providerDescription:"Connect directly from this Chrome extension.",apiKey:"OpenAI API key",saved:"This session",keyHint:"Kept for this browser session. You’ll need to enter it again after Chrome fully closes.",keySavedHint:"A key is already saved for this browser session. Leave this blank to keep it.",model:"Model",modelHint:"gpt-4.1-mini is the default. You can enter another supported OpenAI model ID.",saveConnection:"Save & test",testConnection:"Test",privacyTitle:"What gets shared?",privacyCopy:"Only when you request replies: your Slack identity, selected messages, the current draft and your instructions are sent directly to OpenAI. Your API key is never shared with Slack.",privacyExtra:"API usage is billed separately from ChatGPT. OpenAI’s API data policies apply. This extension does not keep a conversation history.",createKey:"Create an OpenAI API key ↗",forgetConnection:"Remove saved API key",confirmForget:"Confirm: remove API key",forgetPrompt:"Remove the API key from this browser session? Click again to confirm.",footer:"Review your draft before sending. Spark Reply never sends messages for you.",settingsFooter:"Credentials stay in the extension. Nothing is sent to Slack.",showSecret:"Show key",hideSecret:"Hide key",contextEmpty:"No messages captured. Refresh, or write the context in the field below.",contextCount:"selected",includeMessage:"Include message from",unknownAuthor:"Speaker",summary:"Conversation at a glance",short:"Short",friendly:"Friendly",professional:"Professional",suggestions:"Reply options",copy:"Copy reply",insert:"Insert draft",copied:"Copied to clipboard.",copyFailed:"Could not copy. Select the reply and copy it manually.",inserted:"Added to your Slack draft. Review it before sending.",insertFailed:"Could not insert the reply. Copy it instead.",staleDraft:"Your Slack draft or conversation changed. Refresh the context or copy the reply.",missing:"Add a message or tell us what you want to say.",saveSuccess:"Connected. Your key is saved for this browser session.",testSuccess:"Connection verified with a small test request.",forgotten:"API key removed from this browser session.",saving:"Checking your connection…",testing:"Sending a small test request…",forgetting:"Removing the saved API key…",missingKey:"Enter your OpenAI API key to connect.",missingModel:"Enter an OpenAI model ID.",preferencesFailed:"Could not save preferences. Reload the extension and try again.",genericError:"Something went wrong. Please try again.",reload:"The extension was updated. Reload this Slack tab.",demoConnection:"This preview does not save keys or connect to an API. Use the installed extension for setup.",demoDone:"These are prewritten examples, not generated replies.",popupHint:"Open Spark Reply beside a Slack message to use conversation context.",API_UNCONFIGURED:"Add your OpenAI API key in Settings first.",API_KEY_INVALID:"OpenAI rejected this API key. Check it and try again.",API_FORBIDDEN:"This API key cannot access the selected model.",API_RATE_LIMIT:"OpenAI’s usage limit was reached. Check your API quota or try again shortly.",API_NETWORK:"Could not reach OpenAI. Check your network and try again.",API_RESPONSE_INVALID:"OpenAI returned an unexpected response. Please try again.",REQUEST_INVALID:"Check your model, API key and request, then try again.",REQUEST_TIMEOUT:"The request took too long. Please try again.",MODEL_UNSUPPORTED:"This model does not support the required response format. Try gpt-4.1-mini.",API_ERROR:"OpenAI could not complete the request. Check your API settings and try again."
    },
    tr: {
      languages:"Diller",appearance:"Görünüm",close:"Kapat",interfaceLanguage:"Arayüz dili",replyLanguage:"Cevap dili",replies:"Cevaplar",settings:"Ayarlar",light:"Açık",dark:"Koyu",system:"Sistem",
      connectTitle:"OpenAI bağlantısını kur",connectHint:"Cevap üretmek için Ayarlar’dan API anahtarını ekle.",connect:"Bağla",demoNotice:"Örnek cevaplar. Yapay zekâya mesaj gönderilmez.",draftTitle:"Bir cevap hazırla",draftHint:"Konuşmayı ve ne söylemek istediğini kullanır.",context:"Konuşma bağlamı",refresh:"Mesajları yenile",intent:"Ne söylemek istiyorsun?",intentPlaceholder:"Örn. Teşekkür et ve yarın kısa bir görüşme öner.",existingDraft:"Slack’teki mevcut taslağın",generate:"Cevap öner",generateAgain:"Yeniden öner",generating:"Cevaplar hazırlanıyor…",settingsHint:"Bağlantın ve tercihlerin tek bir yerde.",notConnected:"Bağlı değil",configured:"Anahtar kayıtlı",connected:"Bağlı",providerDescription:"Bu Chrome eklentisinden doğrudan bağlanır.",apiKey:"OpenAI API anahtarı",saved:"Bu oturum",keyHint:"Bu tarayıcı oturumu boyunca tutulur. Chrome tamamen kapandığında yeniden girmen gerekir.",keySavedHint:"Bu tarayıcı oturumu için bir anahtar kayıtlı. Korumak için bu alanı boş bırak.",model:"Model",modelHint:"Varsayılan model gpt-4.1-mini. Desteklenen başka bir OpenAI model kimliği girebilirsin.",saveConnection:"Kaydet ve test et",testConnection:"Test et",privacyTitle:"Hangi bilgiler paylaşılır?",privacyCopy:"Yalnızca cevap istediğinde: Slack kimliğin, seçtiğin mesajlar, mevcut taslak ve yazdığın not doğrudan OpenAI’a gönderilir. API anahtarın Slack ile paylaşılmaz.",privacyExtra:"API kullanımı ChatGPT’den ayrı ücretlendirilir. OpenAI API veri politikaları geçerlidir. Eklenti konuşma geçmişini saklamaz.",createKey:"OpenAI API anahtarı oluştur ↗",forgetConnection:"Kayıtlı API anahtarını kaldır",confirmForget:"Onayla: API anahtarını kaldır",forgetPrompt:"Bu tarayıcı oturumundaki API anahtarı kaldırılsın mı? Onaylamak için tekrar tıkla.",footer:"Göndermeden önce taslağını kontrol et. Spark Reply senin yerine mesaj göndermez.",settingsFooter:"Anahtar eklentide tutulur. Slack’e gönderilmez.",showSecret:"Anahtarı göster",hideSecret:"Anahtarı gizle",contextEmpty:"Mesaj bulunamadı. Yenile veya konuşma bağlamını aşağıdaki alana yaz.",contextCount:"seçili",includeMessage:"Mesajını kullan:",unknownAuthor:"Konuşmacı",summary:"Konuşmanın özeti",short:"Kısa",friendly:"Samimi",professional:"Profesyonel",suggestions:"Cevap seçenekleri",copy:"Cevabı kopyala",insert:"Taslağa ekle",copied:"Panoya kopyalandı.",copyFailed:"Kopyalanamadı. Cevabı seçip elle kopyalayabilirsin.",inserted:"Slack taslağına eklendi. Göndermeden önce kontrol et.",insertFailed:"Taslağa eklenemedi. Cevabı kopyalayabilirsin.",staleDraft:"Slack taslağın veya konuşma değişti. Bağlamı yenile ya da cevabı kopyala.",missing:"Bir mesaj ekle veya ne söylemek istediğini yaz.",saveSuccess:"Bağlandı. Anahtarın bu tarayıcı oturumu için kaydedildi.",testSuccess:"Küçük bir test isteğiyle bağlantı doğrulandı.",forgotten:"API anahtarı bu tarayıcı oturumundan kaldırıldı.",saving:"Bağlantın kontrol ediliyor…",testing:"Küçük bir test isteği gönderiliyor…",forgetting:"Kayıtlı API anahtarı kaldırılıyor…",missingKey:"Bağlanmak için OpenAI API anahtarını gir.",missingModel:"Bir OpenAI model kimliği gir.",preferencesFailed:"Tercihler kaydedilemedi. Eklentiyi yenileyip tekrar dene.",genericError:"Bir sorun oluştu. Lütfen tekrar dene.",reload:"Eklenti güncellendi. Bu Slack sekmesini yenile.",demoConnection:"Bu önizleme anahtar kaydetmez veya API’ye bağlanmaz. Kurulum için yüklü eklentiyi kullan.",demoDone:"Bunlar hazır örneklerdir, üretilmiş cevaplar değildir.",popupHint:"Konuşma bağlamını kullanmak için Spark Reply’ı Slack’teki mesaj alanından aç.",API_UNCONFIGURED:"Önce Ayarlar’dan OpenAI API anahtarını ekle.",API_KEY_INVALID:"OpenAI bu API anahtarını kabul etmedi. Kontrol edip tekrar dene.",API_FORBIDDEN:"Bu API anahtarı seçilen modele erişemiyor.",API_RATE_LIMIT:"OpenAI kullanım sınırına ulaşıldı. API kotanı kontrol et veya biraz sonra tekrar dene.",API_NETWORK:"OpenAI’a ulaşılamadı. Ağ bağlantını kontrol edip tekrar dene.",API_RESPONSE_INVALID:"OpenAI beklenmeyen bir cevap döndürdü. Tekrar dene.",REQUEST_INVALID:"Modeli, API anahtarını ve isteğini kontrol edip tekrar dene.",REQUEST_TIMEOUT:"İstek zaman aşımına uğradı. Tekrar dene.",MODEL_UNSUPPORTED:"Bu model gerekli cevap biçimini desteklemiyor. gpt-4.1-mini’yi dene.",API_ERROR:"OpenAI isteği tamamlayamadı. API ayarlarını kontrol edip tekrar dene."
    }
  };
  Object.assign(strings.en, {replyAs:"Replying as", identityHint:"Your Slack display name. Saved on this device for this workspace; edit or clear it here.", IDENTITY_REQUIRED:"Enter your Slack display name so replies are written as you."});
  Object.assign(strings.tr, {replyAs:"Senin adına", identityHint:"Slack görünen adın. Bu cihazda, bu çalışma alanı için hatırlanır; buradan değiştirebilir veya silebilirsin.", IDENTITY_REQUIRED:"Cevapların senin adına yazılması için Slack görünen adını gir."});
  const languages = {en:"English",tr:"Türkçe",de:"Deutsch",fr:"Français",es:"Español",hu:"Magyar"};
  const defaults = {ui_language:"tr",reply_language:"en",theme:"system"};
  let preferences = {...defaults};
  let context = {id:null,messages:[],draft:"",revision:0};
  let replyIdentity = null, identityScope = null, detectedIdentity = "";
  const identityPrefix = "sparkIdentity:";
  const savedIdentities = Object.create(null);
  let identityWrites = Promise.resolve();
  function rememberIdentity(record) {
    if (!identityScope) return;
    const key = identityPrefix + identityScope;
    savedIdentities[key] = record;
    identityWrites = identityWrites.catch(() => {}).then(async () => {
      if (LOCAL) localStorage.setItem(key, JSON.stringify(record));
      else await chrome.storage.local.set({[key]:record});
    }).catch(() => setStatus("reply", "preferencesFailed", "error"));
  }
  let settings = {provider:"direct",model:"gpt-4.1-mini",has_key:false};
  let activeTab = embedded ? "reply" : "settings";
  let result = null, busy = false, settingsBusy = false, generation = 0, requestCount = 0, forgetArmed = false;
  let replyStatus = null, settingsStatus = null;
  const insertRequests = new Map();
  const colorScheme = matchMedia("(prefers-color-scheme: dark)");
  Object.assign(strings.en, {API_REQUEST_FAILED:"OpenAI could not process this request. Check the model and try again.",MODEL_UNAVAILABLE:"This API key cannot use the selected model. Try gpt-4.1-mini.",MODEL_INVALID:"Enter a valid OpenAI model ID.",API_REFUSED:"OpenAI could not draft a reply for this content.",REQUEST_BUSY:"A request is already running. Please wait a moment.",REQUEST_CANCELLED:"The connection changed. Please try again.",CONTEXT_EMPTY:"Add context or instructions first.",CONTEXT_TOO_LARGE:"The context is too long. Remove some messages and try again.",INTERNAL_ERROR:"Could not complete the request. Reload the extension and try again."});
  Object.assign(strings.tr, {API_REQUEST_FAILED:"OpenAI isteği işleyemedi. Modeli kontrol edip yeniden dene.",MODEL_UNAVAILABLE:"Bu API anahtarı seçili modeli kullanamıyor. gpt-4.1-mini modelini deneyebilirsin.",MODEL_INVALID:"Geçerli bir OpenAI model kimliği gir.",API_REFUSED:"OpenAI bu içerik için cevap taslağı hazırlayamadı.",REQUEST_BUSY:"Bir istek sürüyor. Biraz bekleyip tekrar dene.",REQUEST_CANCELLED:"Bağlantı değişti. Yeniden dene.",CONTEXT_EMPTY:"Önce bağlam veya ne söylemek istediğini ekle.",CONTEXT_TOO_LARGE:"Bağlam çok uzun. Bazı mesajları çıkarıp yeniden dene.",INTERNAL_ERROR:"İşlem tamamlanamadı. Eklentiyi yenileyip tekrar dene."});
  const t = key => strings[preferences.ui_language][key] || strings.en[key] || key;
  const effectiveTheme = () => preferences.theme === "system" ? (colorScheme.matches ? "dark" : "light") : preferences.theme;
  function emit(type, extra = {}) {
    if (embedded && nonce && parentOrigin) parent.postMessage({source:"spark-panel",nonce,type,...extra}, parentOrigin);
  }
  function resize() { emit("resize", {height:Math.min(760, Math.ceil($("#app").getBoundingClientRect().height))}); }
  let resizeFrame;
  function queueResize() { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(resize); }
  function renderStatus(target) {
    const value = target === "reply" ? replyStatus : settingsStatus;
    const node = $(target === "reply" ? "#reply-status" : "#settings-status");
    node.hidden = !value;
    node.className = "status" + (value?.tone ? " " + value.tone : "");
    node.textContent = value ? (value.key ? t(value.key) : value.text) : "";
    queueResize();
  }
  function setStatus(target, key, tone = "", text = "") {
    const value = key || text ? {key,tone,text} : null;
    if (target === "reply") replyStatus = value; else settingsStatus = value;
    renderStatus(target);
  }
  function errorKey(error) {
    if (error?.code && strings.en[error.code]) return error.code;
    if (/Extension context invalidated|receiving end does not exist/i.test(error?.message || "")) return "reload";
    return "genericError";
  }
  async function transport(type, payload) {
    if (LOCAL) {
      if (typeof window.SparkDemoTransport === "function") {
        const response = await window.SparkDemoTransport(type, payload);
        if (response && typeof response.ok === "boolean") {
          if (!response.ok) throw Object.assign(new Error(response.error || "Demo error"), {code:response.code});
          return response.data;
        }
        return response;
      }
      if (type === "spark:settings:get") return {provider:"direct",model:"gpt-4.1-mini",has_key:false,mode:"demo"};
      if (type === "spark:health") return {mode:"demo"};
      if (type !== "spark:suggest") throw Object.assign(new Error(t("demoConnection")),{code:"DEMO_ONLY"});
      await new Promise(resolve => setTimeout(resolve, 450));
      return {mode:"demo",summary_tr:preferences.ui_language === "tr" ? "Bu, bir iş arkadaşının olumlu geri bildirimine verilen örnek bir cevaptır." : "This example responds to a colleague’s positive feedback.",note_tr:preferences.ui_language === "tr" ? "Hazır örnekler gösteriliyor. Yazdığın not yapay zekâ ile işlenmedi." : "These are prewritten examples. Your instructions were not processed by AI.",replies:[{style:"short",text:"Thanks, glad the update helps! 😊"},{style:"friendly",text:"Thanks, Alex! Glad it helps 😊 Hopefully the updated link makes things a little easier for the next person."},{style:"professional",text:"Thanks for the feedback, Alex. I’ve updated the link so new joiners can go directly to the request form."}]};
    }
    const response = await chrome.runtime.sendMessage({type,payload});
    if (!response?.ok) throw Object.assign(new Error(response?.error || "Request failed"), {code:response?.code});
    return response.data;
  }
  function validPreferences(saved) {
    const value = {...defaults};
    for (const [key,allowed] of Object.entries({ui_language:["tr","en"],reply_language:Object.keys(languages),theme:["system","light","dark"]})) if (allowed.includes(saved?.[key])) value[key] = saved[key];
    return value;
  }
  async function savePreference(key, value) {
    preferences[key] = value;
    if (key !== "theme") { invalidateGeneration(); result = null; $("#results").replaceChildren(); setStatus("reply", ""); }
    applyPreferences();
    try {
      if (LOCAL) localStorage.setItem("slackSparkPreferences", JSON.stringify(preferences));
      else await chrome.storage.local.set({preferences});
    } catch (_) { setStatus(activeTab, "preferencesFailed", "error"); }
  }
  function makeChoice(label, active, callback, iconName) {
    const button = document.createElement("button"); button.className = "menu-choice" + (active ? " active" : "");
    button.type = "button"; button.setAttribute("aria-pressed", String(active));
    const text = document.createElement("span"); text.textContent = label; button.append(text);
    if (active) button.append(icon(iconName || "check"));
    button.addEventListener("click", callback); return button;
  }
  function renderMenus() {
    const interfaceList = $("#interface-choices"), replyList = $("#reply-choices"), themeList = $("#theme-choices");
    interfaceList.replaceChildren(); replyList.replaceChildren(); themeList.replaceChildren();
    for (const language of ["tr","en"]) interfaceList.append(makeChoice(languages[language], preferences.ui_language === language, () => savePreference("ui_language",language)));
    for (const [language,label] of Object.entries(languages)) replyList.append(makeChoice(label, preferences.reply_language === language, () => { savePreference("reply_language",language); closeMenus(); }));
    for (const name of ["light","dark","system"]) {
      const button = document.createElement("button"); button.className = "theme-choice" + (preferences.theme === name ? " active" : "");
      button.setAttribute("aria-pressed", String(preferences.theme === name));
      const text = document.createElement("span"); text.textContent = t(name);
      button.append(icon(name === "light" ? "sun" : name === "dark" ? "moon" : "computer"), text);
      button.addEventListener("click", () => { savePreference("theme",name); closeMenus(); }); themeList.append(button);
    }
  }
  function applyPreferences() {
    document.documentElement.lang = preferences.ui_language;
    document.documentElement.dataset.theme = effectiveTheme();
    $$('[data-i18n]').forEach(node => node.textContent = t(node.dataset.i18n));
    $$('[data-title]').forEach(node => { node.title = t(node.dataset.title); node.setAttribute("aria-label", t(node.dataset.title)); });
    $("#intent").placeholder = t("intentPlaceholder");
    $("#reply-language-badge").textContent = languages[preferences.reply_language];
    $("#key-hint").textContent = t(settings.has_key ? "keySavedHint" : "keyHint");
    $("#privacy-copy").textContent = t("privacyCopy");
    $("#language-menu").setAttribute("aria-label", t("languages"));
    $("#theme-menu").setAttribute("aria-label", t("appearance"));
    setIcon($("#theme-button"), preferences.theme === "system" ? "computer" : effectiveTheme() === "dark" ? "moon" : "sun");
    $("#generate-label").textContent = t(busy ? "generating" : result ? "generateAgain" : "generate");
    $("#footer-copy").textContent = t(activeTab === "settings" ? "settingsFooter" : "footer");
    $("#forget-button").textContent = t(forgetArmed ? "confirmForget" : "forgetConnection");
    renderMenus(); renderContext(); renderConnection(); renderStatus("reply"); renderStatus("settings");
    if (result) renderResult(result);
    emit("appearance", {theme:effectiveTheme(),ui_language:preferences.ui_language});
    queueResize();
  }
  function renderConnection() {
    const configured = Boolean(settings.has_key);
    $("#connection-banner").hidden = configured || LOCAL;
    $("#demo-banner").hidden = !LOCAL;
    $("#key-saved").hidden = !configured;
    $("#key-hint").textContent = t(configured ? "keySavedHint" : "keyHint");
    $("#forget-button").hidden = !configured;
    const pill = $("#connection-state"); pill.classList.toggle("connected", configured);
    pill.querySelector("span").textContent = LOCAL ? "Demo" : t(configured ? "configured" : "notConnected");
  }
  function switchTab(tab) {
    activeTab = tab === "settings" ? "settings" : "reply";
    for (const name of ["reply","settings"]) {
      const active = name === activeTab;
      $("#" + name + "-view").hidden = !active;
      $("#" + name + "-tab").classList.toggle("active", active);
      $("#" + name + "-tab").setAttribute("aria-selected", String(active));
      $("#" + name + "-tab").tabIndex = active ? 0 : -1;
    }
    closeMenus();
    $("#footer-copy").textContent = t(activeTab === "settings" ? "settingsFooter" : "footer");
    queueResize();
  }
  function closeMenus() {
    for (const name of ["language","theme"]) { $("#" + name + "-menu").hidden = true; $("#" + name + "-button").setAttribute("aria-expanded","false"); }
  }
  function toggleMenu(name) {
    const opening = $("#" + name + "-menu").hidden; closeMenus();
    if (opening) { $("#" + name + "-menu").hidden = false; $("#" + name + "-button").setAttribute("aria-expanded","true"); $("#" + name + "-menu button").focus(); }
  }
  function renderContext() {
    const list = $("#context-list"); list.replaceChildren();
    $("#context-count").textContent = context.messages.filter(message => message.selected).length + " / " + context.messages.length;
    if (!context.messages.length) { const p = document.createElement("p"); p.className = "context-empty"; p.textContent = t(embedded ? "contextEmpty" : "popupHint"); list.append(p); }
    context.messages.forEach(message => {
      const label = document.createElement("label"); label.className = "context-message";
      const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = message.selected;
      checkbox.setAttribute("aria-label", t("includeMessage") + " " + message.author);
      checkbox.addEventListener("change", () => { message.selected = checkbox.checked; $("#context-count").textContent = context.messages.filter(item => item.selected).length + " / " + context.messages.length; });
      const body = document.createElement("div"), author = document.createElement("strong"), text = document.createElement("p");
      author.textContent = message.author; text.textContent = message.text; body.append(author,text); label.append(checkbox,body); list.append(label);
    });
    $("#draft-box").hidden = !context.draft;
    $("#draft-preview").textContent = context.draft;
    $("#refresh-button").hidden = !embedded;
  }
  function invalidateGeneration() { generation++; busy = false; $("#generate-button").disabled = false; $("#app").classList.remove("loading"); $("#generate-label").textContent = t(result ? "generateAgain" : "generate"); }
  function updateContext(next) {
    if (!next || !Array.isArray(next.messages)) return;
    if (context.id !== null && context.id !== next.id) { $("#intent").value = ""; updateIntentCount(); }
    const detected = next.current_user && typeof next.current_user === "object" ? next.current_user : null;
    const scope = typeof next.workspace === "string" ? next.workspace : "demo";
    const signature = JSON.stringify(detected);
    if (identityScope !== scope || signature !== detectedIdentity) {
      identityScope = scope; detectedIdentity = signature;
      const saved = savedIdentities[identityPrefix + scope];
      const sameAccount = !(detected?.id && saved?.account_id && detected.id !== saved.account_id);
      const reusable = saved && sameAccount && typeof saved.display_name === "string" && saved.display_name.trim();
      replyIdentity = reusable && saved.source === "user_confirmed" ? {display_name:saved.display_name,source:"user_confirmed"}
        : detected?.display_name ? detected
        : reusable ? {display_name:saved.display_name,id:saved.id || "",source:saved.source}
        : detected;
      $("#reply-as").value = typeof replyIdentity?.display_name === "string" ? replyIdentity.display_name.slice(0,150) : "";
      if (replyIdentity?.display_name) rememberIdentity({...replyIdentity,account_id:detected?.id || (sameAccount ? saved?.account_id : "") || ""});
      else if (saved && !sameAccount) rememberIdentity({display_name:"",account_id:detected.id});
    }
    context = {id:typeof next.id === "string" ? next.id : "current", revision:Number.isSafeInteger(next.revision) ? next.revision : 0, draft:typeof next.draft === "string" ? next.draft.slice(0,4000) : "", messages:next.messages.slice(-12).filter(item => item && typeof item.text === "string").map(item => ({author:typeof item.author === "string" ? item.author.slice(0,150) : t("unknownAuthor"),author_id:typeof item.author_id === "string" ? item.author_id : "",text:item.text.slice(0,2500),selected:true}))};
    invalidateGeneration(); result = null; $("#results").replaceChildren(); setStatus("reply", ""); renderContext(); queueResize();
  }
  async function generateReplies() {
    const current_user = {...(replyIdentity || {}), display_name:$("#reply-as").value.trim()};
    if (!current_user.display_name && !current_user.id) { setStatus("reply","IDENTITY_REQUIRED","error"); $("#reply-as").focus(); return; }
    const payload = {current_user, messages:context.messages.filter(message => message.selected).map(({author,author_id,text}) => ({author,author_id,text})),draft:context.draft,intent:$("#intent").value.trim(),ui_language:preferences.ui_language,reply_language:preferences.reply_language};
    if (!payload.messages.length && !payload.draft && !payload.intent) { setStatus("reply","missing","error"); $("#intent").focus(); return; }
    const current = ++generation; busy = true; result = null; $("#results").replaceChildren(); setStatus("reply", "");
    $("#generate-button").disabled = true; $("#generate-label").textContent = t("generating"); $("#app").classList.add("loading");
    try {
      const response = await transport("spark:suggest",payload);
      if (current !== generation) return;
      if (!response || !Array.isArray(response.replies) || !response.replies.length) throw Object.assign(new Error("Invalid response"), {code:"API_RESPONSE_INVALID"});
      result = {...response,revision:context.revision}; renderResult(result);
      if (response.mode === "demo") setStatus("reply","demoDone");
    } catch (error) { if (current === generation) { setStatus("reply",errorKey(error),"error"); if (error.code === "API_UNCONFIGURED") { settings.has_key = false; renderConnection(); } } }
    finally { if (current === generation) { busy = false; $("#generate-button").disabled = false; $("#generate-label").textContent = t(result ? "generateAgain" : "generate"); $("#app").classList.remove("loading"); queueResize(); } }
  }
  function renderResult(data) {
    const results = $("#results"); results.replaceChildren();
    if (data.summary_tr || data.note_tr || data.summary || data.note) {
      const insight = document.createElement("div"); insight.className = "insight";
      const title = document.createElement("div"); title.className = "insight-label"; const titleText = document.createElement("span"); titleText.textContent = t("summary"); title.append(icon("info"),titleText); insight.append(title);
      for (const value of [data.summary_tr || data.summary, data.note_tr || data.note]) if (typeof value === "string" && value) { const p = document.createElement("p"); p.textContent = value; insight.append(p); }
      results.append(insight);
    }
    const heading = document.createElement("div"); heading.className = "results-heading"; heading.textContent = t("suggestions"); results.append(heading);
    data.replies.slice(0,3).forEach((reply,index) => {
      if (typeof reply.text !== "string") return;
      const card = document.createElement("article"); card.className = "reply-card";
      const title = document.createElement("h3"); title.textContent = t(["short","friendly","professional"].includes(reply.style) ? reply.style : ["short","friendly","professional"][index]);
      const text = document.createElement("p"); text.className = "reply-text"; text.textContent = reply.text;
      const actions = document.createElement("div"); actions.className = "reply-actions";
      const copy = document.createElement("button"); copy.className = "icon-button copy-button"; copy.title = t("copy"); copy.setAttribute("aria-label", t("copy")); copy.append(icon("copy"));
      copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(reply.text); setStatus("reply","copied","success"); } catch (_) { setStatus("reply","copyFailed","error"); } });
      actions.append(copy);
      if (embedded) {
        const insert = document.createElement("button"); insert.className = "button insert-button";
        const label = document.createElement("span"); label.textContent = t("insert"); insert.append(label,icon("insert"));
        insert.addEventListener("click", () => {
          const requestId = String(++requestCount); insert.disabled = true;
          const timer = setTimeout(() => { if (insertRequests.has(requestId)) { insertRequests.delete(requestId); insert.disabled = false; setStatus("reply","insertFailed","error"); } },5000);
          insertRequests.set(requestId,{button:insert,timer}); emit("insert",{text:reply.text,requestId,revision:data.revision});
        });
        actions.append(insert);
      }
      card.append(title,text,actions); results.append(card);
    });
    queueResize();
  }
  async function loadSettings() {
    try { settings = {...settings,...await transport("spark:settings:get")}; $("#model").value = settings.model || "gpt-4.1-mini"; renderConnection(); }
    catch (error) { setStatus("settings",errorKey(error),"error"); }
  }
  function setSettingsBusy(value) {
    settingsBusy = value;
    for (const selector of ["#save-button","#test-button","#forget-button","#api-key","#model"]) $(selector).disabled = value;
  }
  async function connectionAction(kind) {
    if (settingsBusy) return;
    if (LOCAL) { setStatus("settings","demoConnection"); $("#api-key").value = ""; return; }
    const api_key = $("#api-key").value.trim(), model = $("#model").value.trim();
    if (!api_key && !settings.has_key) { setStatus("settings","missingKey","error"); $("#api-key").focus(); return; }
    if (!model) { setStatus("settings","missingModel","error"); $("#model").focus(); return; }
    setSettingsBusy(true); forgetArmed = false; setStatus("settings",kind === "save" ? "saving" : "testing");
    try {
      await transport(kind === "save" ? "spark:settings:save" : "spark:connection:test",{model,...(api_key ? {api_key} : {})});
      if (kind === "save") { $("#api-key").value = ""; $("#api-key").type = "password"; await loadSettings(); }
      setStatus("settings",kind === "save" ? "saveSuccess" : "testSuccess","success");
    } catch (error) { setStatus("settings",errorKey(error),"error"); }
    finally { setSettingsBusy(false); }
  }
  async function forgetConnection() {
    if (settingsBusy) return;
    if (!forgetArmed) { forgetArmed = true; $("#forget-button").textContent = t("confirmForget"); setStatus("settings","forgetPrompt"); return; }
    setSettingsBusy(true); setStatus("settings","forgetting");
    try { await transport("spark:connection:forget",{confirm:true}); settings.has_key = false; $("#api-key").value = ""; setStatus("settings","forgotten","success"); renderConnection(); }
    catch (error) { setStatus("settings",errorKey(error),"error"); }
    finally { forgetArmed = false; $("#forget-button").textContent = t("forgetConnection"); setSettingsBusy(false); }
  }
  function updateIntentCount() { $("#intent-count").textContent = $("#intent").value.length.toLocaleString(preferences.ui_language) + " / 2,000"; }
  function closePanel() { if (embedded) emit("close"); else window.close(); }
  $$("[data-tab]").forEach(button => button.addEventListener("click", () => switchTab(button.dataset.tab)));
  $(".tabs").addEventListener("keydown", event => {
    if (!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
    event.preventDefault();
    const tab = event.key === "Home" ? "reply" : event.key === "End" ? "settings" : activeTab === "reply" ? "settings" : "reply";
    switchTab(tab); $("#" + tab + "-tab").focus();
  });
  $("#connect-shortcut").addEventListener("click", () => { switchTab("settings"); $("#api-key").focus(); });
  $("#language-button").addEventListener("click", () => toggleMenu("language"));
  $("#theme-button").addEventListener("click", () => toggleMenu("theme"));
  $("#close-button").addEventListener("click", closePanel);
  $("#generate-button").addEventListener("click", generateReplies);
  $("#refresh-button").addEventListener("click", () => emit("refresh"));
  $("#intent").addEventListener("input", updateIntentCount);
  $("#reply-as").addEventListener("input", () => {
    replyIdentity = {display_name:$("#reply-as").value.trim(),source:"user_confirmed"};
    const saved = savedIdentities[identityPrefix + identityScope];
    rememberIdentity({...replyIdentity,account_id:saved?.account_id || ""});
    invalidateGeneration(); result = null; $("#results").replaceChildren(); setStatus("reply", "");
  });
  $("#save-button").addEventListener("click", () => connectionAction("save"));
  $("#test-button").addEventListener("click", () => connectionAction("test"));
  $("#forget-button").addEventListener("click", forgetConnection);
  $$(".reveal-button").forEach(button => button.addEventListener("click", () => {
    const input = $("#" + button.dataset.target); input.type = input.type === "password" ? "text" : "password";
    button.dataset.title = input.type === "password" ? "showSecret" : "hideSecret";
    button.title = t(button.dataset.title); button.setAttribute("aria-label",button.title); setIcon(button,input.type === "password" ? "eye" : "eyeOff");
  }));
  document.addEventListener("pointerdown", event => { if (!event.target.closest(".popover, #language-button, #theme-button")) closeMenus(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); const openMenu = $$(".popover").find(node => !node.hidden); if (openMenu) { const name = openMenu.id.split("-")[0]; closeMenus(); $("#" + name + "-button").focus(); } else closePanel(); }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && activeTab === "reply" && !busy) { event.preventDefault(); generateReplies(); }
  });
  window.addEventListener("message", event => {
    const data = event.data;
    if (!embedded || !parentOrigin || event.source !== parent || event.origin !== parentOrigin || data?.source !== "spark-host" || data.nonce !== nonce) return;
    if (data.type === "context") updateContext(data.context);
    if (data.type === "visibility") {
      if (!data.visible) { invalidateGeneration(); result = null; $("#results").replaceChildren(); closeMenus(); $("#api-key").value = ""; }
      else { queueResize(); loadSettings(); if (activeTab === "reply") $("#intent").focus({preventScroll:true}); }
    }
    if (data.type === "insert-result") {
      const request = insertRequests.get(String(data.requestId));
      if (request) { clearTimeout(request.timer); request.button.disabled = false; insertRequests.delete(String(data.requestId)); }
      setStatus("reply",data.ok ? "inserted" : "staleDraft",data.ok ? "success" : "error");
    }
  });
  colorScheme.addEventListener("change", () => { if (preferences.theme === "system") applyPreferences(); });
  if (!LOCAL && chrome.storage?.onChanged) chrome.storage.onChanged.addListener((changes,area) => { if (area === "local" && changes.preferences) { preferences = validPreferences(changes.preferences.newValue); applyPreferences(); } if (area === "session") loadSettings(); });
  new ResizeObserver(queueResize).observe($("#app"));
  $$("details").forEach(node => node.addEventListener("toggle",queueResize));
  document.body.classList.toggle("embedded",embedded);
  const ready = (async () => {
    try { const saved = LOCAL ? JSON.parse(localStorage.getItem("slackSparkPreferences") || "{}") : (await chrome.storage.local.get("preferences")).preferences; preferences = validPreferences(saved); } catch (_) { /* Defaults work without storage. */ }
    try {
      const stored = LOCAL ? Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith(identityPrefix)).map(key => [key,JSON.parse(localStorage.getItem(key))])) : await chrome.storage.local.get(null);
      for (const [key,value] of Object.entries(stored)) if (key.startsWith(identityPrefix) && value && typeof value.display_name === "string") savedIdentities[key] = value;
    } catch (_) { /* Manual entry remains available if storage is unavailable. */ }
    applyPreferences(); switchTab(activeTab); await loadSettings(); emit("ready"); queueResize();
  })();
  if (LOCAL) window.SparkPanelTest = {ready,updateContext,generateReplies,switchTab,savePreference,transport,getState:() => ({preferences:{...preferences},context:{...context},activeTab,busy,result,settings:{...settings}})};
})();
