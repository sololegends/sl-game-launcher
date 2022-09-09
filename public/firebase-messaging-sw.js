importScripts('https://www.gstatic.com/firebasejs/8.2.7/firebase-app.js')
importScripts('https://www.gstatic.com/firebasejs/8.2.7/firebase-messaging.js')

var firebaseConfig = {
  apiKey: "AIzaSyBdPYcUrMSn7hwjI_XttJiroMBQrhu-uPA",
  authDomain: "workout-together-d680f.firebaseapp.com",
  projectId: "workout-together-d680f",
  storageBucket: "workout-together-d680f.appspot.com",
  messagingSenderId: "1040050026662",
  appId: "1:1040050026662:web:713d2d99e729eaf8eedc67"
};

const app = firebase.initializeApp(firebaseConfig);
app.messaging().getToken({ vapidKey: "BGRKzsGPEJp58VS0Ckq07NPufKC9tGh_iM8L20x4Fjw3Coed3NDgqCIKiHGShC4VHwyyI5DStuOzFDH7yA3Ib-Y" });
// self.addEventListener('push', function(event) {
//   const payload = event.data ? event.data.text() : 'no payload';
//   event.waitUntil(
//     self.registration.showNotification('New Workout Detected', {
//         body: "Go to the workout list to see more",
//     })
//   );
// });
self.addEventListener('fetch', function(event) {
  event.respondWith(async function() {
    try{
      var res = await fetch(event.request);
      var cache = await caches.open('cache');
      cache.put(event.request.url, res.clone());
      return res;
    }
    catch(error){
      return caches.match(event.request);
    }
    }());
});