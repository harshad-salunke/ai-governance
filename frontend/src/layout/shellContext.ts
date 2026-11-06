import { createContext, useContext } from 'react';

export interface ShellApi {
  /** Opens PolicyPilot, optionally pre-selecting an agent or tool (P3-PPL-01). */
  openPilot: (target?: { kind: 'agent' | 'tool'; id: string }) => void;
  openSearch: () => void;
}

export const ShellContext = createContext<ShellApi>({ openPilot: () => {}, openSearch: () => {} });
export const useShell = () => useContext(ShellContext);
