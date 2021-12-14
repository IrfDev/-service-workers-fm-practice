"use strict";

var version = 6;

var isOnline = true;
var isLoggedIn = false;
var cacheName = `ramblings-${version}`;
var urlsToCache = {
  loggedOut: [
    "/css/styles.css",
    "/images/logo.gif",
    "/images/offline.png",
    "/",
    "/about",
    "/contact",
    "/login",
    "/404",
    "/offline",
    "/js/blog.js",
    "/js/home.js",
    "/js/login.js",
  ],
};

self.addEventListener("install", onInstall);
self.addEventListener("activate", onActivate);
self.addEventListener("message", onMessage);
self.addEventListener("fetch", onFetch);

main().catch(console.error);

// ***********************

async function main() {
  console.log(`Service Worker ${version} is starting...`);
  await sendMessage({ requestStatusUpdate: true });
  await cacheLoggedOutFile();
}

async function sendMessage(msg) {
  // This is to have an array for all the clients
  var allClients = await clients.matchAll({ includeUnctontrolled: true });

  return Promise.all(
    allClients.map(() => {
      var chan = new MessageChannel();
      chan.port1.onmessage = onMessage;

      return client.postMessage(msg, [chan.port2]);
    })
  );
}

function onMessage({ data }) {
  if (data.statusUpdate) {
    ({ isLoggedIn, isOnline } = data.statusUpdate);

    console.log(
      `Service Worker (${version}) status update is: isOnline: ${isOnline}, isLoggedIn: ${isLoggedIn}`
    );
  }
}

function onFetch(e) {
  // Receive a Promise and Wait for that promise
  e.respondWith(router(e.request));
}

async function router(req) {
  var url = new URL(req.url);
  var urlPathmame = url.pathname;

  // We open the cache in order to use it later
  var cache = await caches.open(urlPathmame);

  if (url.origin == location.origin) {
    let res;
    try {
      let fetchOptions = {
        method: req.method,
        headers: req.headers,
        credentials: "omit",
        cache: "no-store",
      };

      res = await fetch(req.url, fetchOptions);

      if (res && res.ok) {
        // We need to clone the response in order to re-use ir
        await cache.put(urlPathmame, res.clone());
        return res;
      }
    } catch (err) {
      console.error(err);
    }

    res = await cache.match(urlPathmame);

    if (res) {
      return res.clone();
    }
  }
}

async function onInstall(e) {
  console.log(`Service worker (${version}) installed.`);
  self.skipWaiting();
}

async function onActivate(e) {
  e.waitUntil(handleActivation());
  // You only activate your Service Worker once, other times they're just Starting up
}

async function handleActivation() {
  await clearCaches();
  await cacheLoggedOutFile(true);
  await clients.claim();

  console.log(`Service worker (${version}) activated.`);
}

async function cacheLoggedOutFile(forceReload = false) {
  var cache = await caches.open(cacheName);

  return Promise.all(
    urlsToCache.loggedOut.map(async (cacheUrl) => {
      try {
        let response;

        if (!forceReload) {
          response = await cache.match(cacheUrl);
          if (response) {
            return response;
          }
        }

        let fetchOptions = {
          method: "GET",
          cache: "no-cache",
          credentials: "omit",
        };

        response = await fetch(cacheUrl, fetchOptions);

        if (response.ok) {
          // You can't put a Response Object as an argument. So you need to Clone the Object
          await cache.put(cacheUrl, response);
        }
      } catch (err) {
        console.error(err);
      }
    })
  );
}

async function clearCaches() {
  // Get a list of all of our caches
  var cacheNames = await caches.keys();

  // We need to know the oldCaches
  var oldCacheNames = cacheNames.filter((cacheName) => {
    // We just want caches that match the pattern we use in our names, so we don't messed up other caches

    let cacheRegex = new RegExp(/^ramblings-(\d+)$/);

    if (cacheRegex.test(cacheName)) {
      // We check all the cacheNames that match our Regex
      let [, cacheVersion] = cacheName.match(cacheRegex);

      // We assign a value version deppending if we already have that cache or not
      cacheVersion = cacheVersion != null ? Number(cacheVersion) : cacheVersion;

      // We compare the cache Version to see if we need to clear it or not
      return cacheVersion > 0 && cacheVersion != version;
    }
  });
  console.log(`oldCacheNames`, oldCacheNames);
  return Promise.all(
    oldCacheNames.map((oldCacheName) => {
      return caches.delete(oldCacheName);
    })
  );
}
