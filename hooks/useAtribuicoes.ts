import {
  ATRIBUICOES_PAGE_SIZE,
  listAtribuicaoProfiles,
  listAtribuicaoRoles,
  setAtribuicaoRoleAssignment,
  type AtribuicaoProfile,
  type AtribuicaoRole,
} from '@/lib/atribuicoesApi';
import { useCallback, useEffect, useRef, useState } from 'react';

const SEARCH_DEBOUNCE_MS = 250;

export function useAtribuicoes(isActive: boolean) {
  const [roles, setRoles] = useState<AtribuicaoRole[]>([]);
  const [selectedRoleCode, setSelectedRoleCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<AtribuicaoProfile[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);
  const selectedRoleRef = useRef('');
  const searchQueryRef = useRef('');

  useEffect(() => {
    selectedRoleRef.current = selectedRoleCode;
  }, [selectedRoleCode]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true);
    setError(null);

    try {
      const rows = await listAtribuicaoRoles();
      setRoles(rows);
      setSelectedRoleCode((current) => {
        if (current && rows.some((role) => role.code === current)) {
          return current;
        }

        return rows[0]?.code ?? '';
      });
    } catch (loadError) {
      setRoles([]);
      setSelectedRoleCode('');
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os papéis.');
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  const loadPage = useCallback(
    async (roleCode: string, query: string, offset: number, append: boolean) => {
      if (!roleCode) {
        setProfiles([]);
        setHasMore(false);
        return;
      }

      const seq = ++requestSeqRef.current;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoadingList(true);
      }

      setError(null);

      try {
        const result = await listAtribuicaoProfiles({
          roleCode,
          query,
          offset,
          limit: ATRIBUICOES_PAGE_SIZE,
        });

        if (seq !== requestSeqRef.current || selectedRoleRef.current !== roleCode) {
          return;
        }

        setHasMore(result.hasMore);
        setProfiles((current) => (append ? [...current, ...result.rows] : result.rows));
      } catch (loadError) {
        if (seq !== requestSeqRef.current) {
          return;
        }

        if (!append) {
          setProfiles([]);
          setHasMore(false);
        }

        setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar a lista.');
      } finally {
        if (seq === requestSeqRef.current) {
          setLoadingList(false);
          setLoadingMore(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void loadRoles();
  }, [isActive, loadRoles]);

  useEffect(() => {
    if (!isActive || !selectedRoleCode) {
      return;
    }

    void loadPage(selectedRoleCode, searchQueryRef.current, 0, false);
  }, [isActive, loadPage, selectedRoleCode]);

  useEffect(() => {
    if (!isActive || !selectedRoleCode) {
      return;
    }

    const handle = setTimeout(() => {
      void loadPage(selectedRoleCode, searchQuery, 0, false);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [isActive, loadPage, searchQuery]);

  const changeRole = useCallback((roleCode: string) => {
    requestSeqRef.current += 1;
    selectedRoleRef.current = roleCode;
    setSelectedRoleCode(roleCode);
    setProfiles([]);
    setHasMore(false);
    setError(null);
  }, []);

  const loadMore = useCallback(() => {
    if (!selectedRoleCode || loadingList || loadingMore || !hasMore) {
      return;
    }

    void loadPage(selectedRoleCode, searchQuery, profiles.length, true);
  }, [hasMore, loadPage, loadingList, loadingMore, profiles.length, searchQuery, selectedRoleCode]);

  const toggleAssignment = useCallback(
    async (profileId: string, assigned: boolean) => {
      const roleCode = selectedRoleRef.current;

      if (!roleCode) {
        return { success: false as const, message: 'Selecione um papel.' };
      }

      const previous = profiles.find((row) => row.id === profileId)?.assigned;
      setSavingProfileId(profileId);
      setProfiles((current) =>
        current.map((row) => (row.id === profileId ? { ...row, assigned } : row))
      );

      try {
        const result = await setAtribuicaoRoleAssignment(profileId, roleCode, assigned);

        if (selectedRoleRef.current !== roleCode) {
          return result;
        }

        if (!result.success) {
          setProfiles((current) =>
            current.map((row) =>
              row.id === profileId ? { ...row, assigned: previous === true } : row
            )
          );
        } else if (typeof result.assigned === 'boolean') {
          setProfiles((current) =>
            current.map((row) =>
              row.id === profileId ? { ...row, assigned: result.assigned === true } : row
            )
          );
        }

        return result;
      } catch (saveError) {
        if (selectedRoleRef.current === roleCode) {
          setProfiles((current) =>
            current.map((row) =>
              row.id === profileId ? { ...row, assigned: previous === true } : row
            )
          );
        }

        return {
          success: false as const,
          message: saveError instanceof Error ? saveError.message : 'Não foi possível salvar.',
        };
      } finally {
        setSavingProfileId((current) => (current === profileId ? null : current));
      }
    },
    [profiles]
  );

  return {
    roles,
    selectedRoleCode,
    changeRole,
    searchQuery,
    setSearchQuery,
    profiles,
    loadingRoles,
    loadingList,
    loadingMore,
    hasMore,
    savingProfileId,
    error,
    loadMore,
    toggleAssignment,
  };
}
