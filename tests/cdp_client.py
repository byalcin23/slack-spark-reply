import socket,struct,json,os,base64,urllib.request,urllib.parse
class CDP:
 def __init__(self, target=None):
  pages=json.load(urllib.request.urlopen('http://127.0.0.1:9237/json'))
  u=urllib.parse.urlparse(target or next(p['webSocketDebuggerUrl'] for p in pages if p['type']=='page'))
  self.s=socket.create_connection((u.hostname,u.port),timeout=35); self.i=0; self.on_event=None
  key=base64.b64encode(os.urandom(16)).decode()
  self.s.sendall(('GET '+u.path+' HTTP/1.1\r\nHost: '+u.netloc+'\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: '+key+'\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
  h=b''
  while not h.endswith(b'\r\n\r\n'): h+=self.s.recv(1)
  assert b'101' in h,h
 def read(self,n):
  result=b''
  while len(result)<n:
   part=self.s.recv(n-len(result))
   if not part: raise EOFError()
   result+=part
  return result
 def call(self,method,params={}):
  self.i+=1; request_id=self.i; b=json.dumps({'id':self.i,'method':method,'params':params}).encode(); n=len(b); mask=os.urandom(4)
  header=bytes([0x81,0x80|n]) if n<126 else bytes([0x81,0x80|126])+struct.pack('!H',n)
  self.s.sendall(header+mask+bytes(v^mask[j%4] for j,v in enumerate(b)))
  while True:
   a,c=self.read(2); n=c&127
   if n==126: n=struct.unpack('!H',self.read(2))[0]
   elif n==127: n=struct.unpack('!Q',self.read(8))[0]
   if c&128: m=self.read(4)
   b=self.read(n)
   if c&128: b=bytes(v^m[j%4] for j,v in enumerate(b))
   r=json.loads(b)
   if r.get('id')==request_id:return r
   if r.get('method') and self.on_event:self.on_event(r)
