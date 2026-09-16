/* Credentials and OpenAI requests stay in the trusted extension service worker. */
"use strict";
importScripts("provider.js");
const CREDENTIALS = "sparkCredentials";
let activeRequests = 0, configurationRevision = 0;
const initialized = Promise.all([
  chrome.storage.local.setAccessLevel({accessLevel:"TRUSTED_CONTEXTS"}),
  chrome.storage.session.setAccessLevel({accessLevel:"TRUSTED_CONTEXTS"})
]);
function trustedPanel(sender) {
  if (sender.id !== chrome.runtime.id || typeof sender.url !== "string") return false;
  try { const url=new URL(sender.url); return url.protocol==="chrome-extension:" && url.hostname===chrome.runtime.id && ["/panel.html","/options.html"].includes(url.pathname); }
  catch (_) { return false; }
}
async function credentials() {
  const value=(await chrome.storage.session.get(CREDENTIALS))[CREDENTIALS];
  return value && typeof value.api_key==="string" ? value : null;
}
async function status() {
  const key=await credentials(), local=await chrome.storage.local.get("model");
  return {provider:"direct",model:key?.model||local.model||SparkProvider.DEFAULT_MODEL,has_key:Boolean(key),mode:key?"live":"unconfigured"};
}
function errorResponse(error) {
  const code=error instanceof SparkProvider.ProviderError?error.code:"INTERNAL_ERROR";
  // Provider bodies, request headers and arbitrary exception messages can contain secrets.
  return {ok:false,code,error:code};
}
async function run(message) {
  await initialized;
  if (["spark:health","spark:settings:get"].includes(message.type)) return status();
  const payload=message.payload||{};
  if (message.type==="spark:connection:forget") {
    if(payload.confirm!==true) throw new SparkProvider.ProviderError("REQUEST_INVALID");
    configurationRevision++;
    await chrome.storage.session.remove(CREDENTIALS);
    return status();
  }
  if(activeRequests>=2) throw new SparkProvider.ProviderError("REQUEST_BUSY");
  activeRequests++;
  try {
    const stored=await credentials();
    if(message.type==="spark:suggest") {
      if(!stored) throw new SparkProvider.ProviderError("API_UNCONFIGURED");
      return await SparkProvider.generate(payload,stored);
    }
    if(!["spark:settings:save","spark:connection:test"].includes(message.type)) throw new SparkProvider.ProviderError("REQUEST_INVALID");
    const supplied=SparkProvider.validateCredentials({api_key:payload.api_key||stored?.api_key||"",model:payload.model||stored?.model||SparkProvider.DEFAULT_MODEL});
    const revision=message.type==="spark:settings:save"?++configurationRevision:configurationRevision;
    const test=await SparkProvider.test(supplied);
    if(revision!==configurationRevision) throw new SparkProvider.ProviderError("REQUEST_CANCELLED");
    if(message.type==="spark:settings:save") {
      await chrome.storage.session.set({[CREDENTIALS]:supplied});
      await chrome.storage.local.set({model:supplied.model});
    }
    return {...await status(),verified:true,sample:test.sample};
  } finally {activeRequests--;}
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(!trustedPanel(sender) || !message || !["spark:health","spark:settings:get","spark:suggest","spark:settings:save","spark:connection:test","spark:connection:forget"].includes(message.type)) return false;
  run(message).then(data=>respond({ok:true,data}),error=>respond(errorResponse(error)));
  return true;
});
