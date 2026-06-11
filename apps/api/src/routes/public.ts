import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../index";

// ─────────────────────────────────────────────────────────────────────────────
// Service Worker core — importScripts()'ed by the user's /specter-sw.js stub.
// Browser security requires the SW file to be same-origin with the controlled
// site, so we ship this as a cross-origin importable module (CORS: *).
// ─────────────────────────────────────────────────────────────────────────────

const SW_JS = `"use strict";
let K={isKilled:false},T=null,B=null;
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("message",e=>{
  if(e.data&&e.data.type==="SPECTER_INIT"){T=e.data.token;B=e.data.base;poll();}
});
async function poll(){
  if(!T||!B)return;
  try{
    const r=await fetch(B+"/status/"+T,{cache:"no-store",credentials:"omit"});
    if(!r.ok)return;
    K=await r.json();
    const cs=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    cs.forEach(c=>c.postMessage({type:"SPECTER_STATE",...K}));
  }catch(e){}
}
setInterval(poll,30000);
self.addEventListener("fetch",e=>{
  if(e.request.mode!=="navigate"||!K.isKilled)return;
  const m=K.killMode,c=K.config||{};
  if(m==="redirect"&&c.url){e.respondWith(Response.redirect(c.url,302));return;}
  if(m==="ghost")return;
  const ti=m==="overlay"&&c.title?c.title:"Down for maintenance";
  const ms=m==="overlay"&&c.message?c.message:"We\\u2019ll be back soon.";
  const rt=m==="overlay"&&c.returnTime?"<p style=\\"opacity:.35;font-size:.8rem;margin-top:.5rem\\">Back: "+new Date(c.returnTime).toLocaleString()+"</p>":"";
  const html="<!DOCTYPE html><html><head><title>"+ti+"</title><meta name=\\"viewport\\" content=\\"width=device-width,initial-scale=1\\"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;height:100dvh;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem}.w{max-width:500px}h1{font-size:2rem;font-weight:700;margin-bottom:.75rem}p{opacity:.5;line-height:1.6}</style></head><body><div class=\\"w\\"><h1>"+ti+"</h1><p>"+ms+"</p>"+rt+"</div></body></html>";
  e.respondWith(new Response(html,{status:503,headers:{"Content-Type":"text/html;charset=utf-8","Retry-After":"3600"}}));
});`;

// ─────────────────────────────────────────────────────────────────────────────
// Client loader — the tiny script tag users add to any page.
// 1. Checks kill state immediately (current page).
// 2. Registers the SW stub (/specter-sw.js on the user's domain) so future
//    navigations to ANY page are also intercepted.
// ─────────────────────────────────────────────────────────────────────────────

