import {initializeApp} from 'firebase/app'
import {GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut, type User} from 'firebase/auth'
import {doc, getDocFromServer, getFirestore} from 'firebase/firestore'

interface FirebaseAppletConfig {
	apiKey?: string
	authDomain?: string
	projectId?: string
	storageBucket?: string
	messagingSenderId?: string
	appId?: string
	measurementId?: string
	firestoreDatabaseId?: string
}

function loadFirebaseConfig(): Required<Pick<FirebaseAppletConfig, 'apiKey' | 'authDomain' | 'projectId' | 'appId'>> &
	FirebaseAppletConfig {
	let jsonConfig: FirebaseAppletConfig = {}
	try {
		const globbed = import.meta.glob('../../firebase-applet-config.json', {eager: true}) as Record<
			string,
			{default?: FirebaseAppletConfig} | FirebaseAppletConfig
		>
		const firstEntry = Object.values(globbed)[0]
		if (firstEntry && typeof firstEntry === 'object') {
			jsonConfig =
				'default' in firstEntry && firstEntry.default && typeof firstEntry.default === 'object'
					? firstEntry.default
					: (firstEntry as FirebaseAppletConfig)
		}
	} catch {
		// Fallback to environment variables when import.meta.glob is unavailable
	}

	const env = (import.meta as {env?: Record<string, string | undefined>}).env ?? {}

	return {
		apiKey: env.VITE_FIREBASE_API_KEY || jsonConfig.apiKey || 'demo-api-key',
		authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || jsonConfig.authDomain || 'demo-project.firebaseapp.com',
		projectId: env.VITE_FIREBASE_PROJECT_ID || jsonConfig.projectId || 'demo-project',
		storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || jsonConfig.storageBucket || '',
		messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || jsonConfig.messagingSenderId || '',
		appId: env.VITE_FIREBASE_APP_ID || jsonConfig.appId || '1:000000000000:web:000000000000',
		measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || jsonConfig.measurementId || '',
		firestoreDatabaseId: env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || jsonConfig.firestoreDatabaseId || '(default)',
	}
}

export const firebaseConfig = loadFirebaseConfig()

const app = initializeApp(firebaseConfig)
export const db = getFirestore(
	app,
	firebaseConfig.firestoreDatabaseId,
) /* CRITICAL: The app will break without this line */
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

export enum OperationType {
	CREATE = 'create',
	UPDATE = 'update',
	DELETE = 'delete',
	LIST = 'list',
	GET = 'get',
	WRITE = 'write',
}

export interface FirestoreErrorInfo {
	error: string
	operationType: OperationType
	path: string | null
	authInfo: {
		userId?: string | null
		email?: string | null
		emailVerified?: boolean | null
		isAnonymous?: boolean | null
		tenantId?: string | null
		providerInfo?: {
			providerId?: string | null
			email?: string | null
		}[]
	}
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
	const errInfo: FirestoreErrorInfo = {
		error: error instanceof Error ? error.message : String(error),
		authInfo: {
			userId: auth.currentUser?.uid,
			email: auth.currentUser?.email,
			emailVerified: auth.currentUser?.emailVerified,
			isAnonymous: auth.currentUser?.isAnonymous,
			tenantId: auth.currentUser?.tenantId,
			providerInfo:
				auth.currentUser?.providerData?.map((provider) => ({
					providerId: provider.providerId,
					email: provider.email,
				})) || [],
		},
		operationType,
		path,
	}
	console.error('Firestore Error: ', JSON.stringify(errInfo))
	throw new Error(JSON.stringify(errInfo))
}

async function testConnection() {
	try {
		await getDocFromServer(doc(db, 'rooms', 'TEST00'))
	} catch (error) {
		if (error instanceof Error && error.message.includes('the client is offline')) {
			console.error('Please check your Firebase configuration.')
		}
	}
}

if (typeof window !== 'undefined') {
	testConnection()
}

export async function signInWithGoogle(): Promise<User> {
	const result = await signInWithPopup(auth, googleProvider)
	return result.user
}

export async function signOutUser(): Promise<void> {
	await signOut(auth)
}

export function subscribeAuth(callback: (user: User | null) => void): () => void {
	return onAuthStateChanged(auth, callback)
}
