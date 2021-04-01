import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';

firebase.initializeApp({
  apiKey: 'AIzaSyD1q8d3i0jikA5jRQKcDydFbIw8v2bFRc0',
  authDomain: 'cartographer-a6f04.firebaseapp.com',
  databaseURL: 'https://cartographer-a6f04.firebaseio.com',
  projectId: 'cartographer-a6f04',
  storageBucket: '',
  messagingSenderId: '489953549172',
});

async function fetchFromGithub(uid) {
  const res = await fetch(`https://api.github.com/user/${uid}`);
  const json = await res.json();
  return json;
}

export function init(dispatcher) {
  // const uiAuth = new firebaseui.auth.AuthUI(firebase.auth());

  const circles = firebase.database().ref('circles/BrainWeb');
  circles.on('value', async (s) => {
    const data = s.val();
    if (data === null) {
      return;
    }
    dispatcher.dispatch('data', data);
  });

  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      const { photoURL, providerData } = user;
      let { displayName } = user;
      const { uid } = providerData[0];
      if (uid === undefined || uid === null) {
        dispatcher.dispatch('authError', { error: new Error('UID not present.') });
        return;
      }
      if (!displayName) {
        const json = await fetchFromGithub(uid);
        displayName = json.login;
      }

      dispatcher.dispatch('auth', {
        logged: true, uid, displayName, photoURL,
      });
    } else {
      dispatcher.dispatch('auth', {
        logged: false,
      });
    }
  }, (error) => {
    dispatcher.dispatch('authError', { error });
  });

  return {
    signIn: (signInSuccessUrl) => {
      // uiAuth.start(containerId, {
      //   signInSuccessUrl,
      //   signInOptions: [
      //     firebase.auth.GithubAuthProvider.PROVIDER_ID,
      //   ],
      //   signInFlow: 'popup',
      //   tosUrl: 'tos.html',
      // });
      dispatcher.dispatch('signIn', { signInSuccessUrl });
    },
    signOut: () => {
      firebase.auth().signOut();
      dispatcher.dispatch('signOut', {});
    },
    update: ({ userName, displayName, skills }) => {
      const logged = firebase.auth().currentUser;
      if (logged === null) {
        dispatcher.dispatch('updateError', { error: new Error('Not logged.') });
        return;
      }
      const uid = logged.providerData[0] && logged.providerData[0].uid;
      if (uid === undefined || uid === null) {
        dispatcher.dispatch('updateError', { error: new Error('Not logged.') });
        return;
      }
      circles
        .update({
          [uid]: {
            username: userName,
            displayname: displayName,
            skills,
          },
        })
        .then(
          () => {
            dispatcher.dispatch('updateSuccess', {});
          },
          (error) => {
            dispatcher.dispatch('updateError', { error });
          },
        );
    },
  };
}
