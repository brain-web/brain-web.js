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
      const { providerData } = user;
      let { displayName: displayname } = user;
      const { uid } = providerData[0];
      if (uid === undefined || uid === null) {
        dispatcher.dispatch('auth', {
          error: new Error('UID not present.'),
        });
        return;
      }
      const json = await fetchFromGithub(uid);
      const username = json.login;

      if (!displayname) {
        displayname = username;
      }

      dispatcher.dispatch('auth', {
        logged: true, uid, username, displayname,
      });
    } else {
      dispatcher.dispatch('auth', {
        logged: false,
      });
    }
  }, (error) => {
    dispatcher.dispatch('auth', { error });
  });

  return {
    signIn: () => {
      firebase.auth().signInWithPopup(provider)
        .catch((error) => {
          dispatcher.dispatch('auth', { error });
        });
    },
    signOut: () => {
      firebase.auth().signOut();
    },
    update: ({ username, displayname, skills }) => {
      const logged = firebase.auth().currentUser;
      if (logged === null) {
        dispatcher.dispatch('update', {
          error: new Error('Not logged.'),
        });
        return;
      }
      const uid = logged.providerData[0] && logged.providerData[0].uid;
      if (uid === undefined || uid === null) {
        dispatcher.dispatch('update', {
          error: new Error('Not logged.'),
        });
        return;
      }
      circles
        .update({
          [uid]: {
            username: username,
            displayname: displayname,
            skills,
          },
        })
        .then(
          () => {
            dispatcher.dispatch('update', {});
          },
          (error) => {
            dispatcher.dispatch('update', { error });
          },
        );
    },
  };
}

export default {
  init,
};
