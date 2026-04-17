/**
 * DeployModeContext – React context exposing the deployment mode to components.
 */

import { createContext, useContext } from 'react';
import type { DeployMode } from './deployMode';
import { DEPLOY_MODE } from './deployMode';

export interface DeployModeValue {
  mode: DeployMode;
  isConnected: boolean;
  isStatic: boolean;
}

const value: DeployModeValue = {
  mode: DEPLOY_MODE,
  isConnected: DEPLOY_MODE === 'connected',
  isStatic: DEPLOY_MODE === 'static',
};

export const DeployModeContext = createContext<DeployModeValue>(value);

export function useDeployMode(): DeployModeValue {
  return useContext(DeployModeContext);
}

export function DeployModeProvider({ children }: { children: React.ReactNode }) {
  return (
    <DeployModeContext.Provider value={value}>
      {children}
    </DeployModeContext.Provider>
  );
}
