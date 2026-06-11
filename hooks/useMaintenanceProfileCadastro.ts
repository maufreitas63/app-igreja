import {
  deleteProfileComplete,
  fetchProfileCadastro,
  searchProfilesForCadastroPicker,
  syncProfileAddressFromCep,
  type ProfileCadastroPickerOption,
  type ProfileCadastroRecord,
} from '@/lib/maintenanceProfileCadastroApi';
import { formatCep, lookupViaCep, normalizeCepDigits } from '@/lib/geoMapGeocoding';
import { useCallback, useEffect, useMemo, useState } from 'react';

type CepPreview = {
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

export function useMaintenanceProfileCadastro(enabled: boolean) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileCadastroPickerOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileCadastroRecord | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [cepDraft, setCepDraft] = useState('');
  const [addressNumberDraft, setAddressNumberDraft] = useState('');
  const [addressComplementDraft, setAddressComplementDraft] = useState('');
  const [savingCep, setSavingCep] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cepPreview, setCepPreview] = useState<CepPreview | null>(null);
  const [loadingCepPreview, setLoadingCepPreview] = useState(false);

  const selectedPickerOption = useMemo(
    () => (searchResults ?? []).find((row) => row.id === selectedProfileId) ?? null,
    [searchResults, selectedProfileId]
  );

  const savedCepDigits = useMemo(
    () => normalizeCepDigits(profile?.cep ?? ''),
    [profile?.cep]
  );

  const shouldPreviewCepAddress = useMemo(() => {
    const draftDigits = normalizeCepDigits(cepDraft);

    if (!draftDigits) {
      return false;
    }

    return draftDigits !== savedCepDigits;
  }, [cepDraft, savedCepDigits]);

  const loadProfile = useCallback(async (profileId: string) => {
    setLoadingProfile(true);
    setError(null);

    try {
      const row = await fetchProfileCadastro(profileId);

      if (!row) {
        setProfile(null);
        setCepDraft('');
        setAddressNumberDraft('');
        setAddressComplementDraft('');
        setError('Perfil não encontrado.');
        return;
      }

      setProfile(row);
      setCepDraft(row.cep?.trim() ?? '');
      setAddressNumberDraft(row.address_number?.trim() ?? '');
      setAddressComplementDraft(row.address_complement?.trim() ?? '');
    } catch (err) {
      console.error('Erro ao carregar cadastro:', err);
      setProfile(null);
      setCepDraft('');
      setAddressNumberDraft('');
      setAddressComplementDraft('');
      setError('Não foi possível carregar os dados cadastrais.');
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const clearSelectedUserView = useCallback(() => {
    setSelectedProfileId(null);
    setProfile(null);
    setCepDraft('');
    setAddressNumberDraft('');
    setAddressComplementDraft('');
    setCepPreview(null);
    setLoadingCepPreview(false);
    setLoadingProfile(false);
    setStatusMessage(null);
    setError(null);
  }, []);

  const clearSearchQuery = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearching(false);
  }, []);

  const selectProfile = useCallback(
    async (profileId: string | null) => {
      setSelectedProfileId(profileId);
      setStatusMessage(null);

      if (!profileId) {
        clearSelectedUserView();
        return;
      }

      await loadProfile(profileId);
    },
    [clearSelectedUserView, loadProfile]
  );

  useEffect(() => {
    if (!enabled) {
      setSearchResults([]);
      clearSelectedUserView();
      return;
    }

    const query = searchQuery.trim();

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setSearching(true);

      void searchProfilesForCadastroPicker(query)
        .then((rows) => {
          if (active) {
            setSearchResults(rows ?? []);
          }
        })
        .catch((err) => {
          console.error('Erro ao buscar perfis:', err);

          if (active) {
            setSearchResults([]);
            setError('Não foi possível buscar usuários.');
          }
        })
        .finally(() => {
          if (active) {
            setSearching(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [clearSelectedUserView, enabled, searchQuery]);

  const handleCepDraftChange = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    setCepDraft(digits.length <= 5 ? digits : formatCep(digits));
    setCepPreview(null);
  }, []);

  const clearCepDraft = useCallback(() => {
    setCepDraft('');
    setCepPreview(null);
    setLoadingCepPreview(false);
  }, []);

  useEffect(() => {
    const cepDigits = normalizeCepDigits(cepDraft);

    if (!shouldPreviewCepAddress || !cepDigits) {
      setCepPreview(null);
      setLoadingCepPreview(false);
      return;
    }

    let active = true;
    setLoadingCepPreview(true);

    const timer = setTimeout(() => {
      void lookupViaCep(cepDigits)
        .then((viaCep) => {
          if (!active) {
            return;
          }

          if (!viaCep) {
            setCepPreview(null);
            return;
          }

          setCepPreview({
            street: viaCep.logradouro?.trim() || null,
            neighborhood: viaCep.bairro?.trim() || null,
            city: viaCep.localidade?.trim() || null,
            state: viaCep.uf?.trim() || null,
          });
        })
        .catch(() => {
          if (active) {
            setCepPreview(null);
          }
        })
        .finally(() => {
          if (active) {
            setLoadingCepPreview(false);
          }
        });
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cepDraft, shouldPreviewCepAddress]);

  const saveCepAndAddress = useCallback(async () => {
    if (!selectedProfileId) {
      setError('Selecione um usuário.');
      return { success: false as const, message: 'Selecione um usuário.' };
    }

    setSavingCep(true);
    setError(null);
    setStatusMessage(null);

    try {
      const updated = await syncProfileAddressFromCep(selectedProfileId, {
        cep: cepDraft,
        addressNumber: addressNumberDraft,
        addressComplement: addressComplementDraft,
      });

      if (!updated) {
        return {
          success: false as const,
          message: 'Não foi possível confirmar a atualização do endereço.',
        };
      }

      setProfile(updated);
      setCepDraft(updated.cep?.trim() ?? cepDraft);
      setAddressNumberDraft(updated.address_number?.trim() ?? addressNumberDraft);
      setAddressComplementDraft(updated.address_complement?.trim() ?? addressComplementDraft);
      setCepPreview(null);
      setStatusMessage('CEP e endereço gravados em profiles (rua, bairro, cidade e estado).');

      return { success: true as const, message: 'Endereço atualizado com sucesso.' };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível atualizar o CEP e o endereço.';

      setError(message);

      return { success: false as const, message };
    } finally {
      setSavingCep(false);
    }
  }, [addressComplementDraft, addressNumberDraft, cepDraft, selectedProfileId]);

  const deleteSelectedUser = useCallback(async () => {
    if (!selectedProfileId) {
      return { success: false as const, message: 'Selecione um usuário.' };
    }

    setDeletingUser(true);
    setError(null);
    setStatusMessage(null);

    try {
      const result = await deleteProfileComplete(selectedProfileId);

      if (!result.success) {
        setError(result.message);
        return result;
      }

      setSearchResults((current) => current.filter((row) => row.id !== selectedProfileId));
      clearSearchQuery();
      clearSelectedUserView();
      setStatusMessage(result.message);

      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível excluir o usuário.';

      setError(message);

      return { success: false as const, message };
    } finally {
      setDeletingUser(false);
    }
  }, [clearSearchQuery, clearSelectedUserView, selectedProfileId]);

  return {
    searchQuery,
    setSearchQuery,
    clearSearchQuery,
    clearSelectedUserView,
    searchResults,
    searching,
    selectedProfileId,
    selectedPickerOption,
    profile,
    loadingProfile,
    cepDraft,
    handleCepDraftChange,
    clearCepDraft,
    shouldPreviewCepAddress,
    addressNumberDraft,
    setAddressNumberDraft,
    addressComplementDraft,
    setAddressComplementDraft,
    savingCep,
    deletingUser,
    cepPreview,
    loadingCepPreview,
    error,
    statusMessage,
    selectProfile,
    saveCepAndAddress,
    deleteSelectedUser,
    reloadProfile: () => {
      if (selectedProfileId) {
        void loadProfile(selectedProfileId);
      }
    },
  };
}
