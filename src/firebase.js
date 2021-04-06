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

const provider = new firebase.auth.GithubAuthProvider();

export function init(dispatcher) {
  const circles = firebase.database().ref('circles/BrainWeb');
  circles.on('value', async (s) => {
    const people = s.val();
    if (people === null) {
      return;
    }

    const skills = [];

    Object.keys(people).forEach((id) => {
      const p = people[id];
      if (typeof p.skills === 'undefined') {
        p.skills = [];
      }
      if (typeof p.displayname === 'undefined') {
        p.displayname = p.username;
      }
      p.skills.forEach((skill) => {
        if (!skills.includes(skill)) {
          skills.push(skill);
        }
      });
    });

    dispatcher.dispatch('data', { people, skills });
  });

  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      const { photoURL, providerData } = user;
      let { displayName } = user;
      const { uid } = providerData[0];
      if (uid === undefined || uid === null) {
        dispatcher.dispatch('authError', {
          error: new Error('UID not present.'),
        });
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
    signIn: () => {
      firebase.auth().signInWithPopup(provider)
        .then((result) => {
          const { user, credential } = result;
          dispatcher.dispatch('signIn', { user, credential });
        })
        .catch((error) => {
          dispatcher.dispatch('signInError', { error });
        });
    },
    signOut: () => {
      firebase.auth().signOut();
      dispatcher.dispatch('signOut', {});
    },
    update: ({ userName, displayName, skills }) => {
      const logged = firebase.auth().currentUser;
      if (logged === null) {
        dispatcher.dispatch('updateError', {
          error: new Error('Not logged.'),
        });
        return;
      }
      const uid = logged.providerData[0] && logged.providerData[0].uid;
      if (uid === undefined || uid === null) {
        dispatcher.dispatch('updateError', {
          error: new Error('Not logged.'),
        });
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

export default {
  init,
};
