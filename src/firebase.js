import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';
import 'firebase/storage';

const firebaseConfig = {
	apiKey: 'AIzaSyBcZf-R9kTTDKVeuUXvU0je8h4oyVnTi3Y',
	authDomain: 'react-slack-clone-b4d07.firebaseapp.com',
	databaseURL: 'https://react-slack-clone-b4d07.firebaseio.com',
	projectId: 'react-slack-clone-b4d07',
	storageBucket: 'react-slack-clone-b4d07.appspot.com',
	messagingSenderId: '9698217115',
	appId: '1:9698217115:web:49b3a096717f7f4f26ca3e',
	measurementId: 'G-C2R4WV0QZ6'
};

firebase.initializeApp(firebaseConfig);

export default firebase;