const CLIENT_JS = `(function(d,w){"use strict";
var s=d.currentScript,t=s&&s.getAttribute("data-token");
if(!t)return;
var base=s.src.replace(/\\/js$/,"");
function applyKill(K){
  if(!K||!K.isKilled)return;
  var m=K.killMode,c=K.config||{};
  if(m==="redirect"&&c.url){w.location.replace(c.url);return;}
  if(m==="overlay"){
    var el=d.createElement("div");
    el.setAttribute("style","position:fixed;inset:0;background:#0a0a0a;color:#fff;z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;text-align:center;padding:2rem");
    el.innerHTML="<div><h1 style=\\"font-size:2rem;margin:0 0 1rem\\">"+(c.title||"Down for maintenance")+"</h1><p style=\\"opacity:.5\\">"+(c.message||"We\\u2019ll be back soon.")+"</p>"+(c.returnTime?"<p style=\\"opacity:.35;font-size:.8rem;margin-top:.5rem\\">Back: "+new Date(c.returnTime).toLocaleString()+"</p>":"")+"</div>";
    function inject(){d.body.appendChild(el);}
    d.body?inject():d.addEventListener("DOMContentLoaded",inject);
    return;
  }
  if(m==="ghost"){d.addEventListener("DOMContentLoaded",function(){d.querySelectorAll("a,button,input,select,textarea,form").forEach(function(e){e.style.pointerEvents="none";});});return;}
  d.open();d.write("<!DOCTYPE html><html><head><title>Maintenance</title><meta name=\\"viewport\\" content=\\"width=device-width,initial-scale=1\\"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;height:100dvh;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem}h1{font-size:2rem;font-weight:700;margin-bottom:.75rem}p{opacity:.5}</style></head><body><div><h1>"+(c.maintenanceMessage||"Down for maintenance")+"</h1><p>Please check back later.</p></div></body></html>");d.close();
}
fetch(base+"/status/"+t,{credentials:"omit",cache:"no-store"})
  .then(function(r){return r.ok?r.json():null;}).then(applyKill).catch(function(){});
if("serviceWorker"in navigator){
  var sp=s.getAttribute("data-sw-path")||"/specter-sw.js";
  navigator.serviceWorker.register(sp,{scope:"/"})
    .then(function(reg){
      function send(sw){if(sw)sw.postMessage({type:"SPECTER_INIT",token:t,base:base});}
      var sw=reg.active||reg.installing||reg.waiting;
      if(reg.installing){reg.installing.addEventListener("statechange",function(){if(this.state==="activated")send(reg.active);});}
      else send(sw);
    }).catch(function(){});
  navigator.serviceWorker.addEventListener("message",function(e){
    if(e.data&&e.data.type==="SPECTER_STATE")applyKill(e.data);
  });
}
}(document,window));`;

export async function publicRoutes(app: FastifyInstance) {

  // ── GET /sw.js ───────────────────────────────────────────────────────────────
  // The SW core logic. Users importScripts() this from their /specter-sw.js stub.

  app.get(
    "/sw.js",
    {
      config: { rateLimit: { max: 500, timeWindow: "1 minute" } },
      schema: { description: "Specter Service Worker core", tags: ["public"] },
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      reply
        .header("Content-Type", "application/javascript; charset=utf-8")
        .header("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
        .header("Access-Control-Allow-Origin", "*")
        .header("Service-Worker-Allowed", "/")
      return reply.send(SW_JS)
    }
  )

  // ── GET /js ─────────────────────────────────────────────────────────────────
  // Serves the client-side kill-switch script. No auth, no rate-limit abuse risk
  // because it's a static response.

  app.get(
    "/js",
    {
      config: { rateLimit: { max: 500, timeWindow: "1 minute" } },
      schema: { description: "Specter client script", tags: ["public"] },
    },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      reply
        .header("Content-Type", "application/javascript; charset=utf-8")
        .header("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
        .header("Access-Control-Allow-Origin", "*")
      return reply.send(CLIENT_JS)
    }
  )

  // ── GET /status/:token ──────────────────────────────────────────────────────
  // Public endpoint polled by the client script on every page load.
  // Returns only the fields the client needs — no sensitive data.

  app.get(
    "/status/:token",
    {
      config: { rateLimit: { max: 300, timeWindow: "1 minute" } },
      schema: {
        description: "Get kill state for a site token (public)",
        tags: ["public"],
        params: {
          type: "object",
          properties: { token: { type: "string" } },
          required: ["token"],
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { token: string } }>,
      reply: FastifyReply
    ) => {
      const { token } = request.params

      const site = await prisma.site.findUnique({
        where: { siteToken: token },
        select: { isKilled: true, killMode: true, killState: true },
      })

      // Always respond 200 — unknown tokens get isKilled: false (fail open)
      reply
        .header("Cache-Control", "no-store")
        .header("Access-Control-Allow-Origin", "*")

      if (!site) {
        return reply.code(200).send({ isKilled: false })
      }

      return reply.code(200).send({
        isKilled: site.isKilled,
        killMode: site.killMode,
        config: site.killState ?? {},
      })
    }
  )
}
