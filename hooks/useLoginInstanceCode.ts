import {
  applyValidatedInstance,
  capturePreferredIgrejaCodeFromLocation,
  clearValidatedInstance,
  getPreferredIgrejaCode,
  getStoredActiveIgrejaBranding,
  INSTANCE_CODE_NOT_FOUND_MESSAGE,
  lookupIgrejaByCode,
  normalizeInstanceCode,
  parseInstanceCodeFromUrl,
  type PublicIgrejaLookup,
} from '@/lib/tenantSession';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';

type UseLoginInstanceCodeOptions = {
  igrejaParam?: string | string[] | null;
  codigoParam?: string | string[] | null;
};

export function useLoginInstanceCode({
  igrejaParam,
  codigoParam,
}: UseLoginInstanceCodeOptions) {
  const [instanceCode, setInstanceCodeState] = useState('');
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [isInstanceValid, setIsInstanceValid] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [instanceError, setInstanceError] = useState<string | null>(null);
  const [hasStoredInstance, setHasStoredInstance] = useState(false);
  const instanceInputRef = useRef<TextInput>(null);
  const instanceCodeRef = useRef('');
  const validatingRef = useRef(false);

  instanceCodeRef.current = instanceCode;

  const applyChurch = useCallback((church: PublicIgrejaLookup) => {
    setInstanceCodeState(church.code);
    setInstanceName(church.name?.trim() || church.code);
    setIsInstanceValid(true);
    setHasStoredInstance(true);
    setInstanceError(null);
  }, []);

  const validateInstance = useCallback(
    async (rawCode?: string): Promise<boolean> => {
      const normalized = normalizeInstanceCode(rawCode ?? instanceCodeRef.current);
      if (!normalized) {
        setIsInstanceValid(false);
        setInstanceName(null);
        setInstanceError(null);
        return false;
      }

      if (validatingRef.current) {
        return false;
      }

      validatingRef.current = true;
      setIsValidating(true);
      try {
        const church = await lookupIgrejaByCode(normalized);
        if (!church) {
          await clearValidatedInstance();
          setInstanceCodeState('');
          setInstanceName(null);
          setIsInstanceValid(false);
          setHasStoredInstance(false);
          setInstanceError(INSTANCE_CODE_NOT_FOUND_MESSAGE);
          return false;
        }

        await applyValidatedInstance(church);
        applyChurch(church);
        return true;
      } catch (error) {
        console.warn('lookup_igreja_by_code:', error);
        setIsInstanceValid(false);
        setInstanceError(
          'Não foi possível validar o código da instância. Verifique a conexão e tente novamente.'
        );
        return false;
      } finally {
        validatingRef.current = false;
        setIsValidating(false);
      }
    },
    [applyChurch]
  );

  const hydrateFromSources = useCallback(async () => {
    const fromCodigo = Array.isArray(codigoParam) ? codigoParam[0] : codigoParam;
    const fromIgreja = Array.isArray(igrejaParam) ? igrejaParam[0] : igrejaParam;
    const fromRoute = normalizeInstanceCode(fromCodigo || fromIgreja || '');
    const fromLocation = await capturePreferredIgrejaCodeFromLocation(fromIgreja || fromCodigo);
    let fromLink: string | null = null;
    try {
      fromLink = parseInstanceCodeFromUrl(await Linking.getInitialURL());
    } catch {
      fromLink = null;
    }
    const storedCode = await getPreferredIgrejaCode();
    const storedBranding = await getStoredActiveIgrejaBranding();
    const nextCode = fromRoute || fromLocation || fromLink || storedCode || storedBranding?.code || '';

    if (!nextCode) {
      return;
    }

    setInstanceCodeState(nextCode);
    setHasStoredInstance(Boolean(storedCode || storedBranding?.code));
    await validateInstance(nextCode);
  }, [codigoParam, igrejaParam, validateInstance]);

  useFocusEffect(
    useCallback(() => {
      void hydrateFromSources();
    }, [hydrateFromSources])
  );

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const code = parseInstanceCodeFromUrl(url);
      if (!code) {
        return;
      }
      setInstanceCodeState(code);
      void validateInstance(code);
    });
    return () => {
      subscription.remove();
    };
  }, [validateInstance]);

  const handleInstanceCodeChange = useCallback((text: string) => {
    const normalized = normalizeInstanceCode(text);
    setInstanceCodeState(normalized);
    setIsInstanceValid(false);
    setInstanceName(null);
    setInstanceError(null);
  }, []);

  const handleInstanceBlur = useCallback(() => {
    if (!normalizeInstanceCode(instanceCodeRef.current)) {
      return;
    }
    void validateInstance(instanceCodeRef.current);
  }, [validateInstance]);

  const beginChangeInstance = useCallback(() => {
    void clearValidatedInstance();
    setInstanceCodeState('');
    setInstanceName(null);
    setIsInstanceValid(false);
    setHasStoredInstance(false);
    setInstanceError(null);
    requestAnimationFrame(() => {
      instanceInputRef.current?.focus();
    });
  }, []);

  return {
    instanceCode,
    instanceName,
    isInstanceValid,
    isValidating,
    instanceError,
    hasStoredInstance,
    instanceInputRef,
    handleInstanceCodeChange,
    handleInstanceBlur,
    validateInstance,
    beginChangeInstance,
  };
}
