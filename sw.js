importScripts('./js/idb.js');
importScripts('./js/dbhelper.js');

const staticCacheName = 'rr-static-v1';


self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(staticCacheName).then(function(cache) {
            return cache.addAll(
                [
                    './index.html',
                    './restaurant.html',
                    './manifest.json',
                    './favicon.ico',
                    './sw.js',
                    './js/main.js',
                    './js/restaurant_info.js',
                    './js/idb.js',
                    './js/dbhelper.js',
                    './css/main.css',
                    './css/restaurant_info.css',
                    './img/1.webp',
                    './img/2.webp',
                    './img/3.webp',
                    './img/4.webp',
                    './img/5.webp',
                    './img/6.webp',
                    './img/7.webp',
                    './img/8.webp',
                    './img/9.webp',
                    './img/10.webp',
                ]
            );
        })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.filter(function(cacheName) {
                    return cacheName.startsWith('rr-') && cacheName !== staticCacheName;
                }).map(function(cacheName) {
                    return caches.delete(cacheName);
                })
            );
        })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.open(staticCacheName).then(function(cache) {
            return cache.match(event.request).then(function (response) {
                return response || fetch(event.request).then(function(response) {
                    cache.put(event.request, response.clone());
                    return response;
                });
            });
        })
    );
});

self.addEventListener('sync', function (event) {
  console.log('Sync event fired');

  if (event.tag === 'post-review') {
    event.waitUntil(
      DBHelper.dbPromise().then(function(db) {
        if (!db) return;

        const tx = db.transaction('delayed-reviews');
        const store = tx.objectStore('delayed-reviews');
        return store.getAll();
      }).then(reviews => {
        return postReviews(reviews);
      }).catch(err => console.error(err))
    );
  }

  if (event.tag.startsWith('favorite')) {
    const dataString = event.tag.substring(9);
    let [restaurant_id, is_favorite] = dataString.split('&');

    event.waitUntil(
      toggleFavorite(restaurant_id, is_favorite)
        .catch(err => console.error(err))
    );
  }
});

postReviews = reviews => {
  return Promise.all(reviews.map(review => {
    const {restaurant_id, name, rating, comments} = review;
    return fetch('http://localhost:1337/reviews/', {
      method: 'POST',
      body: JSON.stringify({restaurant_id, name, rating, comments}),
      headers: new Headers({
        'Content-Type': 'application/json'
      })
    }).then(response => {
      if (response.status === 201) {
        console.log('Posted synced review successfully ', response);

        response.json().then(function(review) {
          DBHelper.dbPromise().then(function(db) {
            if (!db) return;

            const tx = db.transaction('reviews', 'readwrite');
            const store = tx.objectStore('reviews');
            store.put(review);
          });
        });

        DBHelper.dbPromise().then(function(db) {
          if (!db) return;

          const tx = db.transaction('delayed-reviews', 'readwrite');
          const store = tx.objectStore('delayed-reviews');
          store.delete(review.id);
        });
      } else console.log('Looks like there was a problem. Status Code: ' + response.status);
    })
  }));
};

toggleFavorite = (restaurant_id, is_favorite) => {
  return fetch(`http://localhost:1337/restaurants/${restaurant_id}/?is_favorite=${is_favorite}`, {method: 'PUT'})
    .then(response => {
      if (response.status === 200) {
        console.log('Put synced toggle favorite successfully ', response);
      } else console.log('Looks like there was a problem. Status Code: ' + response.status);
    })
};
