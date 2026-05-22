import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth } from './firebase';

export enum ActivityAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  SALE = 'SALE',
  IMPORT = 'IMPORT'
}

export const logActivity = async (action: ActivityAction, details: string) => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, 'activities'), {
      userId: user.uid,
      userName: user.displayName || user.email || 'Usuario Desconocido',
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};
