import sys,subprocess,time,json,zipfile,urllib.request,base64,re,argparse,os,tempfile
from pathlib import Path
from cdp_client import CDP
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Synthetic packaged-extension acceptance test; no real API key or Slack account used.')
parser.add_argument('--browser',default=os.environ.get('SPARK_TEST_BROWSER','/private/tmp/spark-reply-testing-browser/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'))
args=parser.parse_args()
workspace=tempfile.TemporaryDirectory(prefix='spark-acceptance-'); release=Path(workspace.name)/'extension';release.mkdir()
with zipfile.ZipFile(root/('dist/spark-reply-'+json.loads((root/'extension/manifest.json').read_text())['version']+'.zip')) as z:z.extractall(release)
binary=args.browser
def ev(c,expression):
 r=c.call('Runtime.evaluate',{'expression':expression,'awaitPromise':True,'returnByValue':True})
 if r.get('result',{}).get('exceptionDetails'):raise RuntimeError('JavaScript evaluation failed: '+r['result']['exceptionDetails'].get('text',''))
 return r['result']['result'].get('value')
def check(value,label):
 if not value:raise AssertionError(label)
 print('PASS',label,flush=True)
with open(Path(workspace.name)/'chrome.log','w') as log:
 p=subprocess.Popen([binary,'--headless','--no-first-run','--no-default-browser-check','--user-data-dir='+str(Path(workspace.name)/'profile'),'--remote-debugging-port=9237','--window-size=1280,900','--load-extension='+str(release),'about:blank'],stdout=log,stderr=log)
 try:
  for i in range(50):
   try:c=CDP();break
   except Exception:time.sleep(.2)
  found=None
  for i in range(50):
   pages=json.load(urllib.request.urlopen('http://127.0.0.1:9237/json'))
   workers=[x for x in pages if x['type']=='service_worker' and x['url'].endswith('/background.js')]
   for w in workers:
    client=CDP(w['webSocketDebuggerUrl'])
    if ev(client,"globalThis.chrome?.runtime?.getManifest?.().name || ''").startswith('Spark Reply'):
     found=(w,client);break
   if found:break
   time.sleep(.1)
  check(bool(found),'exact package loads a service worker')
  target,worker=found
  eid=target['url'].split('/')[2]
  c.call('Page.navigate',{'url':'chrome-extension://'+eid+'/panel.html'})
  for i in range(40):
   if ev(c,'Boolean(document.querySelector("#api-key"))'):break
   time.sleep(.1)
  check(ev(c,'Boolean(document.querySelector("#settings-tab"))'),'integrated settings loads in trusted extension page')
  ev(worker,"globalThis.testMode='ok';globalThis.requestCount=0;globalThis.originalFetch=fetch;globalThis.fetch=async(url,options)=>{requestCount++;globalThis.lastBody=JSON.parse(options.body);if(testMode==='invalid')return new Response('{}',{status:401});if(testMode==='timeout'){const e=new Error('test');e.name='AbortError';throw e;}if(testMode==='malformed')return new Response('{}',{status:200});return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({summary_tr:'Alex appreciates the update to the onboarding guide.',note_tr:'A brief acknowledgment is enough. You can mention the direct link without sounding defensive.',replies:[{style:'short',text:'Thanks for the update.'},{style:'friendly',text:'Thanks, that helps!'},{style:'professional',text:'Thank you for clarifying.'}]})}]}]}),{status:200});};")
  check(ev(c,"(async()=>{await chrome.runtime.sendMessage({type:'spark:connection:forget',payload:{confirm:true}});const r=await chrome.runtime.sendMessage({type:'spark:suggest',payload:{current_user:{display_name:'Jordan Lee'},intent:'Say thanks'}});return r.code==='API_UNCONFIGURED'})()"),'unconfigured service returns an error instead of mock replies')
  check(ev(c,"(async()=>{const r=await chrome.runtime.sendMessage({type:'spark:settings:save',payload:{api_key:'synthetic-test-key',model:'gpt-4.1-mini'}});return r.ok&&r.data.has_key&&!JSON.stringify(r).includes('synthetic-test-key')})()"),'save verifies connection without returning the secret')
  check(ev(c,"(async()=>{const local=await chrome.storage.local.get(null),session=await chrome.storage.session.get(null);return !JSON.stringify(local).includes('synthetic-test-key')&&JSON.stringify(session).includes('synthetic-test-key')})()"),'API key exists only in session storage')
  check(ev(c,"(async()=>{const r=await chrome.runtime.sendMessage({type:'spark:suggest',payload:{current_user:{display_name:'Jordan Lee'},intent:'Mention the link I added',ui_language:'en',reply_language:'tr'}});return r.ok&&r.data.replies.length===3})()"),'panel-to-worker-to-provider generation succeeds')
  check(ev(worker,"lastBody.instructions.includes('natural Turkish')&&lastBody.instructions.includes('in English')&&lastBody.store===false&&lastBody.input[0].content.includes('Mention the link')"),'requested languages and instructions reach structured OpenAI request')
  check(ev(worker,"!trustedPanel({id:chrome.runtime.id,url:'https://app.slack.com/client/test'})&&!trustedPanel({id:'wrong',url:chrome.runtime.getURL('panel.html')})"),'Slack content scripts and foreign extensions cannot access credentials')
  for mode,code in [('invalid','API_KEY_INVALID'),('timeout','REQUEST_TIMEOUT'),('malformed','API_RESPONSE_INVALID')]:
   ev(worker,'testMode='+json.dumps(mode))
   check(ev(c,"(async()=>{const r=await chrome.runtime.sendMessage({type:'spark:suggest',payload:{current_user:{display_name:'Jordan Lee'},intent:'Say thanks'}});return !r.ok&&r.code==="+json.dumps(code)+"&&!JSON.stringify(r).includes('synthetic-test-key')})()"),mode+' provider failure is handled without secret leakage')
  ev(worker,"testMode='ok'")
  check(ev(worker,"(()=>{const p=SparkProvider.validatePayload({current_user:{display_name:'Test user'},intent:'Say thanks',ui_language:'zh-CN',reply_language:'en'});const r=SparkProvider.makeRequest(p,'test');return r.instructions.includes('in Simplified Chinese')&&p.reply_language==='en'})()"),'Chinese UI requests Chinese advice without changing reply language')
  check(ev(worker,"(()=>{try{SparkProvider.validatePayload({intent:'Reply'});return false}catch(e){return e.code==='IDENTITY_REQUIRED'}})()"),'missing identity is rejected before network request')
  check(ev(worker,"(()=>{const p=SparkProvider.validatePayload({current_user:{id:'U123',display_name:'Jordan Lee'},messages:[{author:'Jordan Lee',author_id:'U123',text:'I added the link'},{author:'Adam',author_id:'U456',text:'Thanks for updating it'},{author:'Jordan Lee',author_id:'U789',text:'Different person'}]});return p.messages.map(x=>x.speaker).join(',')==='self,other,other'&&SparkProvider.makeRequest(p,'test').instructions.includes('never thank the user for their own work')})()"),'self and colleague are separated by ID even with duplicate names')
  check(ev(worker,"(()=>{const p=SparkProvider.validatePayload({current_user:{display_name:'Sam'},messages:[{author:'Sam',author_id:'U123',text:'One'},{author:'Sam',author_id:'U456',text:'Two'}]});return p.messages.every(x=>x.speaker==='unknown')})()"),'ambiguous display names are not guessed')
  fixture=(root/'demo/index.html').read_text();fixture=re.sub(r'<script.*?</script>','',fixture,flags=re.S)
  fixture=re.sub(r'<div class="notice">.*?</div>', '<div class="notice"><span><strong>Spark Reply · Example conversation</strong> — Illustrative messages and sample replies.</span><span>Product preview</span></div>',fixture,flags=re.S)
  fixture=fixture.replace('<body>', '<body><button data-qa="user-button" data-member-id="U123" aria-label="Jordan Lee" style="position:fixed;top:0;left:0">Account</button>')
  encoded=base64.b64encode(fixture.encode()).decode()
  def intercept(event):
   if event['method']=='Fetch.requestPaused':c.call('Fetch.fulfillRequest',{'requestId':event['params']['requestId'],'responseCode':200,'responseHeaders':[{'name':'Content-Type','value':'text/html; charset=utf-8'}],'body':encoded})
  c.on_event=intercept
  c.call('Fetch.enable',{'patterns':[{'urlPattern':'https://app.slack.com/client/spark-test','requestStage':'Request'}]})
  c.call('Emulation.setDeviceMetricsOverride',{'width':1280,'height':800,'deviceScaleFactor':1,'mobile':False})
  c.call('Page.navigate',{'url':'https://app.slack.com/client/spark-test'})
  for i in range(40):
   if ev(c,'Boolean(document.querySelector("#spark-reply-companion"))'):break
   time.sleep(.1)
  check(ev(c,'Boolean(document.querySelector("#spark-reply-companion"))'),'packaged content adapter injects into synthetic Slack origin')
  # Click the real orb. Closed shadow root is intentionally not readable by Slack.
  coords=ev(c,'(()=>{const r=document.querySelector(".ql-editor").getBoundingClientRect();return {x:Math.min(innerWidth-44,r.right-46)+17,y:Math.max(10,r.top-39)+17}})()')
  for typ in ['mousePressed','mouseReleased']:c.call('Input.dispatchMouseEvent',{'type':typ,**coords,'button':'left','clickCount':1})
  time.sleep(.5)
  pages=json.load(urllib.request.urlopen('http://127.0.0.1:9237/json'))
  frames=[x for x in pages if x['type']=='iframe' and x['url'].startswith('chrome-extension://'+eid+'/panel.html')]
  check(bool(frames),'isolated extension panel opens inside Slack')
  f=CDP(frames[0]['webSocketDebuggerUrl'])
  for i in range(30):
   if ev(f,'document.querySelector("#context-count")?.textContent==="2 / 2"'):break
   time.sleep(.1)
  check(ev(f,'document.querySelector("#context-count").textContent==="2 / 2"'),'visible Slack context arrives through validated frame messages')
  check(ev(f,'document.querySelector("#reply-as").value==="Jordan Lee"'),'account identity fills replying-as field automatically')
  ev(f,'document.querySelector("#intent").focus()')
  c.call('Input.insertText',{'text':'Teşekkür et, ığüşöç'})
  check(ev(f,'document.querySelector("#intent").value.includes("ığüşöç")'),'native typing works in production extension iframe')
  ev(f,'document.querySelector("#generate-button").click()')
  for i in range(40):
   if ev(f,'document.querySelectorAll(".reply-card").length===3'):break
   time.sleep(.1)
  check(ev(f,'document.querySelectorAll(".reply-card").length===3'),'production panel renders provider replies')
  check(ev(worker,"JSON.parse(lastBody.input[0].content.split('\\n').slice(1).join('\\n')).current_user.id==='U123'"),'detected account identity reaches provider request')
  ev(f,"document.querySelector('#intent').value='Thank Alex and mention that I added the direct link.';document.querySelector('#intent').dispatchEvent(new Event('input'));chrome.storage.local.set({preferences:{ui_language:'en',reply_language:'en',theme:'light'}})");time.sleep(.15)
  (root/'store/assets/01-replies-light.png').write_bytes(base64.b64decode(c.call('Page.captureScreenshot',{'format':'png'})['result']['data']))
  ev(f,'document.querySelector(".insert-button").click()');time.sleep(.1)
  check(ev(c,'document.querySelector(".ql-editor").textContent==="Thanks for the update."'),'cross-origin insertion writes a draft without sending')
  ev(f,'document.querySelector("#settings-tab").click()')
  check(ev(f,'!document.querySelector("#settings-view").hidden'),'settings remain inside the same embedded panel')
  ev(f,"chrome.storage.local.set({preferences:{ui_language:'en',reply_language:'en',theme:'dark'}})");time.sleep(.15)
  (root/'store/assets/02-settings-dark.png').write_bytes(base64.b64decode(c.call('Page.captureScreenshot',{'format':'png'})['result']['data']))
  ev(f,"document.querySelector('#language-button').click()");time.sleep(.1)
  (root/'store/assets/03-languages.png').write_bytes(base64.b64decode(c.call('Page.captureScreenshot',{'format':'png'})['result']['data']))
  ev(c,'document.querySelector(".messages").innerHTML="<div data-qa=\\"message_container\\" data-member-id=\\"U123\\"><b data-qa=\\"message_sender\\">Jordan Lee</b><div class=\\"c-message_kit__message\\"><div class=\\"c-message_kit__text\\"><div class=\\"p-rich_text_section\\">I updated it.</div><div class=\\"p-rich_text_section\\">Here is the link.</div></div></div></div><div data-qa=\\"message_container\\" class=\\"c-message_kit__message--compact\\"><div class=\\"c-message_kit__text\\">https://example.test/ticket</div></div><div data-qa=\\"message_container\\" data-member-id=\\"U456\\"><b class=\\"c-message_kit__sender_name\\">Casey Smith</b><div class=\\"c-message_kit__text\\">done</div></div><div role=\\"separator\\">Tomorrow</div><div data-qa=\\"message_container\\" class=\\"c-message_kit__message--compact\\"><div class=\\"c-message_kit__text\\">Unattributed after divider</div></div><div data-qa=\\"message_container\\"><div class=\\"c-message_kit__text\\"><span data-member-id=\\"U123\\" class=\\"c-message_kit__sender\\">Mention only</span></div></div><div data-qa=\\"message_container\\" class=\\"c-message_kit__message--compact\\" data-member-id=\\"U999\\"><div class=\\"c-message_kit__text\\">Another unknown sender</div></div>"')
  ev(f,"document.querySelector('#refresh-button').click()")
  time.sleep(.1)
  check(ev(f,"Array.from(document.querySelectorAll('#context-list strong')).map(x=>x.textContent).join('|')==='Jordan Lee|Jordan Lee|Casey Smith|Speaker|Speaker|Speaker'"),'grouped messages keep sender without leaking across dividers or mentions')
  check(ev(f,"document.querySelector('#context-list p').textContent.includes('I updated it.')&&document.querySelector('#context-list p').textContent.includes('Here is the link.')&&document.querySelectorAll('#context-list strong').length===6"),'nested wrappers and multiline bodies remain one complete message')
  ev(c,'document.querySelector(".messages").innerHTML="<div class=\\"c-message_kit__background\\"><div data-qa=\\"message_container\\"><div data-qa=\\"message_content\\"><span data-qa=\\"message_sender\\" data-member-id=\\"U123\\">Jordan Lee</span><a class=\\"c-timestamp\\" data-qa=\\"message_timestamp\\">11:58 AM</a><div class=\\"c-message_kit__text\\"><div class=\\"p-rich_text_section\\">Please approve the ticket.</div></div></div></div></div><div class=\\"c-message_kit__background\\"><div data-qa=\\"message_container\\"><div data-qa=\\"message_content\\"><a class=\\"c-timestamp\\">11:58 AM</a><div class=\\"c-message_kit__text\\">https://example.test/ticket</div></div></div></div><div data-qa=\\"message_container\\"><div data-qa=\\"message_content\\"><b class=\\"c-message_kit__sender\\">Slackbot</b><a class=\\"c-timestamp\\">12:00 PM</a><div class=\\"c-message_kit__text\\">Only visible to you</div></div></div><div data-qa=\\"message_container\\"><div data-qa=\\"message_content\\"><b class=\\"c-message_kit__sender\\">Casey Smith</b><a class=\\"c-timestamp\\">12:01 PM</a><div class=\\"c-message_kit__text\\">done</div></div></div><div data-qa=\\"message_container\\"><div data-qa=\\"message_content\\"><b class=\\"c-message_kit__sender\\">Jordan Lee</b><a class=\\"c-timestamp\\">12:06 PM</a><div class=\\"c-message_kit__text\\">Amazing, thanks so much</div></div></div>"')
  ev(f,"document.querySelector('#refresh-button').click()")
  time.sleep(.1)
  check(ev(f,"Array.from(document.querySelectorAll('#context-list strong')).map(x=>x.textContent).join('|')==='Jordan Lee|Jordan Lee|Slackbot|Casey Smith|Jordan Lee'"),'realistic message_content wrappers preserve full and consecutive senders')
  check(ev(f,"Array.from(document.querySelectorAll('#context-list p')).map(x=>x.textContent).join('|')==='Please approve the ticket.|https://example.test/ticket|Only visible to you|done|Amazing, thanks so much'"),'message text excludes header timestamps and names')
  ev(f,"document.querySelector('#reply-tab').click();document.querySelector('#reply-as').value='Corrected user';document.querySelector('#reply-as').dispatchEvent(new Event('input'));document.querySelector('#generate-button').click()")
  for i in range(40):
   if ev(f,'document.querySelectorAll(".reply-card").length===3'):break
   time.sleep(.1)
  check(ev(worker,"JSON.parse(lastBody.input[0].content.split('\\n').slice(1).join('\\n')).current_user.display_name==='Corrected user'&&!JSON.parse(lastBody.input[0].content.split('\\n').slice(1).join('\\n')).current_user.id"),'manual correction discards the previous account ID')
  for i in range(30):
   if ev(f,"(async()=>{const s=await chrome.storage.local.get('sparkIdentity:spark-test');return s['sparkIdentity:spark-test']?.display_name==='Corrected user'})()"):break
   time.sleep(.1)
  ev(f,'location.reload()')
  restored=False
  for i in range(50):
   try: restored=ev(f,"document.querySelector('#reply-as')?.value==='Corrected user'")
   except Exception: pass
   if restored:break
   time.sleep(.1)
  check(restored,'manually entered identity survives panel reload and detected name does not overwrite it')
  ev(c,"document.querySelector('[data-qa=user-button]').remove();history.pushState({},'', '/client/another-workspace')")
  ev(f,"document.querySelector('#refresh-button').click()")
  time.sleep(.1)
  check(ev(f,"document.querySelector('#reply-as').value===''") ,'workspace change clears previous identity when account is unknown')
  count=ev(worker,'requestCount')
  ev(f,"document.querySelector('#generate-button').click()")
  time.sleep(.1)
  check(ev(worker,'requestCount')==count,'missing identity blocks UI generation without an API call')
  check(ev(c,'document.querySelector("#spark-reply-companion").shadowRoot===null'),'Slack page cannot inspect the embedded UI through shadow DOM')
  ev(f,"document.querySelector('#api-key').value='must-clear-when-dismissed'")
  for typ in ['mousePressed','mouseReleased']:c.call('Input.dispatchMouseEvent',{'type':typ,'x':100,'y':100,'button':'left','clickCount':1})
  time.sleep(.15)
  check(ev(f,"document.querySelector('#api-key').value===''"),'outside dismissal clears unsaved credentials')
  check(ev(f,"(async()=>{const r=await chrome.runtime.sendMessage({type:'spark:connection:forget',payload:{confirm:true}});return r.ok&&!r.data.has_key&&Object.keys(await chrome.storage.session.get(null)).length===0})()"),'removing the API key clears session credentials')
  # Optional local browser regressions, when the development fixture server is running.
  try:
   urllib.request.urlopen('http://127.0.0.1:8787/tests.html',timeout=1).close()
  except Exception: pass
  else:
   c.call('Page.navigate',{'url':'http://127.0.0.1:8787/tests.html'})
   for i in range(100):
    if ev(c,'/^(PASS|FAIL) Spark Reply/.test(document.title)'):break
    time.sleep(.1)
   check(ev(c,'document.title==="PASS Spark Reply"'),'local thread, draft, identity, language and theme regressions')
  print('ALL EXTENSION ACCEPTANCE CHECKS PASSED',flush=True)
 finally:
  p.terminate()
  try:p.wait(timeout=5)
  except subprocess.TimeoutExpired:p.kill()
  workspace.cleanup()
