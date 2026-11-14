// Run against a local production preview backed by disposable MongoDB only.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const origin=process.env.PREVIEW_ORIGIN||'http://localhost:3004';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Local disposable preview required');
async function request(path,method='GET',body,cookie,source=origin){
  return fetch(`${origin}/api/street/${path}`,{method,headers:{'Content-Type':'application/json',Origin:source,...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
}
assert.equal((await fetch(`${origin}/streets`)).status,200);
const areas=await (await request('areas')).json();assert.ok(areas.data.length);
const area=areas.data[0].slug;
const dashboard=await (await request(`areas/${area}`)).json();assert.equal(dashboard.dataMode,'synthetic');
assert.equal((await request('auth/register','POST',{},null,'https://untrusted.example')).status,403);
const email=`proxy-${randomBytes(5).toString('hex')}@example.com`;
const registered=await request('auth/register','POST',{name:'Preview test',email,password:randomBytes(20).toString('hex')});
assert.equal(registered.status,201);
const cookie=registered.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=strict/i);
const user=await registered.json();assert.equal(user.token,undefined);assert.equal(user.user.role,'resident');
const session=cookie.split(';')[0];assert.equal((await request('auth/me','GET',undefined,session)).status,200);
const report=await request('reports','POST',{areaSlug:area,streetId:dashboard.streets[0].id,reportType:'FLOODING',reportedWaterDepthCm:12,description:'Disposable proxy integration test'},session);
assert.equal(report.status,201);assert.equal((await report.json()).data.status,'pending');
assert.equal((await request('reports/pending','GET',undefined,session)).status,403);
assert.equal((await request('auth/logout','POST',{},session)).status,204);
assert.equal((await request('auth/me','GET',undefined,session)).status,401);
console.log('Frontend proxy smoke passed: page, backend data, CSRF, HttpOnly session, pending report, role guard, logout.');
