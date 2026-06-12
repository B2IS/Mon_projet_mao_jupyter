import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserSignature {
  userId: string;   // email du profil
  displayName: string;
  poste: string;
  direction: string;
  dataUrl: string;  // canvas PNG base64 ou SVG data-uri
  createdAt: string;
}

interface SignatureState {
  signatures: Record<string, UserSignature>;
  setSignature: (sig: UserSignature) => void;
  getSignature: (userId: string) => UserSignature | null;
  clearSignature: (userId: string) => void;
}

export const useSignatureStore = create<SignatureState>()(
  persist(
    (set, get) => ({
      signatures: {},
      setSignature: (sig) =>
        set(state => ({ signatures: { ...state.signatures, [sig.userId]: sig } })),
      getSignature: (userId) => get().signatures[userId] ?? null,
      clearSignature: (userId) =>
        set(state => {
          const sigs = { ...state.signatures };
          delete sigs[userId];
          return { signatures: sigs };
        }),
    }),
    { name: 'sigepp-signatures-v1' }
  )
);
